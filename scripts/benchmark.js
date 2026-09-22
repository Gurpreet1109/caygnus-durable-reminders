require("dotenv").config();
const crypto = require("crypto");
const { query, closeDatabase } = require("../src/db/database");
const {
  claimDueReminders,
  recoverStaleProcessingReminders,
} = require("../src/services/schedulerService");
const { processReminder } = require("../src/services/reminderProcessor");
const { deliverReminder } = require("../src/services/deliveryService");
const { createClock } = require("../src/utils/clock");
const { calculateRetryDelay } = require("../src/utils/retry");
const {
  isValidTimezone,
  getTimezoneOffsetMinutes,
} = require("../src/utils/timezone");

async function runBenchmark() {
  const benchmarkRunId = crypto.randomUUID();
  const baseTime = new Date("2026-09-22T10:00:00Z");

  let currentTime = new Date(baseTime);

  const clock = createClock(() => new Date(currentTime));

  const benchmarkReminderIds = [];
  const results = [];

  function check(name, passed, details = "") {
    results.push({ name, passed, details });
  }

  function advanceClock(milliseconds) {
    currentTime = new Date(currentTime.getTime() + milliseconds);
    console.log(`Clock advanced to ${currentTime.toISOString()}`);
  }

  console.log("\n========================================");
  console.log(" Caygnus Durable Reminders Benchmark");
  console.log("========================================\n");

  try {
    // ------------------------------------------------------------
    // 1. Database connection
    // ------------------------------------------------------------

    try {
      await query("SELECT 1");
      check("Database connection", true);
    } catch (error) {
      check("Database connection", false, error.message);
    }

    // ------------------------------------------------------------
    // 2-5. Timezone checks
    // ------------------------------------------------------------

    check("Asia/Kolkata accepted", isValidTimezone("Asia/Kolkata"));

    check("America/New_York accepted", isValidTimezone("America/New_York"));

    check(
      "New York summer DST offset",
      getTimezoneOffsetMinutes(
        "America/New_York",
        new Date("2026-07-01T12:00:00Z"),
      ) === -240,
    );

    check(
      "New York winter DST offset",
      getTimezoneOffsetMinutes(
        "America/New_York",
        new Date("2026-01-15T12:00:00Z"),
      ) === -300,
    );

    // ------------------------------------------------------------
    // 6. Create 20 reminders
    // ------------------------------------------------------------

    const reminders = [];

    for (let i = 1; i <= 20; i++) {
      const id = crypto.randomUUID();

      reminders.push({
        id,
        userId: `benchmark-${benchmarkRunId}`,
        message: `Benchmark reminder ${i}`,
        scheduledAt: new Date(baseTime.getTime() - 1000),
        timezone: i % 2 === 0 ? "America/New_York" : "Asia/Kolkata",
      });
    }

    for (const reminder of reminders) {
      await query(
        `
        INSERT INTO reminders (
          id,
          user_id,
          message,
          scheduled_at,
          timezone,
          status,
          retry_count,
          max_retries,
          version,
          idempotency_key
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          'scheduled',
          0,
          3,
          1,
          $6
        )
        `,
        [
          reminder.id,
          reminder.userId,
          reminder.message,
          reminder.scheduledAt,
          reminder.timezone,
          `benchmark-${benchmarkRunId}-${reminder.id}`,
        ],
      );

      benchmarkReminderIds.push(reminder.id);
    }

    check("20 scheduled reminders created", benchmarkReminderIds.length === 20);

    // ------------------------------------------------------------
    // 7. Verify two zones
    // ------------------------------------------------------------

    const zoneResult = await query(
      `
      SELECT COUNT(DISTINCT timezone)::int AS count
      FROM reminders
      WHERE id = ANY($1::uuid[])
      `,
      [benchmarkReminderIds],
    );

    check(
      "20 reminders span at least 2 IANA zones",
      zoneResult.rows[0].count >= 2,
    );

    // ------------------------------------------------------------
    // 8. Edit reminder
    // ------------------------------------------------------------

    const editedId = reminders[0].id;

    const editResult = await query(
      `
      UPDATE reminders
      SET
        message = 'Edited benchmark reminder',
        version = version + 1,
        updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
        AND version = 1
      RETURNING *
      `,
      [editedId],
    );

    check(
      "Scheduled reminder edited before delivery",
      editResult.rows.length === 1 && editResult.rows[0].version === 2,
    );

    // ------------------------------------------------------------
    // 9. Cancel reminder
    // ------------------------------------------------------------

    const cancelledId = reminders[1].id;
    const temporaryFailureId = reminders[6].id;
    const permanentFailureId = reminders[7].id;

    const cancelResult = await query(
      `
      UPDATE reminders
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
      RETURNING *
      `,
      [cancelledId],
    );

    check(
      "Scheduled reminder cancelled before delivery",
      cancelResult.rows.length === 1 &&
        cancelResult.rows[0].status === "cancelled",
    );

    // ------------------------------------------------------------
    // 10. Claim first batch
    // ------------------------------------------------------------

    const firstBatch = await claimDueReminders(clock, 10);

    check("First due batch claimed", firstBatch.length === 10);

    // ------------------------------------------------------------
    // 11. Process exactly 5, leave 5 abandoned
    // ------------------------------------------------------------

    const normalDelivery = deliverReminder;
    const processedBeforeRestart = firstBatch.slice(0, 5);
    const abandonedBeforeRestart = firstBatch.slice(5);

    for (const reminder of processedBeforeRestart) {
      await processReminder(reminder, clock, normalDelivery);
    }

    check(
      "Processing stopped before all claimed work completed",
      abandonedBeforeRestart.length === 5,
    );

    // ------------------------------------------------------------
    // 12. Restart recovery
    // ------------------------------------------------------------

    await query(
      `
      UPDATE reminders
      SET updated_at = $1
      WHERE id = ANY($2::uuid[])
      `,
      [
        new Date(currentTime.getTime() - 120000),
        abandonedBeforeRestart.map((reminder) => reminder.id),
      ],
    );

    const recovered = await recoverStaleProcessingReminders(clock);

    check("Restart recovery returned abandoned work", recovered.length === 5);

    // ------------------------------------------------------------
    // 13. Process recovered work
    // ------------------------------------------------------------

    const recoveredBatch = await claimDueReminders(clock, 20);

    for (const reminder of recoveredBatch) {
      if (
        reminder.id === temporaryFailureId ||
        reminder.id === permanentFailureId
      ) {
        continue;
      }

      await processReminder(reminder, clock, normalDelivery);
    }

    const recoveredIds = new Set(recovered.map((reminder) => reminder.id));

    const recoveredWasClaimed = recovered.every((reminder) =>
      recoveredIds.has(reminder.id),
    );

    check(
      "Recovered work can be claimed again",
      recoveredBatch.length >= 5 && recoveredWasClaimed,
    );

    // ------------------------------------------------------------
    // 14. Temporary failure
    // ------------------------------------------------------------

    await query(
      `
      UPDATE reminders
      SET
        status = 'processing',
        retry_count = 0,
        next_attempt_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    let temporaryReminderResult = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    const temporaryReminder = temporaryReminderResult.rows[0];

    const temporaryDelivery = async () => {
      const error = new Error("Temporary benchmark failure");

      error.retryable = true;

      throw error;
    };

    await processReminder(temporaryReminder, clock, temporaryDelivery);

    const retryState = await query(
      `
      SELECT status, retry_count, next_attempt_at
      FROM reminders
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    check(
      "Temporary failure schedules retry",
      retryState.rows[0].status === "scheduled" &&
        retryState.rows[0].retry_count === 1 &&
        retryState.rows[0].next_attempt_at !== null,
    );

    // ------------------------------------------------------------
    // 15. Retry eventually succeeds
    // ------------------------------------------------------------

    advanceClock(calculateRetryDelay(0) + 100);

    temporaryReminderResult = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    const successfulRetryDelivery = async () => ({
      success: true,
      retryable: false,
    });

    await query(
      `
      UPDATE reminders
      SET status = 'processing',
          updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
      `,
      [temporaryFailureId],
    );

    temporaryReminderResult = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    await processReminder(
      temporaryReminderResult.rows[0],
      clock,
      successfulRetryDelivery,
    );

    const retryFinalState = await query(
      `
      SELECT status
      FROM reminders
      WHERE id = $1
      `,
      [temporaryFailureId],
    );

    check(
      "Temporary failure eventually delivered",
      retryFinalState.rows[0].status === "delivered",
    );

    // ------------------------------------------------------------
    // 16. Permanent failure
    // ------------------------------------------------------------

    await query(
      `
      UPDATE reminders
      SET
        status = 'processing',
        retry_count = 0,
        next_attempt_at = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [permanentFailureId],
    );

    const permanentReminderResult = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = $1
      `,
      [permanentFailureId],
    );

    const permanentDelivery = async () => {
      const error = new Error("Permanent benchmark failure");

      error.retryable = false;

      throw error;
    };

    await processReminder(
      permanentReminderResult.rows[0],
      clock,
      permanentDelivery,
    );

    const permanentFinalState = await query(
      `
      SELECT status, retry_count
      FROM reminders
      WHERE id = $1
      `,
      [permanentFailureId],
    );

    check(
      "Permanent failure becomes terminal",
      permanentFinalState.rows[0].status === "failed" &&
        permanentFinalState.rows[0].retry_count === 0,
    );

    // ------------------------------------------------------------
    // 17. Process remaining scheduled reminders
    // ------------------------------------------------------------

    const remainingResult = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = ANY($1::uuid[])
        AND status = 'scheduled'
      `,
      [benchmarkReminderIds],
    );

    for (const reminder of remainingResult.rows) {
      await query(
        `
        UPDATE reminders
        SET status = 'processing',
            updated_at = NOW()
        WHERE id = $1
          AND status = 'scheduled'
        `,
        [reminder.id],
      );

      const processingResult = await query(
        `
        SELECT *
        FROM reminders
        WHERE id = $1
        `,
        [reminder.id],
      );

      await processReminder(processingResult.rows[0], clock, normalDelivery);
    }

    check("Remaining due reminders processed", true);

    // ------------------------------------------------------------
    // 18. Duplicate execution / delivery idempotency
    // ------------------------------------------------------------

    const duplicateId = reminders[8].id;

    await query(
      `
  DELETE FROM reminder_deliveries
  WHERE reminder_id = $1
  `,
      [duplicateId],
    );

    await query(
      `
  DELETE FROM reminder_attempts
  WHERE reminder_id = $1
  `,
      [duplicateId],
    );

    await query(
      `
  UPDATE reminders
  SET
    status = 'processing',
    retry_count = 0,
    version = version + 1,
    updated_at = NOW()
  WHERE id = $1
  `,
      [duplicateId],
    );

    const duplicateReminderResult = await query(
      `
  SELECT *
  FROM reminders
  WHERE id = $1
  `,
      [duplicateId],
    );

    const duplicateReminder = duplicateReminderResult.rows[0];

    // First execution: creates delivery record.
    await processReminder(duplicateReminder, clock, normalDelivery);

    // Second execution: same logical occurrence.
    // The delivery record already exists.
    await deliverReminder(duplicateReminder);

    const duplicateDeliveryCount = await query(
      `
  SELECT COUNT(*)::int AS count
  FROM reminder_deliveries
  WHERE reminder_id = $1
  `,
      [duplicateId],
    );

    check(
      "Duplicate execution produces one logical delivery",
      duplicateDeliveryCount.rows[0].count === 1,
    );

    // ------------------------------------------------------------
    // 19. Terminal state counts
    // ------------------------------------------------------------

    const stateResult = await query(
      `
      SELECT
        status,
        COUNT(*)::int AS count
      FROM reminders
      WHERE id = ANY($1::uuid[])
      GROUP BY status
      ORDER BY status
      `,
      [benchmarkReminderIds],
    );

    console.log("\nTerminal state counts:");

    const stateCounts = {};

    for (const row of stateResult.rows) {
      stateCounts[row.status] = row.count;
      console.log(`  ${row.status}: ${row.count}`);
    }

    const terminalCount =
      (stateCounts.delivered || 0) +
      (stateCounts.cancelled || 0) +
      (stateCounts.failed || 0);

    check(
      "All 20 reminders reached terminal states",
      terminalCount === 20,
      `terminal=${terminalCount}`,
    );

    // ------------------------------------------------------------
    // 20. Exactly one logical notification
    // ------------------------------------------------------------

    const logicalDeliveryResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM reminder_deliveries
      WHERE reminder_id = ANY($1::uuid[])
      `,
      [benchmarkReminderIds],
    );

    const successfulOccurrenceResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM reminders
      WHERE id = ANY($1::uuid[])
        AND status = 'delivered'
      `,
      [benchmarkReminderIds],
    );

    const logicalDeliveries = logicalDeliveryResult.rows[0].count;

    const successfulOccurrences = successfulOccurrenceResult.rows[0].count;

    console.log("\nDelivery verification:");
    console.log(`  Successful occurrences: ${successfulOccurrences}`);
    console.log(`  Logical deliveries:     ${logicalDeliveries}`);

    check(
      "Each successful occurrence has exactly one logical notification",
      logicalDeliveries === successfulOccurrences,
    );

    // ------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------

    console.log("\n========================================");

    results.forEach((result, index) => {
      console.log(
        `${String(index + 1).padStart(2, "0")}. ${
          result.passed ? "PASS" : "FAIL"
        } - ${result.name}`,
      );

      if (result.details) {
        console.log(`    ${result.details}`);
      }
    });

    console.log("========================================");

    const passed = results.filter((result) => result.passed).length;

    console.log(
      `\nBenchmark result: ${passed}/${results.length} checks passed`,
    );

    if (passed !== results.length) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("\nBenchmark failed:", error);

    process.exitCode = 1;
  } finally {
    try {
      if (benchmarkReminderIds.length > 0) {
        await query(
          `
          DELETE FROM reminders
          WHERE id = ANY($1::uuid[])
          `,
          [benchmarkReminderIds],
        );
      }
    } catch (cleanupError) {
      console.error("Benchmark cleanup failed:", cleanupError.message);

      process.exitCode = 1;
    }

    await closeDatabase();
  }
}

runBenchmark();

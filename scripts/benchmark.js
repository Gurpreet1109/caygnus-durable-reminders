require("dotenv").config();

const {
  checkDatabaseConnection,
  query,
  closeDatabase,
} = require("../src/db/database");

const { isValidTimezone } = require("../src/utils/timezone");

const { calculateRetryDelay, shouldRetry } = require("../src/utils/retry");

const { createClock } = require("../src/utils/clock");

async function runBenchmark() {
  const results = [];

  function check(name, passed, details = "") {
    results.push({
      name,
      passed,
      details,
    });
  }

  console.log("\nCaygnus Durable Reminders Benchmark\n");

  // 1
  try {
    await checkDatabaseConnection();
    check("Database connection", true);
  } catch (error) {
    check("Database connection", false, error.message);
  }

  // 2
  try {
    const result = await query("SELECT COUNT(*)::int AS count FROM reminders");
    check("Reminders table accessible", result.rows[0].count >= 0);
  } catch (error) {
    check("Reminders table accessible", false, error.message);
  }

  // 3
  try {
    const result = await query(
      "SELECT COUNT(*)::int AS count FROM reminder_attempts",
    );
    check("Attempts table accessible", result.rows[0].count >= 0);
  } catch (error) {
    check("Attempts table accessible", false, error.message);
  }

  // 4
  check("Valid IANA timezone", isValidTimezone("Asia/Kolkata"));

  // 5
  check("Another IANA timezone", isValidTimezone("America/New_York"));

  // 6
  check("Invalid timezone rejected", !isValidTimezone("Invalid/Timezone"));

  // 7
  check("Retry delay #1", calculateRetryDelay(0, 1000) === 1000);

  // 8
  check("Retry delay #2", calculateRetryDelay(1, 1000) === 2000);

  // 9
  check("Retry delay #3", calculateRetryDelay(2, 1000) === 4000);

  // 10
  check("Retry allowed below maximum", shouldRetry(1, 3) === true);

  // 11
  check("Retry stops at maximum", shouldRetry(3, 3) === false);

  // 12
  const fixedDate = new Date("2026-09-21T10:00:00Z");

  const clock = createClock(() => fixedDate);

  check(
    "Injectable clock",
    clock.now().toISOString() === "2026-09-21T10:00:00.000Z",
  );

  // 13
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_reminders_due'
      ) AS exists
    `);

    check("Due reminder index exists", result.rows[0].exists);
  } catch (error) {
    check("Due reminder index exists", false, error.message);
  }

  // 14
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = 'idx_reminders_next_attempt'
      ) AS exists
    `);

    check("Retry scheduling index exists", result.rows[0].exists);
  } catch (error) {
    check("Retry scheduling index exists", false, error.message);
  }

  // 15
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'reminders'
        AND column_name = 'next_attempt_at'
      ) AS exists
    `);

    check("next_attempt_at column exists", result.rows[0].exists);
  } catch (error) {
    check("next_attempt_at column exists", false, error.message);
  }

  // 16
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'reminders'
        AND column_name = 'idempotency_key'
      ) AS exists
    `);

    check("Idempotency column exists", result.rows[0].exists);
  } catch (error) {
    check("Idempotency column exists", false, error.message);
  }

  // 17
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reminders_idempotency_key_key'
      ) AS exists
    `);

    check("Idempotency uniqueness constraint exists", result.rows[0].exists);
  } catch (error) {
    check("Idempotency uniqueness constraint exists", false, error.message);
  }

  // 18
  try {
    const result = await query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'reminder_attempts_reminder_id_attempt_number_key'
      ) AS exists
    `);

    check("Attempt uniqueness constraint exists", result.rows[0].exists);
  } catch (error) {
    check("Attempt uniqueness constraint exists", false, error.message);
  }

  // 19
  try {
    const result = await query(`
      SELECT COUNT(*)::int AS count
      FROM reminders
      WHERE status = 'delivered'
    `);

    check("Delivered reminders persisted", result.rows[0].count >= 1);
  } catch (error) {
    check("Delivered reminders persisted", false, error.message);
  }

  // 20
  try {
    const result = await query(`
      SELECT COUNT(*)::int AS count
      FROM reminder_attempts
      WHERE status = 'success'
    `);

    check("Successful attempts persisted", result.rows[0].count >= 1);
  } catch (error) {
    check("Successful attempts persisted", false, error.message);
  }

  console.log("----------------------------------------");

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

  console.log("----------------------------------------");

  const passed = results.filter((result) => result.passed).length;

  console.log(`Result: ${passed}/${results.length} benchmark checks passed`);

  await closeDatabase();

  if (passed !== results.length) {
    process.exitCode = 1;
  }
}

runBenchmark().catch(async (error) => {
  console.error("Benchmark failed:", error);

  await closeDatabase();

  process.exitCode = 1;
});

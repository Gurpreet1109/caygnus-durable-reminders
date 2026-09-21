const { pool } = require("../db/database");
const { systemClock } = require("../utils/clock");
const { processReminder } = require("./reminderProcessor");

let schedulerRunning = false;

async function claimDueReminders(clock = systemClock, limit = 10) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const now = clock.now();

    const result = await client.query(
      `
      SELECT *
      FROM reminders
      WHERE status = 'scheduled'
  AND scheduled_at <= $1
  AND (
    next_attempt_at IS NULL
    OR next_attempt_at <= $1
  )
      ORDER BY scheduled_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
      `,
      [now, limit],
    );

    const reminders = result.rows;

    if (reminders.length === 0) {
      await client.query("COMMIT");
      return [];
    }

    const ids = reminders.map((reminder) => reminder.id);

    const updated = await client.query(
      `
      UPDATE reminders
      SET
        status = 'processing',
        updated_at = NOW()
      WHERE id = ANY($1::uuid[])
      RETURNING *
      `,
      [ids],
    );

    await client.query("COMMIT");

    return updated.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function recoverStaleProcessingReminders(clock = systemClock) {
  const client = await pool.connect();

  try {
    const cutoff = new Date(clock.now().getTime() - 60 * 1000);

    const result = await client.query(
      `
      UPDATE reminders
      SET
        status = 'scheduled',
        updated_at = NOW()
      WHERE status = 'processing'
        AND updated_at < $1
      RETURNING *
      `,
      [cutoff],
    );

    return result.rows;
  } finally {
    client.release();
  }
}

async function runScheduler(clock = systemClock) {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  try {
    await recoverStaleProcessingReminders(clock);

    const reminders = await claimDueReminders(clock);

    for (const reminder of reminders) {
      try {
        await processReminder(reminder, clock);
      } catch (error) {
        console.error(
          `Reminder ${reminder.id} delivery failed:`,
          error.message,
        );
      }
    }
  } catch (error) {
    console.error("Scheduler error:", error);
  } finally {
    schedulerRunning = false;
  }
}

module.exports = {
  claimDueReminders,
  recoverStaleProcessingReminders,
  runScheduler,
};

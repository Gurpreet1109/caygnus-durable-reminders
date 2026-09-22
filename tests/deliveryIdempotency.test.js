const crypto = require("crypto");

const {
  query,
  closeDatabase,
} = require("../src/db/database");

const {
  processReminder,
} = require("../src/services/reminderProcessor");

describe("Full delivery-boundary duplicate execution", () => {
  const reminderId = crypto.randomUUID();

  const reminder = {
    id: reminderId,
    user_id: "test-user",
    message: "Full duplicate execution test",
    retry_count: 0,
    max_retries: 3,
    version: 1,
  };

  beforeAll(async () => {
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
        version
      )
      VALUES (
        $1,
        $2,
        $3,
        NOW(),
        'Asia/Kolkata',
        'processing',
        0,
        3,
        1
      )
      `,
      [
        reminder.id,
        reminder.user_id,
        reminder.message,
      ]
    );
  });

  afterAll(async () => {
    await query(
      `
      DELETE FROM reminders
      WHERE id = $1
      `,
      [reminderId]
    );

    await closeDatabase();
  });

  test("duplicate worker execution creates only one logical notification", async () => {
    const firstResult = await processReminder(reminder);

    const secondResult = await processReminder(reminder);

    const deliveryResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM reminder_deliveries
      WHERE reminder_id = $1
      `,
      [reminderId]
    );

    const attemptResult = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM reminder_attempts
      WHERE reminder_id = $1
      `,
      [reminderId]
    );

    expect(firstResult).not.toBeNull();

    expect(deliveryResult.rows[0].count).toBe(1);

    expect(attemptResult.rows[0].count).toBe(1);
  });
});
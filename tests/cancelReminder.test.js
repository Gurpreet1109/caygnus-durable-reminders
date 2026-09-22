const crypto = require("crypto");

const { query, closeDatabase } = require("../src/db/database");

describe("Reminder cancellation", () => {
  const reminderId = crypto.randomUUID();

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
        'test-user',
        'Reminder to cancel',
        NOW() + INTERVAL '1 hour',
        'Asia/Kolkata',
        'scheduled',
        0,
        3,
        1
      )
      `,
      [reminderId],
    );
  });

  afterAll(async () => {
    await query(
      `
      DELETE FROM reminders
      WHERE id = $1
      `,
      [reminderId],
    );

    await closeDatabase();
  });

  test("scheduled reminder can be cancelled before delivery", async () => {
    const result = await query(
      `
      UPDATE reminders
      SET
        status = 'cancelled',
        updated_at = NOW()
      WHERE id = $1
        AND status = 'scheduled'
      RETURNING *
      `,
      [reminderId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("cancelled");
  });

  test("cancelled reminder is not eligible for processing", async () => {
    const result = await query(
      `
      SELECT *
      FROM reminders
      WHERE id = $1
        AND status = 'scheduled'
        AND scheduled_at <= NOW()
      `,
      [reminderId],
    );

    expect(result.rows).toHaveLength(0);
  });
});

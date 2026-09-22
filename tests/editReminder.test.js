const crypto = require("crypto");

const { query, closeDatabase } = require("../src/db/database");

const { updateReminder } = require("../src/services/reminderService");

describe("Reminder editing", () => {
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
        'Original reminder',
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

  test("scheduled reminder can be edited before delivery", async () => {
    const updated = await updateReminder(
      reminderId,
      {
        message: "Updated reminder",
        scheduledAt: "2026-09-22T12:00:00Z",
        timezone: "Asia/Kolkata",
      },
      1,
    );

    expect(updated).not.toBeNull();
    expect(updated.message).toBe("Updated reminder");
    expect(updated.timezone).toBe("Asia/Kolkata");
    expect(updated.version).toBe(2);
    expect(updated.status).toBe("scheduled");
  });
});

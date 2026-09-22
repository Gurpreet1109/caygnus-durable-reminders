const crypto = require("crypto");

const { query, closeDatabase } = require("../src/db/database");

const { updateReminder } = require("../src/services/reminderService");

describe("Reminder edit race safety", () => {
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
        'Race condition reminder',
        NOW() + INTERVAL '1 hour',
        'Asia/Kolkata',
        'processing',
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

  test("edit is rejected after worker has claimed reminder", async () => {
    const updated = await updateReminder(
      reminderId,
      {
        message: "Late edit",
        scheduledAt: "2026-09-22T12:00:00Z",
        timezone: "Asia/Kolkata",
      },
      1,
    );

    expect(updated).toBeNull();

    const result = await query(
      `
      SELECT status, message, version
      FROM reminders
      WHERE id = $1
      `,
      [reminderId],
    );

    expect(result.rows[0].status).toBe("processing");
    expect(result.rows[0].message).toBe("Race condition reminder");
    expect(result.rows[0].version).toBe(1);
  });

  test("stale worker cannot mark edited reminder as delivered", async () => {
    // Simulate the worker having an old version.
    const staleWorkerVersion = 1;

    // Simulate a user edit that increments the database version.
    await query(
      `
    UPDATE reminders
    SET
      message = 'Updated by user',
      version = 2,
      updated_at = NOW()
    WHERE id = $1
    `,
      [reminderId],
    );

    // The stale worker tries to mark the old version as delivered.
    const result = await query(
      `
    UPDATE reminders
    SET
      status = 'delivered',
      updated_at = NOW()
    WHERE id = $1
      AND status = 'processing'
      AND version = $2
    RETURNING *
    `,
      [reminderId, staleWorkerVersion],
    );

    expect(result.rows).toHaveLength(0);

    const current = await query(
      `
    SELECT status, message, version
    FROM reminders
    WHERE id = $1
    `,
      [reminderId],
    );

    expect(current.rows[0].status).toBe("processing");
    expect(current.rows[0].message).toBe("Updated by user");
    expect(current.rows[0].version).toBe(2);
  });
});

const crypto = require("crypto");

const { query } = require("../db/database");

async function createReminder({
  userId,
  message,
  scheduledAt,
  timezone,
  idempotencyKey,
  maxRetries = 3,
}) {
  const id = crypto.randomUUID();

  const result = await query(
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
      idempotency_key
    )
    VALUES ($1, $2, $3, $4, $5, 'scheduled', 0, $6, $7)
    ON CONFLICT (idempotency_key)
    DO UPDATE SET
      updated_at = reminders.updated_at
    RETURNING *
    `,
    [
      id,
      userId,
      message,
      scheduledAt,
      timezone,
      maxRetries,
      idempotencyKey || null,
    ],
  );

  return result.rows[0];
}

async function getReminders() {
  const result = await query(
    `
    SELECT *
    FROM reminders
    ORDER BY scheduled_at ASC
    `,
  );

  return result.rows;
}

async function getReminderById(id) {
  const result = await query(
    `
    SELECT *
    FROM reminders
    WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
}

async function updateReminder(id, { message, scheduledAt, timezone }) {
  const result = await query(
    `
    UPDATE reminders
    SET
      message = COALESCE($1, message),
      scheduled_at = COALESCE($2, scheduled_at),
      timezone = COALESCE($3, timezone),
      updated_at = NOW()
    WHERE id = $4
    RETURNING *
    `,
    [message ?? null, scheduledAt ?? null, timezone ?? null, id],
  );

  return result.rows[0] || null;
}

async function cancelReminder(id) {
  const result = await query(
    `
    UPDATE reminders
    SET
      status = 'cancelled',
      updated_at = NOW()
    WHERE id = $1
      AND status IN ('scheduled', 'processing')
    RETURNING *
    `,
    [id],
  );

  return result.rows[0] || null;
}

module.exports = {
  createReminder,
  getReminders,
  getReminderById,
  updateReminder,
  cancelReminder,
};

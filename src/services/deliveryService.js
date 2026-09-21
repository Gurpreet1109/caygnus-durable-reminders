const { query } = require("../db/database");

async function deliverReminder(reminder) {
  console.log(`[DELIVERY] ${reminder.user_id}: ${reminder.message}`);

  return {
    success: true,
  };
}

async function recordAttempt(
  reminderId,
  attemptNumber,
  status,
  errorMessage = null,
) {
  await query(
    `
    INSERT INTO reminder_attempts (
      reminder_id,
      attempt_number,
      status,
      error_message
    )
    VALUES ($1, $2, $3, $4)
    `,
    [reminderId, attemptNumber, status, errorMessage],
  );
}

async function markDelivered(reminderId) {
  const result = await query(
    `
    UPDATE reminders
    SET
      status = 'delivered',
      updated_at = NOW(),
      last_error = NULL,
      next_attempt_at = NULL
    WHERE id = $1
      AND status = 'processing'
    RETURNING *
    `,
    [reminderId],
  );

  return result.rows[0] || null;
}

async function markRetry(reminderId, retryCount, errorMessage, nextAttemptAt) {
  const result = await query(
    `
    UPDATE reminders
    SET
      status = 'scheduled',
      retry_count = $1,
      last_error = $2,
      next_attempt_at = $3,
      updated_at = NOW()
    WHERE id = $4
      AND status = 'processing'
    RETURNING *
    `,
    [retryCount, errorMessage, nextAttemptAt, reminderId],
  );

  return result.rows[0] || null;
}

async function markFailed(reminderId, retryCount, errorMessage) {
  const result = await query(
    `
    UPDATE reminders
    SET
      status = 'failed',
      retry_count = $1,
      last_error = $2,
      updated_at = NOW()
    WHERE id = $3
      AND status = 'processing'
    RETURNING *
    `,
    [retryCount, errorMessage, reminderId],
  );

  return result.rows[0] || null;
}

module.exports = {
  deliverReminder,
  recordAttempt,
  markDelivered,
  markRetry,
  markFailed,
};

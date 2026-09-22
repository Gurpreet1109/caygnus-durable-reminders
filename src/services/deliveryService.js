const { query } = require("../db/database");

async function deliverReminder(reminder) {
  const deliveryKey = reminder.id;

  const result = await query(
    `
    INSERT INTO reminder_deliveries (
      reminder_id,
      delivery_key
    )
    VALUES ($1, $2)
    ON CONFLICT (delivery_key)
    DO NOTHING
    RETURNING *
    `,
    [reminder.id, deliveryKey],
  );

  if (result.rows.length === 0) {
    console.log(`[DELIVERY] Duplicate suppressed for reminder ${reminder.id}`);

    return {
      success: true,
      duplicate: true,
      deliveryKey,
    };
  }

  console.log(`[DELIVERY] ${reminder.user_id}: ${reminder.message}`);

  return {
    success: true,
    duplicate: false,
    deliveryKey,
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
ON CONFLICT (reminder_id, attempt_number)
DO NOTHING
    `,
    [reminderId, attemptNumber, status, errorMessage],
  );
}

async function markDelivered(reminderId, expectedVersion) {
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
      AND version = $2
    RETURNING *
    `,
    [reminderId, expectedVersion],
  );

  return result.rows[0] || null;
}

async function markRetry(
  reminderId,
  expectedVersion,
  retryCount,
  errorMessage,
  nextAttemptAt,
) {
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
      AND version = $5
    RETURNING *
    `,
    [retryCount, errorMessage, nextAttemptAt, reminderId, expectedVersion],
  );

  return result.rows[0] || null;
}

async function markFailed(
  reminderId,
  expectedVersion,
  retryCount,
  errorMessage,
) {
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
      AND version = $4
    RETURNING *
    `,
    [retryCount, errorMessage, reminderId, expectedVersion],
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

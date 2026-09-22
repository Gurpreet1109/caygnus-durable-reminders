const {
  deliverReminder,
  recordAttempt,
  markDelivered,
  markRetry,
  markFailed,
} = require("./deliveryService");

const { calculateRetryDelay, shouldRetry } = require("../utils/retry");
const { systemClock } = require("../utils/clock");

async function processReminder(
  reminder,
  clock = systemClock,
  deliveryFunction = deliverReminder,
) {
  const attemptNumber = reminder.retry_count + 1;

  try {
    const deliveryResult = await deliveryFunction(reminder);

    if (!deliveryResult.success) {
      const error = new Error(deliveryResult.errorMessage || "Delivery failed");

      error.retryable =
        deliveryResult.retryable !== undefined
          ? deliveryResult.retryable
          : true;

      throw error;
    }

    await recordAttempt(reminder.id, attemptNumber, "success");

    return await markDelivered(reminder.id, reminder.version);
  } catch (error) {
    await recordAttempt(reminder.id, attemptNumber, "failed", error.message);

    // Permanent failure: do not retry.
    if (error.retryable === false) {
      return await markFailed(
        reminder.id,
        reminder.version,
        reminder.retry_count,
        error.message,
      );
    }

    // Temporary/retryable failure.
    const nextRetryCount = reminder.retry_count + 1;

    if (shouldRetry(nextRetryCount, reminder.max_retries)) {
      const delay = calculateRetryDelay(nextRetryCount - 1);

      const nextAttemptAt = new Date(clock.now().getTime() + delay);

      return await markRetry(
        reminder.id,
        reminder.version,
        nextRetryCount,
        error.message,
        nextAttemptAt,
      );
    }

    // Retry limit exhausted.
    return await markFailed(
      reminder.id,
      reminder.version,
      nextRetryCount,
      error.message,
    );
  }
}

module.exports = { processReminder };

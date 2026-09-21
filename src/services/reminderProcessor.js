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

  // Only delivery failures should enter the retry flow.
  let deliveryResult;

  try {
    deliveryResult = await deliveryFunction(reminder);

    if (!deliveryResult.success) {
      throw new Error("Delivery failed");
    }
  } catch (error) {
    await recordAttempt(reminder.id, attemptNumber, "failed", error.message);

    const nextRetryCount = reminder.retry_count + 1;

    if (shouldRetry(nextRetryCount, reminder.max_retries)) {
      const delay = calculateRetryDelay(nextRetryCount - 1);

      const nextAttemptAt = new Date(clock.now().getTime() + delay);

      return await markRetry(
        reminder.id,
        nextRetryCount,
        error.message,
        nextAttemptAt,
      );
    }

    return await markFailed(reminder.id, nextRetryCount, error.message);
  }

  // Delivery succeeded.
  // Database state updates are deliberately outside
  // the delivery failure catch block.
  await recordAttempt(reminder.id, attemptNumber, "success");

  return await markDelivered(reminder.id);
}

module.exports = {
  processReminder,
};

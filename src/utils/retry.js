function calculateRetryDelay(retryCount, baseDelayMs = 1000) {
  return baseDelayMs * Math.pow(2, retryCount);
}

function shouldRetry(retryCount, maxRetries) {
  return retryCount < maxRetries;
}

module.exports = {
  calculateRetryDelay,
  shouldRetry,
};

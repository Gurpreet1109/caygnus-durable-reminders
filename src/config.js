require("dotenv").config();

module.exports = {
  port: Number(process.env.PORT || 3000),

  schedulerIntervalMs: Number(process.env.SCHEDULER_INTERVAL_MS || 1000),

  maxRetries: Number(process.env.MAX_RETRIES || 3),

  retryBaseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS || 1000),
};

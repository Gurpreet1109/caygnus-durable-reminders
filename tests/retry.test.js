const { calculateRetryDelay, shouldRetry } = require("../src/utils/retry");

describe("Retry utilities", () => {
  test("calculates exponential retry delay", () => {
    expect(calculateRetryDelay(0, 1000)).toBe(1000);
    expect(calculateRetryDelay(1, 1000)).toBe(2000);
    expect(calculateRetryDelay(2, 1000)).toBe(4000);
  });

  test("allows retry while below max retries", () => {
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(2, 3)).toBe(true);
  });

  test("stops retrying at max retries", () => {
    expect(shouldRetry(3, 3)).toBe(false);
  });
});

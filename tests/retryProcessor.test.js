jest.mock("../src/services/deliveryService", () => ({
  deliverReminder: jest.fn(),
  recordAttempt: jest.fn(),
  markDelivered: jest.fn(),
  markRetry: jest.fn(),
  markFailed: jest.fn(),
}));

const {
  deliverReminder,
  recordAttempt,
  markRetry,
  markFailed,
} = require("../src/services/deliveryService");

const { processReminder } = require("../src/services/reminderProcessor");

const { createClock } = require("../src/utils/clock");

describe("Reminder retry processor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("failed delivery schedules a retry", async () => {
    deliverReminder.mockRejectedValue(new Error("Delivery failed"));

    markRetry.mockResolvedValue({
      id: "test-reminder",
      status: "scheduled",
      retry_count: 1,
    });

    const fixedDate = new Date("2026-09-21T10:00:00Z");

    const clock = createClock(() => fixedDate);

    const reminder = {
      id: "test-reminder",
      retry_count: 0,
      max_retries: 3,
      version: 1,
    };

    const expectedNextAttempt = new Date("2026-09-21T10:00:01.000Z");

    await processReminder(reminder, clock);

    expect(deliverReminder).toHaveBeenCalledTimes(1);

    expect(recordAttempt).toHaveBeenCalledWith(
      "test-reminder",
      1,
      "failed",
      "Delivery failed",
    );

    expect(markRetry).toHaveBeenCalledWith(
      "test-reminder",
      1,
      1,
      "Delivery failed",
      expectedNextAttempt,
    );
  });

  test("final failure marks reminder as failed", async () => {
    deliverReminder.mockRejectedValue(new Error("Delivery failed"));

    markFailed.mockResolvedValue({
      id: "test-reminder",
      status: "failed",
      retry_count: 3,
    });

    const clock = createClock(() => new Date("2026-09-21T10:00:00Z"));

    const reminder = {
      id: "test-reminder",
      retry_count: 2,
      max_retries: 3,
      version: 1,
    };

    await processReminder(reminder, clock);

    expect(recordAttempt).toHaveBeenCalledWith(
      "test-reminder",
      3,
      "failed",
      "Delivery failed",
    );

    expect(markFailed).toHaveBeenCalledWith(
      "test-reminder",
      1,
      3,
      "Delivery failed",
    );
  });

  test("permanent failure does not retry", async () => {
    deliverReminder.mockRejectedValue(
      Object.assign(new Error("Invalid destination"), { retryable: false }),
    );

    markFailed.mockResolvedValue({
      id: "test-reminder",
      status: "failed",
      retry_count: 0,
    });

    const clock = createClock(() => new Date("2026-09-21T10:00:00Z"));

    const reminder = {
      id: "test-reminder",
      retry_count: 0,
      max_retries: 3,
      version: 1,
    };

    await processReminder(reminder, clock);

    expect(recordAttempt).toHaveBeenCalledWith(
      "test-reminder",
      1,
      "failed",
      "Invalid destination",
    );

    expect(markFailed).toHaveBeenCalledWith(
      "test-reminder",
      1,
      0,
      "Invalid destination",
    );

    expect(markRetry).not.toHaveBeenCalled();
  });

test("temporary failure retries", async () => {
  deliverReminder.mockRejectedValue(
    Object.assign(
      new Error("Provider temporarily unavailable"),
      { retryable: true }
    )
  );

  markRetry.mockResolvedValue({
    id: "test-reminder",
    status: "scheduled",
    retry_count: 1,
  });

  const fixedDate = new Date("2026-09-21T10:00:00Z");

  const clock = createClock(() => fixedDate);

  const reminder = {
    id: "test-reminder",
    retry_count: 0,
    max_retries: 3,
    version: 1,
  };

  const expectedNextAttempt = new Date(
    "2026-09-21T10:00:01.000Z"
  );

  await processReminder(reminder, clock);

  expect(recordAttempt).toHaveBeenCalledWith(
    "test-reminder",
    1,
    "failed",
    "Provider temporarily unavailable",
  );

  expect(markRetry).toHaveBeenCalledWith(
    "test-reminder",
    1,
    1,
    "Provider temporarily unavailable",
    expectedNextAttempt,
  );

  expect(markFailed).not.toHaveBeenCalled();
});

});

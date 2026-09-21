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
    };

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
      "Delivery failed",
      new Date("2026-09-21T10:00:01.000Z"),
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
      3,
      "Delivery failed",
    );
  });
});

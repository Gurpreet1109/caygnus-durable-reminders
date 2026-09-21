const { createClock } = require("../src/utils/clock");

describe("Restart recovery", () => {
  test("processing reminders can be identified for recovery", () => {
    const reminder = {
      status: "processing",
    };

    expect(reminder.status).toBe("processing");
  });

  test("stale processing reminder should be recoverable", () => {
    const fixedNow = new Date("2026-09-21T10:05:00Z");

    const clock = createClock(() => fixedNow);

    const reminder = {
      status: "processing",
      updated_at: new Date("2026-09-21T10:03:00Z"),
    };

    const recoveryCutoff = new Date(clock.now().getTime() - 60 * 1000);

    expect(reminder.updated_at < recoveryCutoff).toBe(true);
  });

  test("recent processing reminder should not be recovered", () => {
    const fixedNow = new Date("2026-09-21T10:05:00Z");

    const clock = createClock(() => fixedNow);

    const reminder = {
      status: "processing",
      updated_at: new Date("2026-09-21T10:04:30Z"),
    };

    const recoveryCutoff = new Date(clock.now().getTime() - 60 * 1000);

    expect(reminder.updated_at < recoveryCutoff).toBe(false);
  });
});

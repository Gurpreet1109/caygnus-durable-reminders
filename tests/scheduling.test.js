const { createClock } = require("../src/utils/clock");

describe("Scheduling", () => {
  test("clock returns the injected time", () => {
    const fixedDate = new Date("2026-09-22T10:00:00Z");

    const clock = createClock(() => fixedDate);

    expect(clock.now()).toEqual(fixedDate);
  });

  test("clock does not depend on real system time", () => {
    const fixedDate = new Date("2026-01-01T00:00:00Z");

    const clock = createClock(() => fixedDate);

    expect(clock.now().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});

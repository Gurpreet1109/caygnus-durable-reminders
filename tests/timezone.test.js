const {
  isValidTimezone,
  getTimezoneOffsetMinutes,
} = require("../src/utils/timezone");

describe("Timezone utilities", () => {
  test("accepts a valid IANA timezone", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
  });

  test("accepts another valid IANA timezone", () => {
    expect(isValidTimezone("America/New_York")).toBe(true);
  });

  test("rejects an invalid timezone", () => {
    expect(isValidTimezone("Invalid/Timezone")).toBe(false);
  });

  test("rejects empty timezone", () => {
    expect(isValidTimezone("")).toBe(false);
  });

  test("returns Asia/Kolkata offset correctly", () => {
    const offset = getTimezoneOffsetMinutes(
      "Asia/Kolkata",
      new Date("2026-09-22T10:00:00Z"),
    );

    expect(offset).toBe(330);
  });
});

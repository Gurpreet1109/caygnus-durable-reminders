const request = require("supertest");

const { app } = require("../src/server");

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

  test("handles New York DST summer offset", () => {
    const offset = getTimezoneOffsetMinutes(
      "America/New_York",
      new Date("2026-07-01T12:00:00Z"),
    );

    expect(offset).toBe(-240);
  });

  test("handles New York standard-time winter offset", () => {
    const offset = getTimezoneOffsetMinutes(
      "America/New_York",
      new Date("2026-01-15T12:00:00Z"),
    );

    expect(offset).toBe(-300);
  });

  test("rejects timezone-less scheduledAt values", async () => {
    const response = await request(app).post("/api/reminders").send({
      userId: "timezone-test-user",
      message: "DST test",
      scheduledAt: "2026-03-08T02:30:00",
      timezone: "America/New_York",
    });

    expect(response.status).toBe(400);
  });

  test("accepts scheduledAt with explicit UTC offset", async () => {
    const response = await request(app).post("/api/reminders").send({
      userId: "timezone-test-user",
      message: "DST explicit offset test",
      scheduledAt: "2026-03-08T07:30:00Z",
      timezone: "America/New_York",
    });

    expect(response.status).toBe(201);

    if (response.body.id) {
      await request(app).delete(`/api/reminders/${response.body.id}`);
    }
  });
});

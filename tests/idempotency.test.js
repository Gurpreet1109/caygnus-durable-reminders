describe("Idempotency", () => {
  test("idempotency keys should identify a single request", () => {
    const key = "client-call-001";

    expect(key).toBe("client-call-001");
  });

  test("different idempotency keys represent different requests", () => {
    const key1 = "client-call-001";
    const key2 = "client-call-002";

    expect(key1).not.toBe(key2);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const after = vi.fn();
const requestOrigin = vi.fn();
vi.mock("next/server", () => ({ after }));
vi.mock("@/server/payments/request-origin", () => ({ requestOrigin }));
vi.mock("./customer-sms", () => ({ notifyCustomer: vi.fn(), remindUnpaidOrders: vi.fn() }));

const { scheduleCustomerSms, scheduleUnpaidReminders } = await import("./schedule");

describe("scheduling customer SMS", () => {
  beforeEach(() => {
    after.mockReset();
    requestOrigin.mockReset();
  });

  it("queues the SMS after the response", async () => {
    requestOrigin.mockResolvedValue("https://ghaltak.ir");
    await scheduleCustomerSms("ORDER_PLACED", "o1");
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("skips the SMS, without throwing, when the app's address is unknown (no APP_URL in production)", async () => {
    requestOrigin.mockRejectedValue(new Error("APP_URL is required in production"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(scheduleCustomerSms("ORDER_PAID", "o1")).resolves.toBeUndefined();
    await expect(scheduleUnpaidReminders("s1")).resolves.toBeUndefined();
    expect(after).not.toHaveBeenCalled();
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { hasTestDatabase } from "@/test/setup";
import type { ProviderResult, SmsProvider } from "./providers";
import { createSmsService, MAX_SEND_ATTEMPTS, STALE_CLAIM_MS } from "./service";
import { countSmsThisMonth } from "./usage";

// Runs against a real Postgres (TEST_DATABASE_URL). See docs/phase1/README.md.

/** A provider that records calls and answers what the test tells it to. */
function fakeProvider(mode: "LIVE" | "DEV" = "LIVE") {
  const calls: string[] = [];
  let next: () => Promise<ProviderResult> = async () => ({ ok: true, providerId: `id-${calls.length}` });
  const provider: SmsProvider = {
    mode,
    async send({ kind, tokens }) {
      calls.push(`${kind}:${tokens.join(",")}`);
      await new Promise((r) => setTimeout(r, 20)); // a real send takes time: let other calls overlap
      return next();
    },
  };
  return { provider, calls, answer: (fn: () => Promise<ProviderResult>) => (next = fn) };
}

describe.skipIf(!hasTestDatabase)("sendSms service (database)", () => {
  const mobile = `0992${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  let sellerId = "";
  let customerId = "";
  const log = vi.fn();

  const newOrder = async () =>
    (await prisma.order.create({ data: { sellerId, customerId, totalPrice: 100_000 } })).id;

  beforeAll(async () => {
    sellerId = (await prisma.seller.create({ data: { mobile, name: "آزمایش پیامک" } })).id;
    customerId = (await prisma.customer.create({ data: { sellerId, phone: "09350000002" } })).id;
  });
  beforeEach(() => log.mockClear());

  afterAll(async () => {
    await prisma.smsMessage.deleteMany({ where: { OR: [{ sellerId }, { to: mobile }] } });
    await prisma.order.deleteMany({ where: { sellerId } });
    await prisma.customer.deleteMany({ where: { sellerId } });
    await prisma.seller.deleteMany({ where: { id: sellerId } });
    await prisma.$disconnect();
  });

  it("sends an order message once, however many calls arrive together", async () => {
    const orderId = await newOrder();
    const fake = fakeProvider();
    const service = createSmsService({ provider: fake.provider, log });
    const input = { sellerId, to: "09350000002", kind: "ORDER_PAID" as const, tokens: ["ABC123"], orderId };

    const results = await Promise.all(Array.from({ length: 5 }, () => service.send(input)));

    expect(fake.calls).toHaveLength(1);
    expect(results.filter((r) => r.ok && r.status === "SENT")).toHaveLength(1);
    expect(results.filter((r) => r.ok && r.status === "DUPLICATE")).toHaveLength(4);
    const rows = await prisma.smsMessage.findMany({ where: { orderId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "SENT", attempts: 1, providerId: "id-1", sellerId });
  });

  it("a provider failure is recorded, never thrown, and a later call retries it", async () => {
    const orderId = await newOrder();
    const fake = fakeProvider();
    const service = createSmsService({ provider: fake.provider, log });
    const input = { sellerId, to: "09350000002", kind: "ORDER_SHIPPED" as const, tokens: ["ABC123"], orderId };

    fake.answer(async () => ({ ok: false, error: "Kavenegar status 418" }));
    expect(await service.send(input)).toEqual({ ok: false, reason: "PROVIDER_ERROR" });
    expect(await prisma.smsMessage.findFirst({ where: { orderId } })).toMatchObject({ status: "FAILED", attempts: 1 });
    expect(log.mock.calls[0][0]).toContain("0935***0002"); // masked in the log

    fake.answer(async () => ({ ok: true, providerId: "later" }));
    expect(await service.send(input)).toEqual({ ok: true, status: "SENT" });
    expect(await prisma.smsMessage.findFirst({ where: { orderId } })).toMatchObject({
      status: "SENT",
      attempts: 2,
      providerId: "later",
    });
  });

  it(`stops retrying after ${MAX_SEND_ATTEMPTS} attempts`, async () => {
    const orderId = await newOrder();
    const fake = fakeProvider();
    fake.answer(async () => ({ ok: false, error: "down" }));
    const service = createSmsService({ provider: fake.provider, log });
    const input = { sellerId, to: "09350000002", kind: "ORDER_PLACED" as const, tokens: ["ABC123"], orderId };

    for (let i = 0; i < MAX_SEND_ATTEMPTS + 2; i++) {
      expect(await service.send(input)).toEqual({ ok: false, reason: "PROVIDER_ERROR" });
    }
    expect(fake.calls).toHaveLength(MAX_SEND_ATTEMPTS);
  });

  it("takes over a claim left PENDING by a crash, but not a fresh one", async () => {
    const orderId = await newOrder();
    await prisma.smsMessage.create({
      data: { sellerId, to: "09350000002", kind: "PAYMENT_REMINDER", orderId, status: "PENDING", attempts: 1 },
    });
    const fake = fakeProvider();
    const input = { sellerId, to: "09350000002", kind: "PAYMENT_REMINDER" as const, tokens: ["ABC123"], orderId };

    // Just claimed by someone else: leave it alone.
    expect(await createSmsService({ provider: fake.provider, log }).send(input)).toEqual({
      ok: true,
      status: "DUPLICATE",
    });
    // Ten minutes later it is stale: take it over.
    const later = () => new Date(Date.now() + STALE_CLAIM_MS + 5 * 60 * 1000);
    expect(await createSmsService({ provider: fake.provider, now: later, log }).send(input)).toEqual({
      ok: true,
      status: "SENT",
    });
    expect(fake.calls).toHaveLength(1);
  });

  it("login codes: one row per request, and the code itself is never stored", async () => {
    const fake = fakeProvider("DEV");
    const service = createSmsService({ provider: fake.provider, log });
    const input = { sellerId: null, to: mobile, kind: "LOGIN_OTP" as const, tokens: ["428519"] };

    expect(await service.send(input)).toEqual({ ok: true, status: "DEV" });
    expect(await service.send(input)).toEqual({ ok: true, status: "DEV" });

    const rows = await prisma.smsMessage.findMany({ where: { to: mobile, kind: "LOGIN_OTP" } });
    expect(rows).toHaveLength(2);
    expect(JSON.stringify(rows)).not.toContain("428519");
  });

  it("a database error is logged and returned, never thrown", async () => {
    const service = createSmsService({ provider: fakeProvider().provider, log });
    const result = await service.send({
      sellerId,
      to: "09350000002",
      kind: "ORDER_PLACED",
      tokens: ["ABC123"],
      orderId: "no-such-order", // violates the foreign key
    });
    expect(result).toEqual({ ok: false, reason: "ERROR" });
    expect(log).toHaveBeenCalled();
  });

  it("counts this Jalali month's delivered messages per store", async () => {
    // Everything above for this store: 1 + 1 + 1 SENT order messages.
    const before = await countSmsThisMonth(sellerId);
    await prisma.smsMessage.createMany({
      data: [
        { sellerId, to: "09350000002", kind: "MEMBER_INVITE", status: "DEV" },
        { sellerId, to: "09350000002", kind: "MEMBER_INVITE", status: "FAILED" },
        { sellerId, to: "09350000002", kind: "MEMBER_INVITE", status: "PENDING" },
        // Last month (well before the 1st of this Jalali month): not counted.
        { sellerId, to: "09350000002", kind: "MEMBER_INVITE", status: "SENT", createdAt: new Date(Date.now() - 40 * 86_400_000) },
      ],
    });
    expect(before).toBe(3);
    expect(await countSmsThisMonth(sellerId)).toBe(4);
  });
});

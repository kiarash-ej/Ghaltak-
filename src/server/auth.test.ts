import { beforeEach, describe, expect, it, vi } from "vitest";

// requireMember / requireSeller / requireOwner (A10), with the cookie and the
// session check replaced: the database side is in sessions.int.test.ts.

const state = vi.hoisted(() => ({
  cookie: null as null | { sid: string; userId: string; sellerId: string },
  session: null as null | { sessionId: string; userId: string; sellerId: string; role: "OWNER" | "OPERATOR" },
}));

vi.mock("./session", () => ({ readSession: async () => state.cookie }));
vi.mock("./sessions", () => ({ validateSession: async () => state.session }));
vi.mock("@/lib/prisma", () => ({
  prisma: { seller: { findUnique: async () => ({ id: "s1", name: "فروشگاه", mobile: "09120000000" }) } },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const load = async () => {
  vi.resetModules(); // react cache() per test
  return import("./auth");
};

describe("auth", () => {
  beforeEach(() => {
    state.cookie = { sid: "x", userId: "u1", sellerId: "s1" };
    state.session = { sessionId: "x", userId: "u1", sellerId: "s1", role: "OWNER" };
  });

  it("no cookie: to /login; a cookie whose session no longer counts: to /logout", async () => {
    state.cookie = null;
    await expect((await load()).requireSeller()).rejects.toThrow("REDIRECT /login");
    state.cookie = { sid: "x", userId: "u1", sellerId: "s1" };
    state.session = null;
    await expect((await load()).requireSeller()).rejects.toThrow("REDIRECT /logout");
  });

  it("requireSeller keeps its pre-A10 result for any member", async () => {
    state.session!.role = "OPERATOR";
    expect(await (await load()).requireSeller()).toEqual({ id: "s1", name: "فروشگاه", mobile: "09120000000" });
  });

  it("requireOwner: the owner passes, an operator gets a 404", async () => {
    expect(await (await load()).requireOwner()).toMatchObject({ role: "OWNER", userId: "u1" });
    state.session!.role = "OPERATOR";
    await expect((await load()).requireOwner()).rejects.toThrow("NOT_FOUND");
  });
});

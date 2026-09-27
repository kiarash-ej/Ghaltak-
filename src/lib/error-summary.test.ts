import { describe, expect, it } from "vitest";
import { errorSummary } from "./error-summary";

describe("errorSummary", () => {
  it("keeps the kind of error and never its text (#50)", () => {
    const err = Object.assign(new Error("Invalid `prisma.customer.create()` invocation: { name: \"مریم\", phone: \"09121234567\" }"), {
      name: "PrismaClientValidationError",
    });
    const summary = errorSummary(err);
    expect(summary).toEqual({ name: "PrismaClientValidationError", code: undefined });
    expect(JSON.stringify(summary)).not.toContain("0912");
  });

  it("keeps Prisma's error code", () => {
    expect(errorSummary(Object.assign(new Error("x"), { name: "PrismaClientKnownRequestError", code: "P2002" }))).toEqual({
      name: "PrismaClientKnownRequestError",
      code: "P2002",
    });
  });

  it("copes with anything thrown", () => {
    expect(errorSummary(null)).toEqual({ name: undefined, code: undefined });
    expect(errorSummary("boom")).toEqual({ name: undefined, code: undefined });
  });
});

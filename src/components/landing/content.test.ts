import { describe, expect, it } from "vitest";
import { SmsKind } from "@/generated/prisma/enums";
import { SMS_USES } from "./content";

// The landing page's SMS section is what an SMS provider reviews before
// approving templates, and it says it lists every SMS the app sends.
describe("landing page SMS list", () => {
  it("has exactly one entry for every SmsKind", () => {
    expect(SMS_USES.map((s) => s.kind).sort()).toEqual(Object.values(SmsKind).sort());
  });
});

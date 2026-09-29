import { describe, expect, it } from "vitest";
import { SmsKind } from "@/generated/prisma/enums";
import { SMS_USES } from "./sms-content";

// The public SMS guide is what an SMS provider reviews before
// approving templates, and it says it lists every SMS the app sends.
describe("public SMS guide", () => {
  it("has exactly one entry for every SmsKind", () => {
    expect(SMS_USES.map((s) => s.kind).sort()).toEqual(Object.values(SmsKind).sort());
  });
});

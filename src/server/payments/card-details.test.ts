import { describe, expect, it } from "vitest";
import {
  formatCardNumber,
  formatSheba,
  luhnValid,
  normalizeCardNumber,
  normalizeSheba,
  parseCardDetailsForm,
} from "./card-details";

const CARD = "6037991234567893"; // valid Luhn
const SHEBA = "IR820540102680020817909002"; // valid mod-97

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("normalizeCardNumber", () => {
  it.each([
    [CARD, CARD],
    ["6037 9912 3456 7893", CARD],
    ["6037-9912-3456-7893", CARD],
    ["۶۰۳۷۹۹۱۲۳۴۵۶۷۸۹۳", CARD],
  ])("accepts %s", (input, expected) => {
    expect(normalizeCardNumber(input)).toBe(expected);
  });

  it.each([
    "6037991234567890", // wrong check digit
    "603799123456789", // 15 digits
    "60379912345678931", // 17 digits
    "6037 9912 abcd 7893",
    "",
  ])("rejects %s", (input) => {
    expect(normalizeCardNumber(input)).toBeNull();
  });
});

describe("luhnValid", () => {
  it("matches the standard algorithm", () => {
    expect(luhnValid("4539578763621486")).toBe(true);
    expect(luhnValid("4539578763621487")).toBe(false);
  });
});

describe("normalizeSheba", () => {
  it.each([
    [SHEBA, SHEBA],
    ["ir82 0540 1026 8002 0817 9090 02", SHEBA],
    ["820540102680020817909002", SHEBA], // without "IR"
    ["IR۸۲۰۵۴۰۱۰۲۶۸۰۰۲۰۸۱۷۹۰۹۰۰۲", SHEBA],
  ])("accepts %s", (input, expected) => {
    expect(normalizeSheba(input)).toBe(expected);
  });

  it.each([
    "IR820540102680020817909003", // bad checksum
    "IR82054010268002081790900", // too short
    "DE89370400440532013000", // not Iranian
    "IRXX0540102680020817909002",
    "",
  ])("rejects %s", (input) => {
    expect(normalizeSheba(input)).toBeNull();
  });
});

describe("formatting", () => {
  it("groups card numbers and Sheba in fours", () => {
    expect(formatCardNumber(CARD)).toBe("6037 9912 3456 7893");
    expect(formatSheba(SHEBA)).toBe("IR82 0540 1026 8002 0817 9090 02");
  });
});

describe("parseCardDetailsForm", () => {
  it("saves a new card, holder and Sheba", () => {
    const r = parseCardDetailsForm(
      form({ cardNumber: "6037 9912 3456 7893", cardHolder: "  سارا   احمدی ", sheba: SHEBA }),
      { hasCard: false },
    );
    expect(r).toEqual({ success: true, data: { cardNumber: CARD, cardHolder: "سارا احمدی", sheba: SHEBA } });
  });

  it("keeps the stored card and Sheba when their fields are left empty", () => {
    const r = parseCardDetailsForm(form({ cardNumber: "", cardHolder: "سارا", sheba: "" }), { hasCard: true });
    expect(r).toEqual({ success: true, data: { cardHolder: "سارا" } });
    expect(r.success && "cardNumber" in r.data).toBe(false);
    expect(r.success && "sheba" in r.data).toBe(false);
  });

  it("removes them only with the explicit checkboxes", () => {
    const r = parseCardDetailsForm(
      form({ removeCard: "on", removeSheba: "on", cardHolder: "" }),
      { hasCard: true },
    );
    expect(r).toEqual({ success: true, data: { cardNumber: null, cardHolder: null, sheba: null } });
  });

  it("requires a holder name whenever there will be a card", () => {
    const newCard = parseCardDetailsForm(form({ cardNumber: CARD, cardHolder: "" }), { hasCard: false });
    expect(!newCard.success && newCard.errors.cardHolder).toBeDefined();

    const keptCard = parseCardDetailsForm(form({ cardNumber: "", cardHolder: "" }), { hasCard: true });
    expect(!keptCard.success && keptCard.errors.cardHolder).toBeDefined();

    const noCard = parseCardDetailsForm(form({ cardNumber: "", cardHolder: "" }), { hasCard: false });
    expect(noCard.success).toBe(true);
  });

  it("reports invalid card and Sheba", () => {
    const r = parseCardDetailsForm(
      form({ cardNumber: "6037991234567890", cardHolder: "سارا", sheba: "IR00" }),
      { hasCard: false },
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.errors.cardNumber).toBeDefined();
      expect(r.errors.sheba).toBeDefined();
    }
  });
});

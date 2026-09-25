import { describe, expect, it } from "vitest";
import { BOM, csvCell, csvLine, formatPhone } from "./csv";

describe("csv cells", () => {
  it("writes numbers as they are and empty values as nothing", () => {
    expect(csvCell(1250000)).toBe("1250000");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell("")).toBe("");
  });

  it("quotes a cell with a comma, a quote or a line break, doubling quotes", () => {
    expect(csvCell("مانتو، کتان")).toBe("مانتو، کتان"); // Persian comma needs no quotes
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
  });

  // A customer types their own name on the public buy page, so any text cell
  // may be hostile. Excel runs a cell starting with = + - @ as a formula.
  it.each([
    ['=HYPERLINK("http://evil.example","بزنید")', `"'=HYPERLINK(""http://evil.example"",""بزنید"")"`],
    ["+98 912", "'+98 912"],
    ["-2+3", "'-2+3"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\t=1+1", "'\t=1+1"],
    ["\r=1+1", `"'\r=1+1"`],
  ])("neutralizes a formula: %j", (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it("leaves text that only contains those characters later alone", () => {
    expect(csvCell("مریم = نمونه")).toBe("مریم = نمونه");
    expect(csvCell("user@example.com")).toBe("user@example.com");
  });

  it("never guards numbers: they are ours, not typed by a customer", () => {
    expect(csvCell(-5)).toBe("-5");
  });

  it("ends every line with CRLF, as Excel expects", () => {
    expect(csvLine(["a", 1, null, "b,c"])).toBe('a,1,,"b,c"\r\n');
  });

  it("starts files with a UTF-8 byte order mark so Excel reads Persian", () => {
    expect(new TextEncoder().encode(BOM)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]));
  });

  it("keeps long digit codes and leading zeros as text in Excel", () => {
    expect(csvCell("54969929775688794000")).toBe('"=""54969929775688794000"""'); // a Post tracking code
    expect(csvCell("007")).toBe('"=""007"""');
    expect(csvCell("12345")).toBe("12345");
    expect(csvCell("0")).toBe("0");
    expect(csvCell("0912abc")).toBe("0912abc");
  });

  it("writes mobiles with spaces so Excel keeps the leading zero", () => {
    expect(formatPhone("09121234567")).toBe("0912 123 4567");
    expect(formatPhone("12345")).toBe("12345");
  });
});

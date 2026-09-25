import { describe, expect, it } from "vitest";
import { MAX_PRINT_ORDERS, paperSize, parsePrintRequest } from "./print-request";

const id = (n: number) => `cm${String(n).padStart(23, "0")}`;

describe("parsePrintRequest", () => {
  it("takes the selected order ids, in order, without repeats", () => {
    expect(parsePrintRequest({ id: [id(2), id(1), id(2)] })).toEqual({ kind: "ids", ids: [id(2), id(1)] });
    expect(parsePrintRequest({ id: id(1) })).toEqual({ kind: "ids", ids: [id(1)] });
  });

  it("drops anything that can't be an order id", () => {
    expect(parsePrintRequest({ id: [id(1), "", "x", "<script>", `${id(1)}'--`] })).toEqual({
      kind: "ids",
      ids: [id(1)],
    });
  });

  it("prints at most MAX_PRINT_ORDERS at once", () => {
    const many = Array.from({ length: MAX_PRINT_ORDERS + 5 }, (_, i) => id(i));
    const parsed = parsePrintRequest({ id: many });
    expect(parsed.kind === "ids" && parsed.ids).toEqual(many.slice(0, MAX_PRINT_ORDERS));
  });

  it("«ready» means every order waiting to be shipped", () => {
    expect(parsePrintRequest({ ready: "1" })).toEqual({ kind: "ready" });
    expect(parsePrintRequest({ ready: "1", id: id(1) })).toEqual({ kind: "ready" });
  });

  it("nothing selected is an empty list", () => {
    expect(parsePrintRequest({})).toEqual({ kind: "ids", ids: [] });
  });
});

describe("paperSize", () => {
  it("is A5 unless A6 is asked for", () => {
    expect(paperSize(undefined)).toBe("A5");
    expect(paperSize("a6")).toBe("A6");
    expect(paperSize("A6")).toBe("A6");
    expect(paperSize(["a6", "a5"])).toBe("A6");
    expect(paperSize("letter")).toBe("A5");
  });
});

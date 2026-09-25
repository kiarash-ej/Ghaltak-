// Which orders a print request asks for, and on what paper (B9). Pure, no
// database: the seller scoping happens in print.ts.

export const MAX_PRINT_ORDERS = 50;

export type PrintSelection = { kind: "ids"; ids: string[] } | { kind: "ready" };

export type PaperSize = "A5" | "A6";

type Param = string | string[] | undefined;

// Order ids are cuids: lowercase letters and digits.
const ORDER_ID = /^[a-z0-9]{20,40}$/;

const all = (v: Param) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** `?id=…&id=…` for chosen orders, or `?ready=1` for everything waiting to ship. */
export function parsePrintRequest(params: { id?: Param; ready?: Param }): PrintSelection {
  if (all(params.ready).includes("1")) return { kind: "ready" };
  const ids = [...new Set(all(params.id).filter((v) => ORDER_ID.test(v)))];
  return { kind: "ids", ids: ids.slice(0, MAX_PRINT_ORDERS) };
}

export function paperSize(value: Param): PaperSize {
  return all(value)[0]?.toUpperCase() === "A6" ? "A6" : "A5";
}

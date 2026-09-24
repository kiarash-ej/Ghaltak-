import { MAX_STOCK, parseWholeNumber } from "./product-form";

// Parsing of the manual stock adjustment form. Pure, no database.

export type AdjustMode = "add" | "remove" | "set";

export type AdjustRequest =
  | { kind: "delta"; delta: number; note: string | null }
  | { kind: "set"; target: number; expectedStock: number; note: string | null };

export type ParsedAdjustForm =
  | { success: true; data: AdjustRequest }
  | { success: false; error: string };

export const MAX_NOTE_LENGTH = 200;

/** New stock after applying the form values, or null when not computable. Used for the live preview. */
export function previewStock(
  current: number,
  mode: AdjustMode,
  quantity: number | null,
): number | null {
  if (quantity === null) return null;
  if (mode === "set") return quantity;
  return mode === "add" ? current + quantity : current - quantity;
}

export function parseAdjustForm(formData: FormData): ParsedAdjustForm {
  const mode = formData.get("mode");
  if (mode !== "add" && mode !== "remove" && mode !== "set") {
    return { success: false, error: "نوع تغییر را انتخاب کنید." };
  }

  const quantity = parseWholeNumber(formData.get("quantity"));
  if (quantity === null) {
    return { success: false, error: "تعداد را به‌صورت عدد وارد کنید." };
  }
  if (quantity > MAX_STOCK) {
    return { success: false, error: "تعداد بیش از حد مجاز است." };
  }
  if (mode !== "set" && quantity === 0) {
    return { success: false, error: "تعداد باید بیشتر از صفر باشد." };
  }

  const rawNote = formData.get("note");
  const note = typeof rawNote === "string" ? rawNote.trim() : "";
  if (note.length > MAX_NOTE_LENGTH) {
    return {
      success: false,
      error: `توضیح حداکثر ${MAX_NOTE_LENGTH.toLocaleString("fa-IR")} نویسه باشد.`,
    };
  }

  if (mode === "set") {
    const expectedStock = parseWholeNumber(formData.get("expectedStock"));
    if (expectedStock === null) {
      return { success: false, error: "صفحه را دوباره باز کنید و مجدداً تلاش کنید." };
    }
    return {
      success: true,
      data: { kind: "set", target: quantity, expectedStock, note: note || null },
    };
  }

  return {
    success: true,
    data: { kind: "delta", delta: mode === "add" ? quantity : -quantity, note: note || null },
  };
}

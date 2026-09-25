import type { SendSms } from "./types";

/**
 * TEMPORARY STUB of sendSms (Phase 2 Step 0). Track B's customer SMS (B7) can
 * be built against it now; the real one comes in A8 with the same type, and
 * switching is a one-line import change. It only prints, it sends nothing.
 */
export const sendSms: SendSms = async (input) => {
  const masked = input.to.replace(/^(\d{4})\d{3}(\d{4})$/, "$1***$2");
  console.log(`[sms stub] ${input.kind} to ${masked}: ${input.tokens.join(" | ")}`);
  return { ok: true, status: "DEV" };
};

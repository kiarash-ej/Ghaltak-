import "server-only";
import { providerFromEnv } from "./providers";
import { createSmsService } from "./service";
import type { SendSms } from "./types";

// The SMS service for the whole app (A8). Contract for Track B: see ./types.ts.
// Kavenegar when KAVENEGAR_API_KEY is set; printed to the console in
// development without it.

let service: ReturnType<typeof createSmsService> | undefined;

export const sendSms: SendSms = (input) => {
  service ??= createSmsService({ provider: providerFromEnv() });
  return service.send(input);
};

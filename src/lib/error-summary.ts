// What to log about an unexpected error: its kind, never its text. A Prisma
// validation error's message quotes the call's arguments (a customer's name,
// mobile and address), and hosting logs keep it (#50). `code` is Prisma's
// error code (e.g. P2002), enough to tell one failure from another.

export function errorSummary(err: unknown): { name?: string; code?: string } {
  const e = err as { name?: unknown; code?: unknown } | null | undefined;
  return {
    name: typeof e?.name === "string" ? e.name : undefined,
    code: typeof e?.code === "string" ? e.code : undefined,
  };
}

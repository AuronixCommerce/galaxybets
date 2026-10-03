export function reply(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  const known = /^(Unauthorized|Invalid|Unknown|Choose|Bet must|A valid|Insufficient|Too many|This game|Make a move|Game session|Finish|Play is paused|Demo balance|Fairness setup|No active seed|Client seed|That prediction|Confirm that|Seed changed)/.test(message);
  const status = (error as { status?: number })?.status ?? (known ? 400 : 503);
  const retryAfter = (error as { retryAfter?: number })?.retryAfter;
  return Response.json({ error: known ? message : "The demo service is temporarily unavailable." }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": String(retryAfter ?? 10) } : {}) } });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new Error("Invalid request origin.");
}

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request body.");
  return value as Record<string, unknown>;
}

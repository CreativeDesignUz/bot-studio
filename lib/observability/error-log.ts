/**
 * Server-side structured error logging for Cloudflare Workers.
 * Never pass request bodies, cookies, tokens, Telegram initData or PII here.
 */
export function logServerError(operation: string, error: unknown, code = "INTERNAL_ERROR"): string {
  const errorId = crypto.randomUUID();
  const payload = {
    ts: new Date().toISOString(),
    level: "error",
    event: "server_error",
    error_id: errorId,
    operation,
    environment: "cloudflare-worker",
    error_type: error instanceof Error ? error.name : "UnknownError",
    code,
  };
  console.error(JSON.stringify(payload));
  return errorId;
}

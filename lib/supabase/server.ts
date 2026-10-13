import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";

export function getSupabaseServer(options: { privileged?: boolean } = {}) {
  const url = env.SUPABASE_URL?.trim();
  const key = options.privileged
    ? env.SUPABASE_SECRET_KEY?.trim()
    : env.SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      options.privileged
        ? "Supabase server credentials are not configured"
        : "Supabase public credentials are not configured",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

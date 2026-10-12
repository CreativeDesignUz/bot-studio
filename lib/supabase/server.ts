import { createClient } from "@supabase/supabase-js";

// Node.js runtime adapter for Vercel. The Cloudflare application stays on its own branch.
export function getSupabaseServer(options: { privileged?: boolean } = {}) {
  const url = process.env.SUPABASE_URL;
  const key = options.privileged
    ? process.env.SUPABASE_SECRET_KEY
    : process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(options.privileged
      ? "Supabase server credentials are not configured"
      : "Supabase public credentials are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

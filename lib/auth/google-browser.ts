import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const GOOGLE_STORAGE_KEY = "bot-studio-google-pkce";
type PublicConfig = { url: string; key: string };

// The login page and callback MUST use identical PKCE storage settings.
// A code verifier is scoped to the same origin and browsing tab.
export function createGoogleBrowserClient(config: PublicConfig): SupabaseClient {
  return createClient(config.url, config.key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      storage: window.sessionStorage,
      storageKey: GOOGLE_STORAGE_KEY,
    },
  });
}

export function clearGoogleBrowserSession() {
  for (let index = window.sessionStorage.length - 1; index >= 0; index--) {
    const key = window.sessionStorage.key(index);
    if (key === GOOGLE_STORAGE_KEY || key?.startsWith(GOOGLE_STORAGE_KEY + "-")) {
      window.sessionStorage.removeItem(key);
    }
  }
}

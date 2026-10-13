/**
 * Backward-compatible alias for the old Google entry point.
 *
 * This route MUST NOT call signInWithOAuth on the server:
 * our canonical PKCE client starts OAuth inside /login and stores the verifier
 * in sessionStorage for the /auth/callback exchange.
 *
 * Redirect any bookmarked /api/auth/google link to the same login form.
 * A relative Location avoids reflecting a potentially untrusted Host header.
 */
export async function GET() {
  return new Response(null, {
    status: 303,
    headers: {
      location: "/login",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

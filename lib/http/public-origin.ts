const DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function parseOrigin(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("PUBLIC_APP_URL_INVALID"); }
  const isLocal = DEVELOPMENT_HOSTS.has(url.hostname);
  if ((url.protocol !== "https:" && !(isLocal && url.protocol === "http:")) ||
      url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("PUBLIC_APP_URL_INVALID");
  }
  return url.origin;
}

export function resolvePublicAppOrigin(requestUrl: string, configuredUrl?: string) {
  if (configuredUrl?.trim()) return parseOrigin(configuredUrl.trim());
  const requestOrigin = new URL(requestUrl);
  const isLocal = DEVELOPMENT_HOSTS.has(requestOrigin.hostname);
  const isTemporaryTunnel = requestOrigin.protocol === "https:" && requestOrigin.hostname.endsWith(".trycloudflare.com");
  if (!isLocal && !isTemporaryTunnel) throw new Error("PUBLIC_APP_URL_REQUIRED");
  return requestOrigin.origin;
}

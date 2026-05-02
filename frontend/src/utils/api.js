const isLocalHost = (host) => host === "localhost" || host === "127.0.0.1";

export function getApiBaseUrl() {
  const envUrl = (process.env.REACT_APP_API_URL || "").trim();
  const browserHost = window.location.hostname;

  if (!envUrl) {
    return `${window.location.protocol}//${browserHost}:8000`;
  }

  try {
    const parsed = new URL(envUrl);
    if (isLocalHost(parsed.hostname) && !isLocalHost(browserHost)) {
      parsed.hostname = browserHost;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch (_err) {
    return envUrl.replace(/\/$/, "");
  }
}

export function getApiBaseCandidates() {
  const envUrl = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  const candidates = [];
  const isBrowserLocal = isLocalHost(host);

  if (envUrl) candidates.push(envUrl);
  // Only try :8000 / localhost fallbacks while developing locally.
  if (isBrowserLocal) {
    candidates.push(`${protocol}//${host}:8000`);
    candidates.push(`${protocol}//localhost:8000`);
    candidates.push(`${protocol}//127.0.0.1:8000`);
  }

  return [...new Set(candidates)];
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getApiBaseCandidates();
  let lastError = null;

  if (!candidates.length) {
    throw new Error(
      "API URL is not configured. Set REACT_APP_API_URL in your deployment environment variables."
    );
  }

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${normalizedPath}`, options);
      return response;
    } catch (err) {
      lastError = err;
    }
  }

  const host = window.location.hostname;
  if (!isLocalHost(host) && !(process.env.REACT_APP_API_URL || "").trim()) {
    throw new Error(
      "Cannot reach backend API. In Vercel, set REACT_APP_API_URL to your Render backend URL and redeploy."
    );
  }
  throw lastError || new Error("Failed to fetch");
}

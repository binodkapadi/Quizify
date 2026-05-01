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

  if (envUrl) candidates.push(envUrl);
  candidates.push(`${protocol}//${host}:8000`);
  candidates.push(`${protocol}//localhost:8000`);
  candidates.push(`${protocol}//127.0.0.1:8000`);

  return [...new Set(candidates)];
}

export async function apiFetch(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const candidates = getApiBaseCandidates();
  let lastError = null;

  for (const base of candidates) {
    try {
      const response = await fetch(`${base}${normalizedPath}`, options);
      return response;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to fetch");
}

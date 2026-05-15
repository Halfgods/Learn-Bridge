const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const scrapperBase = (import.meta.env.VITE_SCRAPPER_URL as string | undefined)?.trim();
const tutorBase = (import.meta.env.VITE_TUTOR_URL as string | undefined)?.trim();

/**
 * Flask API URL path. In dev, leave `VITE_API_URL` unset so calls stay same-origin
 * (`/api/...`) and Vite proxies to Flask — avoids CORS. Set `VITE_API_URL` for
 * production or when the UI and API are on different hosts.
 */
export function apiPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (envBase) return `${envBase.replace(/\/$/, "")}${p}`;
  return p;
}

/**
 * Parse JSON from an API response. Surfaces a clear error when the server
 * returns HTML (SPA shell, 404 page) because /api is not proxied or Flask is down.
 */
export async function parseApiJson<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    const t = text.trimStart();
    if (t.toLowerCase().startsWith("<!doctype") || t.toLowerCase().includes("<html")) {
      throw new Error(
        "The server returned a web page instead of JSON. Start the Flask API on port 5000 (so /api proxies correctly), or set VITE_API_URL to your backend base URL.",
      );
    }
    throw new Error(`Invalid JSON from API: ${text.slice(0, 180).replace(/\s+/g, " ")}`);
  }
}

/**
 * Scrapper (FastAPI on :8080) path. In dev, leave `VITE_SCRAPPER_URL` unset so
 * `/ytlinks` and `/shaalaalinks` are same-origin and Vite proxies them — avoids CORS.
 */
export function scrapperPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (scrapperBase) return `${scrapperBase.replace(/\/$/, "")}${p}`;
  return p;
}

/**
 * AI Tutor (FastAPI `main.py` on :8000 via Vite `/llm` proxy). Leave `VITE_TUTOR_URL` unset so
 * `/llm/...` is same-origin and Vite proxies to the tutor server (prefix stripped).
 */
export function tutorPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (tutorBase) return `${tutorBase.replace(/\/$/, "")}${p}`;
  return `/llm${p}`;
}

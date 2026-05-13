const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const scrapperBase = (import.meta.env.VITE_SCRAPPER_URL as string | undefined)?.trim();

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
 * Scrapper (FastAPI on :8080) path. In dev, leave `VITE_SCRAPPER_URL` unset so
 * `/ytlinks` and `/shaalaalinks` are same-origin and Vite proxies them — avoids CORS.
 */
export function scrapperPath(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (scrapperBase) return `${scrapperBase.replace(/\/$/, "")}${p}`;
  return p;
}

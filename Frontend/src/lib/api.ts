const envBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

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

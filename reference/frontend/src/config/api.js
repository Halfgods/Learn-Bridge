const normalizeBaseUrl = (value, fallback) => {
  const base = (value && value.trim()) || fallback;
  return base.replace(/\/+$/, '');
};

const BACKEND_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_BACKEND_URL, 'http://localhost:5000');
const LINKS_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_LINKS_URL, 'http://localhost:8080');

export const backendUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_BASE_URL}${normalizedPath}`;
};

export const linksUrl = (path = '') => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${LINKS_BASE_URL}${normalizedPath}`;
};

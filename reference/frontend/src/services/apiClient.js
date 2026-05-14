import { backendUrl, linksBackendUrl } from '../config/api';

const isAbsoluteUrl = (url) => /^https?:\/\//i.test(url);
const resolveBackendUrl = (path) => isAbsoluteUrl(path) ? path : backendUrl(path);
const resolveLinksUrl = (path) => isAbsoluteUrl(path) ? path : linksBackendUrl(path);
const getToken = () => localStorage.getItem('token');

const jsonHeaders = { 'Content-Type': 'application/json' };

const parseJson = async (response, fallback = null) => {
  if (!response.ok) return fallback;
  return response.json();
};

export const apiFetch = (path, options = {}) => (
  fetch(resolveBackendUrl(path), {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {})
    }
  })
);

export const authApiFetch = (path, options = {}) => {
  const token = getToken();

  return fetch(resolveBackendUrl(path), {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
};

export const linksApiFetch = (path, options = {}) => (
  fetch(resolveLinksUrl(path), options)
);

export const apiGet = async (path, fallback = null) => parseJson(await apiFetch(path), fallback);

export const authGet = async (path, fallback = null) => parseJson(await authApiFetch(path), fallback);

export const apiPost = (path, body, options = {}) => (
  apiFetch(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body)
  })
);

export const authPost = (path, body, options = {}) => (
  authApiFetch(path, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body)
  })
);

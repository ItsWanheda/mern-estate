const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const getCsrfToken = async () => {
  const res = await fetch('/api/csrf', { credentials: 'include' });
  if (!res.ok) throw new Error('Unable to obtain CSRF token.');
  const data = await res.json();
  if (typeof data.csrfToken !== 'string' || !data.csrfToken) throw new Error('Invalid CSRF token response.');
  return data.csrfToken;
};

export const apiFetch = async (input, init = {}) => {
  const method = String(init.method || 'GET').toUpperCase();
  const options = { ...init, credentials: 'include' };

  if (unsafeMethods.has(method)) {
    const token = await getCsrfToken();
    options.headers = new Headers(init.headers || {});
    options.headers.set('X-CSRF-Token', token);
  }

  return fetch(input, options);
};

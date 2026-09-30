const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const getCsrfToken = async () => {
  const res = await fetch('/api/csrf', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error('Unable to obtain CSRF token.');
  const data = await res.json();
  if (typeof data.csrfToken !== 'string' || !data.csrfToken) throw new Error('Invalid CSRF token response.');
  return data.csrfToken;
};

const isCsrfFailure = async (res) => {
  try {
    const body = await res.clone().json();
    return /csrf/i.test(body?.message || '');
  } catch {
    return false;
  }
};

export const apiFetch = async (input, init = {}) => {
  const method = String(init.method || 'GET').toUpperCase();
  const unsafe = unsafeMethods.has(method);

  const attempt = async () => {
    const options = { ...init, credentials: 'include' };
    if (unsafe) {
      const headers = new Headers(init.headers || {});
      headers.set('X-CSRF-Token', await getCsrfToken());
      options.headers = headers;
    }
    return fetch(input, options);
  };

  let res = await attempt();
  if (unsafe && res.status === 403 && (await isCsrfFailure(res))) res = await attempt();
  return res;
};
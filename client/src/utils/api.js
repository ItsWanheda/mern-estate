const AUTH_STORAGE_KEY = 'mern_estate_access_token';

export const getAccessToken = () => {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const setAccessToken = (token) => {
  if (typeof token !== 'string' || !token) throw new Error('Invalid authentication token.');
  localStorage.setItem(AUTH_STORAGE_KEY, token);
};

export const clearAccessToken = () => {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage access errors during logout.
  }
};

export const apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  const token = getAccessToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'omit',
  });
};

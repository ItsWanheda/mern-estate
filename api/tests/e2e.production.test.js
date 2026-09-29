import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '');
const password = process.env.E2E_PASSWORD;
const missing = ['E2E_BASE_URL', 'E2E_PASSWORD'].filter((name) => !process.env[name]);

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
};

const getCookies = (response) => response.headers.getSetCookie?.() || [];
const mergeCookies = (jar, response) => {
  for (const value of getCookies(response)) {
    const pair = value.split(';', 1)[0];
    const index = pair.indexOf('=');
    if (index > 0) jar[pair.slice(0, index)] = pair.slice(index + 1);
  }
};
const cookieHeader = (jar) => Object.entries(jar).map(([name, value]) => `${name}=${value}`).join('; ');

test('production smoke test: auth, session, listing lifecycle, search, and pagination', { skip: missing.length > 0 }, async () => {
  const cookies = {};
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = `e2e_${suffix}`.slice(0, 30);
  const email = `e2e+${suffix}@example.invalid`;
  const imageUrls = ['https://example.com/e2e-home.jpg'];
  let userId;
  let csrfToken;
  let listingId;

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  mergeCookies(cookies, signup.response);
  const csrf = await request('/api/csrf', { headers: { Cookie: cookieHeader(cookies) } });
  assert.equal(csrf.response.status, 200, JSON.stringify(csrf.body));
  mergeCookies(cookies, csrf.response);
  csrfToken = csrf.body?.csrfToken;
  assert.ok(csrfToken);

  try {
    const signin = await request('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert.equal(signin.response.status, 200, JSON.stringify(signin.body));
    mergeCookies(cookies, signin.response);
    const cookie = cookieHeader(cookies);
    assert.ok(cookie, 'signin must set the access_token cookie');
    userId = signin.body?._id;

    const session = await request('/api/auth/session', { headers: { Cookie: cookieHeader(cookies) } });
    assert.equal(session.response.status, 200, JSON.stringify(session.body));
    assert.equal(session.body?._id, userId);
    assert.equal('password' in (session.body || {}), false);

    const payload = {
      name: `E2E Listing ${suffix}`,
      description: 'Production smoke-test listing with a sufficiently long description.',
      address: '123 E2E Test Street',
      regularPrice: 250000,
      discountPrice: 225000,
      bedrooms: 3,
      bathrooms: 2,
      furnished: false,
      parking: true,
      type: 'sale',
      offer: true,
      imageUrls,
    };

    const create = await request('/api/listing/create', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify(payload),
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.body));
    listingId = create.body?._id;
    assert.ok(listingId);
    assert.equal(create.body.userRef, userId);

    const get = await request(`/api/listing/get/${listingId}`);
    assert.equal(get.response.status, 200, JSON.stringify(get.body));

    const update = await request(`/api/listing/update/${listingId}`, {
      method: 'POST',
      headers: { Cookie: cookieHeader(cookies), 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ ...payload, imageUrls: [await uploadImage()], name: `E2E Updated Listing ${suffix}`, regularPrice: 260000, discountPrice: 230000 }),
    });
    assert.equal(update.response.status, 200, JSON.stringify(update.body));

    const search = await request(`/api/listing/get?searchTerm=${encodeURIComponent(suffix)}&limit=1&sort=createdAt&order=desc`);
    assert.equal(search.response.status, 200, JSON.stringify(search.body));
    assert.ok(search.body.some((item) => item._id === listingId));

    const firstPage = await request('/api/listing/get?limit=1&sort=createdAt&order=desc');
    assert.equal(firstPage.response.status, 200, JSON.stringify(firstPage.body));
    const nextCursor = firstPage.response.headers.get('x-next-cursor');
    if (nextCursor) {
      const secondPage = await request(`/api/listing/get?limit=1&sort=createdAt&order=desc&cursor=${encodeURIComponent(nextCursor)}`);
      assert.equal(secondPage.response.status, 200, JSON.stringify(secondPage.body));
    }

    const deletedListing = await request(`/api/listing/delete/${listingId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    assert.equal(deletedListing.response.status, 200, JSON.stringify(deletedListing.body));
    listingId = undefined;
  } finally {
    if (listingId && cookie) {
      await request(`/api/listing/delete/${listingId}`, { method: 'DELETE', headers: { Cookie: cookie } });
    }
    if (userId && cookie) {
      const deletedUser = await request(`/api/user/delete/${userId}`, { method: 'DELETE', headers: { Cookie: cookie } });
      assert.equal(deletedUser.response.status, 200, JSON.stringify(deletedUser.body));
    }
  }
});

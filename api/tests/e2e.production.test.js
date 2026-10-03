import test from 'node:test';
import assert from 'node:assert/strict';

const baseUrl = process.env.E2E_BASE_URL?.replace(/\/$/, '');
const password = process.env.E2E_PASSWORD;
const missing = ['E2E_BASE_URL', 'E2E_PASSWORD'].filter((name) => !process.env[name]);

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
    headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { response, body };
};

test('production smoke test: auth, session, upload, listing lifecycle, search, and pagination', { skip: missing.length > 0 }, async () => {
  let accessToken;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const username = `e2e_${suffix}`.slice(0, 30);
  const email = `e2e+${suffix}@example.invalid`;
  let userId;
  let listingId;

  const authHeaders = () => ({ Authorization: `Bearer ${accessToken}` });

  const uploadImage = async () => {
    const form = new FormData();
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
      0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
      0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
      0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    form.append('file', new Blob([png], { type: 'image/png' }), 'e2e.png');
    const result = await request('/api/upload', { method: 'POST', headers: authHeaders(), body: form });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.ok(result.body?.url);
    return result.body.url;
  };

  const signup = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });
  assert.equal(signup.response.status, 201, JSON.stringify(signup.body));
  
  try {
    const signin = await request('/api/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    assert.equal(signin.response.status, 200, JSON.stringify(signin.body));
    accessToken = signin.body?.token;
    assert.ok(accessToken);
    userId = signin.body?._id;
    assert.ok(userId);

    const session = await request('/api/auth/session', { headers: authHeaders() });
    assert.equal(session.response.status, 200, JSON.stringify(session.body));
    assert.equal(session.body?._id, userId);
    assert.equal('password' in (session.body || {}), false);

    const firstImage = await uploadImage();
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
      imageUrls: [firstImage],
    };

    const create = await request('/api/listing/create', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(create.response.status, 201, JSON.stringify(create.body));
    listingId = create.body?._id;
    assert.ok(listingId);
    assert.equal(create.body.userRef, userId);

    const get = await request(`/api/listing/get/${listingId}`);
    assert.equal(get.response.status, 200, JSON.stringify(get.body));

    const secondImage = await uploadImage();
    const update = await request(`/api/listing/update/${listingId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...payload, imageUrls: [secondImage], name: `E2E Updated Listing ${suffix}`, regularPrice: 260000, discountPrice: 230000 }),
    });
    assert.equal(update.response.status, 200, JSON.stringify(update.body));
    assert.equal(update.body.name, `E2E Updated Listing ${suffix}`);

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
      headers: authHeaders(),
    });
    assert.equal(deletedListing.response.status, 200, JSON.stringify(deletedListing.body));
    listingId = undefined;

    const deletedUser = await request(`/api/user/delete/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    assert.equal(deletedUser.response.status, 200, JSON.stringify(deletedUser.body));
    userId = undefined;
  } finally {
    if (listingId && userId) {
      await request(`/api/listing/delete/${listingId}`, { method: 'DELETE', headers: authHeaders() });
    }
    if (userId) {
      await request(`/api/user/delete/${userId}`, { method: 'DELETE', headers: authHeaders() });
    }
  }
});

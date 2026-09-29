const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (message) => ({ valid: false, message });
const ok = (value) => ({ valid: true, value });
const text = (value) => typeof value === 'string' ? value.trim() : '';
const isImageUrl = (value) => typeof value === 'string' && value.length <= 2048 && /^https:\/\//i.test(value);

export function validateSignup(body = {}) {
  const username = text(body.username);
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(username)) return fail('Username is invalid.');
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail('Please provide a valid email address.');
  if (password.length < 8 || password.length > 128) return fail('Password must be between 8 and 128 characters.');
  return ok({ username, email, password });
}

export function validateSignin(body = {}) {
  const email = text(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (email.length > 254 || !EMAIL_RE.test(email)) return fail('Please provide a valid email address.');
  if (!password) return fail('Password is required.');
  return ok({ email, password });
}

export function validateListing(body = {}) {
  const name = text(body.name);
  const description = text(body.description);
  const address = text(body.address);
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : null;
  const regularPrice = Number(body.regularPrice);
  const discountPrice = Number(body.discountPrice);
  const bedrooms = Number(body.bedrooms);
  const bathrooms = Number(body.bathrooms);

  if (name.length < 3 || name.length > 100) return fail('Listing name is invalid.');
  if (description.length < 10 || description.length > 5000) return fail('Description is invalid.');
  if (address.length < 3 || address.length > 300) return fail('Address is invalid.');
  if (!['sale', 'rent'].includes(body.type)) return fail('Listing type must be sale or rent.');
  if (!Number.isFinite(regularPrice) || regularPrice < 0 || regularPrice > 1000000000) return fail('Regular price is invalid.');
  if (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice > regularPrice) return fail('Discount price is invalid.');
  if (!Number.isInteger(bedrooms) || bedrooms < 1 || bedrooms > 100) return fail('Bedrooms are invalid.');
  if (!Number.isInteger(bathrooms) || bathrooms < 1 || bathrooms > 100) return fail('Bathrooms are invalid.');
  if (typeof body.furnished !== 'boolean' || typeof body.parking !== 'boolean' || typeof body.offer !== 'boolean') return fail('Listing flags must be boolean values.');
  if (!imageUrls || imageUrls.length < 1 || imageUrls.length > 6) return fail('A listing must contain between 1 and 6 images.');
  if (imageUrls.some((url) => !isImageUrl(url))) return fail('Every image must be a valid HTTPS URL.');

  return ok({ name, description, address, type: body.type, regularPrice, discountPrice, bedrooms, bathrooms, furnished: body.furnished, parking: body.parking, offer: body.offer, imageUrls });
}

export function validateUserUpdate(body = {}) {
  const result = {};
  if (body.username !== undefined) {
    const username = text(body.username);
    if (username.length < 3 || username.length > 30 || !/^[a-zA-Z0-9_.-]+$/.test(username)) return fail('Username is invalid.');
    result.username = username;
  }
  if (body.email !== undefined) {
    const email = text(body.email).toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) return fail('Please provide a valid email address.');
    result.email = email;
  }
  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) return fail('Password must be between 8 and 128 characters.');
    result.password = body.password;
  }
  if (body.avatar !== undefined) {
    if (!isImageUrl(body.avatar)) return fail('Avatar must be a valid HTTPS URL.');
    result.avatar = body.avatar;
  }
  if (!Object.keys(result).length) return fail('No valid fields were supplied.');
  return ok(result);
}

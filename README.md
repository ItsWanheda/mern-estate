# MERN Estate

A full-stack real estate marketplace built with **MongoDB, Express, React, Node.js, and Tailwind CSS**. Browse properties, search and filter listings, authenticate securely, upload property images, and manage your own listings from a responsive React interface.

> **Repository:** https://github.com/ItsWanheda/mern-estate

## Features

- 🏠 Browse recent property offers, rentals, and properties for sale
- 🔎 Search listings by name and filter by:
  - Rent or sale
  - Offers
  - Furnished status
  - Parking availability
- ↕️ Sort listings by price or creation date
- 📄 View detailed property pages with image galleries
- 👤 User registration, sign-in, sign-out, and profile management
- 🔐 JWT authentication stored in an HTTP-only cookie
- 🔑 Google authentication through Firebase-issued ID tokens verified server-side with the Firebase Admin SDK
- 📝 Create, update, and delete your own property listings
- 🖼️ Upload listing and profile images through the API into durable Firebase Cloud Storage
- 📧 Contact a landlord through a pre-filled email message
- 📱 Responsive UI built with React and Tailwind CSS
- 🧠 Redux Toolkit + Redux Persist for client-side user state
- ⚡ Vite-powered frontend development and production builds
- 🛡️ Security headers, request limits, validation, CORS controls, and rate limiting
- 🚦 Liveness/readiness health endpoints for deployment environments
- 📊 Structured server logging with Pino
- 🧪 Automated Node.js tests for configuration, validation, rate limiting, logging, Redis integration, and API behavior
- 🧰 Optional Redis-backed rate limiting with an in-process fallback for development

## Tech Stack

### Frontend

- React 18
- React Router 6
- Redux Toolkit
- Redux Persist
- Tailwind CSS
- Vite
- Swiper
- React Icons
- Firebase SDK

### Backend

- Node.js 20+
- Express 4
- MongoDB / Mongoose
- JWT
- bcryptjs
- cookie-parser
- Multer
- Redis / ioredis
- Pino / pino-http

## Architecture

```text
mern-estate/
├── api/
│   ├── config/          # Environment/configuration
│   ├── controllers/     # Request/business logic
│   ├── middleware/      # API middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── tests/           # Node.js test suite
│   ├── uploads/         # Runtime image uploads
│   ├── utils/           # Security, logging, validation, Redis, etc.
│   ├── app.js           # Express application factory
│   └── server.js        # Database/server bootstrap
│
├── client/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Application pages
│   │   └── redux/       # Redux store and user state
│   ├── index.html
│   └── vite.config.js
│
├── .env.example
├── package.json
└── README.md
```

In development, Vite runs the React application on port **5173** and proxies `/api` requests to the Express server on port **3000**.

In production, the Express server serves the compiled `client/dist` application alongside the API.

## Requirements

Before starting, make sure you have:

- **Node.js 20+**
- **npm**
- **MongoDB**
- **Redis** (recommended for production; optional during development)
- A Firebase project if Google authentication is enabled

Check your Node.js version:

```bash
node --version
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/ItsWanheda/mern-estate.git
cd mern-estate
```

### 2. Install dependencies

Install the API/root dependencies:

```bash
npm install
```

Install the frontend dependencies:

```bash
npm install --prefix client
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env
```

Then update `.env` with your local configuration.

At minimum, development requires:

```env
NODE_ENV=development
PORT=3000

MONGO=mongodb://app_user:change-me@127.0.0.1:27017/mern-estate?authSource=mern-estate

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
```

For Google authentication and durable image storage, configure:

```env
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"
```

On Google-managed infrastructure, Application Default Credentials can be used instead of the client email/private key.

If Redis is running locally:

```env
REDIS_URL=redis://127.0.0.1:6379
```

The complete list of supported configuration variables is documented in [`.env.example`](./.env.example).

### 4. Start MongoDB

Make sure MongoDB is running and the database/user specified by `MONGO` are available.

The example URI uses:

- Database: `mern-estate`
- Host: `127.0.0.1`
- Port: `27017`

Use a dedicated least-privilege MongoDB application user rather than an administrative account.

### 5. Start the API

From the repository root:

```bash
npm run dev
```

The API will listen on:

```text
http://localhost:3000
```

### 6. Start the frontend

In a second terminal:

```bash
npm run dev --prefix client
```

Open:

```text
http://localhost:5173
```

The Vite development server proxies `/api` requests to `http://localhost:3000` by default.

To use a different API target:

```bash
VITE_API_PROXY_TARGET=http://localhost:4000 npm run dev --prefix client
```

## Production Build

The root build script installs frontend dependencies and creates the Vite production bundle:

```bash
npm run build
```

Start the production server with:

```bash
npm start
```

The Express server serves:

- API routes under `/api/*`
- Uploaded images under `/api/uploads/*`
- The compiled React application from `client/dist`

For production, set `NODE_ENV=production`, provide a strong `JWT_SECRET` (at least 32 characters), configure explicit `CORS_ORIGINS` as needed, and provide `REDIS_URL`.

## Environment Variables

| Variable | Required | Purpose | Example |
| --- | --- | --- | --- |
| `NODE_ENV` | No | Runtime environment | `development` |
| `PORT` | No | Express port | `3000` |
| `LOG_LEVEL` | No | Pino log level | `debug` |
| `MONGO` | Yes* | MongoDB connection URI | `mongodb://...` |
| `MONGO_MAX_POOL_SIZE` | No | MongoDB connection pool maximum | `10` |
| `MONGO_MIN_POOL_SIZE` | No | MongoDB connection pool minimum | `0` |
| `MONGO_SERVER_SELECTION_TIMEOUT_MS` | No | MongoDB selection timeout | `5000` |
| `MONGO_SOCKET_TIMEOUT_MS` | No | MongoDB socket timeout | `30000` |
| `MONGO_CONNECT_ATTEMPTS` | No | Startup connection retries | `5` |
| `REDIS_URL` | Production | Redis connection URI | `redis://127.0.0.1:6379` |
| `JWT_SECRET` | Yes* | JWT signing secret | long random value |
| `JWT_EXPIRES_IN` | No | JWT lifetime | `7d` |
| `TRUST_PROXY` | No | Number of trusted reverse proxies | `0` |
| `CORS_ORIGINS` | No | Comma-separated allowed origins | `https://example.com` |
| `BODY_LIMIT` | No | JSON request body limit | `256kb` |
| `API_RATE_LIMIT_PER_MINUTE` | No | General API rate limit | `300` |
| `AUTH_RATE_LIMIT_MAX` | No | Authentication attempt limit | `20` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | Authentication rate-limit window | `900000` |
| `REQUEST_TIMEOUT_MS` | No | HTTP request timeout | `30000` |
| `SHUTDOWN_TIMEOUT_MS` | No | Graceful shutdown timeout | `10000` |
| `FIREBASE_PROJECT_ID` | Google auth/storage | Firebase project ID | `your-project-id` |
| `FIREBASE_STORAGE_BUCKET` | Image storage | Firebase Cloud Storage bucket | `your-project.appspot.com` |
| `FIREBASE_CLIENT_EMAIL` | Optional | Service-account client email when not using ADC | `...iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Optional | Service-account private key when not using ADC | `-----BEGIN PRIVATE KEY-----...` |

\* Required unless running in the test environment.

### Generate a production JWT secret

For example:

```bash
openssl rand -base64 48
```

Never commit real secrets or credentials to the repository.

## Authentication

The application supports two authentication flows:

### Email/password

Users can:

1. Register with a username, email, and password.
2. Sign in with their credentials.
3. Receive an HTTP-only `access_token` cookie containing a signed JWT.
4. Sign out and clear the cookie.

Passwords are hashed with bcrypt before storage.

### Google

The frontend can obtain a Firebase Google ID token and send it to:

```text
POST /api/auth/google
```

The API validates the token against the configured Firebase project before creating or signing in the user.

## Listings

A listing contains:

- Name
- Description
- Address
- Sale/rent type
- Regular price
- Discount price
- Offer status
- Bedrooms
- Bathrooms
- Furnished status
- Parking availability
- One to six images
- Owning user reference

Listing creation, editing, and deletion require authentication. Users can only modify or delete their own listings.

## Image Uploads

Images are uploaded through the API using Multer.

Rules enforced by the upload endpoint:

- Images only
- Maximum **2 MB per image**
- Up to **6 images per listing**
- Files are stored under `api/uploads`
- Uploaded files are served from `/api/uploads/*`

Because uploads are stored on the application filesystem, production deployments should account for persistent storage or replace this storage layer with an object-storage service.

## API Reference

### Health

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | No | Process liveness |
| GET | `/api/ready` | No | MongoDB/Redis readiness status |

### Authentication

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | No | Create an account |
| POST | `/api/auth/signin` | No | Sign in |
| POST | `/api/auth/google` | No | Authenticate with a Firebase Google ID token |
| POST | `/api/auth/signout` | No | Clear the auth cookie |
| GET | `/api/auth/session` | Yes | Hydrate the current server-side session/user |

### Listings

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/listing/get` | No | Search/filter listings |
| GET | `/api/listing/get/:id` | No | Get a listing |
| POST | `/api/listing/create` | Yes | Create a listing |
| POST | `/api/listing/update/:id` | Yes | Update an owned listing |
| DELETE | `/api/listing/delete/:id` | Yes | Delete an owned listing |

Listing search supports query parameters including:

```text
searchTerm
type=sale|rent
offer=true|false
furnished=true|false
parking=true|false
sort=createdAt|regularPrice|discountPrice|bedrooms|bathrooms|name
order=asc|desc
startIndex (legacy offset pagination)
cursor (preferred cursor pagination)
limit
```

Example:

```text
GET /api/listing/get?type=rent&furnished=true&parking=true&sort=regularPrice&order=asc
```

### Users

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/user/test` | No | Basic user route test |
| GET | `/api/user/:id` | Yes | Get user information |
| GET | `/api/user/listings/:id` | Yes | Get a user's listings |
| POST | `/api/user/update/:id` | Yes | Update a user |
| DELETE | `/api/user/delete/:id` | Yes | Delete a user |

### Uploads

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/upload` | No | Upload one image |
| GET | `/api/uploads/:filename` | No | Serve an uploaded image |

## Security

The API includes several production-oriented protections:

- HTTP-only authentication cookies
- Secure cookies in production
- SameSite cookie protection
- bcrypt password hashing
- JWT expiration
- Input validation
- MongoDB ObjectId validation
- Ownership checks for listing mutations
- CORS origin validation
- JSON body-size limits
- Authentication-specific rate limiting
- General API rate limiting
- Redis-backed rate limiting when Redis is configured
- Graceful in-process rate-limit fallback for development
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- HSTS in production
- Request and server timeouts
- Graceful shutdown handling

## Testing

Run the backend test suite with:

```bash
npm test
```

The repository includes tests covering configuration, API behavior, validation, logging, rate limiting, regex escaping, and Redis integration.

Run linting with:

```bash
npm run lint
```

Run the combined project check:

```bash
npm run check
```

Build the frontend and production application:

```bash
npm run build
```

## Useful Development Commands

### Backend

```bash
npm run dev      # Start API with nodemon
npm start        # Start API with Node
npm test         # Run tests
npm run lint     # Lint API code
npm run check    # Run lint checks
npm run build    # Build client for production
```

### Frontend

```bash
npm run dev --prefix client
npm run build --prefix client
npm run lint --prefix client
npm run preview --prefix client
```

## Deployment Notes

For a production deployment:

1. Use Node.js 20 or newer.
2. Provision MongoDB with a least-privilege application user.
3. Configure Redis for shared rate limiting across instances.
4. Set a strong `JWT_SECRET`.
5. Set `NODE_ENV=production`.
6. Configure `CORS_ORIGINS` with explicit origins.
7. Set `TRUST_PROXY` correctly when running behind a reverse proxy.
8. Run `npm run build`.
9. Start with `npm start`.
10. Persist `api/uploads` or move uploads to durable object storage.
11. Expose `/api/health` for liveness monitoring and `/api/ready` for readiness checks.
12. Use HTTPS in production.

## Project Scripts

The root `package.json` provides:

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Express API with nodemon |
| `npm start` | Start the production Express server |
| `npm test` | Run backend tests |
| `npm run lint` | Lint backend code |
| `npm run check` | Run backend lint checks |
| `npm run build` | Install/build the frontend for production |

The `client/package.json` provides Vite-specific scripts for frontend development, builds, previewing, and linting.

## Contributing

Contributions are welcome.

A typical workflow is:

1. Fork the repository.
2. Create a feature branch.
3. Make your changes.
4. Run tests and linting.
5. Verify the production build.
6. Open a pull request with a clear description of the change.

## License

This project currently declares the **ISC License** in `package.json`.

## Author

Built and maintained by [ItsWanheda](https://github.com/ItsWanheda).

---

If you find a bug or have an improvement, please open an issue or submit a pull request.

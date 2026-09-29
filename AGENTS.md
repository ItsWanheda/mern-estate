# Base44 dev environment — MERN Estate

Full-stack real-estate marketplace: Express API (`api/`) + Vite/React client (`client/`), backed by MongoDB and Redis.

## Running

```
docker compose -f docker-compose.base44.yml up -d --build
```

- `web` (Vite dev server) is the public entry point, host port 3000 -> container 5173. It proxies `/api` to the `api` service via `VITE_API_PROXY_TARGET`.
- `api` (Express via nodemon, port 3000 internal) is not exposed publicly; it's reached only through the Vite proxy. Health: `/api/health` (liveness), `/api/ready` (checks Mongo + Redis).
- `mongo` (mongo:7) and `redis` (redis:7-alpine) are internal infra services with healthchecks.

## Single-origin wiring

The client calls the API with relative `/api` paths; Vite proxies them server-side to `http://api:3000`. No CORS config is needed in dev. The API's production `client/dist` static serving is unused in dev (Vite serves source instead).

## Configuration

- Local infra credentials (Mongo, Redis) and the dev `JWT_SECRET` are inline in `docker-compose.base44.yml` — they are not external user secrets.
- `JWT_SECRET` is a development placeholder; replace it for any non-dev use.
- The client reads `VITE_FIREBASE_API_KEY` (Firebase Web API key) for Google OAuth and Storage image uploads. The app boots without it, but those features won't work. Provide it via the Base44 secrets dashboard when needed.

## Notes

- No seed data; the database starts empty, so listing pages show empty sections until listings are created.
- Node modules for `api` (root) and `client` are installed on container startup via `npm ci` into named volumes.
- Vite 4 binds `0.0.0.0` (`server.host: true`); it does not gate by Host header.

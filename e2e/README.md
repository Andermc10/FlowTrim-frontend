# Critical browser flow (HU-48)

One command replays the real user journey in Chromium: sign in, create a subscription, ask FlowTrim Insights, check
the evidence, prove that a second account cannot see the first account's data, and import a CSV file (preview, then
confirm only the valid rows).

```bash
npm run e2e
```

## What it starts

| Server | Address | How |
|---|---|---|
| Test identity provider | `http://localhost:5999` | `e2e/support/test-issuer.mjs`: OIDC discovery, JWKS, a sign-in page with **Account A** / **Account B**, PKCE S256 code exchange, logout |
| FlowTrim API | `http://localhost:5214` | `dotnet run` in `../FlowTrim-backend/src/FlowTrim.Api` (Development settings, fake Insights provider, trusts only the test issuer) |
| SPA | `http://localhost:4200` | `ng build --configuration e2e` (uses `src/environments/environment.e2e.ts`) served by `e2e/support/spa-server.mjs` |

The real Angular sign-in code runs (redirect, PKCE, callback, guard, sign-out). The test issuer exists only for this
flow: it listens on `localhost`, is never part of the production build, and does not replace Auth0 anywhere else.

## Prerequisites (once)

1. Docker Desktop running and the database up: `docker compose up -d` in `FlowTrim-backend`.
2. .NET 10 SDK, Node 22 and the backend cloned **next to** this repository (or set `FLOWTRIM_BACKEND_DIR`).
3. Backend User Secrets with `ConnectionStrings:FlowTrimDb` (see the backend README) and migrations applied:
   `dotnet ef database update --project src/FlowTrim.Infrastructure --startup-project src/FlowTrim.Api`.
4. `npm ci` and `npx playwright install chromium` in this repository.

No AI key, Auth0 account or real data is needed.

## Data

Each run uses new synthetic subjects (`e2e|account-a-<runId>`, `e2e|account-b-<runId>`), so runs never collide and the
database needs no reset. The flow deletes the subscriptions it creates. If a run fails halfway, its rows stay under an
`e2e|` owner and are invisible to every other account; remove them with (`<user>` and `<database>` are
`POSTGRES_USER` and `POSTGRES_DB` from the backend `.env`):

```bash
docker exec flowtrim-postgres psql -U <user> -d <database> -c "DELETE FROM subscriptions WHERE owner_id LIKE 'e2e|%';"
```

## Results

- `e2e/results/report/` — HTML report (`npx playwright show-report e2e/results/report`).
- `e2e/results/checkpoints/` — screenshots of the overview, the Insights answer, Account B's empty list and the import preview.
- On failure: screenshot and trace under `e2e/results/test-output/` (`npx playwright show-trace <trace.zip>`).

`e2e/results/` is ignored by Git.

## Options

| Variable | Effect |
|---|---|
| `FLOWTRIM_BACKEND_DIR` | Backend repository path (default `../FlowTrim-backend`). |
| `E2E_REUSE_SERVERS=1` | Reuse servers already running on 5999, 5214 and 4200 instead of starting them. |

The flow is not part of GitHub Actions yet: it needs both repositories, .NET and PostgreSQL (see the HU-48 spec).

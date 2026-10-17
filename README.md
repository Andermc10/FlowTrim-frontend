# FlowTrim-frontend

Angular single-page application for **FlowTrim** — a deterministic, transparent engine to track
recurring subscriptions, compute monthly-equivalent and annual spending, warn about upcoming
renewals, and simulate cancellation savings. This repository holds the web client; the API lives in
[`FlowTrim-backend`](https://github.com/Andermc10/FlowTrim-backend).

## Features

- **Subscriptions** — list (with name search), create, edit and delete (with confirmation).
- **Summary** — financial summary per currency (monthly equivalent, annual projection, active count).
- **Upcoming** — upcoming charges with a server-computed countdown and colored alert windows.
- **Simulator** — pick subscriptions to cancel and see the potential savings at 1/12/24 months.
- **Usage** — record declared usage and view cost per use, including a safe not-calculable state.
- **Landing and workspace** — a product introduction at `/` and a responsive control workspace at `/app`.
- **Themes** — persisted light and dark modes using the Carbon Signal visual system.
- **Localization** — client-side English and Spanish interface with persisted preference.
- **Secure access** — OIDC Authorization Code + PKCE handoff, session-scoped access token and protected workspace routes.
- **Landing motion** — CSS/SVG motion, scroll-snap feature rail and reduced-motion support without an animation dependency.
- Every data-driven view handles **loading / empty / success / error** states; errors go through a
  central HTTP interceptor and show an actionable message.

## Tech stack

- Angular 21 (standalone components, signals, routing; SSR disabled)
- TypeScript (strict mode), SCSS
- Vitest for unit tests

## Requirements

- Node.js `^20.19` or `^22.12` or `>=24` (Angular 21). Angular 22 needs Node `>=22.22.3`.
- npm 10+

## Getting started

```bash
npm install          # install dependencies (.npmrc sets legacy-peer-deps; see docs/TECH-DEBT.md)
npm start            # dev server at http://localhost:4200 (ng serve)
npm run build        # production build into dist/
npm test             # unit tests (Vitest)
```

The backend must be running for live data — start it on the `http` profile (`http://localhost:5214`)
and bring up its PostgreSQL container. See the backend README.

## API configuration (environments)

The API base URL is per-environment and swapped at build time via `angular.json` `fileReplacements`:

| File | `apiUrl` | Used by |
|---|---|---|
| `src/environments/environment.ts` | `http://localhost:5214` | `ng serve` / dev build |
| `src/environments/environment.production.ts` | `''` (same origin) | `ng build` (production) |

Change `apiUrl` to point the SPA at a different API, with no code changes. CORS for the dev origin
(`http://localhost:4200`) is configured on the backend.

## OIDC/JWT configuration

The SPA does not implement password storage. Configure one OIDC provider in each environment:

```ts
auth: {
  authority: 'https://your-issuer.example.com',
  clientId: 'your-public-spa-client-id',
  audience: 'flowtrim-api',
  scope: 'openid profile email',
}
```

The authorization-code flow uses PKCE. Access tokens are held in `sessionStorage` only, attached to
FlowTrim API requests by the auth interceptor and never sent to the identity provider as an API bearer
header. Refresh tokens are intentionally not stored in this MVP.

## Routes

| Path | View |
|---|---|
| `/` | FlowTrim landing page |
| `/auth/login` | OIDC login handoff |
| `/auth/callback` | PKCE callback and token exchange |
| `/app` | Workspace overview |
| `/app/subscriptions` | Subscription list (search, edit, delete) |
| `/new` | Create a subscription |
| `/:id/edit` | Edit a subscription |
| `/:id/usage` | Record usage and view cost per use |
| `/upcoming` | Upcoming charges + countdown |
| `/summary` | Financial summary dashboard |
| `/simulator` | Cancellation simulator |

## Project structure

```
src/
  app/
    core/                       cross-cutting (auth and HTTP interceptors, route guard)
    features/
      auth/                     login and OIDC callback
      core/theme/                persisted light/dark theme service
      features/landing/          public landing page
      subscriptions/             list, form, usage, upcoming panel, models, service
      summary/                  summary dashboard, model, service
      simulator/                simulator, models, service
    app.routes.ts, app.config.ts, app.ts/html/scss
  environments/                 environment.ts / environment.production.ts
  styles.scss                   global styles
public/                         static assets
```

## Screenshots

> Captured from the running app (sample data; dark fintech theme).

| | |
|---|---|
| Landing | ![Landing](docs/screenshots/landing.png) |
| Workspace | ![Workspace](docs/screenshots/workspace.png) |
| Subscriptions | ![Subscriptions](docs/screenshots/subscriptions.png) |
| Summary | ![Summary](docs/screenshots/summary.png) |
| Upcoming | ![Upcoming](docs/screenshots/upcoming.png) |
| Simulator | ![Simulator](docs/screenshots/simulator.png) |

## Known limitations

- **Manual data only**; no bank integration or automatic charge detection.
- **Provider setup required** — authentication flow and protected routes are implemented, but each
  deployment must configure an OIDC Authority, public Client ID and API Audience.
- The visual system is implemented with SCSS, CSS custom properties and inline SVG; Tailwind and chart libraries remain optional future decisions.
- Full in-browser integration needs the backend running with CORS (HU-08).

## Notes

- `.npmrc` sets `legacy-peer-deps=true` as a temporary workaround for an npm 10.9.2 bug resolving
  Vitest's peer graph. See [`docs/TECH-DEBT.md`](docs/TECH-DEBT.md) (TD-001, TD-002).
- Planning, user stories and specs live in the `FlowTrim-tracker` repository.

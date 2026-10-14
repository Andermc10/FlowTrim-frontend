# FlowTrim-frontend

Angular single-page application for **FlowTrim** — a deterministic engine to track recurring
subscriptions, compute monthly-equivalent and annual spending, warn about upcoming renewals,
and simulate cancellation savings. This repository holds the web client; the API lives in
[`FlowTrim-backend`](https://github.com/Andermc10/FlowTrim-backend).

## Tech stack

- Angular 21 (standalone components, routing enabled, SSR disabled)
- TypeScript (strict mode)
- SCSS for styling

## Requirements

- Node.js `^20.19` or `^22.12` or `>=24` (Angular 21 requirement). Angular 22 needs Node `>=22.22.3`.
- npm 10+

## Getting started

```bash
npm install          # install dependencies
npm start            # dev server at http://localhost:4200 (ng serve)
npm run build        # production build into dist/
npm test             # unit tests (Karma/Jasmine)
```

## Project structure

```
src/
  app/               root standalone component, routes and config
  main.ts            bootstrap
  styles.scss        global styles
public/              static assets
```

The feature-oriented structure (`core/`, `shared/`, `features/<feature>/`) will grow as the
MVP stories are implemented.

## Notes

- `.npmrc` sets `legacy-peer-deps=true` as a temporary workaround for an npm 10.9.2 bug when
  resolving Vitest's peer graph. See [`docs/TECH-DEBT.md`](docs/TECH-DEBT.md) (TD-001, TD-002).

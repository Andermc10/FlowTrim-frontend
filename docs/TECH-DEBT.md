# Tech Debt & Deferred Decisions — FlowTrim Frontend

Running log of known issues, warnings and decisions we chose to defer.
Each entry records what it is, why it was deferred, and the agreed next step.
Add a new row whenever something is knowingly left for later; close it when resolved.

Status legend: **OPEN** (not addressed) · **PLANNED** (scheduled) · **RESOLVED** (fixed) · **WONTFIX** (accepted as-is).

---

## TD-001 — `legacy-peer-deps` workaround for npm 10.9.2 + Vitest peer graph

- **Detected:** 2026-10-14 · EP-00 frontend task #1 (`feature/ep-00-angular-init`)
- **Area:** dependency install (`.npmrc`, `package-lock.json`)
- **Status:** MITIGATED (2026-10-22)
- **What:** A plain `npm install` fails with `Cannot read properties of null (reading 'edgesOut')`
  inside npm's arborist while resolving the peer set of Vitest (Angular 21's default unit-test
  runner). It is a known bug in npm 10.9.2, the version bundled with Node 22.15.0.
- **Workaround:** `.npmrc` sets `legacy-peer-deps=true`, which skips the peer-set resolution that
  crashes. The committed `package-lock.json` was generated this way.
- **Why deferred:** Node/npm cannot be upgraded without the user's action.
- **Next step:** Update Node to `>=22.22.3` (also unlocks Angular 22), then remove `.npmrc`,
  delete `package-lock.json` + `node_modules`, and run a clean `npm install` to confirm it works
  without the flag.
- **Owner decision:** Pending — Node version kept as-is for now.
- **Resolution:** Node is now 22.23.3 (npm 10.9.9), which resolves the Vitest peer set without crashing.
  `.npmrc` was removed; `npm install` only added the optional platform binaries that the old flag had
  skipped (esbuild, rolldown, lmdb, …; no new direct or transitive library), and a clean `npm ci`,
  `npm test` and `npm run build` pass without the flag.
- **Update (2026-10-22, Angular 22 upgrade):** the crash is still in npm 10.9.9 when the dependency tree is
  resolved **from scratch** (no lockfile), again in Vitest's optional peers. `npm ci` with npm 10 works because it
  only reads the lockfile, so CI and normal installs are fine. To regenerate `package-lock.json`, run
  `npx npm@11 install` (npm 11.21.1 resolves it). Fully resolved once Node ships npm 11 by default.

---

## TD-002 — Angular pinned to 21 instead of latest (22) due to Node version

- **Detected:** 2026-10-14 · EP-00 frontend task #1
- **Area:** framework version
- **Status:** RESOLVED (2026-10-22)
- **What:** The latest Angular (22) requires Node `>=22.22.3`; the installed Node was `22.15.0`.
  Angular 21 (requires `^22.12.0`) is the newest major compatible with that Node.
- **Why deferred:** Avoid changing the user's Node install mid-setup.
- **Update (2026-10-21):** Node is now 22.23.3, so the blocker is gone. The upgrade is a major version
  change (framework, CLI, Vitest builder) and would also allow `ng2-charts` 11; it needs the owner's
  approval and its own branch with the full unit, build and e2e checks.
- **Next step:** `ng update @angular/core@22 @angular/cli@22` on a dedicated branch.
- **Owner decision:** Approved by Ander on 2026-10-22.
- **Resolution:** Angular 22.2.3 and TypeScript 6.0.3. The v22 migrations kept the old behavior with
  `ChangeDetectionStrategy.Eager` and `withXhr()`; the Eager opt-outs were then removed, so every component uses
  the v22 default OnPush (the state already lives in signals). Unit tests and a browser walkthrough of every
  screen passed. ESLint (`angular-eslint` 22, `npm run lint`) was added in the same change and runs in CI.

---

<!-- Plantilla para nuevas entradas:

## TD-00X — <título corto>

- **Detected:** <fecha> · <tarea/rama>
- **Area:** <proyecto/archivo>
- **Status:** OPEN | PLANNED | RESOLVED | WONTFIX
- **What:** <descripción>
- **Next step:** <acción concreta>
- **Owner decision:** <quién y cuándo>

-->

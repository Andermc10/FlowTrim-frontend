# Tech Debt & Deferred Decisions — FlowTrim Frontend

Running log of known issues, warnings and decisions we chose to defer.
Each entry records what it is, why it was deferred, and the agreed next step.
Add a new row whenever something is knowingly left for later; close it when resolved.

Status legend: **OPEN** (not addressed) · **PLANNED** (scheduled) · **RESOLVED** (fixed) · **WONTFIX** (accepted as-is).

---

## TD-001 — `legacy-peer-deps` workaround for npm 10.9.2 + Vitest peer graph

- **Detected:** 2026-10-14 · EP-00 frontend task #1 (`feature/ep-00-angular-init`)
- **Area:** dependency install (`.npmrc`, `package-lock.json`)
- **Status:** OPEN (workaround in place)
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

---

## TD-002 — Angular pinned to 21 instead of latest (22) due to Node version

- **Detected:** 2026-10-14 · EP-00 frontend task #1
- **Area:** framework version
- **Status:** OPEN (accepted for now)
- **What:** The latest Angular (22) requires Node `>=22.22.3`; the installed Node is `22.15.0`.
  Angular 21 (requires `^22.12.0`) is the newest major compatible with the current Node.
- **Why deferred:** Avoid changing the user's Node install mid-setup.
- **Next step:** After updating Node, `ng update` to Angular 22.
- **Owner decision:** Pending.

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

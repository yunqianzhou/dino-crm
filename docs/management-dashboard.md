# Management dashboard / 管理看板

Route: `#/management-dashboard`. Uses the existing prototype store. No production or test database connection; no customer data was added.

## Scope and counting

- Vietnam only. Respects sales module access, country scope and the same current owner visibility rules as Sales Center Phase 3.
- Defaults to formal users and all registration dates. Test users can be explicitly selected.
- Current follow-up: current sales leads, split into assigned/unassigned and the exact shared `consultationStage` stages. The CC table breaks down these same counts by current owner.
- Period activity: distinct user IDs per metric. Registration uses registration time, calls use call time, bookings use appointment creation time. Attendance/completion use explicit lifecycle record timestamps (`reportedAt`); current status and appointment update timestamps are not treated as historical evidence.
- All date boundaries use Vietnam UTC+7. Period columns are independent and must not be divided to produce conversion rates.
- Historical conversion, paid conversion and CC payment ranking remain excluded.

## Navigation

- Counts open the matching users, including zero-count empty states.
- Sales follow-up opens `/sales-v3?studentId=...&tab=pool|follow` with an exact user filter. Existing actions and permissions apply.
- User details open `/users-v2/:studentId`.
- User orders open `/orders-v3?studentId=...` with an exact user filter, then existing order details and transactions. No matching orders is a valid empty state.
- A return button restores dashboard filters and its user modal. Order details return to the filtered order list.
- All new dashboard content and linked navigation use the global Chinese/English language selection.

## Verification

`npm run test:dashboard` checks UTC+7 boundaries, distinct users, scope/owner permissions, paid/test exclusions, current-stage totals and explicit activity dates. `npm run build` checks types and builds the site. Both run before GitHub Pages deployment.

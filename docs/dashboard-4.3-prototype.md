# Management dashboard 4.3 prototype

Updated 2026-10-09. Current product rules are maintained in [management-dashboard.md](management-dashboard.md). This prototype uses synthetic data shared with Sales, User and Order Centers.

## Current scope

- Three views: registration-cohort conversion, sales follow-up, payments.
- Conversion uses six independent recorded milestones and overall L2S. Trial completion requires a completed trial lesson.
- Current lead overview and Calling current states ignore activity dates. Calling period activity follows recorded call/payment dates.
- Follow-up resolves current status first, then filters by that status's business date. Waiting uses stage-entry date; booked/no-show/consultation use the associated session's scheduled date; closed uses the latest closure date. Rebooking moves the user to the new booked date and removes the old date/state from this table.
- Both follow-up tables support CC/date hierarchies independently. Follow-up date rows show matching current-state counts; Calling date rows show dashes for current snapshots. Payment counts and amounts use payment dates throughout.
- Closed and rejected reason panels reconcile with their respective current user sets. Activity dates affect closed reasons only.
- The shared currency selector offers Local currency and USD only. Both convert the same orders. Different local currencies remain separate; USD aggregates converted amounts. Rates are explicitly synthetic demo values; original amounts and currency are retained.
- Exact user/order drilldowns, shared permissions, totals, sorting, date memory, grouping memory, and raw XLSX downloads remain. Downloads include business-date and original/converted payment evidence.

## Regression coverage

`pnpm run test:dashboard` runs legacy checks, `scripts/test-dashboard43.cjs`, and `scripts/test-dashboard-current-dates.cjs`. The latter verifies the 10th-to-12th rebooking example, current-state date selection, stage-entry history, missing dates, future appointments, UTC+7, closure/reactivation, CC/date hierarchies, same-order local/USD conversion, and unavailable-rate handling. Build/type checks and actual browser interactions supplement these data-rule tests.

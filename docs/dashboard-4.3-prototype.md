# Management dashboard 4.3 prototype

Updated 2026-10-10. Current product rules are maintained in [management-dashboard.md](management-dashboard.md). This prototype uses synthetic data shared with Sales, User and Order Centers.

## Current scope

- Three views: registration-cohort conversion, sales follow-up, payments.
- Conversion uses six independent recorded milestones and overall L2S. Trial completion requires a completed trial lesson.
- Current lead overview and Calling current states ignore activity dates. Calling period activity follows recorded call/payment dates.
- Follow-up resolves current status first, then filters by that status's business date. Waiting uses stage-entry date; booked/no-show/consultation use the associated session's scheduled date; closed uses the latest closure date. Rebooking moves the user to the new booked date and removes the old date/state from this table.
- Both follow-up tables support CC/date hierarchies independently. Follow-up date rows show matching current-state counts; Calling date rows show dashes for current snapshots. Payment counts and amounts use payment dates throughout.
- Closed and rejected reason panels reconcile with their respective current user sets. Activity dates affect closed reasons only.
- Amounts use recorded local currency and paid amount. There is no currency selector or currency conversion. Different currencies have separate totals and averages; mixed-currency monetary sorting is disabled.
- Exact user/order drilldowns, shared permissions, totals, sorting, date memory, grouping memory, and raw XLSX downloads remain. Downloads include business-date and recorded currency/amount payment evidence.
- Payment results summarize amount, users, paid order count, AOV and amount per payer in five top cards. The grouped payment detail table has no duplicate total row. Other tables keep their existing totals.

## Regression coverage

`pnpm run test:dashboard` runs legacy checks, `scripts/test-dashboard43.cjs`, and `scripts/test-dashboard-current-dates.cjs`. The latter verifies the 10th-to-12th rebooking example, current-state date selection, stage-entry history, missing dates, future appointments, UTC+7, closure/reactivation, CC/date hierarchies, local-currency totals and averages, mixed-currency sorting, and raw payment exports. Build/type checks and actual browser interactions supplement these data-rule tests.

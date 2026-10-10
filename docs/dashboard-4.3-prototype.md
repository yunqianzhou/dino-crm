# Management dashboard 4.3 prototype

Updated 2026-10-10. Current product rules are maintained in [management-dashboard.md](management-dashboard.md). This prototype uses synthetic data shared with Sales, User and Order Centers.

## Current scope

- Three views: registration-cohort conversion, sales follow-up, payments. They share a required single business line, defaulting to the first permitted option in Sales Center option order. Reset restores this line; no All/clear selection. Downloads resolve the same default line.
- Conversion uses six independent recorded milestones and overall L2S. Trial completion requires a completed trial lesson.
- Current lead overview, Calling current states and waiting for booking ignore activity dates. Calling period activity follows recorded call/payment dates.
- Waiting is the only current-state column in the follow-up table; other columns belong to Selected period and use their business dates. Waiting is a date-independent current snapshot; booked/no-show/consultation use the associated session's scheduled date; closed uses the latest closure date. Rebooking moves the user to the new booked date and removes the old date/state from this table.
- Both follow-up tables support CC/date hierarchies independently. Follow-up date rows show a dash for waiting and matching period values; Calling date rows show dashes for current snapshots. Payment counts and amounts use payment dates throughout.
- Closed and rejected reason panels reconcile with their respective current user sets. Activity dates affect closed reasons only.
- Amounts use recorded local currency and paid amount. There is no currency selector or currency conversion. Different currencies have separate totals and averages; mixed-currency monetary sorting is disabled.
- All metric numbers are display-only, including totals, child rows, reasons and calling-route counts. Numeric drilldowns and detail modals are removed. Shared permissions, totals, sorting, date memory, grouping memory, and each section’s statistical XLSX downloads remain. Downloads contain page statistics and filter context; the conversion funnel download has been removed.
- Payment results summarize amount, users, paid order count, AOV and amount per payer in five top cards. Use large, bold figures and smaller currency codes/help to make these metrics prominent. The grouped payment detail table has no duplicate total row. Other tables keep their existing totals.

## Regression coverage

`pnpm run test:dashboard` runs legacy checks, `scripts/test-dashboard43.cjs`, and `scripts/test-dashboard-current-dates.cjs`. The latter verifies the 10th-to-12th rebooking example, current-state date selection, stage-entry history, missing dates, future appointments, browser timezones and daylight-saving changes, closure/reactivation, CC/date hierarchies, local-currency totals and averages, mixed-currency sorting, and statistical exports. Build/type checks and actual browser interactions supplement these data-rule tests.

All date filters, daily grouping, presets and exported timestamps use the browser timezone, including daylight saving. See `management-dashboard.md` for exact download headers.

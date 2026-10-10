# Management dashboard

Updated 2026-10-10. Route: `#/management-dashboard`. Shared synthetic prototype data; no production database integration.

## Views and shared filters

Three views: registration-cohort conversion, sales follow-up, and payments. Business line is a required searchable single selection; current CC remains multi-select. When no business line is supplied, select the first option after filtering the existing Sales Center option order by the account’s data permissions. There is no All business lines or clear option. Reset selects that first permitted line and clears CC and current-view dates; changing the line clears selected CCs. An explicit invalid or unauthorized URL selection produces empty data, never a broader default. No permitted options means an empty disabled selector and no data. Legacy links with multiple business lines use only the first specified line. Page data and export scope use the same resolved single line, including when the URL initially has no line parameter. Business line, current CC and permissions are shared. Each view remembers its own date range; grouping is retained across view switches. Source, purchase-intent, age and registration-age grouping controls are hidden.

All business dates use UTC+7 after interpreting the record's timezone. Current CC means current ownership, not historical operator attribution. Formal eligible users and current permissions determine the population; test users are excluded.

## Conversion overview

Registration dates select one cohort. Six milestones count distinct CRM users: leads, valid completed calls, connections, bookings ever created, completed trial lessons, and valid paid orders. Outcomes must occur between registration and now. Trial completion requires an explicit completed trial lesson, not appointment attendance. Only overall L2S is shown; independent milestone bars allow skipped steps.

Money includes qualifying payments after registration through now for the same cohort. It does not mean cash received on the registration date.

## Sales follow-up: current state first, business date second

Current lead overview and Calling current-state columns remain current snapshots independent of activity dates. Calling period counts use actual call dates. Calling date rows show a dash for current-state columns.

Follow-up first resolves the same current status as Sales Center, then filters and groups by the business date for that status:

| Column | Business date |
| --- | --- |
| Waiting to book | Most recent entry into this stage |
| Booked | Current appointment's scheduled lesson date |
| No-show | Scheduled date of the session associated with the current no-show state |
| Consultation incomplete / complete | Scheduled date of the session associated with the current state |
| Closed | Most recent closure date; reopening removes the user |
| Paid | Each qualifying order's payment date |

Example: a user misses the lesson on the 10th. Before rebooking, selecting the 10th shows no-show. After rebooking to the 12th, the 10th shows nothing and the 12th shows booked. Selecting both days counts the user once as booked. The old absence remains in user history; this table does not accumulate historical states.

Repeated notes or connections do not reset waiting-entry time. Production needs actual stage-transition timestamps. Prototype evidence uses confirmed transitions in consecutive stage-history records, explicit cancellation/reactivation events, and first completed connected calls. It never substitutes registration time, arbitrary last-update time, or today. Missing business dates appear only under All dates in a separate missing-date group. Future scheduled dates are eligible; an elapsed appointment alone does not establish a no-show.

Both comparison tables independently support CC → activity date, activity date → CC, only CC, and only date. Follow-up date rows contain actual matching current-state counts. Each user belongs to one current follow-up state/date. Paid users are independently deduplicated per day and across the selected period; the same payer can appear on multiple payment dates. Amounts and order counts sum by payment date. Do not add status and paid columns horizontally.

Closed reasons use the same date-filtered current closed users as the table. Rejected reasons remain attached to the date-independent current rejected users. Changing grouping does not change either population.

## Local currency and payment results

Amounts use the currency and paid amount recorded on each order. There is no currency selector or exchange-rate calculation. Legacy `moneyCurrency=USD` links have no effect on amounts. Normal reporting is for one selected business line and its local currency. Different countries are not combined. Unexpected mixed currencies in source orders are kept separate rather than relabeled or converted. USD appears only when the underlying order is already denominated in USD; amounts are never relabeled to the business line's currency.

- Amount paid: sum of qualifying paid amounts within each currency.
- AOV: that currency's amount / that currency's paid order count.
- Amount per payer: that currency's amount / its distinct payer count.
- No orders: amount 0 and averages unavailable.
- Missing currency: retain the order and payer counts, show an explicitly labeled unknown-currency group with unavailable money/averages, and preserve the recorded amount in the export for reconciliation.

Orders must be currently paid, have a valid payment timestamp and finite positive paid amount. Refunds, cancelled, pending and zero-value orders are excluded. A profile's paid flag cannot substitute for order evidence. Original orders and amounts are unchanged.

Payment results show five top-level cards: amount paid, paid users, paid orders, AOV, and amount per payer. All five card values are prominent (26–32 px, bold, high contrast), with smaller currency codes and secondary labels/help. The amount-paid card has a light green emphasis. All values remain plain display text; the payment download contains the qualifying order details. The payment detail table shows grouped records only, with no repeated total row; the cards summarize the full selection independently of sorting, expansion and pagination.

Money/AOV sorting uses unrounded recorded values within a single known currency. Multiple currencies cannot form one ranking, so monetary sorting is disabled in mixed-currency selections. Unavailable values sort last in either direction. Other dashboard tables retain their pinned totals, recalculated from the full selected population outside sorting and pagination.

## Display-only metrics and raw downloads

Every business metric is display-only, including funnel counts, summary cards, table totals and child rows, reason counts and shares, order counts, money/averages, and calling system/route counts and durations. Metric values have no link, button, click handler, keyboard action or detail modal, regardless of access to Sales, User or Order Centers. Sorting, expansion, pagination, filters and view selection remain interactive.

Details are available through each section’s existing downloads: conversion funnel/details, current lead inventory, calling, follow-up, rejection/closure reasons, payments, and the calling-system/route call-detail download. Downloads reconcile with the same metric populations and scopes; sorting, pagination and expansion do not truncate them.

Downloads require the dashboard's independent export permission. Follow-up exports contain filtered current users and their business-date evidence, relevant current appointments, period users, payment evidence, and scope. Payment exports across all three views preserve currency and paid amount, with no target currency, exchange rate, converted amount or rate version. Reason exports use the same user sets as the displayed distribution. UTC export timestamps and scope allow reconciliation.

## Verification

`pnpm run test:dashboard` covers existing dashboard regressions plus current-stage date rules, rebooking, waiting history, missing dates, UTC+7, future appointments, closure/reopening, both grouping directions, payment dates, local-currency totals, per-currency averages, mixed-currency sorting and raw payment exports. `pnpm run build` checks types and builds. The deployment workflow also runs App A/B, Phase 5 and outbound checks.

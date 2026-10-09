# Management dashboard

Updated 2026-10-09. Route: `#/management-dashboard`. Shared synthetic prototype data; no production database integration.

## Views and shared filters

Three views: registration-cohort conversion, sales follow-up, and payments. Business line, current CC multi-select, permissions and display currency are shared. Each view remembers its own date range; grouping and currency survive list drilldown and return. Source, purchase-intent, age and registration-age grouping controls are hidden.

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

## Display currency and payment results

The shared selector has exactly two choices: Local currency and US dollar (USD), default Local currency. It converts the same qualifying orders; it never filters by original payment currency. Payer and order counts remain unchanged across currency switches.

Local currency follows the user's business line: VND, KRW, MYR, IDR, THB, SGD, SAR or USD. Multiple local currencies remain separate. USD converts and aggregates all selected orders. Unconfigured mappings or unknown source currency are unavailable, not an extra selector option.

The prototype uses fixed synthetic rates (`demo-2026-10-09`), not market quotes: USD 1, VND 25000, KRW 1400, MYR 4.5, IDR 16000, THB 35, SGD 1.35, SAR 3.75 per USD. Conversion is original amount ÷ source rate × target rate. Sum unrounded converted values before display rounding. Production must supply an approved, versioned rate table with effective timestamps.

- Amount paid: sum of qualifying converted order amounts.
- AOV: converted amount / paid order count.
- Amount per payer: converted amount / distinct payer count.
- No orders: amount 0 and averages unavailable.
- Missing rates: affected currency total and averages unavailable, with missing-order count; payer/order counts remain. Never show a partial sum as a complete total.

Orders must be currently paid, have a valid payment timestamp and finite positive paid amount. Refunds, cancelled, pending and zero-value orders are excluded. A profile's paid flag cannot substitute for order evidence. Original orders and amounts are unchanged.

Money/AOV sorting uses the displayed converted values. Multiple local currencies cannot form one ranking; switch to USD for that comparison. Unavailable values sort last in either direction. Pinned totals are recalculated from the full selected population, outside sorting and pagination.

## Details and raw downloads

Ordinary lead/status counts open Sales Center with exact clicked user IDs; paid-user counts open User Center. Payment order counts, amount and averages open Order Center with exact original order IDs. Display currency is retained on return and is never imposed as an original-order currency filter. Existing module permissions still apply; empty selections stay empty.

Downloads require the dashboard's independent export permission. Follow-up exports contain filtered current users and their business-date evidence, relevant current appointments, period users, payment evidence, and scope. Payment exports across all three views preserve original currency/amount, target currency, rate, converted amount and rate version. Reason exports use the same user sets as the displayed distribution. UTC export timestamps and scope allow reconciliation.

## Verification

`pnpm run test:dashboard` covers existing dashboard regressions plus current-stage date rules, rebooking, waiting history, missing dates, UTC+7, future appointments, closure/reopening, both grouping directions, payment dates, same-order currency conversion and missing rates. `pnpm run build` checks types and builds. The deployment workflow also runs App A/B, Phase 5 and outbound checks.

# Management dashboard

Updated 2026-10-10. Route: `#/management-dashboard`. Shared synthetic prototype data; no production database integration.

## Views and shared filters

Three views: registration-cohort conversion, sales follow-up, and payments. Business line is a required searchable single selection; current CC remains multi-select. When no business line is supplied, select the first option after filtering the existing Sales Center option order by the account’s data permissions. There is no All business lines or clear option. Reset selects that first permitted line and clears CC and current-view dates; changing the line clears selected CCs. An explicit invalid or unauthorized URL selection produces empty data, never a broader default. No permitted options means an empty disabled selector and no data. Legacy links with multiple business lines use only the first specified line. Page data and export scope use the same resolved single line, including when the URL initially has no line parameter. Business line, current CC and permissions are shared. Each view remembers its own date range; grouping is retained across view switches. Source, purchase-intent, age and registration-age grouping controls are hidden.

All dashboard dates, date presets, filters, grouping and exported timestamps use the signed-in user’s browser timezone, including daylight-saving rules. Interpret the record’s original timezone/offset before converting the instant; do not infer the reporting timezone from its business line. Current CC means current ownership, not historical operator attribution. Formal eligible users and current permissions determine the population; test users are excluded.

## Conversion overview

Registration dates select one cohort. Six milestones count distinct CRM users: leads, valid completed calls, connections, bookings ever created, completed trial lessons, and valid paid orders. Outcomes must occur between registration and now. Trial completion requires an explicit completed trial lesson, not appointment attendance. Only overall L2S is shown; independent milestone bars allow skipped steps.

Money includes qualifying payments after registration through now for the same cohort. It does not mean cash received on the registration date.

## Sales follow-up: current state first, business date second

Current lead overview and Calling current-state columns remain current snapshots independent of activity dates. Calling period counts use actual call dates. Calling date rows show a dash for current-state columns.

Waiting is the only Current status column and is independent of activity dates. The other columns belong to Selected period; they resolve the same current status as Sales Center, then filter and group by the applicable business date:

| Column | Business date |
| --- | --- |
| Waiting to book | Current snapshot; no date filtering or date grouping |
| Booked | Current appointment's scheduled lesson date |
| No-show | Scheduled date of the session associated with the current no-show state |
| Consultation incomplete / complete | Scheduled date of the session associated with the current state |
| Closed | Most recent closure date; reopening removes the user |
| Paid | Each qualifying order's payment date |

Example: a user misses the lesson on the 10th. Before rebooking, selecting the 10th shows no-show. After rebooking to the 12th, the 10th shows nothing and the 12th shows booked. Selecting both days counts the user once as booked. The old absence remains in user history; this table does not accumulate historical states.

Waiting does not require a stage-entry date. Missing business dates for period states appear only under All dates in a separate missing-date group. Future scheduled dates are eligible; an elapsed appointment alone does not establish a no-show.

Both comparison tables independently support CC → activity date, activity date → CC, only CC, and only date. Follow-up date rows show a dash for waiting and actual values for period columns. Each user belongs to one current follow-up state; waiting is not repeated by date. Paid users are independently deduplicated per day and across the selected period; the same payer can appear on multiple payment dates. Amounts and order counts sum by payment date. Do not add status and paid columns horizontally.

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

## Display-only metrics and statistical downloads

All metric numbers remain display-only. The funnel has no download button; conversion details is the only conversion download entry. Every download now contains the same statistics as its page table, plus a Filters sheet (Item, Value). Raw user, call, booking, lesson and order evidence sheets are no longer exported. Downloading includes all filtered primary groups and enabled secondary groups regardless of sorting, pagination or expansion.

Group tables identify Total, Primary group and Secondary group rows; never sum them together. Date and Current CC columns stay in that order for either grouping direction. Waiting is the only current snapshot in the follow-up table; its total and CC rows ignore date filters, and dated rows show a dash. All other follow-up columns belong to Selected period and use their existing business dates; payments always use payment dates.

Filters record business line, permission intersection, CC names/accounts, date scope, grouping, formal-user scope, browser IANA timezone, local calculation/export timestamps and reconciliation rules. Downloads keep the independent dashboard export permission.

## Verification

`pnpm run test:dashboard` covers existing dashboard regressions plus current-stage date rules, rebooking, waiting history, missing dates, browser timezones and daylight-saving changes, future appointments, closure/reopening, both grouping directions, payment dates, local-currency totals, per-currency averages, mixed-currency sorting, statistical exports and page-value reconciliation. `pnpm run build` checks types and builds. The deployment workflow also runs App A/B, Phase 5 and outbound checks.

## Vietnam and Malaysia demonstration records

A one-time additive fixture update provides 96 additional Vietnamese users and 100 Malaysian users, with assigned CCs, unassigned leads, calls, bookings, completed trial lessons and current follow-up outcomes. It adds 18 paid Vietnamese orders in VND and 20 paid Malaysian orders in MYR, plus pending, canceled and refunded examples. All contacts are synthetic, records are marked Demo, and linked evidence is shared with the other CRM pages and the dashboard statistics. Existing records, edits and deliberate deletions remain intact on refresh. Dates are anchored to the first load of this fixture update.

## Download column templates

Each file contains the named data sheet and Filters. Headers below are in exact Chinese export order. Dates use the browser timezone. Missing/non-applicable values use —; actual zeros remain 0.

- **转化明细** (`conversion-details.xlsx`): 行类型、注册日期、当前 CC、线索数（含已付费）、外呼人数、接通人数、预约人数、体验课完成人数、已支付人数、L2S、币种、实付金额、平均订单金额（AOV）。
- **当前线索概况** (`followup-current.xlsx`): 当前 CC、当前销售线索、已分配、未分配、已拒绝、已结束、暂不跟进。
- **外呼情况** (`followup-calls.xlsx`): 行类型、活动日期、当前 CC、待外呼、未接通 · 待跟进、已拒绝、外呼人数、接通人数。
- **跟进情况** (`followup-followup.xlsx`): 行类型、活动日期、当前 CC、待预约、已预约、未出勤、咨询未完成、咨询已完成、已结束、已支付、币种、实付金额、平均订单金额（AOV）。
- **支付结果** (`payments.xlsx`): 行类型、支付日期、当前 CC、已支付订单、已支付用户、币种、实付金额、平均订单金额（AOV）、人均支付金额。
- **已拒绝原因分布** (`rejection-reasons.xlsx`): 原因、人数、占比。
- **已结束原因分布** (`closure-reasons.xlsx`): 原因、人数、占比。
- **外呼系统与线路** (`calling-routes.xlsx`): 外呼系统、线路、通话次数、外呼人数、接通次数、接通人数、接通时长（秒）。

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

## Display-only metrics and detail downloads

Numbers remain display-only. Only the lower conversion-details section has a conversion download button. Each entry downloads its contributing users and business records, with user IDs, current CC, registration timestamps, business-record IDs and event timestamps. User sheets contain numeric 0/1 membership flags; event sheets retain every qualifying record. There are no aggregate, parent or child rows in exports. Grouping, sorting, pagination and expansion do not truncate details.

Times use the browser timezone, with UTC offsets on timestamps and an IANA timezone in Filters. Missing source times stay blank, never inferred from registration or last update. Waiting remains a current snapshot regardless of the selected dates; its business date stays blank. Other follow-up states retain their selected-period business dates. IDs are strings. Orders retain original currency and amounts; cross-currency user totals stay blank. Permissions are unchanged.

Reconcile flags to page counts, deduplicate event user IDs for people counts, and sum only order amounts per currency for revenue. Recompute AOV, per-payer amounts and L2S. Never join multiple event tables and then sum duplicated amounts.

## Verification

`pnpm run test:dashboard` covers existing dashboard regressions plus current-stage date rules, rebooking, waiting history, missing dates, browser timezones and daylight-saving changes, future appointments, closure/reopening, both grouping directions, payment dates, local-currency totals, per-currency averages, mixed-currency sorting, user/event detail exports and page-value reconciliation. `pnpm run build` checks types and builds. The deployment workflow also runs App A/B, Phase 5 and outbound checks.

## Vietnam and Malaysia demonstration records

A one-time additive fixture update provides 96 additional Vietnamese users and 100 Malaysian users, with assigned CCs, unassigned leads, calls, bookings, completed trial lessons and current follow-up outcomes. It adds 18 paid Vietnamese orders in VND and 20 paid Malaysian orders in MYR, plus pending, canceled and refunded examples. All contacts are synthetic, records are marked Demo, and linked evidence is shared with the other CRM pages and the dashboard statistics. Existing records, edits and deliberate deletions remain intact on refresh. Dates are anchored to the first load of this fixture update.

## Download column templates

All entries append Filters (项目、内容). The public blank template is `public/templates/dashboard-download-headers.xlsx`.

| Entry/file | Detail sheets |
| --- | --- |
| conversion-details.xlsx | 转化用户明细、通话记录明细、预约记录明细、体验课记录明细、支付订单明细 |
| followup-current.xlsx | 当前线索用户明细 |
| followup-calls.xlsx | 外呼用户明细、通话记录明细 |
| followup-followup.xlsx | 跟进用户明细、预约记录明细、支付订单明细 |
| payments.xlsx | 支付订单明细 |
| rejection-reasons.xlsx / closure-reasons.xlsx | 原因用户明细 |
| calling-routes.xlsx | 通话记录明细 |

### 转化用户明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、线索数（含已付费）（0/1）、外呼人数（0/1）、接通人数（0/1）、预约人数（0/1）、体验课完成人数（0/1）、已支付人数（0/1）、首次有效外呼时间、首次接通时间、首次预约创建时间、首次体验课完成时间、首次有效支付时间、有效已支付订单数、币种、用户实付金额合计。

### 当前线索用户明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、当前销售阶段、跟进进度、最近跟进时间、最近跟进备注、当前销售线索（0/1）、已分配（0/1）、未分配（0/1）、已拒绝（0/1）、已结束（0/1）、暂不跟进（0/1）。

### 外呼用户明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、当前销售阶段、跟进进度、最近跟进时间、最近跟进备注、待外呼（0/1）、未接通 · 待跟进（0/1）、已拒绝（0/1）、外呼人数（0/1）、接通人数（0/1）、期间首次外呼时间、期间最近外呼时间、期间首次接通时间、期间最近接通时间。

### 跟进用户明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、当前销售阶段、跟进进度、最近跟进时间、最近跟进备注、待预约（0/1）、已预约（0/1）、未出勤（0/1）、咨询未完成（0/1）、咨询已完成（0/1）、已结束（0/1）、已支付（0/1）、状态统计口径、状态业务日期、状态业务时间、状态时间依据、关联预约 ID、期间首次支付时间、期间最近支付时间、有效已支付订单数、币种、用户实付金额合计。

### 通话记录明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、通话 ID、外呼系统、第三方通话 ID、线路 ID、线路名称、坐席、操作人、起呼时间、通话日期、接通时间、结束时间、通话状态、通话结果、接通时长（秒）、结束原因、同步时间、通话备注。

### 预约记录明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、预约 ID、预约创建时间、预约上课时间、预约上课日期、预约状态、出勤状态、咨询状态、原因、预约备注、创建人、更新时间、更新人。

### 体验课记录明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、课程记录 ID、课标、课程名称、课程类型、课程状态、老师、上课时间、完课时间、完课日期。

### 支付订单明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、订单 ID、商品名称、订单状态、原价、实付金额、币种、支付方式、支付时间、支付日期、有效期截止时间。

### 原因用户明细

用户 ID、姓名、业务线、用户类型、当前 CC、当前 CC 账号、注册时间、注册日期、用户状态、当前销售阶段、原因分类、具体原因、拒绝或结束时间、拒绝或结束日期、时间依据、最近跟进时间、最近跟进备注。

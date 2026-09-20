# Management dashboard / 管理看板

Route: `#/management-dashboard`. Uses the existing prototype store. No production or test database connection; no customer data was added.

## Scope and counting

- Vietnam only. Respects sales module access, country scope and the same current owner visibility rules as Sales Center Phase 3.
- Counts formal users only; test users are always excluded, including legacy URLs containing a user-type filter. All registration dates are selected by default.
- Current follow-up: current sales leads, split into assigned/unassigned and the exact shared `consultationStage` stages. The CC table breaks down these same counts by current owner.
- Period activity: distinct user IDs per metric. Registration uses registration time, calls use call time, bookings use appointment creation time. Attendance/completion use explicit lifecycle record timestamps (`reportedAt`); current status and appointment update timestamps are not treated as historical evidence.
- All date boundaries use Vietnam UTC+7. Period columns are independent and must not be divided to produce conversion rates.
- Historical conversion rates are deferred: the prior registration-cohort implementation did not establish complete history and must not be shown as a reliable funnel. Counting rules retain the user-approved definitions: contact / leads, booked / contacted, attended / booked, paid / attended, and paid / leads. Current-stage percentages are only stage / current leads.
- CC, date, channel source, purchase intent, age and registration age are six equally visible breakdown controls. Existing source labels do not imply a completed business-source mapping.
- Payments appear in both modes. In Sales activity they share the activity dates; in Current stage they have independent payment-date filters, explicitly separate from registration dates. Both use the selected current CC. Show amount paid and amount per distinct payer, with currencies kept separate. Refunded orders restate their original payment period; these amounts are not reconciled accounting revenue.

## Navigation

- Counts open the matching users, including zero-count empty states.
- Sales follow-up opens `/sales-v3?studentId=...&tab=pool|follow` with an exact user filter. Existing actions and permissions apply.
- User details open `/users-v2/:studentId`.
- User orders open `/orders-v3?studentId=...` with an exact user filter, then existing order details and transactions. No matching orders is a valid empty state.
- A return button restores dashboard filters and its user modal. Order details return to the filtered order list.
- All new dashboard content and linked navigation use the global Chinese/English language selection.

## Verification

`npm run test:dashboard` checks UTC+7 boundaries, distinct users, scope/owner permissions, paid/test exclusions, current-stage totals and explicit activity dates. `npm run build` checks types and builds the site. Both run before GitHub Pages deployment.

## Demo dataset

Existing browser sessions receive a one-time additive dataset on reload: 204 Vietnam users, six CCs, 180 current sales leads (156 assigned / 24 unassigned), 24 paid users, 54 orders covering all four order statuses, and related calls, bookings, lifecycle records and lessons. The nine current stages all have examples.

The dataset uses reserved `.invalid` accounts and deliberately invalid phone numbers. These fictional AppID users are marked as formal users to exercise the default dashboard filter. They are prototype fixtures, not real customers. Registration and event times span the three weeks before first load; their dates and user edits are then retained. Existing data is preserved; a migration marker prevents duplicates and stops deleted fixtures from being re-added.

## Date breakdown

The two modes are labeled 当前阶段分布 / Current stage distribution and 销售活动统计 / Sales activity. Each supports By CC and By date. Current-stage date rows group by registration date and show the current stage, not a historical snapshot. Activity rows group by the time used for each metric, in UTC+7, and deduplicate within each day. Only dates with data appear. The summary shows distinct users across the full selected period, not the sum of daily rows. Selecting a daily count opens those exact users and preserves that date when returning from a Phase 3 page.

## Business table review and management view

The business Base was read via the existing authorized Lark API (table field metadata only). Test database fields and aggregate enum coverage were checked read-only. No real records, credentials or database aggregate results are bundled into the public prototype.

| Business need | Prototype support | Basis / limitation |
| --- | --- | --- |
| CC and dates | Same metrics grouped by current CC or date | Current owner attribution; dates follow each metric definition |
| Purchase intent | Interested / not interested / not recorded | `sales_lead.purchase_intent`; does not reproduce Lark PL 50% / 80% / deposit labels |
| Age | Existing CRM age groups, missing shown separately | `user_profile.age_range`; Lark age is free text |
| Time since registration | 0–7 / 8–30 / 31+ calendar days, as of today in Vietnam | Derived from registration time, not stage duration, SLA or Lark Old Lead |
| Follow-up reasons | No-show, incomplete consultation, pause and close | `sales_lifecycle_event.action`, `reason_code`, `reported_at`; categories use CRM options |
| Detailed Lark rejection reasons | Not mapped automatically | Lark has more detailed categories than CRM; unknown free text groups as Other |
| Appointment confirmation, city, deposits and remaining balance | Deferred | No verified complete equivalent in the audited sales tables |
| Sources and campaigns | Source is visible alongside the other breakdowns; campaigns deferred | Source mapping is incomplete |
| Paid users | Supported in the prototype from paid orders | Positive amount and valid payment time; deduplicate by user; live payment reconciliation remains pending |
| Historical conversion rates | Deferred; approved formulas retained in Counting rules | Complete event history remains unresolved |
| Payment amounts | Both modes, explicit payment dates, separate by currency | Successful positive paid orders; original period restated on refund; no accounting revenue claim |

Current-stage reasons use the latest matching explicit record for users still in that stage. Missing reasons remain a separate category. Activity reasons use recorded dates and distinct users within each reason; users can occur in multiple reason rows, so these rows have no additive grand total or share. Every count opens matching users using the same shared data and permissions; Phase 3 return links preserve the selected dimension and details.

The view always excludes test users, even when an old URL contains a type filter. The unnecessary user-type dropdown has been removed. Header shows scope and Demo data; detailed counting notes are available through Counting rules. Reason fixtures are added once only to existing original synthetic events without replacing existing reasons or changing dates, IDs or user edits.


## Paid users (2026-09-17)

Paid users are an independent order-based metric in both views and all supported breakdowns. Orders must currently be 已支付, have a positive finite paidAmount and a valid paidTime. Pending, cancelled, refunded and zero-value orders are excluded. Multiple qualifying orders for one user count once in the selection. Refunds therefore restate the earlier counts. No profile payment flag, membership expiry or coupon is used as order evidence.

The current view filters these users by registration date, alongside (but outside) the current unpaid sales-lead total and its nine-stage denominator. The activity view filters orders by payment date in Vietnam UTC+7. Daily rows include days with only a payment, and the whole-period summary deduplicates repeat payments across dates. CC attribution remains current ownership. Clicking a count uses the existing user and Order Center Phase 3 detail links. The shared synthetic dataset contains 24 qualifying paid users; this does not imply a production payment integration has been completed.


## Usability revision and content restoration (2026-09-20)

- Current view retains overall counts, all nine stages, current breakdown, registration-cohort outcomes, payments and follow-up reasons. No module disappears when switching to activity mode except the explicitly current-stage distribution.
- All six breakdown dimensions are equally visible in one wrapping button group. The current table defaults to all 11 metrics (lead total, nine stages, paid users); activity defaults to all seven. Optional column choices are preserved, with Show all metrics to restore the full table.
- Registration-cohort outcomes restore the old lead/contact/booking/attendance/payment counts and date → CC/source hierarchy. Paid users remain in the original registered cohort. Subsequent events are not restricted to registration dates. Counts open exact users at both parent and child levels, preserving the path and modal on return.
- Historical counts require recorded evidence: calls/contact events, appointment creation/booking events, attendance/consultation events and paid orders. Cancelled bookings still demonstrate a booking was created. Current appointment attendance flags alone are not historical evidence. Missing records do not prove that an outcome never happened.
- Historical conversion percentages remain deferred; all five approved formulas and the reason are visible in the restored section as well as Counting rules. Independent record counts are not divided into a purported funnel.
- Current mode shares the global registration dates with the cohort section and provides separate payment dates. Activity mode shares global activity dates with payments and provides separate registration dates for cohort outcomes. Current CC is shared across all sections. Local date selections persist in the dashboard URL.
- Payment order counts, payer counts and amounts open exact matching details; users can open qualifying orders and the existing Phase 3 detail. CC/date, currency, user selection and dialog state return with the dashboard URL.
- User detail actions remain visible while scrolling. Summary cards have a full-card hit area and keyboard focus remains on the count button.
- No fixtures, customer records, permissions or other CRM modules were changed.

Validation includes cohort retention of later payments, repeated-call deduplication, cancelled booking evidence, missing attendance history, owner/test-user exclusions, subgroup totals and empty ranges, in addition to the existing UTC+7, currency and refund tests. Browser checks cover unified dimensions, all columns, expandable hierarchy, exact user details and return navigation, independent dates, empty states and English labels.

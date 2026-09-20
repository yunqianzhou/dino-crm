# Management dashboard

Route: `#/management-dashboard`. Uses the shared prototype store, not a test or production database. No real customer records or business screenshot figures are bundled into the site.

## Business purpose

The supplied business dashboard and follow-up conversation establish the priorities:

1. Compare CC conversion at each step: lead, contact, appointment, attendance and payment.
2. Combine date and CC to examine daily CC activity and the outcomes of a registration group.
3. Include amount paid and AOV in the corresponding detail table, not just a separate payment page.
4. Source analysis is deferred at the user’s request. Source filters, grouping choices and source comparison matrices are hidden. Existing source data is preserved; legacy source-filter URL parameters do not narrow the dashboard.

## Reading the page

Four always-visible question buttons keep all content in the same dashboard. Each view has one date filter with an explicit meaning, a plain-language interpretation of the current numbers, and a suggested next action. Dates are remembered separately for each view. Current CC is shared. Counting rules include an example of one user registering, being contacted and paying on three different dates.

| View | Date meaning | Content |
| --- | --- | --- |
| Conversion overview (default) | Registration dates select the same lead group; recorded outcomes and valid orders are followed to date | Five step counts, five reference rates, date-to-CC hierarchy and amount/AOV column |
| Current leads | Registration dates select users whose stages are shown now | Lead/assigned/unassigned/paid cards, all nine current stages, all 11 metrics, amount/AOV, follow-up reasons |
| Sales activity | Each metric uses its activity date | Seven distinct-user activity metrics, daily rows expandable by CC, amount/AOV by payment date, recorded follow-up reasons |
| Payments | Payment dates | Amount, payers, AOV, amount per payer, paid orders and exact user/order details; dates expandable by CC |

The five current/activity breakdowns remain equally visible: CC, date, intent, age and time since registration. All metrics are shown by default. Optional column choices persist; Show all metrics restores them.

Conversion overview defaults to registration date then current CC. Both hierarchy levels offer date and CC only. Legacy source hierarchy selections fall back to date/CC.

## Definitions and limitations

- Vietnam formal users only; exclude test users. Preserve the existing country scope and current-owner access rules. Missing current owner is shown as Unassigned.
- All date boundaries use Vietnam UTC+7. CC attribution is current ownership, not the historical operator or assignment at the event time.
- Current stages use the shared `consultationStage` definition. The nine stages partition current sales leads; their percentages mean stage / current leads, not conversion.
- Activity counts deduplicate each metric independently. Registration uses registration time; calls use call time; bookings use creation time; attendance/completion use explicit lifecycle `reportedAt`. Daily counts may include the same user on several dates. Grand totals deduplicate the whole period.
- Registered lead groups include phone-bearing eligible users who later paid. Contact requires a valid dated call or contact event; booking requires a created appointment or booking event (cancellation does not erase a past booking); attendance requires attendance/consultation events. Current appointment status alone does not reconstruct history.
- Missing historical records do not prove an outcome never occurred. Conversion percentages are explicitly **reference ratios from available records**, not verified complete-history performance rates.

| Reference rate | Formula |
| --- | --- |
| Contact | Reached users / leads |
| Booking | Booked users / reached users |
| Attendance | Attended users / booked users |
| Attendance-to-payment | Paid users / attended users |
| Lead-to-payment | Paid users / leads |

A rate is unavailable when its denominator is zero, or its numerator contains users absent from the preceding-step evidence. Valid zero numerators display 0%. Totals are calculated from the total selected user sets, not averaged from row percentages. Independent activity counts are never divided into these ratios.

## Amounts and AOV

A qualifying order must currently be Paid, have a finite positive paidAmount and a valid paidTime. Pending, cancelled, refunded and zero-value orders are excluded. A profile payment flag is not a substitute for an order.

- Amount paid is the sum of qualifying orders in one currency.
- AOV (average order value) is amount paid / paid order count.
- Amount per paying user is amount paid / distinct paying users. It remains a separate payment metric.
- Registration-group/current-stage tables include valid payments to date for the users registered in that row's date range. These are not cash receipts on the registration day.
- Activity/payment tables use payment dates. A date-to-CC child row matches both that date and current owner.
- Currencies are never summed together. Missing currency remains separate. Refunds restate the original paid period; these are not reconciled accounting net-revenue figures.

## Details and navigation

Non-payment user counts (leads, contact, booking, attendance, sales activity, stages and reasons) open Sales Center with the exact clicked user set. Only paid-user counts open User Center. This rule applies to headline cards, breakdown rows, hierarchy children and totals across every question view. Sales Center reuses its existing follow-up table as Dashboard results while a dashboard selection is active, retaining unassigned and subsequently paid cohort members; normal pool/follow routing resumes when the selection is cleared. Paid historical rows remain viewable without lead mutation actions; unassigned leads retain their claim action. Payment order counts and amounts open the existing Order Center list with the exact paid-order set, currency, date and CC scope. No aggregate detail modals are used. Destination lists show a removable dashboard selection and a return-to-dashboard button. Existing module and data permissions still apply; empty clicked sets remain empty. Browser history retains the selection, and returning restores the selected dashboard question, dates and CCs.

Payment rows open exact paid orders or distinct payers; date-plus-CC payment details preserve both constraints. Users can open their qualifying orders and the existing Phase 3 order detail/transactions. Legacy current/activity and detail URLs remain readable after introduction of the four question views.

Chinese and English are supported through the existing language menu. Explanations, formulas, examples and date semantics switch with the rest of the page.

## Other retained dimensions

Purchase intent uses current CRM values; it does not recreate business PL 50%/80%/deposit labels. Registration age uses elapsed calendar days as of today, not time in stage or Old Lead. Follow-up reasons retain no-show, incomplete consultation, pause and close categories, with missing reasons separately identified. Current reasons use the latest matching record; activity reasons use recorded dates and deduplicate within each reason.

Appointment confirmation, city, deposit/balance and more detailed business-specific rejection categories remain outside the verified field mapping.

## Demo and verification

The existing additive demo dataset remains unchanged: 204 Vietnam users, six CCs, 180 current leads and 24 paid users, plus orders, appointments and events. Browser sessions can contain additional prototype records or edits. Source data is preserved but hidden from the dashboard; business screenshot values are not copied in as data.

`npm run test:dashboard` verifies UTC+7 boundaries, permissions, deduplication, shared stages, paid-order evidence, currency separation, refunds, registration cohorts, step-rate denominators and missing preceding-step records, AOV versus amount per payer, table payment-date semantics, source matrix totals, independent view dates and legacy URL interpretation. `npm run build` checks types and produces the site. Browser verification covers all four questions, date retention, reference-rate rows, date-to-CC expansion, direct user/order list navigation and return navigation.

## CC selection

The shared CC filter supports multiple selections and name search. An empty selection means all permitted CCs; clear restores that scope. Current leads, daily activity, cohort conversion, reasons, revenue and AOV use the union of selected CCs, without double counting. Unassigned can be selected alongside named CCs. Repeated `cc` URL parameters retain the selection across views, reloads and detail-return navigation; legacy single-CC links remain valid. Detail headers list the selected CCs unless a more specific row was opened.

## Table totals and sorting

Current/activity, cohort, payment and reason tables pin their totals below the column header, outside sorting and pagination. Every numeric column supports ascending and descending sorting within each hierarchy level. Combined revenue/AOV columns offer a sorting metric and, when needed, one currency; different currencies are never added for ranking. Missing rates/AOV remain last in either direction. Reason totals count distinct users even when historical reasons overlap.

L2S (lead-to-paid conversion) is the final top-level KPI next to paid users and also a sortable column in the date/CC table. It uses paid users divided by the same registered cohort; the four intermediate step rates remain together below.

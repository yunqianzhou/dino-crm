# Management dashboard 4.3 prototype

Updated 2026-09-21. Demo data only; no production integration.

- Three views: registration-cohort conversion, sales follow-up, payments.
- Six cohort facts: leads, valid completed calls, connections, bookings ever created, completed trial lessons, valid paid orders. All deduplicate by CRM user ID within the same registration cohort. Outcomes must be at/after registration and no later than now. The demo model links lessons directly to the CRM user; production must resolve student-to-CRM-user mapping.
- Trial completion uses `LessonRecord.lessonType=体验课`, `status=已完课`, and a valid `completedAt`. Appointment attendance cannot substitute for it. Independent bar heights allow skipped steps; only overall L2S is shown.
- Sales follow-up contains Calling and Follow-up sections. Current workload ignores activity dates. Period activity uses call times, booking creation times, result registration times and payment times. Current CC is the grouping owner, not a claim of historical performance attribution.
- Phone-stage rejected counts, reason breakdown panels and scheduled-date detail reporting are deferred and hidden, including their controls, exports and explanatory copy. Their data helpers remain for future use; they are not current product capabilities.
- Existing stages remain visible. Attended appointments awaiting a consultation result are separated. Payment concerns do not close a lead. Explicit closure types separate phone rejection from post-consultation closure; unclassified legacy records remain separate in the data model. The prototype recognizes optional closure event `closureType` and explicit `sale/待支付` concern events; this dashboard change does not implement the new Sales Center data-entry actions or production fields.
- CC multi-select, independent date memory per view, top totals, numeric sorting, currency-specific amount/AOV sorting and direct scoped list navigation are retained. Grouping selections survive list drilldown/back navigation. Download buttons produce XLSX raw evidence with section scope and timestamp, subject to existing export permission.
- Existing synthetic fixtures gain separate trial lesson records and payment concern events once. Existing real records, edited reasons, subsequent deletions and unrelated browser storage are preserved.

Validation: `npm run test:dashboard` runs legacy regression checks plus `scripts/test-dashboard43.cjs`; `npm run build` type-checks and builds. Browser checks are recorded separately in the delivery notes; build success alone is not proof of browser interaction verification.

## Unified follow-up comparison tables

Calling and Sales follow-up each use one table and one raw download entry. Two grouped headers distinguish current workload from activity in the selected period. A single grouping control applies to both groups of columns. The default row is current CC; expanding it shows daily activity. Daily rows display a dash for current workload, rather than fabricating historical snapshots. Daily payment amounts/AOV use only payments on that date. Parent and total user counts remain independently deduplicated across dates. Downloads include current snapshot, period users and raw evidence as separate sheets in the same workbook.

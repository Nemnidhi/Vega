# Sales targets

Open **Sales Targets** from the sidebar. Only admins and salespeople have page/API access. Admins can assign and edit targets; salespeople can only read targets assigned to their own account. Other salespeople's targets and the team picker are not included in their API responses.

Targets support revenue in INR and a count of closed deals. Pick a calendar month or calendar year, salesperson, target, achieved value and optional notes. A salesperson can have one target per metric and period; monthly and yearly targets are separate goals, not automatically added together. Only active sales accounts can receive new targets. Existing targets remain accessible to admins even if the assignee later becomes inactive.

Selecting Closed Won on a lead opens a revenue form (INR, including an explicit zero for a free deal). Sales closure does not require scope or proposal documents; engineering-start requirements remain separate. Revenue and salesperson attribution are stored atomically on the lead. Both revenue and closed-deal targets calculate automatic progress from closed leads in the matching Asia/Kolkata month or calendar year, including targets assigned after the deal closed. Repeated saves do not count twice. Transferring an already closed lead retains its original salesperson credit. Reopening removes its contribution; closing again records the new closure date, owner and revenue.

Admins can set an opening adjustment for historical achievements not captured through lead closure. Total progress is automatic closed-lead progress plus that adjustment, shown separately on each card. Existing manually entered achieved values remain as opening adjustments. Avoid entering the same deal in both places. Salespeople cannot edit target definitions or adjustments. Signing a proposal no longer silently closes a lead; use the explicit revenue form.

Unique indexing prevents duplicate assignments for the same person/metric/period. Updates carry a version so a stale form cannot overwrite another admin's change. There is no bulk assignment, automatic renewal or deletion operation in this page.

Validation: use an isolated MongoDB instance on `127.0.0.1:27943` and set `SALES_TARGET_TEST_URI=mongodb://127.0.0.1:27943/hrms_sales_targets_test_<unique suffix>`, then run `npm run test:sales-targets`. The test does not load application environment files.

Run `npm run test:deal-revenue` against a fresh isolated test database to verify revenue validation, closure without scope/proposal documents, ownership, retry handling, target aggregation, transfer/reopen semantics and India period boundaries.

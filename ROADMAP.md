# RowMend product roadmap

RowMend stays local-first. The free browser product should remain useful without an account or artificial row limits. Paid value begins when RowMend removes recurring operational work for individuals and teams.

## 0.9.0 — Run Insights & Data Drift

Goal: make repeat runs explain what changed.

Free capabilities:
- compare the current run with the previous compatible run
- save a specific local run as the comparison baseline
- row-count, completeness, duplicate and invalid-row deltas
- per-column schema/type/missingness/uniqueness drift
- workflow-configuration fingerprint awareness
- compact local trend views
- export a privacy-minimized insights report
- no source rows, cell values, file names or generated SQL in run history

Release gate:
- runner UI complete
- legacy 0.8 history handled safely
- privacy copy updated
- core tests pass
- production smoke test before publish

## 0.10.0 — Scale & Trust

Goal: make the free local workflow dependable on messier real-world files.

Planned focus:
- Excel worksheet selector instead of first-sheet-only behavior
- clearer import/contract diagnostics and remediation hints
- large-file performance work, moving expensive processing off the UI thread where practical
- project/configuration version visibility
- stronger project import/export portability
- baseline/history UX refinements
- regression coverage for recurring-file edge cases gathered from external users
- accessibility and responsive-layout polish

Commercial gate:
Do not build the paid layer just because the roadmap says so. Start 1.0 Pro implementation once repeated external usage shows that people come back to the same project, or qualitative feedback repeatedly asks for automation, synchronized history, alerts or CI execution.

## 1.0.0 — RowMend Pro commercial launch

Goal: introduce the first billable version without weakening the free local product.

Free remains:
- manual local Projects and Workflow Runner
- profiling, cleanup, contracts, validation, SQL output and reconciliation
- local history, baselines and drift insights
- local exports
- no account required

Pro target:
- account and subscription
- encrypted synchronization of project configuration and aggregate run summaries
- cross-device/cloud run history
- headless CLI/CI execution so workflows can run in customer infrastructure without uploading source datasets to RowMend
- drift/failure alerts and webhooks from submitted run summaries
- shareable run/insights reports
- longer history and backup
- billing and entitlement management

Privacy architecture:
The first Pro release should not require RowMend to ingest raw customer CSV/Excel contents. CLI/CI execution remains local/customer-side; only configuration and privacy-minimized run summaries need synchronization unless the user explicitly opts into a future connector that requires cloud processing.

Commercial milestone:
1.0 is the first version designed for recurring software subscription revenue. Before 1.0, limited Founding Workflow Pilots may generate service revenue while validating whether recurring CSV/Excel workflow pain is strong enough to pay for. Pilot revenue is evidence, not a substitute for repeat-product usage. Profitability is not guaranteed by the release itself; it depends on paid conversion and operating costs.

Initial pricing hypothesis to validate before launch:
- Free: €0
- Pro: roughly €12–19/month per individual, with an annual option
Pricing is a hypothesis, not a commitment. Validate willingness to pay before finalizing it.

## 1.1.0 — Automation & Connectors

Goal: reduce manual file handling after Pro proves willingness to pay.

Candidates:
- managed schedules
- S3/object-storage and SFTP sources
- database/file connectors selected from real customer demand
- scheduled CLI/agent execution
- richer alert thresholds
- API execution
- webhook integrations

Keep connector scope demand-driven; do not build a broad connector catalogue in advance.

## 1.2.0 — Team & Governance

Goal: support shared operational workflows.

Candidates:
- shared projects and baselines
- workspace roles and permissions
- audit trail
- approvals
- shared contracts
- run ownership and annotations
- organization-level retention policies

Likely Team pricing should be evaluated only after Pro has active paying users.

## Profitability path

The path is:

0.9 retention value + paid workflow pilots → 0.10 reliability → 1.0 first paid Pro subscription → 1.1 automation expansion → 1.2 team expansion.

The key commercial signal is not raw traffic. It is repeated use of the same workflow. Track:
visit → project_created → workflow_file_loaded → workflow_run_completed → workflow_output_exported

For product-market evidence, add retention-oriented signals:
- same project run on multiple dates
- multiple completed runs per local project
- baseline/insights usage
- repeated exports
- explicit requests for alerts, automation, sync, CLI/CI or team sharing

A practical go/no-go gate for Pro is either:
- at least 10 external users complete repeat runs on the same project, or
- at least 5 credible external users independently ask for one of the planned paid capabilities.

These are decision thresholds, not guarantees of profitability.

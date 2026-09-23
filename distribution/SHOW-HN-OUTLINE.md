# Show HN outline — RowMend

Do **not** paste this as the final HN submission text.

Hacker News asks users not to post generated or AI-edited comments. Use this only as a factual checklist and write the actual post personally.

## Suggested title structure

Show HN: RowMend – local-first workflows for recurring CSV/Excel imports

## Facts worth covering in your own words

### Why I built it
- Recurring import files often look structurally simple but drift over time.
- Common failures: renamed columns, missing required values, duplicate keys, inconsistent date/number formats and source/target mismatches.
- One-off spreadsheet edits and scripts are difficult to repeat and review.

### What RowMend does now
- CSV/TSV/Excel profiling.
- Cleanup recipes.
- Data contracts and schema-drift checks.
- Import validation and source-to-target mappings.
- INSERT / MERGE / UPSERT generation for Oracle, SQL Server and PostgreSQL.
- Migration reconciliation.
- Local Projects.
- Workflow Runner: one file load → profile → clean → contract → validate → SQL output.
- Compact local run history.

### Architecture choice
- Processing happens in the browser.
- No application account is required.
- Source files are not intentionally uploaded to a RowMend backend.
- Projects and run history stay in browser storage.
- Run history stores aggregate summaries rather than raw rows.

### What I deliberately have not built yet
- cloud accounts;
- scheduled execution;
- shared projects;
- database credential storage;
- team permissions.

### What feedback would be useful
Ask specifically about:
- recurring vendor/partner files;
- which step in the workflow is most painful today;
- whether local-only processing is valuable;
- whether historical drift/quality trends would be useful;
- file shapes that RowMend fails on.

## Link

https://rowmend.netlify.app/?utm_source=hackernews&utm_medium=community&utm_campaign=v080_launch

## HN hygiene

- Be present in the thread.
- Answer technical questions directly.
- Do not ask friends to upvote or comment.
- Do not frame a minor version number as the news; frame the usable product.
- Do not use generated replies.

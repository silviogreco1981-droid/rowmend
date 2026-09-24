# DEV article draft — The file had the same columns. It still broke the workflow.

A schema check catches an obvious class of failure: a missing or renamed column.

It does not catch every dangerous change.

A recurring CSV can arrive with exactly the expected headers and still be materially different from last month:

- a key that used to be unique now contains duplicates;
- a numeric field starts containing text;
- missing values jump from 1% to 25%;
- row count collapses unexpectedly;
- an optional-looking column becomes operationally important;
- the file remains parseable, so the downstream job runs anyway.

That is why I’ve started thinking about recurring files as having two contracts.

The first is the **structural contract**: columns, expected types and explicit validation rules.

The second is the **behavioural baseline**: what a normal delivery looks like in practice.

For a lightweight baseline you do not necessarily need to retain the source data. You can keep aggregate signals such as row count, completeness, duplicate rate, inferred type, missingness and uniqueness, then compare the next run against them.

That distinction also gives you three useful outcomes:

1. **compatible** — the next delivery is within expected bounds;
2. **changed but reviewable** — the structure still works, but quality/drift signals moved;
3. **unsafe** — a critical contract rule failed and downstream processing should stop.

I’ve been implementing this approach in RowMend, a local-first browser tool for recurring CSV/Excel workflows. The source rows stay in the browser; compact comparison metrics can remain local for the next run.

The point is not that every spreadsheet needs another platform. It is that recurring file handoffs deserve the same idea we already apply elsewhere in software: validate assumptions, record what “normal” looked like, and fail deliberately when the assumptions no longer hold.

Technical walkthrough:
https://rowmend.netlify.app/guides/detect-data-drift-recurring-csv/?utm_source=devto&utm_medium=article&utm_campaign=rc3_validation

I’m interested in how other teams draw that line: which kinds of drift are warnings in your workflow, and which ones stop ingestion entirely?

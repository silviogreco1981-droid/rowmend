---
title: From One-Off CSV Fixes to a Repeatable Local Data Workflow
published: false
description: A practical way to turn recurring CSV and Excel cleanup, schema checks, validation and database preparation into a repeatable workflow.
tags: dataengineering, csv, sql, database
canonical_url: https://rowmend.netlify.app/guides/repeatable-csv-data-workflow/
---

A recurring CSV import rarely fails in the same way twice.

The file may arrive every week or every month. The business process calls it the same feed. But one delivery adds a column, another changes a date format, another introduces duplicate keys, and eventually the “simple import” becomes a collection of spreadsheet steps and one-off scripts.

The useful shift is to stop treating each file as an isolated cleanup task and instead model the **workflow around the file**.

## 1. Profile before changing anything

Before editing values, capture the structure of the incoming dataset.

Useful signals include:

- row and column count;
- missing values;
- uniqueness;
- exact duplicate rows;
- inferred types;
- mixed-type columns;
- numeric/date ranges;
- common values.

The purpose is not to create a perfect statistical profile. It is to establish enough context to answer a basic question:

> Does this delivery still resemble the source I expect?

## 2. Make cleanup explicit

Repeated spreadsheet edits are difficult to audit and even harder to reproduce.

If the same feed repeatedly needs whitespace trimming, case normalization, replacements, column renames or deduplication, turn those operations into an ordered recipe.

A recipe has two advantages:

1. the transformation can be repeated;
2. the assumptions become visible.

That is already better than “open the file and fix the usual things.”

## 3. Separate cleanup from expectations

Cleanup and validation are different concerns.

A cleanup recipe answers:

> How should this file be normalized?

A data contract answers:

> What must still be true after normalization?

Useful contract rules can include:

- expected columns;
- required columns;
- expected types;
- acceptable missing rates;
- uniqueness expectations;
- composite keys;
- row-count boundaries.

This distinction matters because you do not want cleanup logic silently hiding an upstream schema change.

## 4. Reuse the import configuration

Recurring feeds usually go to the same destination.

That means the source-to-target mapping, validation rules, SQL dialect and merge key are not properties of the individual file. They are properties of the workflow.

Save them once.

The next delivery should not require somebody to remember that `customer_code` maps to `CUSTOMER_ID`, that the email field is required, or that `CUSTOMER_ID` is the merge key.

## 5. Add quality gates

Not every issue should have the same consequence.

Examples:

- missing required key column → stop;
- broken data contract → stop before database preparation;
- invalid email in a non-critical field → review;
- invalid import rows → export errors and block SQL;
- warning-only schema drift → continue but surface the warning.

Quality gates make the workflow deterministic instead of operator-dependent.

## 6. Run the pipeline from one file load

Once the configuration exists, there is little value in opening five separate tools and loading the same file five times.

A more natural pipeline is:

`Load → Profile → Clean → Contract → Validate → Output`

The output can include:

- cleaned CSV;
- validation-error CSV;
- INSERT SQL;
- MERGE / UPSERT SQL;
- a compact run report.

For post-migration work, a second target dataset can then be used for reconciliation.

## 7. Keep history without keeping raw data

For recurring workflows, the result of the previous run is useful even when the previous source file is not retained.

A privacy-minimized local history can keep aggregate information such as:

- run status;
- row counts;
- invalid-row count;
- contract warning/error count;
- duration.

That is enough to start spotting trends without turning the tool into another data store.

## A concrete implementation

I have been implementing this model in **RowMend**, a local-first browser tool.

The current version includes:

- Data Profiler;
- Clean & Transform recipes;
- Data Contracts;
- Import Checker and SQL generation;
- Migration Check;
- Local Projects;
- Workflow Runner with local run history.

The important architectural constraint is that the data operations run in the browser. There is no required account and source files are not intentionally uploaded to a RowMend application backend.

You can try the workflow here:

https://rowmend.netlify.app/guides/repeatable-csv-data-workflow/?utm_source=devto&utm_medium=article&utm_campaign=v080_workflow_runner

The next question I am trying to answer is whether local run history should evolve into data-drift insights: comparing row counts, completeness, uniqueness and contract violations between recurring deliveries.

If you work with recurring CSV/Excel imports, I would be interested in what changes most often between deliveries and which failure mode is hardest to detect early.

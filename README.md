# RowMend

**Validate imports and verify data migrations locally in your browser.**

RowMend is a local-first browser tool for checking import files and verifying data migrations. It can compare source and target CSV/TSV datasets for missing, extra, changed and duplicate records, and it also validates import files, maps columns, exports clean/error CSVs, and generates safe SQL for Oracle, SQL Server, and PostgreSQL.

**Try it:** https://rowmend.netlify.app/?utm_source=github&utm_medium=referral&utm_campaign=repository

## Why RowMend

Import problems are usually discovered too late: after a spreadsheet reaches a database, ETL job, ERP/CRM import, or migration script. RowMend moves that check earlier in the workflow.

It helps you answer questions like:

- Which rows will fail validation?
- Are required values missing?
- Do email, date, number, or uniqueness rules look wrong?
- Are source columns mapped to the intended target columns?
- Which rows are safe to export or turn into SQL?
- Can I generate INSERT or MERGE / UPSERT statements without including invalid rows by default?

## What it does

- Compare **source and target CSV/TSV** datasets after a migration using one or more key columns.
- Detect **missing, extra, changed, and duplicate** records with browser-only reconciliation.

- Load **CSV, TSV, XLSX, or XLS** files.
- Parse and inspect data **locally in your browser**.
- Infer a simple schema and surface data-quality issues.
- Map source columns to target columns.
- Apply validation rules such as required, unique, email, and type checks.
- Preview valid and invalid rows.
- Export **clean CSV** and **error CSV** files.
- Save reusable mapping profiles in local browser storage.
- Generate SQL for:
  - Oracle
  - SQL Server
  - PostgreSQL
- Generate INSERT plus MERGE / UPSERT workflows.
- Exclude invalid rows from generated SQL by default.

## Privacy-first architecture

Your spreadsheet is not uploaded to a RowMend application backend.

Parsing, validation, mapping, local profile storage, and SQL generation happen in the browser. The current MVP has no application account system and no backend database.

Minimal product analytics are used to understand whether people reach useful actions such as loading a file, generating SQL, exporting cleaned data, or saving a profile. RowMend does not intentionally send uploaded file contents, filenames, column names, generated SQL, target table names, validation results, profile names, or data values to analytics.

See the live privacy notice for details.

## Quick start

### Migration Check

1. Open https://rowmend.netlify.app/migration-check/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Load a source CSV/TSV and a target CSV/TSV, or use the demo comparison.
3. Confirm automatic column mapping and select one or more key columns.
4. Compare the datasets and review changed, missing, extra, and duplicate records.
5. Export detected issues as CSV when needed.

### Import Checker


1. Open https://rowmend.netlify.app/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Drop a CSV/Excel file, or load the sample dataset.
3. Review **Issues** and **Mapping & Rules**.
4. Choose your target SQL dialect and key column if needed.
5. Export clean/error data or generate INSERT / MERGE / UPSERT SQL.

## Example use cases

RowMend is useful when you regularly prepare or troubleshoot import files for:

- database migrations;
- ERP / CRM imports;
- ETL and data-loading jobs;
- customer, supplier, product, or master-data loads;
- one-off CSV cleanup before SQL execution;
- pre-flight validation before handing data to another team or system.

## Who it is for

- Developers
- DBAs
- Data analysts
- Data engineers
- ERP / CRM consultants
- Operations teams working with recurring CSV / Excel imports

## Safe-by-default SQL

Generated SQL is intended to reduce repetitive import work, not to replace database review.

By default, rows that fail configured validation rules are excluded from generated SQL. Always review and test generated statements before executing them against production systems.

Current browser caps keep the MVP responsive:

- INSERT generation: up to 1,000 rows
- MERGE / UPSERT generation: up to 250 rows

## Run locally

RowMend is a static site. Any local static web server works.

For example:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Current validation phase

RowMend is being tested as a free utility before deciding which workflows are worth turning into paid Pro / Team features.

The key product question is not simply whether people can generate SQL. It is whether recurring import work creates enough pain around **repeatability, collaboration, governance, auditability, and automation** to justify a paid workflow.

Potential future Pro / Team capabilities include:

- shared reusable mapping and validation profiles;
- richer validation rules and schema contracts;
- batch processing;
- audit and exportable quality reports;
- reusable import recipes;
- CLI / API / CI integration;
- centralized team workflows and governance.

If you use RowMend and one of those would materially help your workflow, use the in-product feedback form.

## Feedback

Real import cases are more useful than generic feature requests.

If RowMend saves you time, breaks on a file shape you commonly use, or is missing something that would make it part of a recurring workflow, please send feedback through the app.

## Important MVP limitations

- The CSV parser handles common quoted CSV but is not a complete RFC 4180 implementation for every edge case.
- Date inference is intentionally conservative and favors ISO-like formats.
- Very large files may be limited by browser memory and responsiveness.
- Generated SQL must be reviewed and tested before use.
- Legal pages are MVP drafts and are not legal advice.


## Practical guide

Read the technical guide: **[How to validate CSV & Excel before database import](https://rowmend.netlify.app/guides/validate-csv-excel-before-database-import/?utm_source=github&utm_medium=referral&utm_campaign=technical_guide)**.

It covers schema drift, mappings, required values, duplicate keys, type/date validation, clean/error rows, and safe SQL generation.

## CSV Import Test Kit

The repository includes a small **[CSV Import Test Kit](./test-kit/)** with deliberately valid and invalid files for testing import-validation workflows.

The kit includes examples for missing required values, duplicate keys, invalid values, and schema drift. It can be used with RowMend or with other ETL/import validation workflows.

## Branding note

**RowMend** is currently a working product name. Formal trademark/domain clearance should be completed before material commercial investment in the brand.

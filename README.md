# RowMend

**Build and run repeatable data workflows locally in your browser.**

RowMend is a local-first data operations toolbox and workflow runner. Local Projects bundle recurring configuration, while Workflow Runner can execute profiling, cleanup, data-contract checks, import validation and SQL preparation from one file load. Standalone tools still support profiling, cleanup, contracts, SQL generation and source-vs-target migration reconciliation.

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

### Workflow Runner
- Run a Local Project from one CSV/TSV/Excel load.
- Profile the input, apply the attached cleanup recipe, check the attached data contract and validate the attached import profile in sequence.
- Use local quality gates to stop on contract errors or block SQL when invalid rows exist.
- Generate valid-row INSERT or MERGE/UPSERT output when the configured gates allow it.
- Export cleaned CSV, validation-error CSV, SQL and a run report.
- Keep up to 30 privacy-minimized run summaries per project in localStorage without storing source rows, file names or SQL text.


### Local Projects
- Bundle a structural profile snapshot, cleanup recipe, data contract, import profile and migration preset into one browser-local workflow.
- Open each RowMend tool in project context and save the current setup back to the project.
- Attach existing locally saved recipes, contracts and import profiles.
- Export/import project JSON without embedding source CSV/Excel row data.
- Keep standalone saved recipes/contracts intact when a project is deleted.


### Data Profiler
- Profile CSV, TSV, XLSX, or XLS files locally.
- Measure completeness, missing values, uniqueness, exact duplicate rows and mixed types.
- Inspect inferred types, numeric/date ranges, string lengths and common values.
- Export the profile as CSV or JSON.

### Clean & Transform
- Build an ordered, reversible cleanup recipe.
- Trim whitespace, normalize text case, convert empty values to NULL, find/replace values and rename columns.
- Remove exact duplicates or deduplicate by one or more key columns.
- Preview before/after data and export the transformed CSV.
- Save reusable recipes in browser localStorage.

### Data Contract & Schema Guard
- Generate an editable contract from a known-good CSV, TSV or Excel baseline.
- Check expected columns, inferred types, missing-value thresholds and uniqueness rules.
- Define composite keys and detect duplicate key groups.
- Optionally flag unexpected columns and row-count drift.
- Save contracts locally, export/import them as JSON, and export contract issues as CSV.


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

Profiling, cleaning, data-contract checks, validation, mapping, workflow execution, local run history and SQL generation happen in the browser. The current MVP has no application account system and no backend database. Local Projects are configuration containers stored in browser localStorage; source datasets are not copied into them.

Minimal product analytics are used to understand whether people reach useful actions such as profiling a dataset, applying transformations, checking a data contract, loading a file, generating SQL, exporting cleaned data, comparing migrations, or saving a local profile/recipe/contract/project. RowMend does not intentionally send uploaded file contents, filenames, column names, generated SQL, target table names, validation results, profile names, or data values to analytics.

See the live privacy notice for details.

## Quick start

### Workflow Runner

1. Open https://rowmend.netlify.app/projects/?utm_source=github&utm_medium=referral&utm_campaign=repository and select a Local Project.
2. Click **Run project**.
3. Load the new CSV/TSV/Excel file once.
4. Choose the quality gates and SQL mode.
5. Run the pipeline and review Profile → Clean → Contract → Validate → Output.
6. Export the current outputs or review compact local run history.


### Local Projects

1. Open https://rowmend.netlify.app/projects/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Create a recurring local workflow.
3. Attach existing cleanup recipes, contracts or import profiles, or open a RowMend tool in project context.
4. Save the current tool configuration back to the project as you work.
5. Export the project JSON when you want a portable configuration backup.


### Data Profiler

1. Open https://rowmend.netlify.app/profile-data/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Load CSV/TSV/Excel or use the sample.
3. Review completeness, duplicates, inferred types, uniqueness and common values.
4. Open column detail for ranges and distributions.
5. Export the profile as CSV or JSON.

### Clean & Transform

1. Open https://rowmend.netlify.app/clean-data/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Load a dataset or use the messy sample.
3. Add transformations to the ordered recipe.
4. Review the before/after preview and row-count impact.
5. Save the recipe locally or export the cleaned CSV.


### Data Contract

1. Open https://rowmend.netlify.app/data-contract/?utm_source=github&utm_medium=referral&utm_campaign=repository
2. Load a known-good baseline or use the sample.
3. Generate and edit the proposed contract rules.
4. Save locally or export the contract JSON.
5. Load a new dataset and run the schema/data-quality contract check.

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

RowMend is being developed as a useful free local-first toolbox. Browser-side capabilities that are cheap to provide are intended to remain broadly available; paid Pro / Team work is aimed at collaboration, cloud automation, shared governance and recurring organizational workflows.

The key product question is not simply whether people can generate SQL. It is whether recurring import work creates enough pain around **repeatability, collaboration, governance, auditability, and automation** to justify a paid workflow.

Potential future Pro / Team capabilities include:

- shared reusable mapping, cleanup and validation profiles;
- shared/versioned data contracts, richer validation rules and schema history;
- batch processing;
- scheduled contract checks, alerts, audit and exportable quality reports;
- reusable import recipes;
- CLI / API / CI integration;
- scheduled project runs, synchronized history, alerts, synchronized projects, centralized team workflows and governance.

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

# RowMend MVP 0.1

A zero-backend, local-first MVP for CSV / Excel validation and SQL generation.

## Product hypothesis

Developers and operations teams frequently receive spreadsheets that must be imported into databases. They need to discover bad data before running the import and want reusable SQL for Oracle, SQL Server and PostgreSQL.

The MVP tests the smallest useful workflow:

1. Load CSV / TSV / XLSX / XLS locally.
2. Infer a simple schema.
3. Surface basic data-quality issues.
4. Preview rows.
5. Generate INSERT or MERGE / UPSERT SQL.

No application backend, account system or database is required.

## Run locally

Because this is a static site, any static web server works.

Python:

```bash
python -m http.server 8080
```

Then open http://localhost:8080.

## Free deployment: Cloudflare Pages Direct Upload

The current Cloudflare Pages documentation supports direct upload of prebuilt static assets. Create a Pages project in the Cloudflare dashboard and upload the contents of this folder. `index.html` must remain at the project root.

A `*.pages.dev` hostname is issued after deployment. Add a custom domain only after validation if you want to keep initial cash cost at zero.

## What to validate before building Pro

Do not add authentication or billing yet. Measure:

- visitors who load a file;
- files successfully parsed;
- INSERT generation clicks;
- MERGE generation clicks;
- repeat visitors;
- clicks on “I'd use Pro”;
- requests for saved mappings / rules / larger files / direct DB connectivity.

The MVP intentionally records Pro interest only in localStorage. For real validation, replace that button with a privacy-compliant waitlist form or an email link.

## Next product increments

1. Editable schema and target-column mapping.
2. User-defined validation rules (required, regex, ranges, allowed values).
3. Downloadable error report and cleaned CSV.
4. Reusable mapping profiles stored locally first.
5. PII detection / anonymization prototype.
6. Only after demand is proven: accounts, sync, team features, billing.

## Branding note

“RowMend” is a working product name. Before paying for a domain or commercializing it, perform formal trademark/domain clearance in target markets.

## Important MVP limitations

- CSV parser handles common quoted CSV but is not a full RFC 4180 implementation for multiline quoted fields.
- SQL generation is capped (INSERT: 1,000 rows; MERGE/UPSERT: 250 rows) to keep browser performance predictable.
- Date inference currently favors ISO-like dates.
- Generated SQL must be reviewed and tested before use.
- Legal pages are MVP drafts, not legal advice.

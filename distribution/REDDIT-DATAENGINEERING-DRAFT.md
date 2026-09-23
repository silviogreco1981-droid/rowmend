# r/dataengineering draft — RowMend 0.8

## Suggested title

How do you keep recurring vendor CSV/Excel imports from turning into one-off cleanup scripts?

## Draft

A recurring pattern I keep running into is that the file format is technically “the same” every month, but in practice something drifts.

A header changes, an identifier starts duplicating, a date format changes, null rates jump, or a field that used to be numeric suddenly contains text. The import itself is usually not the hard part. The hard part is making the checks and cleanup repeatable instead of adding another one-off script or spreadsheet procedure.

I have been working on RowMend to explore a local-first workflow for this.

The current workflow is roughly:

- profile the incoming CSV/Excel;
- apply an ordered cleanup recipe;
- check a data contract for schema/data-quality drift;
- reuse source-to-target mappings and validation rules;
- optionally generate INSERT / MERGE / UPSERT SQL;
- compare source and target data after a migration;
- keep the workflow in a local project and run a new delivery through it from one file load.

Everything runs in the browser and there is no account requirement. The source file is not intentionally uploaded to a RowMend backend.

Affiliation disclosure: I built RowMend.

What I am more interested in than promoting the tool is the workflow itself: for people receiving recurring files from vendors/customers/partners, what causes the most operational pain?

- schema drift?
- duplicate business keys?
- date/number formatting?
- mapping changes?
- files that are structurally valid but semantically wrong?
- reconciliation after the load?

RowMend is here if anyone wants to try the approach:

https://rowmend.netlify.app/?utm_source=reddit&utm_medium=community&utm_campaign=v080_vendor_workflow

I would especially value examples where this model would fail or where the checks need to happen differently.

## Posting note

r/dataengineering currently limits self-promotion for a project/product to once per month. Confirm that no RowMend promotional post has been made in the previous month before using this draft.

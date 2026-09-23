# r/dataengineering — RowMend 0.8

## Suggested title

I built a local-only workflow for recurring CSV/Excel imports — looking for the edge cases I missed

## Draft

I’ve been working on a small browser tool called RowMend, mostly because I wanted a better way to deal with recurring CSV/Excel files that are “the same” every month until they suddenly aren’t.

The annoying cases are usually not broken CSVs.

They’re things like:

- a column quietly gets renamed;
- a business key starts duplicating;
- nulls appear in a field that used to be complete;
- a date/number format changes;
- someone fixes the file manually and nobody remembers exactly what they changed;
- source and target have the same row count after a migration but some records are still wrong.

I originally built RowMend around import validation and SQL generation. I’ve since reworked it into a more repeatable flow:

**Profile → Clean → Contract → Validate → Output**

A project can keep the cleanup recipe, schema/data-quality expectations and import mapping together, then run a new delivery through them from one file load.

It all runs in the browser. No account is required, and the source file is not intentionally uploaded to a RowMend backend.

There’s a small preconfigured demo if anyone wants to see what I mean without setting anything up:

https://rowmend.netlify.app/?utm_source=reddit&utm_medium=community&utm_campaign=v080_vendor_workflow

Full disclosure: I built it.

What I’d genuinely like to know from people who deal with recurring external files is where this model falls apart.

Which problems are harder than they look?

Schema drift? Bad keys? Locale-specific numbers/dates? Multiple sheets? Huge files? Reconciliation after load? Something else entirely?

I’m trying to use that feedback to decide what deserves to go into the next version rather than just adding more features.

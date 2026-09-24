# Show HN draft — RowMend

## Title

Show HN: RowMend – local-first recurring CSV/Excel workflow checks

## Draft

Hi HN — I’ve been building RowMend, a local-first browser tool for a fairly unglamorous problem: recurring CSV/Excel files that are “almost the same” every time, until they aren’t.

The workflow I kept running into was:

1. receive a CSV/Excel export;
2. inspect missing values, duplicates and inferred types;
3. clean/normalize a few things;
4. check that the expected columns/rules still hold;
5. prepare the data for an import;
6. do it all again when the next delivery arrives.

The current version bundles those steps into Local Projects and a Workflow Runner. The part I’m testing now is Run Insights: RowMend keeps a compact local baseline from a previous run and compares the next delivery for row-count, completeness, duplicates, invalid rows, types, missingness and uniqueness drift.

Everything runs in the browser. Source rows, filenames and generated SQL aren’t uploaded to a RowMend backend, and there’s no account required for the local product.

Live: https://rowmend.netlify.app/?utm_source=hackernews&utm_medium=show_hn&utm_campaign=rc3_validation
71-second walkthrough: https://rowmend.netlify.app/tutorial/?utm_source=hackernews&utm_medium=show_hn&utm_campaign=rc3_validation

I’m deliberately not trying to make “AI fixes any spreadsheet.” The design question I’m more interested in is where to draw the line between:

- changes that are safe to adapt to;
- changes that should produce a warning;
- changes that should make the workflow fail loudly.

I’d especially like feedback from people dealing with vendor/customer files, ERP/CRM imports or recurring operational spreadsheets.

What kinds of drift have caused the most painful failures in your own file-based workflows?

## Before publishing

Do not submit until:
- RC3 has enough external usage evidence to answer technical questions credibly;
- 0.10 large-file/worksheet work is stable if we decide to launch that version instead;
- maker can be present in HN comments after posting.

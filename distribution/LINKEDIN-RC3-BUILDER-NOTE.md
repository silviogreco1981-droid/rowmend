# LinkedIn builder note draft

A CSV can have exactly the same columns as last month and still be unsafe to import.

That sounds obvious once you say it, but I kept treating schema validation as the main guardrail.

Then you look at the actual recurring failures:

- a key starts duplicating;
- missing values jump;
- a numeric column quietly becomes mixed text;
- the row count drops for no clear reason.

The file is still “schema compatible”. It just isn’t behaving like the file you trusted before.

That’s the idea I’ve been working on in RowMend 0.9: keep a small local baseline from a good run, then compare the next delivery against it.

Not the raw rows. Just enough structural/quality signals to answer a better question:

“Did this file change enough that I should stop and look at it?”

I’m still validating where the boundary should be between warning and hard failure.

If you work with recurring vendor/customer CSV or Excel files, I’d be interested in the failure that catches you most often.

https://rowmend.netlify.app/tutorial/?utm_source=linkedin&utm_medium=social&utm_campaign=rc3_validation&utm_content=drift_builder_note

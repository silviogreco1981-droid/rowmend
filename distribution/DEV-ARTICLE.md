---
title: I Stopped Treating Recurring CSV Imports as One-Off Files
published: false
description: A practical approach to recurring CSV and Excel imports: keep cleanup, schema expectations, validation and output as one repeatable workflow.
tags: dataengineering, csv, sql, database
canonical_url: https://rowmend.netlify.app/guides/repeatable-csv-data-workflow/
---

For a long time I thought of CSV imports as a file problem.

A file arrives, you inspect it, clean it, fix a couple of values, map the columns, load it, move on.

That works until the file is not really a one-off file.

A supplier sends a new version every month. A partner exports the same report every week. An internal team sends another workbook that is supposed to match the previous one.

At that point the interesting thing is no longer the file. It is the **workflow around the file**.

That distinction changed how I approached the problem.

## The file changes. The decisions usually do not.

The incoming data may be different each time, but many decisions repeat:

- trim these columns;
- normalize this field to lowercase;
- this column must exist;
- this identifier must be unique;
- this field maps to that target column;
- use this key for MERGE/UPSERT;
- stop if the schema changes;
- block SQL if any row fails validation.

Re-entering those decisions on every run is wasteful, and doing them manually makes the process difficult to review later.

So I started treating those decisions as configuration.

## First: profile before touching the data

Before changing anything, I want a quick picture of the incoming file.

Not a huge statistical report. Just enough to answer questions such as:

- how many rows and columns are there?
- where are values missing?
- which columns are likely unique?
- are there exact duplicate rows?
- did a numeric/date column suddenly become mixed text?
- is the file structurally similar to the last one?

This is useful because cleanup can otherwise hide upstream problems.

If a column changed type and I immediately coerce it, I may fix the symptom and miss the fact that the source changed.

## Cleanup should be a recipe, not muscle memory

The next recurring problem is manual cleanup.

Everyone has some version of:

> open the spreadsheet, trim this, replace that, rename this header, remove duplicates, save a copy

The trouble is not that those steps are difficult. The trouble is that six weeks later nobody remembers exactly which steps were applied.

An ordered cleanup recipe makes those decisions explicit and repeatable.

For example:

```text
1. trim NAME and EMAIL
2. lowercase EMAIL
3. convert blank CUSTOMER_CODE values to NULL
4. remove duplicate CUSTOMER_ID rows, keep first
```

Now the next file can go through the same transformation without rebuilding the process.

## Cleanup and validation are not the same thing

This was one of the more important design choices for me.

A cleanup recipe answers:

> How should this dataset be normalized?

A data contract answers:

> What must still be true?

Those are different questions.

A contract might say:

- these columns must exist;
- CUSTOMER_ID must be numeric and unique;
- EMAIL may be missing in at most 5% of rows;
- unexpected columns should be flagged;
- the file should contain at least 1,000 rows.

The cleanup step should not silently make those expectations disappear.

## Save the import mapping too

If the file is recurring, chances are the destination is recurring as well.

That means this:

```text
customer_code -> CUSTOMER_ID
company_name  -> NAME
email_address -> EMAIL
```

is not really a property of one particular CSV. It is part of the workflow.

The same applies to validation rules, SQL dialect and MERGE/UPSERT key.

Once those are saved, the next file should not need somebody to rebuild the mapping from memory.

## Add explicit quality gates

Not every warning deserves to stop a pipeline.

But some errors probably should.

A few examples:

- required key column missing → stop;
- schema contract broken → stop before import validation;
- invalid rows present → block SQL output;
- extra optional column → warn, but continue;
- minor completeness change → review.

The value of a quality gate is not that it is sophisticated. It is that the decision is made once and then repeated consistently.

## One load is better than five tools

Once the configuration exists, loading the same file into several separate utilities becomes unnecessary friction.

The workflow I ended up with is:

```text
Load
  ↓
Profile
  ↓
Clean
  ↓
Contract
  ↓
Validate
  ↓
Output
```

The output might be cleaned CSV, an error file, INSERT statements, MERGE/UPSERT statements or a compact run report.

For migration work, a separate source-vs-target comparison can then check what actually arrived on the other side.

## Keep history without keeping the source data

For recurring jobs, previous runs are useful.

But that does not mean the tool has to become another repository of source files.

A small local history can keep things like:

- PASS / REVIEW_REQUIRED;
- input/output row counts;
- invalid row count;
- contract warnings/errors;
- duration.

That gives enough context to notice that a feed suddenly shrank or started failing without storing the original rows again.

## Why I built RowMend this way

I’ve been implementing this approach in a browser tool called **RowMend**.

The current version has:

- profiling;
- cleanup recipes;
- data contracts;
- import validation and SQL generation;
- migration reconciliation;
- Local Projects;
- Workflow Runner;
- local run history.

The deliberate constraint is that the data operations happen in the browser. There is no mandatory account and source files are not intentionally uploaded to a RowMend application backend.

If you want to see the complete path, there is now a preconfigured demo:

https://rowmend.netlify.app/?utm_source=devto&utm_medium=article&utm_campaign=v080_workflow_runner

I’m less interested in adding another dozen transforms right now than in finding out where this workflow model breaks in real life.

If you deal with recurring CSV/Excel deliveries, what changes most often between runs? And which failures are the hardest to catch before the import starts?

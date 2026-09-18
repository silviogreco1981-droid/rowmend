---
title: A CSV Can Be Valid and Still Corrupt Your Import
published: false
description: A practical pre-flight checklist for catching schema drift, mapping errors, duplicate keys and invalid values before CSV or Excel data reaches a database.
tags: dataengineering, sql, database, csv
canonical_url: https://rowmend.netlify.app/guides/validate-csv-excel-before-database-import/
---

A CSV can parse perfectly and still be wrong for the import that consumes it.

That is the class of problem I find most dangerous: not the file that obviously fails, but the file that looks valid enough to move through the pipeline.

A column gets renamed. Two columns change order. A business key becomes duplicated. A date format changes. The ETL job finishes successfully, but the target now contains data that does not mean what the source intended.

## Start with structure, not values

Before validating individual values, check whether the file still has the shape you expect.

Questions worth answering before the load starts:

- Are all expected columns present?
- Did unexpected columns appear?
- Were any columns renamed?
- Does each source column still map to the intended target field?
- Is the pipeline relying on column position anywhere?

Position-based mapping is especially risky. A CSV with the same number of columns can still be semantically wrong if the order changes.

## Required fields should fail early

Database constraints are useful, but they are a poor first diagnostic tool.

If a required field is missing, it is much easier to report:

> Row 184 is missing CUSTOMER_ID

than to wait for a database error after SQL generation or bulk loading.

The same applies to fields that are technically nullable in the database but required by the business workflow.

## Duplicate keys can hide inside “successful” loads

Row counts alone are not enough.

Imagine that one expected record is missing while another key appears twice. Source and target can still have the same number of rows.

If an import uses a key for MERGE/UPSERT behavior, check that key for uniqueness before generating SQL.

## Be conservative with types and dates

Implicit conversions are convenient until the source changes.

Common examples:

- decimal separators change;
- dates move from `YYYY-MM-DD` to a locale-specific format;
- numeric columns start containing text;
- empty strings and NULLs get treated differently.

For recurring imports, explicit accepted formats are usually safer than aggressive type guessing.

## Separate clean rows from error rows

A useful validation workflow should produce two things:

1. rows that are safe to continue processing;
2. rows that need attention, with enough context to understand why.

This makes remediation easier and reduces the chance of known-invalid rows leaking into generated SQL.

## SQL generation should be the last step

INSERT, MERGE and UPSERT generation should happen only after:

- structure is understood;
- mappings are explicit;
- required values have been checked;
- key uniqueness is verified;
- type/date rules have passed.

Generated SQL still needs review before production use, but validation removes a large class of avoidable problems before they become database problems.

## A compact pre-flight checklist

Before importing a CSV or Excel file, I would at least check:

- expected columns;
- unexpected or renamed columns;
- source-to-target mappings;
- required values;
- duplicate keys;
- accepted date/number formats;
- separation of valid and invalid rows;
- exclusion of known-invalid rows from generated SQL.

I put the longer version of this checklist, including Oracle, SQL Server and PostgreSQL considerations, in this guide:

https://rowmend.netlify.app/guides/validate-csv-excel-before-database-import/?utm_source=devto&utm_medium=referral&utm_campaign=database_import_guide

I am also using the same workflow while building RowMend, a local-first browser tool for validating CSV/Excel imports before they reach a database. The useful part for me is less “generate SQL” and more catching structural and data-quality problems early.

If you work with recurring imports, I would be interested in the failure mode you see most often: schema drift, mappings, duplicate keys, type conversions, or something else?

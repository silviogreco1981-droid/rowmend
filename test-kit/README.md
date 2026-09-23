# RowMend CSV Import Test Kit

A small set of deliberately simple CSV files for testing import-validation workflows.

The files are designed around one expected customer schema:

```text
ID,NAME,EMAIL,START_DATE
```

Assumptions for the examples:

- `ID` is required and unique.
- `NAME` is required.
- `EMAIL` is required and should contain a valid email address.
- `START_DATE` should use an ISO-like `YYYY-MM-DD` format.

## Files

| File | Purpose | Expected issue |
| --- | --- | --- |
| `customers-valid.csv` | Baseline file | No intentional validation errors |
| `customers-missing-required.csv` | Missing required data | One row has an empty NAME |
| `customers-duplicate-key.csv` | Duplicate identifier | ID 1002 appears twice |
| `customers-invalid-values.csv` | Value/type problems | Invalid email and invalid date examples |
| `customers-schema-drift.csv` | Changed source structure | NAME and EMAIL were renamed and STATUS was added |

## Why this exists

A useful import test should cover more than malformed CSV. Some of the most dangerous cases are files that parse successfully but no longer match the expected source contract.

These samples can be used with RowMend or with any ETL/import validation workflow.

## Try with RowMend

Open https://rowmend.netlify.app/?utm_source=github&utm_medium=referral&utm_campaign=csv_test_kit and load one of the files.

Review:

1. inferred issues;
2. Mapping & Rules;
3. key selection;
4. clean/error exports;
5. generated INSERT or MERGE/UPSERT SQL.

Generated SQL should always be reviewed before use against a production database.


## Workflow Runner demo

The `workflow-demo/` folder contains an importable RowMend Local Project plus three recurring vendor-file scenarios for testing the complete 0.8 workflow:

- valid delivery → PASS + SQL output;
- invalid email → import validation error + SQL blocked by the default gate;
- schema drift → contract error + downstream steps skipped.

See [workflow-demo/README.md](./workflow-demo/README.md) for the end-to-end instructions.

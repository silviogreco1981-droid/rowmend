# RowMend 0.9 Workflow Runner demo

This folder provides a small end-to-end demo for **Local Projects + Workflow Runner**.

It is designed to make the RowMend 0.9 workflow and Run Insights testable without building a project configuration from scratch.

## Files

| File | Purpose | Expected result |
| --- | --- | --- |
| `monthly-vendor-import.rowmend-project.json` | Importable RowMend Local Project | Provides cleanup recipe, data contract and PostgreSQL import profile |
| `vendor-good.csv` | Valid recurring delivery / baseline | Workflow should PASS and SQL output should be available |
| `vendor-drift.csv` | Changed recurring delivery | Workflow should require review; Run Insights should flag row-count, completeness, duplicate/uniqueness and validation/contract drift |
| `vendor-invalid-email.csv` | Value-level import problem | Contract should pass, import validation should flag one invalid row and SQL should be blocked by the default quality gate |
| `vendor-schema-drift.csv` | Structural upstream change | Contract should detect missing `AMOUNT` plus unexpected `STATUS` and stop before import validation with the default contract-error gate |

## How to run the demo

1. Open RowMend Local Projects.
2. Choose **Import project JSON**.
3. Import `monthly-vendor-import.rowmend-project.json`.
4. Open the imported project.
5. Click **Run project**.
6. Load one of the CSV files in this folder.
7. Keep the default quality gates enabled for the first run.
8. Run `vendor-good.csv` first so 0.9 has a compatible baseline.
9. Run `vendor-drift.csv` next and review:
   - Profile
   - Clean
   - Contract
   - Validate / quality-gate behavior
   - Output
   - Run Insights
   - Local run history

## What the project demonstrates

### Cleanup
The project trims `NAME` and `EMAIL`, then lowercases `EMAIL`.

### Contract
The project expects:

```text
ID,NAME,EMAIL,AMOUNT
```

Rules include:
- all four columns required;
- `ID` must be unique;
- `ID` and `AMOUNT` must be numeric;
- unexpected columns are flagged;
- at least one row is expected.

### Import validation
The saved import profile maps:

```text
ID     -> ID
NAME   -> SUPPLIER_NAME
EMAIL  -> EMAIL
AMOUNT -> AMOUNT
```

The target dialect is PostgreSQL and `ID` is the UPSERT key.

## Expected behavior

### vendor-good.csv

Expected:

```text
Profile   PASS
Clean     PASS
Contract  PASS
Validate  PASS
Output    PASS
```

The cleaned result should normalize spaces and email case.

### vendor-drift.csv

Run this after `vendor-good.csv`.

Expected:
- input row count drops from 4 to 3;
- completeness drops because `EMAIL` contains empty values;
- duplicate rows appear;
- `ID` uniqueness drops and the contract reports duplicate-key errors;
- the workflow requires review and the default contract-error gate stops later validation/output;
- Run Insights compares the current run with the previous compatible run and surfaces the drift signals;
- selecting an older compatible run in **Compare with** saves that run as the local baseline;
- **Insights JSON** exports only privacy-minimized run/structural metrics.

### vendor-invalid-email.csv

Expected:

```text
Profile   PASS
Clean     PASS
Contract  PASS
Validate  ERROR
Output    WARNING / blocked by quality gate
```

Disable **Block SQL output when at least one row fails import validation** if you want to verify that RowMend can still generate SQL from only the valid rows.

### vendor-schema-drift.csv

Expected contract problems:
- required column `AMOUNT` is missing;
- unexpected column `STATUS` is present.

With **Stop the pipeline before import validation when the data contract has errors** enabled, the later import/output stages should be skipped.

## Privacy behavior to verify

After running the demo, refresh or reopen the project and inspect local history.

History should retain compact run summaries plus the structural metrics needed for drift analysis, including completeness, duplicate counts, inferred column types and missing/uniqueness/mixed-type rates.

It should not persist source CSV rows, cell values, source filename, generated SQL or row-level validation values.

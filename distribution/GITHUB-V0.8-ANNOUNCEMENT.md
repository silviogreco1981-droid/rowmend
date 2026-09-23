# GitHub / repository announcement — RowMend 0.8

RowMend has moved beyond the original CSV-to-SQL/import-checker idea.

The current version is built around recurring data work:

**Profile → Clean → Contract → Validate → Output**

What is new in the 0.8 line:

- Local Projects for reusable workflow configuration;
- Workflow Runner to execute the configured steps from one file load;
- cleanup recipes;
- data contracts and schema-drift checks;
- import validation + INSERT / MERGE / UPSERT generation;
- compact local run history;
- source-vs-target migration reconciliation;
- a one-click preconfigured demo for first-time users.

The local-first constraint stays the same: the data operations run in the browser and no application account is required.

Try it:

https://rowmend.netlify.app/?utm_source=github&utm_medium=community&utm_campaign=v080_launch

Quick start:

https://rowmend.netlify.app/guides/workflow-runner-quick-start/?utm_source=github&utm_medium=community&utm_campaign=v080_launch

The most useful feedback at this point is not “what feature should be added next?” but real recurring-file cases that RowMend handles badly or not at all.

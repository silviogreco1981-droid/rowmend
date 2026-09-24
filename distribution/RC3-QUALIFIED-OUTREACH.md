# RowMend 0.9.0 RC3 — Qualified Outreach Experiment

## Objective

Generate the first small sample of qualified external traffic without mass outreach or generic launch copy.

Primary question:
> Do people who already work with data quality, ERP/CRM implementations, migrations or recurring operational data handoffs recognize the problem RowMend is trying to solve?

This experiment is for product validation, not lead-volume optimization.

## Guardrails

- First wave: max 8–10 highly relevant people.
- No bulk mail.
- No invented pain points or claims that a person uses CSV/Excel unless public evidence supports it.
- No fake customer language, fake testimonials or manufactured urgency.
- Keep the message builder-to-practitioner, not vendor-to-buyer.
- Ask for a sanity check / feedback before asking for a sale.
- Do not send raw customer/source data to RowMend: reinforce local-first processing where useful.
- Do not put private/professional email addresses in this repository.

## Segment A — Data quality / data engineering

Typical public evidence:
- data quality ownership
- ETL/data architecture
- BI/data pipelines
- procurement/supplier data

Message angle:
- recurring deliveries can remain schema-compatible while still drifting in completeness, duplicates or data types
- RowMend compares runs locally without retaining raw source rows
- ask whether this is a recognizable workflow/problem

Tracked URL:
https://rowmend.netlify.app/tutorial/?utm_source=direct_outreach&utm_medium=message&utm_campaign=rc3_validation&utm_content=data_quality

Secondary URL:
https://rowmend.netlify.app/guides/detect-data-drift-recurring-csv/?utm_source=direct_outreach&utm_medium=message&utm_campaign=rc3_validation&utm_content=data_quality

## Segment B — ERP / CRM implementation & migration

Typical public evidence:
- ERP/CRM implementation
- migration/cutover
- testing and QA
- data mapping/import validation
- onboarding/integration

Message angle:
- preflight profiling and validation of customer data before platform import
- local-first workflow for cleanup, contracts, import checks and migration reconciliation
- ask whether a lightweight browser-side tool is useful between spreadsheet/source export and target platform

Tracked URL:
https://rowmend.netlify.app/?utm_source=direct_outreach&utm_medium=message&utm_campaign=rc3_validation&utm_content=implementation

Secondary URL:
https://rowmend.netlify.app/guides/validate-csv-excel-before-database-import/?utm_source=direct_outreach&utm_medium=message&utm_campaign=rc3_validation&utm_content=implementation

## Segment C — BI / operational reporting

Typical public evidence:
- recurring operational reports
- BI tooling
- database management
- supplier/procurement reporting

Message angle:
- recurring file handoffs that change silently between periods
- profiling, duplicate/missing-value checks and run comparison
- use only where the person's public role supports the relevance

Tracked URL:
https://rowmend.netlify.app/?utm_source=direct_outreach&utm_medium=message&utm_campaign=rc3_validation&utm_content=bi_operations

## First-wave success signals

Do not optimize for opens alone. Useful signals are:

1. Reply that confirms the problem exists.
2. Click from the direct_outreach / rc3_validation campaign.
3. Tool-level action after the visit.
4. Demo/project creation.
5. Workflow file load or workflow run.
6. A second visit from the same qualified source later.

If there are clicks but no product actions, inspect positioning/onboarding.
If there are replies but no clicks, inspect the message-to-product bridge.
If there are neither replies nor clicks after a genuinely relevant first wave, revisit ICP/message before scaling volume.

## Message style

Good:
- brief
- specific to a public role/responsibility
- admits RowMend is early
- asks for perspective
- one link at most in the first message
- no superlatives

Avoid:
- "revolutionize"
- "game-changing"
- "perfect for you"
- "I know you struggle with..."
- fabricated personalization
- feature lists
- multiple CTAs

## Production discipline

RC3 remains unchanged during the clean Umami observation window.
This outreach experiment requires no Netlify deploy.

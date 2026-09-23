# Indie Hackers — RowMend 0.8

## Suggested title

I turned a CSV import checker into a repeatable local data workflow

## Post

I started RowMend with a fairly small idea: catch bad CSV/Excel rows before they reach a database and make SQL generation a little safer.

While building it, I realised the more annoying problem was not the first import.

It was the second, third and tenth import of the "same" file.

The supplier export is supposed to be stable, but next month a header changes. Or the ID field starts duplicating. Or the date format changes. Somebody fixes the workbook manually and the fix becomes tribal knowledge.

So I changed direction.

RowMend now has Local Projects that keep the recurring configuration together, and a Workflow Runner that takes one file through:

Profile → Clean → Contract → Validate → Output

The whole thing still runs in the browser. There is no required account and I deliberately haven't put artificial row limits behind a paid plan.

The part I'm interested in eventually charging for is the operational layer around the workflow: scheduling, synchronized history, alerts, shared projects, permissions and auditability.

For now I'm trying to answer a much simpler question:

Do people who deal with recurring external CSV/Excel files actually find this workflow model useful?

There is a preconfigured demo now, so it takes about a minute to see the full path:

https://rowmend.netlify.app/?utm_source=indiehackers&utm_medium=community&utm_campaign=v080_workflow

If you work with these kinds of files, I'd rather hear the ugly edge case that breaks the model than a generic feature suggestion.

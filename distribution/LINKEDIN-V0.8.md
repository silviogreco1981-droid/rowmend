# LinkedIn — RowMend 0.8

I’ve spent the last few weeks changing RowMend quite a bit.

It started as a small tool for checking CSV/Excel imports and generating SQL. Useful, but too narrow.

The problem I kept coming back to was everything that happens around a recurring file before it reaches the database.

A supplier sends the “same” file again. One column has changed name. A key that was unique last month is no longer unique. A date format changes. Someone fixes it manually in Excel. Next month the same work starts again.

So I moved RowMend toward a repeatable workflow instead of another one-off CSV utility.

The current flow is:

**Profile → Clean → Contract → Validate → SQL Output**

You can keep the configuration in a Local Project and run the next delivery through it from one file load.

A few choices I wanted to keep:
- files are processed in the browser;
- no account is required;
- source data is not intentionally uploaded to a RowMend backend;
- the browser-side workflow is free.

There’s also a preconfigured demo now, so you can see the whole pipeline without setting anything up first.

I’m at the point where I need real edge cases more than more ideas.

If you regularly receive CSV/Excel files from suppliers, customers or partners, I’d be interested in what tends to break in practice.

https://rowmend.netlify.app/?utm_source=linkedin&utm_medium=social&utm_campaign=v080_launch

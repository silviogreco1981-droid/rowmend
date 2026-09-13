# First public deployment checklist

## 1. Smoke test locally
- Open the site through a local web server.
- Click “Use sample dataset”.
- Verify Issues, Schema and Preview tabs.
- Generate INSERT for each dialect.
- Generate MERGE / UPSERT for each dialect.
- Upload `sample-customers.csv` manually.
- Upload at least one `.xlsx` workbook while online (SheetJS is loaded from its official CDN).

## 2. Publish without spending money
Use Cloudflare Pages → Direct Upload and upload this folder as static assets. The service returns a `*.pages.dev` URL.

## 3. Do not buy a domain yet
Use the free hostname until real usage exists. Brand clearance should happen before commercial use.

## 4. Share with a tiny target audience
Send the public link only to developers / data operators who actually import spreadsheets into databases. Ask them to use their own non-sensitive test data and observe where they stop.

## 5. Record the only metrics that matter initially
- 10+ independent users load a file.
- 5+ generate SQL.
- 3+ explicitly request a saved workflow / mapping / validation rule.
- At least 1 person asks if a paid version exists.

If these signals do not appear, change the workflow before building accounts, subscriptions or a backend.

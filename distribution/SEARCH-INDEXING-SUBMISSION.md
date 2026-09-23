# RowMend 0.8 — search indexing submission

Production sitemap:

https://rowmend.netlify.app/sitemap.xml

The deployed sitemap currently contains 15 indexable URLs.

## Google Search Console

Submit or resubmit the sitemap in **Search Console → Sitemaps**:

`sitemap.xml`

Then use **URL Inspection → Request indexing** for the highest-priority new/updated pages:

1. https://rowmend.netlify.app/
2. https://rowmend.netlify.app/guides/
3. https://rowmend.netlify.app/guides/workflow-runner-quick-start/
4. https://rowmend.netlify.app/guides/messy-vendor-csv-excel-imports/
5. https://rowmend.netlify.app/guides/repeatable-csv-data-workflow/
6. https://rowmend.netlify.app/guides/validate-csv-excel-before-database-import/

Projects and Workflow Runner are intentionally `noindex,follow`; do not submit these for indexing:

- /projects/
- /projects/run/

Google's URL Inspection requests are not guaranteed to produce indexing and are subject to daily limits. For the rest of the pages, rely on the sitemap.

## Bing Webmaster Tools

Resubmit the sitemap in **Bing Webmaster Tools → Sitemaps**:

https://rowmend.netlify.app/sitemap.xml

Then use **URL Submission** for the same six priority URLs listed above.

Bing currently recommends IndexNow for automated future change notifications. RowMend does not enable IndexNow yet because it would require hosting a verification key file. Add IndexNow in a future substantive deployment rather than spending a production deploy only for that integration.

## Verification after submission

Check again after a few days:

- Google Search Console → URL Inspection / Page indexing
- Bing Webmaster Tools → URL Inspection / URL Submission history
- query `site:rowmend.netlify.app` only as a rough external check, not as the source of truth

Do not repeatedly resubmit the same URL in an attempt to accelerate indexing.

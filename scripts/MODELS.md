# Downloading product models

## Hosting models with Git LFS

The 3,047 GLB models in `public/models` are tracked with Git LFS and served by
Next.js at `/models/[article].glb`. Both the room and hover previews use these
same-origin paths. No Blob token or external asset URL is needed for deployment.

Install Git LFS before adding or checking out models:

```sh
git lfs install
git lfs pull
npm ci
npm run build
```

The repository's `.gitattributes` tracks only `public/models/*.glb`. Git stores
small LFS pointers while GitHub stores the actual binaries. Check an upload with
`git lfs status` and `git lfs fsck`. A normal `git push` uploads required LFS
objects through the local pre-push hook. Keep that hook installed.

In Vercel, open the project settings, select **Git**, enable **Git Large File
Storage (LFS)**, and redeploy after enabling it. This is a project setting, not
a `vercel.json` option. Verify a deployed model URL returns binary GLB content,
not a Git LFS pointer or a 404 page.
The build validates every advertised GLB before compiling and fails with setup
instructions if a file is missing or still contains an LFS pointer.

References: [Vercel LFS support](https://vercel.com/docs/project-configuration/git-settings)
and [GitHub LFS usage](https://docs.github.com/en/billing/concepts/product-billing/git-lfs).
The current collection is 3.36 GiB. GitHub's included storage and monthly download
bandwidth apply, and fresh deployment downloads consume that bandwidth.

New downloads must be staged through Git LFS. Raw IKEA listings, alternate USDZ
files, processing logs, and local tokens stay out of Git. Existing Blob uploads
are independent and are not deleted by this setup.

## Download script

The scraper reads article keys from the derived `src/data/room-catalog.json` catalog. It visits IKEA product pages with headless Playwright Chromium and extracts HTTPS `.glb` and `.usdz` URLs directly from the page HTML returned by `page.content()` after navigation. Query strings are preserved, and JSON escaped slashes, Unicode slash and ampersand escapes, and HTML entities are normalized without executing embedded scripts. It collects all matching candidates and tries GLB downloads first.

Install Chromium once before running:

```sh
npx playwright install chromium
npm run models:scrape
```

For a small run or a different market:

```sh
npm run models:scrape -- --limit 5
npm run models:scrape -- --articles 80275887 --locale gb/en
npm run models:scrape -- --articles 10265392 --locale us/en
```

The market defaults to `gb/en`. Each article is visited once in the selected market. If its product page fails or no downloadable model is found, the scraper logs the result and moves on without trying another region. Use `--locale` to select a different market for the run.

Models are saved to `public/models/[article].glb`. GLB is preferred; when only a valid USDZ download succeeds, the file keeps its `.usdz` extension and the log identifies that fallback. The script does not convert USDZ to GLB. Downloads must pass HTTP, content type and binary signature checks before being saved. Existing files with the same article and format are overwritten only after download validation.

At startup the scraper creates or reads `processed_ids.log` in the project root. Each valid eight digit article in this local, gitignored log is skipped before applying `--limit`, as are articles with an existing GLB or an entry in `public/prices.json`. Blank lines are ignored and malformed lines produce one summary warning. Every attempted article is appended to the log, including successes, missing source URLs, missing downloads and all failures (even transient context, page creation or navigation errors). Writes are serialized across workers. A log write failure is reported per article and makes the run exit with an error after cleanup; that article may be attempted again on a later run.

To retry an article, remove its line from `processed_ids.log`, or remove the entire log to reset all checked IDs. Stop the scraper before editing the log. Existing GLB files and price entries still cause skips after resetting the log. The log applies across locales, so remove an article's line before retrying it in another market.

The scraper processes batches of 75 articles with one shared browser and a separate browser context and page for each article. Each article waits a random 200 to 500 milliseconds before opening its context and page. The script waits three seconds between batches, including failed attempts.

Before navigating, each page installs a request route that aborts images, stylesheets, fonts and media. Documents, scripts, fetch, XHR and all other resource types remain allowed. Model candidates come exclusively from the page HTML and are downloaded directly through the context's request client.

Each article has a 30 second navigation timeout, waits only for `domcontentloaded`, then immediately reads the page HTML. It does not interact with viewer controls, inspect iframe content, wait for model responses or wait for network idle. A page without a matching source URL logs `[article] No model URL in page HTML` and moves on immediately. Each candidate download has a 30 second timeout. Missing models and product failures are logged and skipped. Models whose URLs appear only after further JavaScript execution, an API response, iframe navigation or viewer interaction cannot be discovered by this source-only approach. Regional availability and access restrictions can also prevent discovery; a missing model does not stop the remaining articles.

Downloaded GLB models are tracked through Git LFS; alternate USDZ files stay local. Review asset usage rights before distributing them. Installing the npm package does not install a browser or run the scraper.

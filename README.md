# The Office of Sam Solomon

One-page site for samsolomon.co. The content lives in a Google Sheet. Cloudflare Pages reads the sheet, builds a static page and hosts it. There are no dependencies and nothing runs on the live site.

```
src/template.html                    page markup and styles, with {{PLACEHOLDERS}}
src/assets/                          static files, copied to the site as-is
scripts/build.mjs                    reads the sheet, fills the template, writes dist/
content/*.csv                        offline copy of the content (used when SHEET_ID isn't set)
apps-script/Publish.gs               adds Site → Publish to website to the Google Sheet
sheet-template.xlsx                  starter sheet with the current content
.github/workflows/daily-rebuild.yml  optional daily rebuild
.nvmrc                               Node version for the build
```

## Setup (once)

### 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new), then **File → Import → Upload** and choose `sheet-template.xlsx`. Pick **Replace spreadsheet**.
2. **Share → General access → Anyone with the link → Viewer.** The build reads the sheet anonymously, so it has to be viewable by link.
3. Copy the sheet ID from its URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

### 2. Create the Cloudflare Pages project

1. In the Cloudflare dashboard, go to **Workers & Pages → Create application → Pages → Connect to Git**.
2. Choose **GitHub**, authorize Cloudflare, and pick the `ssco` repository.
3. On **Set up builds and deployments**:
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: `node scripts/build.mjs`
   - Build output directory: `dist`
   - Environment variables: add `SHEET_ID` with the ID from step 1.
4. Click **Save and Deploy**. Your site appears at `ssco.pages.dev` (or similar).
5. For the custom domain, open the project's **Custom domains** tab and add `samsolomon.co`.

Every push to `main` rebuilds the site automatically.

### 3. Add the Publish button to the sheet

1. In the Pages project, go to **Settings → Builds → Deploy hooks → Add deploy hook**. Name it `google-sheet`, set the branch to `main`, and copy the URL it gives you.
2. In the sheet, open **Extensions → Apps Script**, replace the contents of `Code.gs` with `apps-script/Publish.gs`, and save.
3. In Apps Script, open **Project Settings → Script Properties** and add `DEPLOY_HOOK_URL` with the URL from step 1.
4. Reload the sheet. A **Site** menu appears. The first time you use it, Google asks you to authorize the script.

Treat the deploy hook URL like a password: anyone with it can trigger a rebuild. If it leaks, delete the hook in Cloudflare and make a new one.

### 4. Optional: daily rebuild

In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret**. Name it `CLOUDFLARE_DEPLOY_HOOK` and paste the same deploy hook URL. The site then rebuilds every morning, which catches sheet edits that weren't published. Without the secret, the workflow does nothing.

## Editing content

Edit the sheet, then choose **Site → Publish to website**. The site updates in about a minute.

- **Settings:** one key per row. `heading`, `email` and `availability` are required. A line break in `heading` (Cmd+Enter or Ctrl+Enter in the cell) becomes a line break on the page.
- **Bio:** one paragraph per row. Write links as `[label](https://example.com)`.
- **Services and Clients:** set `visible` to FALSE to hide a row. Rows sort by `order`, then by row position. A client with a `url` becomes a link.
- Don't rename the four content tabs or change their header rows. Other tabs, like *Read me*, are ignored.

If the sheet is unreadable, a tab is missing, or a required value is blank, the build fails with a message saying what to fix (see the deployment log in Cloudflare), and the live site stays as it was.

## Working locally

```
npm run build     # build dist/ from content/*.csv
SHEET_ID=… npm run build     # build from the live sheet
SHEET_ID=… npm run pull      # build from the sheet and save it to content/
npm run preview   # build, then serve dist/ at http://localhost:8000
```

Needs Node 18 or newer. To change the layout or styles, edit `src/template.html`.

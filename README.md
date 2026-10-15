# The Office of Sam Solomon

One-page site for samsolomon.co. The content lives in a Google Sheet. A GitHub Action reads the sheet, builds a static page and deploys it to GitHub Pages. There are no dependencies and nothing runs on the live site.

```
src/template.html         page markup and styles, with {{PLACEHOLDERS}}
src/assets/               static files, copied to the site as-is
scripts/build.mjs         reads the sheet, fills the template, writes dist/
content/*.csv             offline copy of the content (used when SHEET_ID isn't set)
apps-script/Publish.gs    adds Site → Publish to website to the Google Sheet
sheet-template.xlsx       starter sheet with the current content
.github/workflows/        build and deploy
```

## Setup (once)

### 1. Create the Google Sheet

1. Go to [sheets.new](https://sheets.new), then **File → Import → Upload** and choose `sheet-template.xlsx`. Pick **Replace spreadsheet**.
2. **Share → General access → Anyone with the link → Viewer.** The build reads the sheet anonymously, so it has to be viewable by link.
3. Copy the sheet ID from its URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.

### 2. Set up the GitHub repo

1. Push this folder to a new repository.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. **Settings → Secrets and variables → Actions → Variables → New repository variable.** Name it `SHEET_ID` and paste the ID as the value.
4. **Actions → Build and deploy → Run workflow** to do the first deploy.
5. For the custom domain, enter `samsolomon.co` under **Settings → Pages → Custom domain** and follow GitHub's DNS instructions.

### 3. Add the Publish button to the sheet

1. Create a token at **GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token**:
   - Repository access: **Only select repositories**, then pick this repo
   - Permissions: **Contents: Read and write**
   - Expiration: up to a year. Set a reminder to renew it.
2. In the sheet, open **Extensions → Apps Script**, replace the contents of `Code.gs` with `apps-script/Publish.gs`, and save.
3. In Apps Script, open **Project Settings → Script Properties** and add:
   - `GITHUB_REPO`: `your-username/your-repo`
   - `GITHUB_TOKEN`: the token from step 1
4. Reload the sheet. A **Site** menu appears. The first time you use it, Google asks you to authorize the script.

## Editing content

Edit the sheet, then choose **Site → Publish to website**. The site updates in about a minute. It also rebuilds daily, and after every push to `main`.

- **Settings:** one key per row. `heading`, `email` and `availability` are required. A line break in `heading` (Cmd+Enter or Ctrl+Enter in the cell) becomes a line break on the page.
- **Bio:** one paragraph per row. Write links as `[label](https://example.com)`.
- **Services and Clients:** set `visible` to FALSE to hide a row. Rows sort by `order`, then by row position. A client with a `url` becomes a link.
- Don't rename the four content tabs or change their header rows. Other tabs, like *Read me*, are ignored.

If the sheet is unreadable, a tab is missing, or a required value is blank, the build fails with a message saying what to fix, and the live site stays as it was.

## Working locally

```
npm run build     # build dist/ from content/*.csv
SHEET_ID=… npm run build     # build from the live sheet
SHEET_ID=… npm run pull      # build from the sheet and save it to content/
npm run preview   # build, then serve dist/ at http://localhost:8000
```

Needs Node 18 or newer. To change the layout or styles, edit `src/template.html`.

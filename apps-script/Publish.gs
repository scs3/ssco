/**
 * Adds a "Site" menu to the Google Sheet with a "Publish to website" item.
 * Publishing calls the Cloudflare Pages deploy hook, which rebuilds the site
 * from this sheet.
 *
 * Setup (once): Extensions → Apps Script, paste this file, then in
 * Project Settings → Script Properties add:
 *   DEPLOY_HOOK_URL   the deploy hook URL from Cloudflare
 *                     (Workers & Pages → your project → Settings → Builds → Deploy hooks)
 *
 * Treat the URL like a password: anyone who has it can trigger a rebuild.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Site')
    .addItem('Publish to website', 'publishSite')
    .addToUi();
}

function publishSite() {
  const ui = SpreadsheetApp.getUi();
  const hook = PropertiesService.getScriptProperties().getProperty('DEPLOY_HOOK_URL');

  if (!hook) {
    ui.alert('Publishing isn\'t set up yet',
      'Add DEPLOY_HOOK_URL under Extensions → Apps Script → Project Settings → Script Properties.',
      ui.ButtonSet.OK);
    return;
  }

  // Make sure edits in progress are saved before Cloudflare reads the sheet.
  SpreadsheetApp.flush();

  const res = UrlFetchApp.fetch(hook, { method: 'post', muteHttpExceptions: true });
  const code = res.getResponseCode();

  if (code >= 200 && code < 300) {
    SpreadsheetApp.getActive().toast('The site will update in about a minute.', 'Publishing', 8);
  } else if (code === 404) {
    ui.alert('Cloudflare didn\'t recognize the deploy hook (404)',
      'The hook may have been deleted. Create a new one in Cloudflare and update DEPLOY_HOOK_URL.',
      ui.ButtonSet.OK);
  } else {
    ui.alert('Publishing failed (' + code + ')', res.getContentText().slice(0, 500), ui.ButtonSet.OK);
  }
}

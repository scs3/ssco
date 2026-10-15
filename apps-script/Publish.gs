/**
 * Adds a "Site" menu to the Google Sheet with a "Publish to website" item.
 * Publishing asks GitHub to rebuild and deploy the site from the sheet.
 *
 * Setup (once): Extensions → Apps Script, paste this file, then in
 * Project Settings → Script Properties add:
 *   GITHUB_REPO   owner/repo, e.g. samsolomon/samsolomon-site
 *   GITHUB_TOKEN  a fine-grained token for that repo with
 *                 Contents: Read and write
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Site')
    .addItem('Publish to website', 'publishSite')
    .addItem('Open build status', 'openBuildStatus')
    .addToUi();
}

function publishSite() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const repo = props.getProperty('GITHUB_REPO');
  const token = props.getProperty('GITHUB_TOKEN');

  if (!repo || !token) {
    ui.alert('Publishing isn\'t set up yet',
      'Add GITHUB_REPO and GITHUB_TOKEN under Extensions → Apps Script → Project Settings → Script Properties.',
      ui.ButtonSet.OK);
    return;
  }

  // Make sure edits in progress are saved before GitHub reads the sheet.
  SpreadsheetApp.flush();

  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    payload: JSON.stringify({
      event_type: 'sheet-publish',
      client_payload: { by: Session.getActiveUser().getEmail() || 'sheet' }
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code === 204) {
    SpreadsheetApp.getActive().toast('The site will update in about a minute.', 'Publishing', 8);
  } else if (code === 401 || code === 403 || code === 404) {
    ui.alert('GitHub refused the request (' + code + ')',
      'Check that GITHUB_REPO is spelled owner/repo and that the token has Contents: Read and write on that repository and hasn\'t expired.',
      ui.ButtonSet.OK);
  } else {
    ui.alert('Publishing failed (' + code + ')', res.getContentText().slice(0, 500), ui.ButtonSet.OK);
  }
}

function openBuildStatus() {
  const repo = PropertiesService.getScriptProperties().getProperty('GITHUB_REPO');
  const url = repo ? 'https://github.com/' + repo + '/actions' : 'https://github.com';
  const html = HtmlService.createHtmlOutput(
    '<p style="font-family:sans-serif">Build status: <a href="' + url + '" target="_blank">' + url + '</a></p>'
  ).setWidth(420).setHeight(80);
  SpreadsheetApp.getUi().showModalDialog(html, 'Build status');
}

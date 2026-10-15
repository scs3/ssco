// Builds dist/ from src/template.html and the site content.
//
// Content comes from the Google Sheet named by the SHEET_ID environment
// variable. Without SHEET_ID it falls back to the CSV files in content/,
// which is handy for working offline.
//
//   node scripts/build.mjs          build (sheet if SHEET_ID is set, else content/)
//   node scripts/build.mjs --save   also write the fetched sheet into content/
//
// No dependencies; needs Node 18+.

import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "src");
const DIST = join(root, "dist");
const CONTENT = join(root, "content");

const SHEET_ID = (process.env.SHEET_ID || "").trim();
const SAVE = process.argv.includes("--save");

// Tabs the build reads, and the columns each must have.
const TABS = {
  Settings: ["key", "value"],
  Bio: ["paragraph"],
  Services: ["name"],
  Clients: ["name"],
};

const REQUIRED_SETTINGS = ["heading", "email", "availability"];
const DEFAULT_SETTINGS = {
  title: "The Office of Sam Solomon",
  description: "",
  email_label: "email",
  services_title: "Services",
  clients_title: "Clients",
  availability_label: "Availability",
};

// ---------- CSV ----------

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", i = 0, quoted = false;
  text = text.replace(/^﻿/, "");
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { quoted = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { quoted = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function toRecords(tab, text) {
  const rows = parseCSV(text).filter((r) => r.some((v) => v.trim() !== ""));
  if (!rows.length) throw new Error(`The "${tab}" tab is empty.`);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const missing = TABS[tab].filter((col) => !header.includes(col));
  if (missing.length) {
    throw new Error(
      `The "${tab}" tab is missing the column(s): ${missing.join(", ")}. ` +
      `Found: ${header.join(", ") || "(none)"}. Check the tab name and the header row.`
    );
  }
  return rows.slice(1).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()]))
  );
}

// ---------- Loading ----------

async function fetchTab(tab) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: "follow" });
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.includes("csv")) {
    throw new Error(
      `Couldn't read the "${tab}" tab (HTTP ${res.status}, ${type || "no content type"}). ` +
      `Make sure the sheet is shared as "Anyone with the link: Viewer" and SHEET_ID is right.`
    );
  }
  return res.text();
}

async function loadContent() {
  const raw = {};
  for (const tab of Object.keys(TABS)) {
    raw[tab] = SHEET_ID
      ? await fetchTab(tab)
      : await readFile(join(CONTENT, `${tab}.csv`), "utf8");
  }
  if (SHEET_ID && SAVE) {
    for (const [tab, text] of Object.entries(raw)) {
      await writeFile(join(CONTENT, `${tab}.csv`), text.endsWith("\n") ? text : text + "\n");
    }
    console.log("Saved the sheet to content/.");
  }
  return Object.fromEntries(Object.entries(raw).map(([tab, text]) => [tab, toRecords(tab, text)]));
}

// ---------- Rendering ----------

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isVisible = (v) => !/^(false|no|0|hide|hidden)$/i.test(String(v ?? "").trim());

function ordered(records) {
  return records
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.name && isVisible(r.visible))
    .sort((a, b) => {
      const oa = parseFloat(a.r.order), ob = parseFloat(b.r.order);
      const ka = Number.isFinite(oa) ? oa : Infinity, kb = Number.isFinite(ob) ? ob : Infinity;
      return ka - kb || a.i - b.i;
    })
    .map(({ r }) => r);
}

function safeUrl(url) {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

// Escapes text, then turns [label](https://…) into links and line breaks into <br>.
function inlineMarkdown(text) {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
      const href = safeUrl(url.replace(/&amp;/g, "&"));
      if (!href) return m;
      return `<a href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`;
    })
    .replace(/\n/g, "<br>");
}

function renderHeading(text) {
  let i = 0;
  return text
    .split(/\r?\n/)
    .map((line) =>
      line.trim().split(/\s+/).filter(Boolean)
        .map((w) => `<span class="word" style="--i:${i++}">${esc(w)}</span>`)
        .join(" ")
    )
    .filter(Boolean)
    .join("<br>");
}

function renderTags(records, withLinks) {
  return ordered(records)
    .map((r) => {
      const href = withLinks && r.url ? safeUrl(r.url) : null;
      return href
        ? `        <li><a class="tag" href="${esc(href)}" target="_blank" rel="noopener">${esc(r.name)}</a></li>`
        : `        <li class="tag">${esc(r.name)}</li>`;
    })
    .join("\n");
}

function render(template, content) {
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of content.Settings) if (key) settings[key.toLowerCase()] = value;

  const missing = REQUIRED_SETTINGS.filter((k) => !settings[k]);
  if (missing.length) throw new Error(`Settings tab is missing a value for: ${missing.join(", ")}.`);

  const paragraphs = content.Bio.map((r) => r.paragraph).filter(Boolean);
  if (!paragraphs.length) throw new Error("The Bio tab has no paragraphs.");

  const services = renderTags(content.Services, false);
  const clients = renderTags(content.Clients, true);
  if (!services) throw new Error("The Services tab has no visible rows.");
  if (!clients) throw new Error("The Clients tab has no visible rows.");

  const values = {
    TITLE: esc(settings.title),
    DESCRIPTION: esc(settings.description),
    HEADING: renderHeading(settings.heading),
    EMAIL: esc(settings.email),
    EMAIL_LABEL: esc(settings.email_label),
    BIO: paragraphs.map((p) => `        <p>${inlineMarkdown(p)}</p>`).join("\n"),
    SERVICES_TITLE: esc(settings.services_title),
    CLIENTS_TITLE: esc(settings.clients_title),
    SERVICES: services,
    CLIENTS: clients,
    AVAILABILITY_LABEL: esc(settings.availability_label),
    AVAILABILITY: esc(settings.availability),
  };

  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => {
    if (!(key in values)) throw new Error(`Template uses an unknown placeholder: ${m}`);
    return values[key];
  });
  return html;
}

// ---------- Main ----------

async function main() {
  console.log(SHEET_ID ? `Reading Google Sheet ${SHEET_ID}…` : "SHEET_ID not set; reading content/ CSV files.");
  const content = await loadContent();
  const template = await readFile(join(SRC, "template.html"), "utf8");
  const html = render(template, content);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  for (const entry of await readdir(SRC)) {
    if (entry !== "template.html") await cp(join(SRC, entry), join(DIST, entry), { recursive: true });
  }
  await writeFile(join(DIST, "index.html"), html);
  console.log(
    `Built dist/index.html — ${ordered(content.Services).length} services, ` +
    `${ordered(content.Clients).length} clients, ${content.Bio.filter((r) => r.paragraph).length} bio paragraphs.`
  );
}

main().catch((err) => {
  console.error(`Build failed: ${err.message}`);
  process.exit(1);
});

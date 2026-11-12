/**
 * ALHAYBA Store — receive orders from the website and save them in this Google Sheet.
 *
 * Setup (once):
 *  1. Open your Google Sheet → Extensions → Apps Script.
 *  2. Delete everything in Code.gs and paste this whole file. Save.
 *  3. Deploy → New deployment → type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     → Deploy → authorize → copy the "Web app URL" (ends with /exec).
 *  4. Put that URL in js/app.js → CONFIG.sheetUrl.
 *
 * If you edit this script later: Deploy → Manage deployments → ✏️ Edit →
 * Version: "New version" → Deploy (the URL stays the same).
 */

const ORDERS_SHEET = "Commandes";
const CLICKS_SHEET = "Clics WhatsApp";

const ORDER_HEADERS = ["Date", "N° commande", "Source", "Nom", "Téléphone", "Ville",
  "Produits", "Quantité", "Total (DH)", "Statut", "Page"];
const CLICK_HEADERS = ["Date", "Produit", "Prix (DH)", "Bouton", "Page"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // Honeypot: bots fill hidden fields, humans don't.
    if (data.website) return json({ ok: true });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tz = ss.getSpreadsheetTimeZone();
    const now = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

    if (data.type === "click") {
      const sh = sheet(ss, CLICKS_SHEET, CLICK_HEADERS);
      sh.appendRow([now, clean(data.product), num(data.price), clean(data.button), clean(data.page)]);
      return json({ ok: true });
    }

    // Order (from the order form or the cart)
    const items = Array.isArray(data.items) ? data.items.slice(0, 30) : [];
    const products = items.map(i => `${clean(i.name)} (${clean(i.size)}) × ${num(i.qty)}`).join("\n");
    const qty = items.reduce((s, i) => s + num(i.qty), 0);

    const sh = sheet(ss, ORDERS_SHEET, ORDER_HEADERS);
    sh.appendRow([
      now,
      clean(data.orderId),
      data.source === "cart" ? "Panier" : "Formulaire",
      clean(data.name),
      "'" + clean(data.phone).replace(/^'+/, ""),   // keep the leading 0
      clean(data.city),
      products,
      qty,
      num(data.total),
      "Nouvelle",
      clean(data.page),
    ]);
    return json({ ok: true, orderId: data.orderId });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Visit the /exec URL in a browser to check the deployment works. */
function doGet() {
  return json({ ok: true, message: "ALHAYBA order endpoint is running." });
}

/* ---------- helpers ---------- */
function sheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d6af5c");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Text only, limited length, and block spreadsheet formulas (=, +, -, @).
function clean(v) {
  let s = String(v == null ? "" : v).trim().slice(0, 300);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function num(v) {
  const n = Number(v);
  return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

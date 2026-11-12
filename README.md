# ALHAYBA Store — متجر الهيبة

Static storefront (HTML/CSS/JS, no build step) with categories, product details, cart and WhatsApp ordering.
Live: https://al-hayba.vercel.app/

## Orders → Google Sheet → WhatsApp
When a customer confirms an order (order form or cart), the site:
1. saves it in the Google Sheet (tab **Commandes**: date, order number, name, phone, city, products, total, status),
2. then redirects the customer to WhatsApp with the same order number in the message.

Clicks on a product's WhatsApp button are saved in a second tab, **Clics WhatsApp**.
If Google is slow or down, the customer is still sent to WhatsApp after 2.5 s — no order is blocked.

### Setup (once, ~5 minutes)
1. Open the Google Sheet → **Extensions → Apps Script**.
2. Delete the code in `Code.gs`, paste the content of [`google-apps-script/Code.gs`](google-apps-script/Code.gs), click 💾 Save.
3. **Deploy → New deployment** → ⚙️ type **Web app** →
   *Execute as:* **Me** · *Who has access:* **Anyone** → **Deploy**.
4. Google asks for authorization → choose your account → *Advanced* → *Go to (unsafe)* → **Allow**
   (it's your own script; it only writes to this Sheet).
5. Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
   Open it in the browser: you should see `{"ok":true,...}`.
6. Paste it in `js/app.js` → `CONFIG.sheetUrl`, bump `?v=` on the `app.js` link in `index.html`, push.

The tabs **Commandes** and **Clics WhatsApp** are created automatically on the first order.
To change the script later: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy** (URL stays the same).

## Structure
```
index.html          page + all product cards + SEO structured data (JSON-LD)
css/styles.css      design (black & gold, RTL)
js/app.js           cart, categories filter, product popup, order form, WhatsApp links
assets/products/    optimized WebP product images (used by the site)
assets/og-image.jpg image shown when the link is shared (WhatsApp, Facebook…)
robots.txt, sitemap.xml, favicon.svg, site.webmanifest
```

## Product pages (for ads)
Every product has its own landing page with an order form built in:

| Product | Link for ads |
|---|---|
| Sexo Miel | https://al-hayba.vercel.app/produits/sexo-miel |
| Prosta Miel | https://al-hayba.vercel.app/produits/prosta-miel |
| Prostalex | https://al-hayba.vercel.app/produits/prostalex |
| Maca | https://al-hayba.vercel.app/produits/maca |
| Ashwagandha | https://al-hayba.vercel.app/produits/ashwagandha |
| Tribulus | https://al-hayba.vercel.app/produits/tribulus |
| Shilajit | https://al-hayba.vercel.app/produits/shilajit |
| Ginseng | https://al-hayba.vercel.app/produits/ginseng |
| Racine d'ortie | https://al-hayba.vercel.app/produits/racine-ortie |
| Pack huile de courge | https://al-hayba.vercel.app/produits/pack-huile-courge |
| Pack costus marin | https://al-hayba.vercel.app/produits/pack-costus-marin |
| Crème Al Jamal | https://al-hayba.vercel.app/produits/creme-al-jamal |
| Huile de gingembre | https://al-hayba.vercel.app/produits/huile-gingembre |

**Track which ad brings orders:** add UTM tags to the link, e.g.
`https://al-hayba.vercel.app/produits/sexo-miel?utm_source=facebook&utm_campaign=sexo-nov`.
The full link is saved in the Sheet column **Page** for every order.

**The pages are generated** from the product cards in `index.html`. After changing a product
(price, name, description, image), run:
```bash
node tools/build-product-pages.js
```
This rebuilds `produits/*.html` and `sitemap.xml`. Share images per product are in `assets/og/`.

## Common edits
- **WhatsApp numbers** — `CONFIG` at the top of `js/app.js`, and the visible numbers in `index.html` (search `07 84`).
- **Price / name of a product** — edit its `<article class="p-card" …>` in `index.html`:
  the `data-price` attribute (used by the cart) **and** the visible `<p class="price">`.
  Also update the same product in the JSON-LD block at the top (`"price": "199"`) so Google shows the right price.
- **Add a product** — copy an existing `<article class="p-card">` into the right category section, give it a new
  `id="p-xxx"` / `data-id="xxx"`, add a WebP image to `assets/products/`, and add an entry to the JSON-LD list.
  Category counts update automatically.
- **After changing CSS/JS** — bump the `?v=` number on the `styles.css` / `app.js` links in `index.html`
  so returning visitors get the new version.

## Domain
All SEO URLs use `https://al-hayba.vercel.app/`. If you connect your own domain, replace that URL in
`index.html` (canonical, og:*, JSON-LD), `robots.txt` and `sitemap.xml`.
After deploy, submit the sitemap in Google Search Console.

## Images
To add an optimized image (ffmpeg):
```bash
ffmpeg -i photo.png -vf "scale='min(800,iw)':-1" -c:v libwebp -quality 80 assets/products/name.webp
```

## Run locally
```bash
python -m http.server 5178
```
then open http://localhost:5178

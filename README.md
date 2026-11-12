# ALHAYBA Store — متجر الهيبة

Static storefront (HTML/CSS/JS, no build step) with categories, product details, cart and WhatsApp ordering.
Live: https://al-hayba.vercel.app/

## Structure
```
index.html          page + all product cards + SEO structured data (JSON-LD)
css/styles.css      design (black & gold, RTL)
js/app.js           cart, categories filter, product popup, order form, WhatsApp links
assets/products/    optimized WebP product images (used by the site)
assets/og-image.jpg image shown when the link is shared (WhatsApp, Facebook…)
robots.txt, sitemap.xml, favicon.svg, site.webmanifest
```

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

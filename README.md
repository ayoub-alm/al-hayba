# ALHAYBA Store — Landing page

Static landing page (HTML/CSS/JS, no build step) for Sexo Miel, Prosta Miel and Huile de Gingembre, with WhatsApp ordering.

## Edit
Everything you may want to change is in the `CONFIG` block at the bottom of `index.html`:
- `whatsapp` — main number (international format, digits only, e.g. `212784960106`)
- `whatsapp2` — second number
- `products[].price` — set a number (DH) or `null` to show "price on WhatsApp"

## Deploy on Vercel
1. Go to https://vercel.com/new and import the GitHub repo `ayoub-alm/al-hayba`.
2. Framework Preset: **Other** — leave Build Command and Output Directory empty.
3. Click **Deploy**. Every push to `main` redeploys automatically.

`vercel.json` adds long-term caching for `/assets` and basic security headers.

## Run locally
```bash
python -m http.server 5178
```
then open http://localhost:5178

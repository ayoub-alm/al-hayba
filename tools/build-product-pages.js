#!/usr/bin/env node
/**
 * ALHAYBA — build one landing page per product (for ads + SEO).
 *
 *   node tools/build-product-pages.js
 *
 * Source of truth = the product cards in index.html (name, price, image, description, details).
 * Edit a product there, run this script, commit → every product page is regenerated in /produits/.
 * Output: produits/<slug>.html  (served by Vercel as /produits/<slug>)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://al-hayba.vercel.app";
const WA = "212784960106";
const OUT_DIR = path.join(ROOT, "produits");

const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const version = (index.match(/styles\.css\?v=([\w-]+)/) || [])[1] || "1";

/* ---------------- helpers ---------------- */
const between = (s, a, b) => {
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length);
  if (i < 0 || j < 0) throw new Error(`markers not found: ${a} … ${b}`);
  return s.slice(i, j);
};
const pick = (s, re, i = 1) => { const m = s.match(re); return m ? m[i] : ""; };
const strip = h => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const esc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrs = s => Object.fromEntries([...s.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
// links in shared chunks must work from /produits/
const abs = h => h
  .replace(/(src|poster|href)="assets\//g, '$1="/assets/')
  .replace(/href="#top"/g, 'href="/"')
  .replace(/href="#(?!i-)([\w-]+)"/g, 'href="/#$1"');   // keep SVG icon refs (#i-…) local

/* ---------------- read products from index.html ---------------- */
const groups = [...index.matchAll(/<section class="cat-group" id="cat-([\w-]+)"[\s\S]*?<h3[^>]*>([^<]+)<span lang="fr">([^<]+)<\/span><\/h3>([\s\S]*?)<\/section>/g)]
  .map(m => ({ key: m[1], title: m[2].trim(), titleFr: m[3].trim(), html: m[4] }));

const products = [];
for (const g of groups) {
  for (const m of g.html.matchAll(/<article class="p-card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g)) {
    const a = attrs(m[1]), inner = m[2];
    const slug = path.basename(a["data-img"], path.extname(a["data-img"]));
    products.push({
      id: a["data-id"],
      slug,
      name: a["data-name"],
      nameFr: a["data-name-fr"],
      size: a["data-size"],
      price: Number(a["data-price"]),
      img: "/" + a["data-img"],
      imgFile: a["data-img"],
      catLabel: a["data-cat-label"],
      group: g.key,
      groupTitle: g.title,
      groupTitleFr: g.titleFr,
      badge: pick(inner, /<span class="p-badge">([^<]*)<\/span>/),
      alt: pick(inner, /<img [^>]*alt="([^"]*)"/),
      photo: /p-media--photo/.test(inner),
      desc: pick(inner, /<p class="p-desc">([\s\S]*?)<\/p>/).trim(),
      details: pick(inner, /<div class="p-details">([\s\S]*?)<\/div>\s*$/).trim(),
    });
  }
}
if (products.length < 1) throw new Error("no products found in index.html");
const byId = Object.fromEntries(products.map(p => [p.id, p]));

/* image sizes (width/height attributes) from index.html */
const imgSize = file => {
  const m = index.match(new RegExp(`src="${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*width="(\\d+)" height="(\\d+)"`));
  return m ? { w: m[1], h: m[2] } : { w: 800, h: 800 };
};

/* ---------------- shared chunks from index.html ---------------- */
const sprite = pick(index, /(<svg width="0" height="0"[\s\S]*?<\/svg>)/);
const topbar = pick(index, /(<div class="topbar">[\s\S]*?<\/div>)/);
const header = abs(pick(index, /(<header class="site-header">[\s\S]*?<\/header>)/));
const trust = abs(between(index, "<!-- ============ TRUST", "<!-- ============ PRODUCTS")).replace(/^<!--[^>]*-->\s*/, "");
const how = abs(between(index, "<!-- ============ HOW TO ORDER", "<!-- ============ ORDER FORM")).replace(/^<!--[^>]*-->\s*/, "");
const faq = abs(between(index, "<!-- ============ FAQ", "<!-- ============ FINAL CTA")).replace(/^<!--[^>]*-->\s*/, "");
const finalCta = abs(between(index, "<!-- ============ FINAL CTA", "</main>")).replace(/^<!--[^>]*-->\s*/, "");
const footer = abs(pick(index, /(<footer class="footer">[\s\S]*?<\/footer>)/))
  .replace(/<a href="\/#cat-([\w-]+)" data-filter-link="[\w-]+">/g, '<a href="/#cat-$1">');
const waFloat = pick(index, /(<a class="wa-float"[\s\S]*?<\/a>)/);
const mbar = between(index, '<div class="mbar"', "<!-- Cart drawer -->");
const cartDrawer = between(index, "<!-- Cart drawer -->", "<!-- Quick order -->");
const quickOrder = between(index, "<!-- Quick order -->", "<!-- Product details -->");
const toast = '<div class="toast" id="toast" role="status" aria-live="polite"></div>';
const fontsHead = pick(index, /(<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">[\s\S]*?display=swap">)/);

/* videos on the store page, keyed by product id */
const videos = {};
for (const m of index.matchAll(/<article class="video[^"]*">([\s\S]*?)<\/article>/g)) {
  const id = pick(m[1], /data-order="([\w-]+)"/);
  if (id) videos[id] = { html: abs(m[0]), portrait: /video--portrait/.test(m[0]) };
}

/* ---------------- page template ---------------- */
const upsellOf = id => byId[id === "ginger" ? "jamal" : "ginger"];
const cartSvg = '<svg aria-hidden="true"><use href="#i-cart"/></svg>';
const waSvg = '<svg aria-hidden="true"><use href="#i-wa"/></svg>';

function relatedCards(p) {
  const same = products.filter(x => x.group === p.group && x.id !== p.id);
  const others = products.filter(x => x.group !== p.group);
  return [...same, ...others].slice(0, 4).map(x => {
    const s = imgSize(x.imgFile);
    return `
        <article class="p-card">
          ${x.badge ? `<span class="p-badge">${x.badge}</span>` : ""}
          <a class="p-media${x.photo ? " p-media--photo" : ""}" href="/produits/${x.slug}" aria-label="${esc(x.name)}">
            <img src="${x.img}" alt="${esc(x.alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
          </a>
          <div class="p-body">
            <span class="p-cat">${x.catLabel}</span>
            <h3 class="p-name"><a href="/produits/${x.slug}">${x.name}</a></h3>
            <p class="p-sub" lang="fr" dir="ltr">${x.nameFr} · ${x.size}</p>
            <div class="p-foot">
              <div class="p-price-row"><p class="price">${x.price}<small>DH</small></p><a class="p-detail-link" href="/produits/${x.slug}">التفاصيل</a></div>
              <div class="p-actions">
                <button type="button" class="btn btn--gold" data-order="${x.id}">اطلب دابا</button>
                <button type="button" class="btn-icon btn-icon--cart" data-add-cart="${x.id}" aria-label="زيد ${esc(x.name)} للسلة">${cartSvg}</button>
              </div>
            </div>
          </div>
        </article>`;
  }).join("");
}

function page(p) {
  const url = `${SITE}/produits/${p.slug}`;
  const s = imgSize(p.imgFile);
  const up = upsellOf(p.id);
  const title = `${p.name} ${p.nameFr} ${p.size} — ${p.price} درهم | متجر الهيبة`;
  const description = `${strip(p.desc)} ${p.price} درهم، التوصيل لجميع مدن المغرب والدفع عند الاستلام. اطلب دابا.`.slice(0, 300);
  const longText = strip(p.details.replace(/<ul[\s\S]*<\/ul>/, ""));
  const specs = [...p.details.matchAll(/<li><b>([^<]+)<\/b><span[^>]*>([^<]+)<\/span><\/li>/g)].map(m => ({ k: m[1], v: m[2] }));
  const ogImage = `${SITE}/assets/og/${p.slug}.jpg`;
  const video = videos[p.id];
  const catalog = products.map(({ id, name, nameFr, size, price, img, catLabel, group }) => ({ id, name, nameFr, size, price, img, catLabel, group }));

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${url}#product`,
        name: `${p.nameFr} — ${p.name} ${p.size}`,
        image: [`${SITE}${p.img}`],
        description: longText || strip(p.desc),
        sku: p.id,
        category: p.groupTitle,
        offers: {
          "@type": "Offer",
          url,
          price: String(p.price),
          priceCurrency: "MAD",
          availability: "https://schema.org/InStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "OnlineStore", name: "ALHAYBA Store", url: `${SITE}/` },
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "الرئيسية", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: p.groupTitle, item: `${SITE}/#cat-${p.group}` },
          { "@type": "ListItem", position: 3, name: p.name, item: url },
        ],
      },
    ],
  };

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0b0907">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="product">
<meta property="og:site_name" content="ALHAYBA Store — متجر الهيبة">
<meta property="og:locale" content="ar_MA">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(`${p.name} — ${p.price} درهم | متجر الهيبة`)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="product:price:amount" content="${p.price}">
<meta property="product:price:currency" content="MAD">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(`${p.name} — ${p.price} درهم`)}">
<meta name="twitter:image" content="${ogImage}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/site.webmanifest">
${fontsHead}
<link rel="preload" as="image" href="${p.img}" fetchpriority="high">
<link rel="stylesheet" href="/css/styles.css?v=${version}">
<script>document.documentElement.classList.add("js")</script>
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
<body data-product="${p.id}">
<a class="skip-link" href="#commander">تخطى للطلب</a>

${sprite}

${topbar}

${header}

<main id="top">

<nav class="crumbs wrap" aria-label="مسار الصفحة">
  <a href="/">الرئيسية</a><span aria-hidden="true">›</span><a href="/#cat-${p.group}">${p.groupTitle}</a><span aria-hidden="true">›</span><span aria-current="page">${p.name}</span>
</nav>

<!-- ============ PRODUCT ============ -->
<section class="pp" aria-labelledby="ppTitle">
  <div class="wrap pp__grid">
    <div class="pp__media">
      <div class="pp__img${p.photo ? " pp__img--photo" : ""}">
        ${p.badge ? `<span class="p-badge">${p.badge}</span>` : ""}
        <img src="${p.img}" alt="${esc(p.alt)}" width="${s.w}" height="${s.h}" fetchpriority="high" decoding="async">
      </div>
      <ul class="pp__badges">
        <li><svg aria-hidden="true"><use href="#i-cash"/></svg><span>الدفع عند الاستلام</span></li>
        <li><svg aria-hidden="true"><use href="#i-truck"/></svg><span>التوصيل لجميع المدن</span></li>
        <li><svg aria-hidden="true"><use href="#i-lock"/></svg><span>تغليف سري</span></li>
      </ul>
    </div>

    <div class="pp__info">
      <span class="p-cat">${p.catLabel}</span>
      <h1 id="ppTitle">${p.name} <span lang="fr" dir="ltr">${p.nameFr} · ${p.size}</span></h1>
      <div class="pp__price"><p class="price">${p.price}<small>DH</small></p><span class="pp__cod">الدفع عند الاستلام</span></div>
      <p class="pp__desc">${p.desc}</p>
      ${specs.length ? `<ul class="pp__points">${specs.map(x => `<li><svg aria-hidden="true"><use href="#i-check"/></svg><b>${x.k}:</b> <span>${x.v}</span></li>`).join("")}</ul>` : ""}

      <div class="pp-form-wrap" id="commander">
        <form class="pp-form" id="ppForm" data-product="${p.id}" novalidate>
          <div class="pp-form__head">
            <h2>اطلب دابا</h2>
            <p>عمر المعلومات — كنتاصلو بيك باش نأكدو الطلب</p>
          </div>
          <div class="pp-form__qty">
            <span>الكمية</span>
            <div class="qty" aria-label="الكمية">
              <button type="button" id="ppMinus" aria-label="نقص">−</button>
              <output id="ppQty">1</output>
              <button type="button" id="ppPlus" aria-label="زيد">+</button>
            </div>
          </div>
          ${up ? `<label class="qo__upsell" id="ppUpsell">
            <input type="checkbox" id="ppUpsellCheck">
            <img src="${up.img}" alt="" width="48" height="48" loading="lazy">
            <span><b>زيد معاه ${up.name}</b><small>+ ${up.price} DH فقط</small></span>
          </label>` : ""}
          <div class="qo__fields">
            <div class="field">
              <label for="ppName">الاسم الكامل</label>
              <input id="ppName" name="name" autocomplete="name" placeholder="مثال: يوسف العلوي" required>
            </div>
            <div class="row2">
              <div class="field">
                <label for="ppPhone">رقم الهاتف</label>
                <input id="ppPhone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="06 XX XX XX XX" dir="ltr" required>
              </div>
              <div class="field">
                <label for="ppCity">المدينة</label>
                <input id="ppCity" name="city" autocomplete="address-level2" placeholder="الدار البيضاء" required>
              </div>
            </div>
            <div class="field">
              <label for="ppAddress">العنوان <small>(اختياري)</small></label>
              <input id="ppAddress" name="address" autocomplete="street-address" placeholder="الحي، الزنقة، الرقم…">
            </div>
            <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          </div>
          <div class="qo__total"><span>المجموع</span><strong id="ppTotal">${p.price} DH</strong></div>
          <p class="form-error" id="ppError" role="alert"></p>
          <button type="submit" class="btn btn--gold btn--block qo__submit" id="ppSubmit"><svg aria-hidden="true"><use href="#i-check"/></svg> <span>أكد الطلب</span></button>
          <ul class="qo__assure">
            <li><svg aria-hidden="true"><use href="#i-cash"/></svg>ما كتخلص والو دابا</li>
            <li><svg aria-hidden="true"><use href="#i-lock"/></svg>تغليف سري</li>
            <li><svg aria-hidden="true"><use href="#i-truck"/></svg>جميع المدن</li>
          </ul>
        </form>
        <a class="pp__wa" data-wa="${p.id}" href="https://wa.me/${WA}" target="_blank" rel="noopener">${waSvg} ولا اطلب مباشرة عبر واتساب</a>
      </div>
    </div>
  </div>
</section>

${trust}

<!-- ============ DETAILS ============ -->
<section class="sec" id="details" aria-labelledby="detailsTitle">
  <div class="wrap pp-details">
    <div class="pp-details__text reveal">
      <p class="sec-head__kicker" lang="fr">Détails du produit</p>
      <h2 id="detailsTitle">تفاصيل ${p.name}</h2>
      ${p.details}
      <button type="button" class="btn btn--gold" data-goto-form>اطلب ${p.name} دابا — ${p.price} DH</button>
    </div>
    ${video ? `<div class="pp-details__video${video.portrait ? " is-portrait" : ""} reveal">${video.html.replace(/<div class="video__body">[\s\S]*?<\/button>\s*<\/div>/, "")}</div>` : ""}
  </div>
</section>

${how}

${faq}

<!-- ============ RELATED ============ -->
<section class="sec sec--alt" aria-labelledby="relatedTitle">
  <div class="wrap">
    <header class="sec-head reveal">
      <p class="sec-head__kicker" lang="fr">Vous aimerez aussi</p>
      <h2 id="relatedTitle">منتجات <span class="gold">قريبة ليه</span></h2>
    </header>
    <div class="grid">${relatedCards(p)}
    </div>
    <p class="pp-all"><a class="btn btn--outline" href="/#products">شوف جميع المنتجات</a></p>
  </div>
</section>

${finalCta}
</main>

${footer}

${waFloat}

${mbar}
${cartDrawer}
${quickOrder}
${toast}

<script type="application/json" id="catalogData">${JSON.stringify(catalog)}</script>
<script src="/js/app.js?v=${version}" defer></script>
</body>
</html>
`;
}

/* ---------------- write ---------------- */
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT_DIR, f));
for (const p of products) fs.writeFileSync(path.join(OUT_DIR, `${p.slug}.html`), page(p));

/* sitemap */
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
${products.map(p => `    <image:image><image:loc>${SITE}${p.img}</image:loc></image:image>`).join("\n")}
  </url>
${products.map(p => `  <url>
    <loc>${SITE}/produits/${p.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <image:image><image:loc>${SITE}${p.img}</image:loc></image:image>
  </url>`).join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);

console.log(`Built ${products.length} product pages in /produits:`);
for (const p of products) console.log(`  ${SITE}/produits/${p.slug}   (${p.name} — ${p.price} DH)`);

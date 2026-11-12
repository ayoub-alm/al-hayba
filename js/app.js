/* ALHAYBA Store — app logic (store page + product pages)
   Store page: product data is read from the HTML cards (data-* attributes).
   Product pages (/produits/*.html): data comes from the embedded #catalogData JSON,
   generated from index.html by tools/build-product-pages.js. */
(() => {
  "use strict";

  /* ================= CONFIG — edit here ================= */
  const CONFIG = {
    whatsapp: "212784960106",   // main number   07 84 96 01 06
    whatsapp2: "212700430167",  // second number 07 00 43 01 67
    currency: "DH",
    featured: "sexo",           // product shown in the mobile bottom bar
    upsell: "ginger",           // "add this too" suggestion in the order popup
    upsellAlt: "jamal",         // suggestion when the customer orders the upsell product itself
    cartKey: "alhayba-cart-v1",
    // Google Sheet: paste your Apps Script "Web app URL" here (ends with /exec).
    // Leave empty to skip the Sheet and go straight to WhatsApp.
    sheetUrl: "https://script.google.com/macros/s/AKfycbzzMBtY5QAcx0ynBJ7D_23IRIV9_Ic8xFka8v1H8eyvKfOCF6PuYYNZyhmMEyJDplNy4g/exec",
  };
  /* ====================================================== */

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- products: from store cards, or from the product page catalog ---------- */
  const cards = $$("#productGrid .p-card[data-id], .cat-group .p-card[data-id]");
  const products = cards.length
    ? cards.map(card => ({
        id: card.dataset.id,
        name: card.dataset.name,
        nameFr: card.dataset.nameFr,
        size: card.dataset.size,
        price: Number(card.dataset.price) || 0,
        img: card.dataset.img,
        catLabel: card.dataset.catLabel,
        group: card.closest("[data-group]")?.dataset.group,
        card,
      }))
    : (() => { try { return JSON.parse($("#catalogData")?.textContent || "[]"); } catch { return []; } })();
  const byId = Object.fromEntries(products.map(p => [p.id, p]));
  const money = n => `${n} ${CONFIG.currency}`;

  /* ---------- WhatsApp ---------- */
  // api.whatsapp.com directly: the wa.me redirect turns emojis into "�"
  const wa = (text, number = CONFIG.whatsapp) => `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(text)}`;
  // No emojis in messages: WhatsApp's link page shows them as "�"
  const hello = "السلام عليكم ALHAYBA";
  const productMsg = (p, q = 1) =>
    `${hello}\nبغيت نطلب:\n• ${p.nameFr} (${p.name}) — ${p.size}\n• الكمية: ${q}\n• الثمن: ${money(p.price * q)}\n\nعفاكم أكدو ليا ثمن التوصيل.`;
  const generalMsg = `${hello}\nبغيت نعرف أكثر على المنتجات ديالكم.`;

  $$("[data-wa]").forEach(a => {
    const key = a.dataset.wa, p = byId[key];
    a.href = p ? wa(productMsg(p)) : key === "general2" ? wa(generalMsg, CONFIG.whatsapp2) : wa(generalMsg);
  });

  /* ---------- Google Sheet ---------- */
  const newOrderId = () => "AH-" + Date.now().toString(36).toUpperCase().slice(-6);
  const page = () => location.href.split("#")[0];

  // Send an order, wait max 2.5 s, never block the customer if Google is slow/down.
  function sendOrder(payload) {
    if (!CONFIG.sheetUrl) return Promise.resolve();
    const req = fetch(CONFIG.sheetUrl, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, page: page() }),
    }).catch(() => {});
    return Promise.race([req, new Promise(r => setTimeout(r, 2500))]);
  }

  // Log a direct WhatsApp click (no customer data) — fire and forget.
  function logClick(p, button) {
    if (!CONFIG.sheetUrl || !p) return;
    const body = JSON.stringify({ type: "click", product: `${p.nameFr} (${p.size})`, price: p.price, button, page: page() });
    try {
      if (!navigator.sendBeacon?.(CONFIG.sheetUrl, new Blob([body], { type: "text/plain" }))) throw 0;
    } catch {
      fetch(CONFIG.sheetUrl, { method: "POST", mode: "no-cors", keepalive: true, body }).catch(() => {});
    }
  }

  const PHONE_RE = /^(?:0[5-7]\d{8}|(?:\+|00)?212[5-7]\d{8})$/;
  const CUSTOMER_KEY = "alhayba-customer-v1";
  const customerForms = () => $$("#qoForm, #cartForm, #orderForm");

  // Returns {name, city, phone, address} or null (and shows the error).
  function readCustomer(form, errEl) {
    const f = form.elements;
    const name = f.name.value.trim(), city = f.city.value.trim(), phone = f.phone.value.trim();
    const address = f.address ? f.address.value.trim() : "";
    [f.name, f.city, f.phone].forEach(i => i.removeAttribute("aria-invalid"));
    const bad = !name ? f.name : !PHONE_RE.test(phone.replace(/[\s().-]/g, "")) ? f.phone : !city ? f.city : null;
    if (bad) {
      bad.setAttribute("aria-invalid", "true");
      errEl.textContent = bad === f.phone ? "رقم الهاتف ماشي صحيح (مثال: 0612345678)." : bad === f.name ? "عافاك كتب الاسم ديالك." : "عافاك كتب المدينة.";
      bad.focus();
      return null;
    }
    errEl.textContent = "";
    return { name, city, phone, address, bot: f.website?.value || "" };
  }

  // Remember the customer on this device so the next order is faster.
  function saveCustomer(c) {
    try { localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: c.name, phone: c.phone, city: c.city, address: c.address })); } catch { /* ignore */ }
  }
  function prefillCustomer() {
    let c;
    try { c = JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null"); } catch { c = null; }
    if (!c || typeof c !== "object") return;
    customerForms().forEach(form => ["name", "phone", "city", "address"].forEach(k => {
      const input = form.elements[k];
      if (input && !input.value && typeof c[k] === "string") input.value = c[k].slice(0, 200);
    }));
  }

  function setLoading(btn, on) {
    btn.classList.toggle("is-loading", on);
    btn.disabled = on;
    const label = btn.querySelector("span");
    if (label) {
      if (on) { label.dataset.html = label.innerHTML; label.textContent = "كنسجلو الطلب…"; }
      else label.innerHTML = label.dataset.html || label.innerHTML;
    }
  }

  const customerLines = c =>
    `\n\nالاسم: ${c.name}\nالهاتف: ${c.phone}\nالمدينة: ${c.city}` + (c.address ? `\nالعنوان: ${c.address}` : "");

  /* ---------- toast ---------- */
  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), 2400);
  }

  /* ---------- dialogs ---------- */
  function openDialog(d) { d.showModal(); document.body.classList.add("is-locked"); }
  $$("dialog").forEach(d => {
    d.addEventListener("close", () => document.body.classList.remove("is-locked"));
    d.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return d.close();
      if (e.target === d) { // backdrop click
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
      }
    });
  });

  /* ================= CART ================= */
  let cart = {};
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.cartKey) || "{}");
    for (const p of products) {
      const n = Number(saved?.[p.id]);
      if (Number.isInteger(n) && n > 0) cart[p.id] = Math.min(n, 99);
    }
  } catch { /* storage unavailable */ }

  const cartDialog = $("#cartDialog"), cartBtn = $("#cartOpen");
  const entries = () => products.filter(p => cart[p.id] > 0).map(p => ({ p, q: cart[p.id] }));

  function renderCart() {
    const list = entries();
    const count = list.reduce((s, e) => s + e.q, 0);
    const sum = list.reduce((s, e) => s + e.p.price * e.q, 0);

    $("#cartCount").textContent = count;
    cartBtn.setAttribute("aria-label", `السلة (${count})`);
    $("#cartTotal").textContent = money(sum);

    $("#cartItems").innerHTML = list.length
      ? list.map(({ p, q }) => `
        <article class="c-item">
          <img src="${p.img}" alt="" width="72" height="72" loading="lazy">
          <div>
            <h3>${p.name}</h3>
            <small lang="fr" dir="ltr">${p.nameFr} · ${p.size}</small>
            <div class="c-item__row">
              <div class="qty">
                <button type="button" data-cart-dec="${p.id}" aria-label="نقص ${p.name}">−</button>
                <output>${q}</output>
                <button type="button" data-cart-inc="${p.id}" aria-label="زيد ${p.name}">+</button>
              </div>
              <span class="c-item__price">${money(p.price * q)}</span>
            </div>
            <button type="button" class="c-remove" data-cart-remove="${p.id}">حيد من السلة</button>
          </div>
        </article>`).join("")
      : `<div class="drawer__empty"><svg aria-hidden="true"><use href="#i-cart"/></svg><p>السلة ديالك خاوية.</p><p>اختار منتج وضغط على «زيد للسلة».</p></div>`;

    const checkout = $("#cartCheckout");
    checkout.classList.toggle("is-disabled", !list.length);
    checkout.setAttribute("aria-disabled", String(!list.length));
    $("#cartFields").hidden = !list.length;

    try { localStorage.setItem(CONFIG.cartKey, JSON.stringify(cart)); } catch { /* ignore */ }
    updateBar();
  }

  function addToCart(id, q = 1) {
    const p = byId[id];
    if (!p) return;
    cart[id] = Math.min(99, (cart[id] || 0) + q);
    renderCart();
    toast(`تزاد «${p.name}» للسلة ✓`);
    cartBtn.classList.remove("bump"); void cartBtn.offsetWidth; cartBtn.classList.add("bump");
  }

  cartBtn.addEventListener("click", () => { renderCart(); openDialog(cartDialog); });

  /* ================= PLACE ORDER (shared) =================
     1. save to Google Sheet  2. show confirmation  3. go to WhatsApp */
  const qoDialog = $("#orderDialog"), qoForm = $("#qoForm"), qoDone = $("#qoDone");
  let redirectTimer;

  async function placeOrder({ source, list, c, btn }) {
    const orderId = newOrderId();
    const sum = list.reduce((s, x) => s + x.p.price * x.q, 0);
    const lines = list.map(({ p, q }) => `• ${p.nameFr} (${p.name}) — ${p.size} × ${q} = ${money(p.price * q)}`);
    const msg = `${hello}\nطلب جديد رقم ${orderId}:\n${lines.join("\n")}\n\nالمجموع: ${money(sum)}${customerLines(c)}\n\nعفاكم أكدو ليا الطلب وثمن التوصيل.`;

    setLoading(btn, true);
    await sendOrder({
      type: "order", source, orderId,
      name: c.name, phone: c.phone, website: c.bot,
      city: c.address ? `${c.city} — ${c.address}` : c.city,
      items: list.map(({ p, q }) => ({ id: p.id, name: p.nameFr, size: p.size, qty: q, price: p.price })),
      total: sum,
    });
    setLoading(btn, false);
    saveCustomer(c);
    prefillCustomer();

    // confirmation screen
    $$("dialog[open]").forEach(d => d !== qoDialog && d.close());
    qoForm.hidden = true;
    qoDone.hidden = false;
    $("#qoDoneId").textContent = orderId;
    const url = wa(msg);
    $("#qoDoneWa").href = url;
    if (!qoDialog.open) openDialog(qoDialog);
    clearTimeout(redirectTimer);
    redirectTimer = setTimeout(() => { location.href = url; }, 1800);
    return orderId;
  }
  qoDialog.addEventListener("close", () => {
    clearTimeout(redirectTimer);
    qoForm.hidden = false;
    qoDone.hidden = true;
  });

  // Cart checkout
  const cartForm = $("#cartForm");
  cartForm.addEventListener("submit", async e => {
    e.preventDefault();
    const list = entries();
    if (!list.length) return;
    const c = readCustomer(cartForm, $("#cartError"));
    if (!c) return;
    await placeOrder({ source: "cart", list, c, btn: $("#cartCheckout") });
    cart = {};
    renderCart();
  });

  /* ================= QUICK ORDER ================= */
  const qo = { id: null, qty: 1 };
  const upsellFor = id => byId[id === CONFIG.upsell ? CONFIG.upsellAlt : CONFIG.upsell];

  function renderQuickOrder() {
    const p = byId[qo.id], up = upsellFor(qo.id);
    $("#qoQty").textContent = qo.qty;
    const withUp = up && $("#qoUpsellCheck").checked;
    $("#qoTotal").textContent = money(p.price * qo.qty + (withUp ? up.price : 0));
    $("#qoSubmit span").innerHTML = `أكد الطلب — <bdi dir="ltr">${money(p.price * qo.qty + (withUp ? up.price : 0))}</bdi>`;
  }
  function openQuickOrder(id, qty = 1) {
    const p = byId[id];
    if (!p) return;
    $$("dialog[open]").forEach(d => d.close());
    qo.id = id; qo.qty = qty;
    $("#qoImg").src = p.img;
    $("#qoImg").alt = p.name;
    $("#qoName").textContent = p.name;
    $("#qoSub").textContent = `${p.nameFr} · ${p.size}`;
    $("#qoUnit").textContent = money(p.price);
    const up = upsellFor(id);
    $("#qoUpsell").hidden = !up;
    $("#qoUpsellCheck").checked = false;
    if (up) {
      $("#qoUpImg").src = up.img;
      $("#qoUpName").textContent = up.name;
      $("#qoUpPrice").textContent = `+ ${money(up.price)} فقط`;
    }
    $("#qoError").textContent = "";
    prefillCustomer();
    renderQuickOrder();
    openDialog(qoDialog);
    // focus first empty field (keyboard users / desktop)
    if (matchMedia("(hover: hover)").matches) {
      const first = ["name", "phone", "city"].map(k => qoForm.elements[k]).find(i => !i.value);
      (first || $("#qoSubmit")).focus();
    }
  }
  $("#qoMinus").addEventListener("click", () => { qo.qty = Math.max(1, qo.qty - 1); renderQuickOrder(); });
  $("#qoPlus").addEventListener("click", () => { qo.qty = Math.min(10, qo.qty + 1); renderQuickOrder(); });
  $("#qoUpsellCheck").addEventListener("change", renderQuickOrder);
  qoForm.addEventListener("submit", async e => {
    e.preventDefault();
    const c = readCustomer(qoForm, $("#qoError"));
    if (!c) return;
    const list = [{ p: byId[qo.id], q: qo.qty }];
    const up = upsellFor(qo.id);
    if (up && $("#qoUpsellCheck").checked) list.push({ p: up, q: 1 });
    await placeOrder({ source: "quick", list, c, btn: $("#qoSubmit") });
  });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-order]");
    if (b) openQuickOrder(b.dataset.order);
  });

  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add-cart]");
    if (add) return addToCart(add.dataset.addCart);

    const inc = e.target.closest("[data-cart-inc]"), dec = e.target.closest("[data-cart-dec]"), rm = e.target.closest("[data-cart-remove]");
    if (!inc && !dec && !rm) return;
    const id = (inc || dec || rm).dataset[inc ? "cartInc" : dec ? "cartDec" : "cartRemove"];
    if (!cart[id]) return;
    if (rm) delete cart[id];
    else { cart[id] += inc ? 1 : -1; if (cart[id] <= 0) delete cart[id]; if (cart[id] > 99) cart[id] = 99; }
    renderCart();
    const again = inc ? `[data-cart-inc="${id}"]` : dec ? `[data-cart-dec="${id}"]` : null;
    (again && $(again, cartDialog) || $("[data-close]", cartDialog)).focus();
  });

  /* ================= PRODUCT DETAILS (store page) ================= */
  const pd = $("#productDialog");
  let pdId = null, pdQty = 1;
  if (pd) {
  function setPdQty(n) {
    pdQty = Math.max(1, Math.min(10, n));
    $("#pdQty").textContent = pdQty;
    const p = byId[pdId];
    $("#pdPrice").innerHTML = `${p.price * pdQty}<small>${CONFIG.currency}</small>`;
    $("#pdWa").href = wa(productMsg(p, pdQty));
  }
  function openProduct(id) {
    const p = byId[id];
    if (!p) return;
    pdId = id;
    const img = $("#pdImg");
    img.src = p.img;
    img.alt = $(".p-media img", p.card)?.alt || p.name;
    $("#pdCat").textContent = p.catLabel || "";
    $("#pdTitle").textContent = p.name;
    $("#pdSub").textContent = `${p.nameFr} · ${p.size}`;
    $("#pdText").innerHTML = $(".p-details", p.card)?.innerHTML || "";
    const pageLink = $("#pdPage");
    if (pageLink) pageLink.href = "produits/" + p.img.split("/").pop().replace(/\.\w+$/, "");
    setPdQty(1);
    openDialog(pd);
  }
  $("#pdMinus").addEventListener("click", () => setPdQty(pdQty - 1));
  $("#pdPlus").addEventListener("click", () => setPdQty(pdQty + 1));
  $("#pdAdd").addEventListener("click", () => { addToCart(pdId, pdQty); pd.close(); });
  $("#pdOrder").addEventListener("click", () => openQuickOrder(pdId, pdQty));
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open-detail]");
    if (t) openProduct(t.closest(".p-card").dataset.id);
  });
  // deep link: /#p-maca opens the product
  const fromHash = location.hash.match(/^#p-(.+)$/);
  if (fromHash && byId[fromHash[1]]) setTimeout(() => openProduct(fromHash[1]), 400);
  }

  /* ================= INLINE ORDER (product pages) ================= */
  const ppForm = $("#ppForm");
  if (ppForm) {
    const pid = ppForm.dataset.product, pp = { qty: 1 };
    const upP = upsellFor(pid);
    const upCheck = $("#ppUpsellCheck");
    if (!upP && $("#ppUpsell")) $("#ppUpsell").hidden = true;
    const render = () => {
      const p = byId[pid];
      const total = p.price * pp.qty + (upP && upCheck?.checked ? upP.price : 0);
      $("#ppQty").textContent = pp.qty;
      $("#ppTotal").textContent = money(total);
      $("#ppSubmit span").innerHTML = `أكد الطلب — <bdi dir="ltr">${money(total)}</bdi>`;
    };
    $("#ppMinus").addEventListener("click", () => { pp.qty = Math.max(1, pp.qty - 1); render(); });
    $("#ppPlus").addEventListener("click", () => { pp.qty = Math.min(10, pp.qty + 1); render(); });
    upCheck?.addEventListener("change", render);
    ppForm.addEventListener("submit", async e => {
      e.preventDefault();
      const c = readCustomer(ppForm, $("#ppError"));
      if (!c) return;
      const list = [{ p: byId[pid], q: pp.qty }];
      if (upP && upCheck?.checked) list.push({ p: upP, q: 1 });
      await placeOrder({ source: "page", list, c, btn: $("#ppSubmit") });
    });
    render();
  }
  // "scroll to the order form" buttons on product pages
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-goto-form]");
    if (!b || !ppForm) return;
    e.preventDefault();
    ppForm.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    setTimeout(() => (["name", "phone", "city"].map(k => ppForm.elements[k]).find(i => !i.value) || $("#ppSubmit")).focus({ preventScroll: true }), 450);
  });

  /* ================= CATEGORIES ================= */
  const groups = $$("[data-group]");
  const filterBtns = $$(".filter[data-filter], .cat-tile[data-filter]");
  const counts = { all: products.length };
  products.forEach(p => { counts[p.group] = (counts[p.group] || 0) + 1; });
  $$("[data-count]").forEach(el => { el.textContent = counts[el.dataset.count] || 0; });

  function applyFilter(cat, scroll) {
    groups.forEach(g => { g.hidden = cat !== "all" && g.dataset.group !== cat; });
    filterBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.filter === cat && (cat !== "all" || b.classList.contains("filter")))));
    $("#filterStatus").textContent = `كتشوف ${counts[cat]} منتج`;
    revealVisible();
    if (scroll) $("#catalog").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }
  filterBtns.forEach(b => b.addEventListener("click", () => {
    const cat = b.dataset.filter;
    const already = b.classList.contains("cat-tile") && b.getAttribute("aria-pressed") === "true";
    applyFilter(already ? "all" : cat, b.classList.contains("cat-tile"));
  }));
  if (groups.length) $$("[data-filter-link]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    applyFilter(a.dataset.filterLink, true);
  }));

  /* ================= ORDER FORM ================= */
  const form = $("#orderForm");
  if (form) {
    const sel = $("#fProduct"), qtySel = $("#fQty"), totalEl = $("#fTotal"), errEl = $("#formError");
    sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name} — ${p.price} درهم</option>`).join("");
    const updTotal = () => { totalEl.textContent = money(byId[sel.value].price * Number(qtySel.value)); };
    sel.addEventListener("change", updTotal);
    qtySel.addEventListener("change", updTotal);
    updTotal();
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const c = readCustomer(form, errEl);
      if (!c) return;
      await placeOrder({ source: "form", list: [{ p: byId[sel.value], q: Number(qtySel.value) }], c, btn: $("button[type=submit]", form) });
    });
  }

  /* ---------- log direct WhatsApp product clicks ---------- */
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-wa], #pdWa");
    if (!a) return;
    const p = a.id === "pdWa" ? byId[pdId] : byId[a.dataset.wa];
    if (p) logClick(p, a.id === "pdWa" ? "fiche produit" : a.closest(".p-card") ? "carte produit" : "autre");
  });

  /* ================= MOBILE BAR ================= */
  const bar = $("#mbar"), barBtn = $("#mbarBtn");
  function updateBar() {
    const list = entries();
    if (list.length) {
      const count = list.reduce((s, e) => s + e.q, 0);
      $("#mbarTitle").textContent = `السلة: ${count} منتج`;
      $("#mbarPrice").textContent = money(list.reduce((s, e) => s + e.p.price * e.q, 0));
      barBtn.textContent = "كمّل الطلب";
      barBtn.onclick = () => { renderCart(); openDialog(cartDialog); };
    } else {
      const p = byId[document.body.dataset.product] || byId[CONFIG.featured];
      $("#mbarTitle").innerHTML = `${p.name} · <bdi dir="ltr">${p.size}</bdi>`;
      $("#mbarPrice").textContent = money(p.price);
      barBtn.textContent = "اطلب دابا";
      barBtn.onclick = ppForm
        ? () => $("[data-goto-form]")?.click()
        : () => openQuickOrder(p.id);
    }
  }
  const barTrigger = $(".hero") || $(".pp-form-wrap");
  if (barTrigger) {
    // store: show once the hero is scrolled past · product page: show whenever the order form is off-screen
    new IntersectionObserver(([en]) => bar.classList.toggle("is-on", !en.isIntersecting)).observe(barTrigger);
  }

  /* ================= MENU ================= */
  const menuBtn = $("#menuBtn"), nav = $("#mainNav");
  function setMenu(open) {
    nav.classList.toggle("is-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "سد القائمة" : "فتح القائمة");
    $("use", menuBtn).setAttribute("href", open ? "#i-close" : "#i-menu");
  }
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  $$("a", nav).forEach(a => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });

  /* ================= REVEAL ================= */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver(es => es.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      }), { threshold: 0.1, rootMargin: "0px 0px -30px 0px" })
    : null;
  function revealVisible() {
    $$(".reveal:not(.is-in)").forEach(el => io ? io.observe(el) : el.classList.add("is-in"));
  }
  revealVisible();

  /* ---------- misc ---------- */
  $("#year").textContent = new Date().getFullYear();
  // pause other videos when one plays
  $$("video").forEach(v => v.addEventListener("play", () => $$("video").forEach(o => o !== v && o.pause())));

  // Coming back from WhatsApp with the Back button: start clean.
  addEventListener("pageshow", e => { if (e.persisted && qoDialog.open) qoDialog.close(); });

  prefillCustomer();
  renderCart();
})();

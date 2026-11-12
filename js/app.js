/* ALHAYBA Store — app logic
   Product data is read from the HTML cards (data-* attributes),
   so prices/names only need to be edited in index.html. */
(() => {
  "use strict";

  /* ================= CONFIG — edit here ================= */
  const CONFIG = {
    whatsapp: "212784960106",   // main number   07 84 96 01 06
    whatsapp2: "212700430167",  // second number 07 00 43 01 67
    currency: "DH",
    featured: "sexo",           // product shown in the mobile bottom bar
    cartKey: "alhayba-cart-v1",
  };
  /* ====================================================== */

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- products from DOM ---------- */
  const cards = $$(".p-card[data-id]");
  const products = cards.map(card => ({
    id: card.dataset.id,
    name: card.dataset.name,
    nameFr: card.dataset.nameFr,
    size: card.dataset.size,
    price: Number(card.dataset.price) || 0,
    img: card.dataset.img,
    catLabel: card.dataset.catLabel,
    group: card.closest("[data-group]")?.dataset.group,
    card,
  }));
  const byId = Object.fromEntries(products.map(p => [p.id, p]));
  const money = n => `${n} ${CONFIG.currency}`;

  /* ---------- WhatsApp ---------- */
  const wa = (text, number = CONFIG.whatsapp) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  const hello = "السلام عليكم ALHAYBA 👋";
  const productMsg = (p, q = 1) =>
    `${hello}\nبغيت نطلب:\n• ${p.nameFr} (${p.name}) — ${p.size}\n• الكمية: ${q}\n• الثمن: ${money(p.price * q)}\n\nعفاكم أكدو ليا ثمن التوصيل.`;
  const generalMsg = `${hello}\nبغيت نعرف أكثر على المنتجات ديالكم.`;

  $$("[data-wa]").forEach(a => {
    const key = a.dataset.wa, p = byId[key];
    a.href = p ? wa(productMsg(p)) : key === "general2" ? wa(generalMsg, CONFIG.whatsapp2) : wa(generalMsg);
  });

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
    if (list.length) {
      const lines = list.map(({ p, q }) => `• ${p.nameFr} (${p.name}) — ${p.size} × ${q} = ${money(p.price * q)}`);
      checkout.href = wa(`${hello}\nبغيت نطلب:\n${lines.join("\n")}\n\nمجموع المنتجات: ${money(sum)}\nعفاكم أكدو ليا ثمن التوصيل.`);
    } else checkout.removeAttribute("href");

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

  /* ================= PRODUCT DETAILS ================= */
  const pd = $("#productDialog");
  let pdId = null, pdQty = 1;
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
    setPdQty(1);
    openDialog(pd);
  }
  $("#pdMinus").addEventListener("click", () => setPdQty(pdQty - 1));
  $("#pdPlus").addEventListener("click", () => setPdQty(pdQty + 1));
  $("#pdAdd").addEventListener("click", () => { addToCart(pdId, pdQty); pd.close(); });
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-open-detail]");
    if (t) openProduct(t.closest(".p-card").dataset.id);
  });
  // deep link: /#p-maca opens the product
  const fromHash = location.hash.match(/^#p-(.+)$/);
  if (fromHash && byId[fromHash[1]]) setTimeout(() => openProduct(fromHash[1]), 400);

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
  $$("[data-filter-link]").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    applyFilter(a.dataset.filterLink, true);
  }));

  /* ================= ORDER FORM ================= */
  const form = $("#orderForm"), sel = $("#fProduct"), qtySel = $("#fQty"), totalEl = $("#fTotal"), errEl = $("#formError");
  sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name} — ${p.price} درهم</option>`).join("");
  const updTotal = () => { totalEl.textContent = money(byId[sel.value].price * Number(qtySel.value)); };
  sel.addEventListener("change", updTotal);
  qtySel.addEventListener("change", updTotal);
  updTotal();

  form.addEventListener("submit", e => {
    e.preventDefault();
    const f = form.elements;
    const name = f.name.value.trim(), city = f.city.value.trim(), phone = f.phone.value.trim();
    const phoneOk = /^(?:0[5-7]\d{8}|(?:\+|00)?212[5-7]\d{8})$/.test(phone.replace(/[\s().-]/g, ""));
    [f.name, f.city, f.phone].forEach(i => i.removeAttribute("aria-invalid"));
    const bad = !name ? f.name : !city ? f.city : !phoneOk ? f.phone : null;
    if (bad) {
      bad.setAttribute("aria-invalid", "true");
      errEl.textContent = bad === f.phone ? "رقم الهاتف ماشي صحيح (مثال: 0612345678)." : "عافاك عمر الاسم والمدينة.";
      bad.focus();
      return;
    }
    errEl.textContent = "";
    const p = byId[sel.value], q = Number(qtySel.value);
    const msg = `${hello}\nطلب جديد:\n• المنتج: ${p.nameFr} (${p.name}) — ${p.size}\n• الكمية: ${q}\n• الثمن: ${money(p.price * q)}\n\n👤 الاسم: ${name}\n📍 المدينة: ${city}\n📞 الهاتف: ${phone}`;
    window.open(wa(msg), "_blank", "noopener");
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
      const p = byId[CONFIG.featured];
      $("#mbarTitle").innerHTML = `${p.name} · <bdi dir="ltr">${p.size}</bdi>`;
      $("#mbarPrice").textContent = money(p.price);
      barBtn.textContent = "زيد للسلة";
      barBtn.onclick = () => addToCart(p.id);
    }
  }
  new IntersectionObserver(([en]) => bar.classList.toggle("is-on", !en.isIntersecting))
    .observe($(".hero"));

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

  renderCart();
})();

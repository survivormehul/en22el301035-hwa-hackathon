(function () {
  "use strict";
  var STORAGE_KEY = "hwa_cart";

  var DEFAULTS = {
    annualDiscountPercent: 0,
    yearlyMonths: 12,
    defaultShippingRate: 99,
    shippingZones: [
      { label: "Metro", prefixes: ["110", "400", "560", "600", "700"], rate: 49 },
      { label: "Remote", prefixes: ["18", "19", "78", "79"], rate: 149 }
    ],
    coupons: {
      FIRST10: { code: "FIRST10", type: "first_time", percent: 10, label: "10% off your first order" },
      FREESHIP: { code: "FREESHIP", type: "free_delivery", percent: 0, label: "Free delivery" }
    }
  };

  window.HWA_CONFIG = window.HWA_CONFIG || {};
  Object.keys(DEFAULTS).forEach(function (key) {
    if (window.HWA_CONFIG[key] === undefined || window.HWA_CONFIG[key] === null) {
      window.HWA_CONFIG[key] = DEFAULTS[key];
    }
  });
  window.HWA_CONFIG.yearlyMonths = Number(window.HWA_CONFIG.yearlyMonths) || 12;
  window.HWA_CONFIG.annualDiscountPercent = typeof window.HWA_CONFIG.annualDiscountPercent === "number" ? window.HWA_CONFIG.annualDiscountPercent : 0;

  var CATEGORY_LABELS = {
  "toys": "Toys",
  "enrichment-puzzles": "Enrichment Puzzles",
  "food-bags": "Food Bags",
  "small-treats": "Small Treats",
  "clothing-options": "Clothing Options",
  "accessories": "Accessories"
};
function categoryLabel(id) { return CATEGORY_LABELS[id] || id; }

  var PRODUCTS = {
    "happy-box": { id: "happy-box", name: "The Happy Box", price: 1999, image: "The%20Happy%20box.webp" },
    "food-club": { id: "food-club", name: "The Food Club", price: 1499, image: "the%20food%20club.webp" },
    "style-club": { id: "style-club", name: "The Style Club", price: 999, image: "The%20style%20club.webp" },
    "calm-box": { id: "calm-box", name: "The Calm Box", price: 1499, image: "the%20calm%20box.webp" },
    "build-your-own": { id: "build-your-own", name: "Build Your Happy Box", price: 3499, image: "The%20Happy%20box.webp" }
  };

  function discountPercent() {
    var d = window.HWA_CONFIG && window.HWA_CONFIG.annualDiscountPercent;
    return typeof d === "number" && d > 0 ? d : 0;
  }

  function yearlyUpfront(item) {
    var months = window.HWA_CONFIG.yearlyMonths || 12;
    var gross = item.price * months;
    return Math.round(gross * (1 - discountPercent() / 100));
  }

  function effectivePrice(item) {
    return item.freq === "yearly" ? yearlyUpfront(item) : item.price;
  }

  function shippingFor(pincode) {
    var pin = String(pincode || "").trim();
    if (!/^[0-9]{6}$/.test(pin)) { return { known: false, rate: 0, zone: null }; }
    var zones = window.HWA_CONFIG.shippingZones || [];
    for (var i = 0; i < zones.length; i++) {
      var zone = zones[i];
      var prefixes = zone.prefixes || [];
      for (var j = 0; j < prefixes.length; j++) {
        if (pin.indexOf(String(prefixes[j])) === 0) {
          return { known: true, rate: Number(zone.rate) || 0, zone: zone.label || "Zone" };
        }
      }
    }
    return { known: true, rate: Number(window.HWA_CONFIG.defaultShippingRate) || 0, zone: "Standard" };
  }

  function couponFor(code) {
    var key = String(code || "").trim().toUpperCase();
    var coupons = window.HWA_CONFIG.coupons || {};
    return coupons[key] || null;
  }

  function computeTotals(items) {
    var subtotal = 0;
    var count = 0;
    var monthlyCount = 0;
    var yearlyCount = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      subtotal += effectivePrice(it) * it.qty;
      count += it.qty;
      if (it.freq === "yearly") { yearlyCount += it.qty; } else { monthlyCount += it.qty; }
    }
    return { subtotal: subtotal, shipping: null, total: subtotal, count: count, monthlyCount: monthlyCount, yearlyCount: yearlyCount };
  }

  function Cart() { this.items = []; }
  Cart.prototype.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) { this.items = []; return; }
    try { this.items = JSON.parse(raw) || []; } catch (e) { this.items = []; }
  };
  Cart.prototype.save = function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); } catch (e) {}
  };
  Cart.prototype.add = function (productId, opts) {
    opts = opts || {};
    var p = PRODUCTS[productId];
    if (!p) { return null; }
    var existing = null;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i];
      var sameProduct = it.productId === productId;
      var sameConfig = JSON.stringify(it.config || {}) === JSON.stringify(opts.config || {});
      var sameFreq = (it.freq || "monthly") === (opts.freq || "monthly");
      if (sameProduct && sameConfig && sameFreq) { existing = it; break; }
    }
    if (existing) {
      existing.qty = (existing.qty || 1) + (opts.qty || 1);
    } else {
      this.items.push({
        productId: productId,
        name: p.name,
        price: p.price,
        image: p.image,
        qty: opts.qty || 1,
        freq: opts.freq || "monthly",
        dogId: opts.dogId || null,
        config: opts.config || null
      });
    }
    this.save();
    return this.items.length;
  };
  Cart.prototype.remove = function (index) { this.items.splice(index, 1); this.save(); renderCart(); };
  Cart.prototype.setQty = function (index, qty) { if (qty < 1) { this.remove(index); return; } this.items[index].qty = qty; this.save(); renderCart(); };
  Cart.prototype.setFreq = function (index, freq) { if (freq !== "monthly" && freq !== "yearly") { return; } this.items[index].freq = freq; this.save(); renderCart(); };
  Cart.prototype.setDog = function (index, dogId) { this.items[index].dogId = dogId; this.save(); renderCart(); };
  Cart.prototype.clear = function () { this.items = []; this.save(); renderCart(); };

  var cart = new Cart();
  cart.load();

  function getCart() { return cart; }
  function updateQty(index, qty) { cart.setQty(index, qty); }
  function removeItem(index) { cart.remove(index); }

  function itemLabel(item) {
    if (item.productId === "build-your-own" && item.config && item.config.categories) {
      return item.name + " <span>[" + item.config.categories.map(categoryLabel).join(", ") + "]</span>";
    }
    return item.name;
  }

  function fmt(n) { return "\u20B9" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }

  var drawerBuilt = false;
  var drawerOpen = false;

  function renderCart() {
    if (!drawerBuilt) { return; }
    var itemsEl = document.getElementById("hwaCartItems");
    var summaryEl = document.getElementById("hwaCartSummary");
    if (!itemsEl || !summaryEl) { return; }
    itemsEl.innerHTML = "";
    if (cart.items.length === 0) {
      itemsEl.innerHTML =
        '<div class="hwa-cart-empty">' +
          '<span class="cart-empty-art" aria-hidden="true">' +
            '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M32 51c-8 0-15-5.5-15-13 0-6.6 5.6-11 11-11 2.4 0 4.6.7 6.3 2 1.7-1.3 3.9-2 6.3-2 5.4 0 11 4.4 11 11 0 7.5-7 13-15 13z"/><circle cx="20" cy="17" r="4"/><circle cx="32" cy="11" r="4"/><circle cx="44" cy="17" r="4"/></svg>' +
          '</span>' +
          '<p>Your cart is feeling a little empty.</p>' +
          '<a class="btn btn-primary btn-sm" href="products.html">Browse the boxes</a>' +
        '</div>';
    } else {
      for (var i = 0; i < cart.items.length; i++) {
        var it = cart.items[i];
        var ep = effectivePrice(it);
        var priceLine = it.freq === "yearly"
          ? fmt(ep) + '<span class="hwa-cart-period"> / 12 months upfront</span>'
          : fmt(ep) + '<span class="hwa-cart-period"> / month</span>';
        var row = document.createElement("div");
        row.className = "hwa-cart-item";
        row.innerHTML =
          '<div class="hwa-cart-item-img"><img src="' + it.image + '" alt="" loading="lazy"></div>' +
          '<div class="hwa-cart-item-info">' +
            '<div class="hwa-cart-item-name">' + itemLabel(it) + '</div>' +
            '<div class="hwa-cart-item-controls">' +
              '<div class="hwa-qty-stepper hwa-qty-stepper-sm">' +
                '<button class="hwa-qty-btn" type="button" data-action="qty-down" data-index="' + i + '" aria-label="Decrease quantity">-</button>' +
                '<span class="hwa-qty-val" data-index="' + i + '" aria-live="polite">' + it.qty + '</span>' +
                '<button class="hwa-qty-btn" type="button" data-action="qty-up" data-index="' + i + '" aria-label="Increase quantity">+</button>' +
              '</div>' +
              '<button class="hwa-remove-btn" type="button" data-action="remove" data-index="' + i + '">Remove</button>' +
            '</div>' +
            '<label class="hwa-freq-label">Billing' +
              '<select class="hwa-freq-select" data-action="freq" data-index="' + i + '">' +
                '<option value="monthly"' + (it.freq === "monthly" ? " selected" : "") + '>Monthly</option>' +
                '<option value="yearly"' + (it.freq === "yearly" ? " selected" : "") + '>Yearly - 12 months upfront</option>' +
              '</select>' +
            '</label>' +
          '</div>' +
          '<div class="hwa-cart-item-price">' + priceLine + (it.qty > 1 ? '<span class="hwa-cart-qty-note">x ' + it.qty + '</span>' : '') + '</div>';
        itemsEl.appendChild(row);
      }
    }

    var t = computeTotals(cart.items);
    var yearlyTotal = window.HWA_CONFIG.yearlyMonths || 12;
    var notes = [];
    if (t.yearlyCount > 0) { notes.push("Yearly boxes are billed for " + yearlyTotal + " months upfront and delivered monthly."); }
    if (t.monthlyCount > 1) { notes.push(t.monthlyCount + " monthly boxes renew independently."); }
    summaryEl.innerHTML =
      '<div class="hwa-cart-row"><span>Subtotal</span><span>' + fmt(t.subtotal) + '</span></div>' +
      '<div class="hwa-cart-row"><span>Shipping</span><span class="hwa-muted-strong">Calculated at checkout</span></div>' +
      '<div class="hwa-cart-row hwa-cart-total"><span>Estimated total</span><span>' + fmt(t.subtotal) + '</span></div>' +
      notes.map(function (note) { return '<p class="hwa-cart-note">' + note + '</p>'; }).join("");

    var badge = document.getElementById("hwaCartBadge");
    if (badge) { badge.textContent = String(t.count); }
    var checkoutBtn = document.getElementById("hwaCartCheckoutBtn");
    if (checkoutBtn) { checkoutBtn.disabled = cart.items.length === 0; }
    document.dispatchEvent(new CustomEvent("hwa:cart-updated", { detail: { count: t.count } }));
  }

  function ensureDrawer() {
    if (drawerBuilt) { return; }
    var overlay = document.createElement("div");
    overlay.id = "hwaCartOverlay";
    overlay.className = "hwa-cart-overlay";
    overlay.addEventListener("click", closeCart);
    var drawer = document.createElement("aside");
    drawer.id = "hwaCartDrawer";
    drawer.className = "hwa-cart-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-modal", "true");
    drawer.setAttribute("aria-label", "Shopping cart");
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML =
      '<div class="hwa-cart-header">' +
        '<div><span class="eyebrow">Your happy stack</span><h2>Shopping cart</h2></div>' +
        '<button id="hwaCartCloseBtn" class="hwa-cart-close" type="button" aria-label="Close cart">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="hwa-cart-items" id="hwaCartItems" aria-live="polite"></div>' +
      '<div class="hwa-cart-footer">' +
        '<div class="hwa-cart-summary" id="hwaCartSummary"></div>' +
        '<div class="hwa-cart-actions">' +
          '<button id="hwaCartContinueBtn" class="btn btn-outline" type="button">Keep browsing</button>' +
          '<button id="hwaCartCheckoutBtn" class="btn btn-primary" type="button">Checkout</button>' +
        '</div>' +
        '<p class="hwa-cart-demo-note">Demo store: shipping, coupons and the final total are confirmed at checkout. No real payment is taken.</p>' +
      '</div>';
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    drawerBuilt = true;

    document.getElementById("hwaCartCloseBtn").addEventListener("click", closeCart);
    document.getElementById("hwaCartContinueBtn").addEventListener("click", closeCart);
    document.getElementById("hwaCartCheckoutBtn").addEventListener("click", function () {
      if (!cart.items.length) { return; }
      closeCart();
      window.location.href = "checkout.html";
    });
    drawer.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action]");
      if (!btn || btn.tagName === "SELECT") { return; }
      var idx = parseInt(btn.getAttribute("data-index"), 10);
      if (isNaN(idx)) { return; }
      if (btn.getAttribute("data-action") === "qty-up") { updateQty(idx, (cart.items[idx].qty || 1) + 1); }
      else if (btn.getAttribute("data-action") === "qty-down") { updateQty(idx, (cart.items[idx].qty || 1) - 1); }
      else if (btn.getAttribute("data-action") === "remove") { removeItem(idx); }
    });
    drawer.addEventListener("change", function (e) {
      var sel = e.target.closest("[data-action='freq']");
      if (!sel) { return; }
      cart.setFreq(parseInt(sel.getAttribute("data-index"), 10), sel.value);
    });
    renderCart();
  }

  function bumpBadge() {
    var badge = document.getElementById("hwaCartBadge");
    if (!badge) { return; }
    badge.classList.remove("is-bumped");
    void badge.offsetWidth;
    badge.classList.add("is-bumped");
  }

  function openCart() {
    ensureDrawer();
    drawerOpen = true;
    var o = document.getElementById("hwaCartOverlay");
    var d = document.getElementById("hwaCartDrawer");
    if (o) { o.classList.add("open"); }
    if (d) { d.classList.add("open"); d.setAttribute("aria-hidden", "false"); }
    document.body.classList.add("cart-open");
    var closeBtn = document.getElementById("hwaCartCloseBtn");
    if (closeBtn) { closeBtn.focus(); }
  }
  function closeCart() {
    drawerOpen = false;
    var o = document.getElementById("hwaCartOverlay");
    var d = document.getElementById("hwaCartDrawer");
    if (o) { o.classList.remove("open"); }
    if (d) { d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); }
    document.body.classList.remove("cart-open");
  }

  function addToCart(productId, opts) {
    var n = cart.add(productId, opts || {});
    if (n) { renderCart(); bumpBadge(); openCart(); }
    return n;
  }

  window.HWA = window.HWA || {};
  window.HWA.Cart = {
    get: getCart,
    add: addToCart,
    updateQty: updateQty,
    removeItem: removeItem,
    setFreq: function (i, f) { cart.setFreq(i, f); },
    setDog: function (i, d) { cart.setDog(i, d); },
    clear: function () { cart.clear(); },
    totals: computeTotals,
    amountFor: effectivePrice,
    products: PRODUCTS
  };
  window.HWA.shippingFor = shippingFor;
  window.HWA.categoryLabel = categoryLabel;
  window.HWA.categoryLabels = CATEGORY_LABELS;
  window.HWA.couponFor = couponFor;
  window.HWA.coupons = window.HWA_CONFIG.coupons;
  window.HWA.addToCart = addToCart;
  window.HWA.openCart = openCart;
  window.HWA.closeCart = closeCart;

  document.addEventListener("DOMContentLoaded", function () {
    ensureDrawer();
    var openBtn = document.getElementById("cartOpenBtn");
    if (openBtn) { openBtn.addEventListener("click", openCart); }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawerOpen) { closeCart(); }
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#hwaCartDrawer")) { return; }
      var addBtn = e.target.closest("[data-action='add']");
      if (addBtn) {
        var addPid = addBtn.getAttribute("data-product");
        var cardQty = addPid ? document.querySelector(".hwa-qty-val[data-product='" + addPid + "']") : null;
        var q = cardQty ? parseInt(cardQty.textContent, 10) : parseInt(addBtn.getAttribute("data-qty") || "1", 10);
        if (isNaN(q) || q < 1) { q = 1; }
        addToCart(addPid, { qty: q });
        if (cardQty) { cardQty.textContent = "1"; }
        return;
      }
      var stepper = e.target.closest("[data-action='qty-up'], [data-action='qty-down']");
      if (stepper) {
        var stepPid = stepper.getAttribute("data-product");
        var qtyEl = stepPid ? document.querySelector(".hwa-qty-val[data-product='" + stepPid + "']") : null;
        if (qtyEl) {
          var v = parseInt(qtyEl.textContent, 10);
          if (isNaN(v) || v < 1) { v = 1; }
          v += stepper.getAttribute("data-action") === "qty-up" ? 1 : -1;
          if (v < 1) { v = 1; }
          qtyEl.textContent = String(v);
        }
      }
    });
  });
})();
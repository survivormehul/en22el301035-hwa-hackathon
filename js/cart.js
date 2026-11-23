(function () {
  "use strict";
  var STORAGE_KEY = "hwa_cart";
  var FREE_SHIPPING_THRESHOLD = 2999;
  var SHIPPING_FEE = 99;
  var YEARLY_MONTHS = 12;

  if (!window.HWA_CONFIG) { window.HWA_CONFIG = { annualDiscountPercent: 0 }; }
  if (typeof window.HWA_CONFIG.annualDiscountPercent !== "number") { window.HWA_CONFIG.annualDiscountPercent = 0; }

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
    var gross = item.price * YEARLY_MONTHS;
    var net = gross * (1 - discountPercent() / 100);
    return Math.round(net);
  }

  function effectivePrice(item) {
    return item.freq === "yearly" ? yearlyUpfront(item) : item.price;
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
    var shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, count: count, monthlyCount: monthlyCount, yearlyCount: yearlyCount };
  }

  function Cart() { this.items = []; }
  Cart.prototype.load = function () {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { return; }
    if (!raw) { this.items = []; return; }
    try { this.items = JSON.parse(raw) || []; } catch (e) { this.items = []; }
  };
  Cart.prototype.save = function () { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items)); } catch (e) {} };
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
    if (existing) { existing.qty = (existing.qty || 1) + (opts.qty || 1); }
    else { this.items.push({ productId: productId, name: p.name, price: p.price, image: p.image, qty: opts.qty || 1, freq: opts.freq || "monthly", dogId: opts.dogId || null, config: opts.config || null }); }
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
    if (item.productId === "build-your-own" && item.config && item.config.categories) { return item.name + " [BYO: " + item.config.categories.join(", ") + "]"; }
    return item.name;
  }

  function fmt(n) { return "\u20B9" + n.toLocaleString("en-IN"); }

  function renderCart() {
    var drawer = document.getElementById("hwaCartDrawer");
    if (!drawer) { return; }
    var itemsEl = document.getElementById("hwaCartItems");
    var summaryEl = document.getElementById("hwaCartSummary");
    if (!itemsEl || !summaryEl) { return; }
    itemsEl.innerHTML = "";
    if (cart.items.length === 0) { itemsEl.innerHTML = '<div class="hwa-cart-empty">Your cart is empty. Add a happy box!</div>'; }
    for (var i = 0; i < cart.items.length; i++) {
      var it = cart.items[i];
      var ep = effectivePrice(it);
      var priceLine = it.freq === "yearly" ? fmt(ep) + " / 12 months upfront" : fmt(ep) + " / month";
      var row = document.createElement("div");
      row.className = "hwa-cart-item";
      row.innerHTML =
        '<div class="hwa-cart-item-img"><img src="' + it.image + '" alt="' + it.name + '"></div>' +
        '<div class="hwa-cart-item-info">' +
          '<div class="hwa-cart-item-name">' + itemLabel(it) + '</div>' +
          '<div class="hwa-cart-item-controls">' +
            '<button class="hwa-qty-btn" data-action="qty-down" data-index="' + i + '">-</button>' +
            '<span class="hwa-qty-val" data-index="' + i + '">' + it.qty + '</span>' +
            '<button class="hwa-qty-btn" data-action="qty-up" data-index="' + i + '">+</button>' +
            '<button class="hwa-remove-btn" data-action="remove" data-index="' + i + '">Remove</button>' +
          '</div>' +
          '<select class="hwa-freq-select" data-action="freq" data-index="' + i + '">' +
            '<option value="monthly"' + (it.freq === "monthly" ? " selected" : "") + '>Monthly</option>' +
            '<option value="yearly"' + (it.freq === "yearly" ? " selected" : "") + '>Yearly (12 months upfront)</option>' +
          '</select>' +
        '</div>' +
        '<div class="hwa-cart-item-price">' + priceLine + (it.qty > 1 ? '<br>x ' + it.qty : '') + '</div>';
      itemsEl.appendChild(row);
    }
    var t = computeTotals(cart.items);
    summaryEl.innerHTML =
      '<div class="hwa-cart-row"><span>Subtotal</span><span>' + fmt(t.subtotal) + '</span></div>' +
      '<div class="hwa-cart-row"><span>Shipping</span><span>' + (t.shipping === 0 ? "FREE" : fmt(t.shipping)) + '</span></div>' +
      '<div class="hwa-cart-row hwa-cart-total"><span>Initial Payable</span><span>' + fmt(t.total) + '</span></div>' +
      (t.yearlyCount > 0 ? '<div class="hwa-cart-note">Yearly items are charged for 12 months upfront and delivered monthly.</div>' : '') +
      (t.monthlyCount > 1 ? '<div class="hwa-cart-note">' + t.monthlyCount + ' monthly subscriptions renew independently.</div>' : '');
    var badge = document.getElementById("hwaCartBadge");
    if (badge) { badge.textContent = String(t.count); }
  }

  function ensureDrawer() {
    if (document.getElementById("hwaCartDrawer")) { return; }
    var overlay = document.createElement("div");
    overlay.id = "hwaCartOverlay";
    overlay.className = "hwa-cart-overlay";
    overlay.addEventListener("click", closeCart);
    var drawer = document.createElement("aside");
    drawer.id = "hwaCartDrawer";
    drawer.className = "hwa-cart-drawer";
    drawer.innerHTML =
      '<div class="hwa-cart-header"><h2>Your Cart</h2><button id="hwaCartCloseBtn" class="hwa-cart-close" aria-label="Close cart">&times;</button></div>' +
      '<div class="hwa-cart-items" id="hwaCartItems"></div>' +
      '<div class="hwa-cart-summary" id="hwaCartSummary"></div>' +
      '<div class="hwa-cart-actions">' +
        '<button id="hwaCartContinueBtn" class="btn btn-outline">Continue Shopping</button>' +
        '<button id="hwaCartCheckoutBtn" class="btn btn-primary">Proceed to Checkout</button>' +
      '</div>';
    overlay.appendChild(drawer);
    document.body.appendChild(overlay);
    document.getElementById("hwaCartCloseBtn").addEventListener("click", closeCart);
    document.getElementById("hwaCartContinueBtn").addEventListener("click", closeCart);
    document.getElementById("hwaCartCheckoutBtn").addEventListener("click", function () { closeCart(); window.location.href = "checkout.html"; });
    document.getElementById("hwaCartDrawer").addEventListener("click", function (e) {
      e.stopPropagation();
      var btn = e.target.closest("[data-action]");
      if (!btn || btn.tagName === "SELECT") { return; }
      var idx = parseInt(btn.getAttribute("data-index"), 10);
      if (btn.getAttribute("data-action") === "qty-up") { updateQty(idx, (cart.items[idx].qty || 1) + 1); }
      else if (btn.getAttribute("data-action") === "qty-down") { updateQty(idx, (cart.items[idx].qty || 1) - 1); }
      else if (btn.getAttribute("data-action") === "remove") { removeItem(idx); }
    });
    document.getElementById("hwaCartDrawer").addEventListener("change", function (e) {
      var sel = e.target.closest("[data-action='freq']");
      if (!sel) { return; }
      cart.setFreq(parseInt(sel.getAttribute("data-index"), 10), sel.value);
    });
    renderCart();
  }

  function openCart() { ensureDrawer(); var o = document.getElementById("hwaCartOverlay"); var d = document.getElementById("hwaCartDrawer"); if (o) { o.classList.add("open"); } if (d) { d.classList.add("open"); } }
  function closeCart() { var o = document.getElementById("hwaCartOverlay"); var d = document.getElementById("hwaCartDrawer"); if (o) { o.classList.remove("open"); } if (d) { d.classList.remove("open"); } }

  function addToCart(productId, opts) { var n = cart.add(productId, opts || {}); if (n) { renderCart(); openCart(); } return n; }

  window.HWA = window.HWA || {};
  window.HWA.Cart = { get: getCart, add: addToCart, updateQty: updateQty, removeItem: removeItem, setFreq: function (i, f) { cart.setFreq(i, f); }, setDog: function (i, d) { cart.setDog(i, d); }, clear: function () { cart.clear(); }, totals: computeTotals, products: PRODUCTS };
  window.HWA.addToCart = addToCart;
  window.HWA.openCart = openCart;
  window.HWA.closeCart = closeCart;

  document.addEventListener("DOMContentLoaded", function () {
    ensureDrawer();
    var openBtn = document.getElementById("cartOpenBtn");
    if (openBtn) { openBtn.addEventListener("click", openCart); }
    var closeBtn = document.getElementById("hwaCartCloseBtn");
    if (closeBtn) { closeBtn.addEventListener("click", closeCart); }
    var contBtn = document.getElementById("hwaCartContinueBtn");
    if (contBtn) { contBtn.addEventListener("click", closeCart); }
    var chkBtn = document.getElementById("hwaCartCheckoutBtn");
    if (chkBtn) { chkBtn.addEventListener("click", function () { closeCart(); window.location.href = "checkout.html"; }); }

    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("#hwaCartDrawer")) { return; }
      var addBtn = e.target.closest("[data-action='add']");
      if (addBtn) {
        var card = addBtn.closest("[data-product]");
        var cardQty = card ? card.querySelector(".hwa-qty-val") : null;
        var q = cardQty ? parseInt(cardQty.textContent, 10) : parseInt(addBtn.getAttribute("data-qty") || "1", 10);
        if (isNaN(q) || q < 1) { q = 1; }
        addToCart(addBtn.getAttribute("data-product"), { qty: q });
        if (cardQty) { cardQty.textContent = "1"; }
        return;
      }
      var stepper = e.target.closest("[data-action='qty-up'], [data-action='qty-down']");
      if (stepper) {
        var card2 = stepper.closest("[data-product]");
        var qtyEl = card2 ? card2.querySelector(".hwa-qty-val") : null;
        if (qtyEl) {
          var v = parseInt(qtyEl.textContent, 10);
          if (isNaN(v) || v < 1) { v = 1; }
          v += stepper.getAttribute("data-action") === "qty-up" ? 1 : -1;
          if (v < 1) { v = 1; }
          qtyEl.textContent = String(v);
        }
        return;
      }
    });
  });
})();
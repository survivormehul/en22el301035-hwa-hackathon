(function () {
  "use strict";
  var STORAGE_KEY = "hwa_cart";
  var FREE_SHIPPING_THRESHOLD = 2999;
  var SHIPPING_FEE = 99;
  var YEARLY_MULTIPLIER = 10;
  var FREQUENCY = { monthly: "Monthly", yearly: "Yearly" };

  var PRODUCTS = {
    "happy-box": { id: "happy-box", name: "The Happy Box", price: 1999, image: "The%20Happy%20box.webp", tagline: "Fun that keeps wagging." },
    "food-club": { id: "food-club", name: "The Food Club", price: 1499, image: "the%20food%20club.webp", tagline: "Chef-crafted happiness." },
    "style-club": { id: "style-club", name: "The Style Club", price: 999, image: "The%20style%20club.webp", tagline: "Cozy comfort wear." },
    "calm-box": { id: "calm-box", name: "The Calm Box", price: 1499, image: "the%20calm%20box.webp", tagline: "Serenity in a box." },
    "build-your-own": { id: "build-your-own", name: "Build Your Happy Box", price: 3499, image: "The%20Happy%20box.webp", tagline: "Curate your own happiness." }
  };

  function effectivePrice(item) {
    return item.freq === "yearly" ? (item.price * YEARLY_MULTIPLIER) : item.price;
  }

  function computeTotals(items) {
    var subtotal = 0;
    var count = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var ep = effectivePrice(it);
      subtotal += ep * it.qty;
      count += it.qty;
    }
    var shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    var total = subtotal + shipping;
    return { subtotal: subtotal, shipping: shipping, total: total, count: count };
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
      var same = it.productId === productId && JSON.stringify(it.config || {}) === JSON.stringify(opts.config || {});
      if (same) { existing = it; break; }
    }
    if (existing) { existing.qty = (existing.qty || 1) + (opts.qty || 1); }
    else { this.items.push({ productId: productId, name: p.name, price: p.price, image: p.image, qty: opts.qty || 1, freq: opts.freq || "monthly", config: opts.config || null }); }
    this.save();
    return this.items.length;
  };
  Cart.prototype.remove = function (index) { this.items.splice(index, 1); this.save(); renderCart(); };
  Cart.prototype.setQty = function (index, qty) { if (qty < 1) { this.remove(index); return; } this.items[index].qty = qty; this.save(); renderCart(); };
  Cart.prototype.clear = function () { this.items = []; this.save(); renderCart(); };

  var cart = new Cart();
  cart.load();

  function getCart() { return cart; }
  function addToCart(productId, opts) { var n = cart.add(productId, opts || {}); if (n) { renderCart(); openCart(); } return n; }
  function updateQty(index, qty) { cart.setQty(index, qty); }
  function removeItem(index) { cart.remove(index); }

  function itemLabel(item) {
    if (item.productId === "build-your-own" && item.config && item.config.categories) { return item.name + " [BYO: " + item.config.categories.join(", ") + "]"; }
    return item.name;
  }

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
      var row = document.createElement("div");
      row.className = "hwa-cart-item";
      row.innerHTML =
        '<div class="hwa-cart-item-img"><img src="' + it.image + '" alt="' + it.name + '"></div>' +
        '<div class="hwa-cart-item-info">' +
          '<div class="hwa-cart-item-name">' + itemLabel(it) + '</div>' +
          '<div class="hwa-cart-item-meta">' + (FREQUENCY[it.freq] || "Monthly") + ' &middot; ' + (it.config && it.config.categories ? "BYO" : "") + '</div>' +
          '<div class="hwa-cart-item-controls">' +
            '<button class="hwa-qty-btn" data-action="qty-down" data-index="' + i + '">-</button>' +
            '<span class="hwa-qty-val" data-index="' + i + '">' + it.qty + '</span>' +
            '<button class="hwa-qty-btn" data-action="qty-up" data-index="' + i + '">+</button>' +
            '<button class="hwa-remove-btn" data-action="remove" data-index="' + i + '">Remove</button>' +
          '</div>' +
        '</div>' +
        '<div class="hwa-cart-item-price">' + "\u20B9" + ep.toLocaleString("en-IN") + " x " + it.qty + "</div>";
      itemsEl.appendChild(row);
    }
    var t = computeTotals(cart.items);
    summaryEl.innerHTML =
      '<div class="hwa-cart-row"><span>Subtotal</span><span>\u20B9' + t.subtotal.toLocaleString("en-IN") + "</span></div>" +
      '<div class="hwa-cart-row"><span>Shipping</span><span>' + (t.shipping === 0 ? "FREE" : "\u20B9" + t.shipping) + "</span></div>" +
      '<div class="hwa-cart-row hwa-cart-total"><span>Total</span><span>\u20B9' + t.total.toLocaleString("en-IN") + "</span></div>";
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
    document.getElementById("hwaCartDrawer").addEventListener("click", function (e) { e.stopPropagation(); var btn = e.target.closest("[data-action]"); if (!btn) { return; } var idx = parseInt(btn.getAttribute("data-index"), 10); if (btn.getAttribute("data-action") === "qty-up") { updateQty(idx, (cart.items[idx].qty || 1) + 1); } else if (btn.getAttribute("data-action") === "qty-down") { updateQty(idx, (cart.items[idx].qty || 1) - 1); } else if (btn.getAttribute("data-action") === "remove") { removeItem(idx); } });
    renderCart();
  }

  function openCart() { ensureDrawer(); var o = document.getElementById("hwaCartOverlay"); var d = document.getElementById("hwaCartDrawer"); if (o) { o.classList.add("open"); } if (d) { d.classList.add("open"); } }
  function closeCart() { var o = document.getElementById("hwaCartOverlay"); var d = document.getElementById("hwaCartDrawer"); if (o) { o.classList.remove("open"); } if (d) { d.classList.remove("open"); } }

  function addToCart(productId, opts) { var n = cart.add(productId, opts || {}); if (n) { renderCart(); openCart(); } return n; }

  window.HWA = window.HWA || {};
  window.HWA.Cart = { get: getCart, add: addToCart, updateQty: updateQty, removeItem: removeItem, clear: function () { cart.clear(); }, totals: computeTotals, products: PRODUCTS };
  window.HWA.addToCart = addToCart;
  window.HWA.openCart = openCart;
  window.HWA.closeCart = closeCart;

  document.addEventListener("DOMContentLoaded", function () {
    ensureDrawer();
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
        var pid = addBtn.getAttribute("data-product");
        var qtyEl = addBtn.closest("[data-product]") ? addBtn.closest("[data-product]").querySelector(".hwa-qty-val") : null;
        var q = qtyEl ? parseInt(qtyEl.getAttribute("data-product") || qtyEl.textContent, 10) : parseInt(addBtn.getAttribute("data-qty") || "1", 10);
        if (isNaN(q) || q < 1) { q = 1; }
        addToCart(pid, { qty: q });
        return;
      }
      var qtyUp = e.target.closest("[data-action='qty-up']");
      var qtyDown = e.target.closest("[data-action='qty-down']");
      if (qtyUp) {
        var pid2 = qtyUp.getAttribute("data-product");
        var qtyEl2 = qtyUp.closest("[data-product]") ? qtyUp.closest("[data-product]").querySelector(".hwa-qty-val") : null;
        var cur2 = qtyEl2 ? parseInt(qtyEl2.getAttribute("data-product") || qtyEl2.textContent, 10) : 1;
        var found2 = false;
        for (var i2 = 0; i2 < cart.items.length; i2++) { if (cart.items[i2].productId === pid2) { cart.setQty(i2, (cart.items[i2].qty || 1) + 1); found2 = true; break; } }
        if (!found2) { addToCart(pid2, { qty: (cur2 || 1) + 1 }); }
        return;
      }
      if (qtyDown) {
        var pid3 = qtyDown.getAttribute("data-product");
        var qtyEl3 = qtyDown.closest("[data-product]") ? qtyDown.closest("[data-product]").querySelector(".hwa-qty-val") : null;
        var cur3 = qtyEl3 ? parseInt(qtyEl3.getAttribute("data-product") || qtyEl3.textContent, 10) : 1;
        var found3 = false;
        for (var j = 0; j < cart.items.length; j++) { if (cart.items[j].productId === pid3) { cart.setQty(j, (cart.items[j].qty || 1) - 1); found3 = true; break; } }
        if (!found3 && (cur3 || 1) > 1) { addToCart(pid3, { qty: (cur3 || 1) - 1 }); }
        return;
      }
    });
  });
})();
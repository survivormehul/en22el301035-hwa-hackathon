const STORAGE_KEY = 'hwa_cart';

let cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

function saveCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.qty += 1;
  else cart.push({ ...product, qty: 1 });
  saveCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else saveCart();
  if (document.getElementById('cart-items')) renderCart();
}

function cartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function cartCount() {
  return cart.reduce((sum, item) => sum + item.qty, 0);
}

function updateCartBadge() {
  const el = document.getElementById('cart-count');
  if (el) el.textContent = cartCount();
}

function formatPrice(n) { return '₹' + n.toFixed(2); }

function productCard(p, showAdd = true) {
  return `
    <article class="product-card">
      <div class="product-image" style="background:${p.color}">${p.emoji}</div>
      <div class="product-info">
        <h3 class="product-title">${p.name}</h3>
        <p class="product-desc">${p.desc}</p>
        <div class="product-price">${formatPrice(p.price)}</div>
        ${showAdd ? `<button class="btn btn-primary add-to-cart" data-id="${p.id}">Add to Cart</button>` : ''}
      </div>
    </article>
  `;
}

function initShop(products) {
  const grid = document.getElementById('product-grid');
  if (!grid) return;
  grid.innerHTML = products.map(p => productCard(p)).join('');
  grid.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const p = products.find(x => x.id === id);
      addToCart(p);
      btn.textContent = 'Added ✓';
      setTimeout(() => btn.textContent = 'Add to Cart', 1200);
    });
  });
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const empty = document.getElementById('cart-empty');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;
  if (cart.length === 0) {
    container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (totalEl) totalEl.textContent = formatPrice(0);
    return;
  }
  if (empty) empty.style.display = 'none';
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-thumb" style="background:${item.color}">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-title">${item.name}</div>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="qty-btn" data-id="${item.id}" data-delta="-1">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" data-id="${item.id}" data-delta="1">+</button>
      </div>
      <button class="remove-btn" data-id="${item.id}">Remove</button>
    </div>
  `).join('');
  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => changeQty(btn.dataset.id, parseInt(btn.dataset.delta)));
  });
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
  if (totalEl) totalEl.textContent = formatPrice(cartTotal());
}

function initCheckout() {
  const totalEl = document.getElementById('checkout-total');
  const itemsEl = document.getElementById('checkout-items');
  if (totalEl) totalEl.textContent = formatPrice(cartTotal());
  if (itemsEl) {
    itemsEl.innerHTML = cart.map(item => `<div class="checkout-row"><span>${item.name} × ${item.qty}</span><span>${formatPrice(item.price * item.qty)}</span></div>`).join('');
  }
  const form = document.getElementById('checkout-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const orig = btn.textContent;
      btn.textContent = 'Placing order…';
      btn.disabled = true;
      try {
        const res = await fetch('/api/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.value,
            email: form.email.value,
            address: form.address.value,
            city: form.city.value,
            pincode: form.pincode.value,
            phone: form.phone.value,
            items: cart,
            total: cartTotal()
          })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
          cart = [];
          saveCart();
          form.reset();
          btn.textContent = 'Order Placed ✓';
          setTimeout(() => { window.location.href = 'index.html?order=success'; }, 1000);
        } else {
          throw new Error(data.error || 'Order failed');
        }
      } catch (err) {
        btn.textContent = orig;
        btn.disabled = false;
        alert(err.message || 'Could not place order. Try again.');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  const cartPage = document.getElementById('cart-items');
  if (cartPage) renderCart();
  const checkoutPage = document.getElementById('checkout-total');
  if (checkoutPage) initCheckout();

  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
  }

  const url = new URL(window.location.href);
  if (url.searchParams.get('order') === 'success') {
    const hero = document.querySelector('.hero');
    if (hero) hero.insertAdjacentHTML('afterbegin', '<div class="order-success" style="text-align:center;max-width:600px;margin:0 auto 24px;padding:20px;background:#eaf7ec;border:1px solid #b9e2be;border-radius:10px;color:#1e5c2b;font-weight:700;">Thank you! Your order is on its way. 🐾</div>');
  }
});
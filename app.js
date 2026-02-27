// =====================
// app.js (FULL)
// =====================

// ====== 0) HELPERS ======
const money = (n) => (Number(n || 0)).toLocaleString("ru-RU") + " ₽";
const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

// ====== 1) FIREBASE CONFIG ======
// ВАЖНО: вставь сюда свой реальный конфиг из Firebase (Project settings → flower-web → CDN/Config)
const firebaseConfig = {
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
  storageBucket: "flower-app-5a32c.firebasestorage.app",
  messagingSenderId: "540208840853",
  appId: "1:540208840853:web:250f64a9ceedde1620db9c",
};

if (!window.firebase) {
  alert("Firebase не загрузился. Проверь <script> в index.html");
}

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====== 2) ADMIN SETTINGS ======
const ADMIN_IDS = [2272172]; // твой Telegram user id (числом)

// ====== 3) TELEGRAM INIT (опционально) ======
let tgUser = null;
let isAdmin = false;

if (window.Telegram?.WebApp) {
  Telegram.WebApp.expand();
  Telegram.WebApp.ready?.();
  tgUser = Telegram.WebApp.initDataUnsafe?.user || null;

  if (tgUser && ADMIN_IDS.includes(Number(tgUser.id))) {
    isAdmin = true;
    const adminBtn = document.getElementById("adminBtn");
    if (adminBtn) adminBtn.style.display = "block";
  }
}

// ====== 4) CART (localStorage) ======
const LS_CART = "fs_cart_v1";
let cart = loadCart();

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(LS_CART) || "{}");
  } catch {
    return {};
  }
}
function saveCart() {
  localStorage.setItem(LS_CART, JSON.stringify(cart));
}
function cartCount() {
  return Object.values(cart).reduce((s, it) => s + (it.qty || 0), 0);
}

function addToCart(id, data) {
  if (!cart[id]) {
    cart[id] = {
      id,
      name: data.name || "Без названия",
      price: Number(data.price || 0),
      qty: 0,
    };
  }
  cart[id].qty += 1;
  saveCart();

  // лёгкий фидбек
  if (window.Telegram?.WebApp?.HapticFeedback) {
    try {
      Telegram.WebApp.HapticFeedback.impactOccurred("light");
    } catch {}
  }

  // простое уведомление
  console.log("Cart items:", cartCount());
}

// ====== 5) RENDER ======
const catalogDiv = document.getElementById("catalog");
if (!catalogDiv) {
  console.warn("Не найден #catalog в index.html");
}

function renderProducts(snapshot) {
  catalogDiv.innerHTML = "";

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    const img = images.length
      ? images[0]
      : "https://via.placeholder.com/600x400?text=Flower";

    const name = escapeHtml(data.name || "Без названия");
    const price = money(data.price);

    catalogDiv.innerHTML += `
      <div class="card">
        <img 
          src="${escapeHtml(img)}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Flower';"
        >
        <div class="card-body">
          <div>${name}</div>
          <div class="price">${price}</div>
          <button class="buy" data-id="${escapeHtml(id)}">В корзину</button>
        </div>
      </div>
    `;
  });

  // навешиваем обработчики на кнопки
  document.querySelectorAll("button.buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const doc = snapshot.docs.find((d) => d.id === id);
      if (!doc) return;
      addToCart(id, doc.data() || {});
    });
  });
}

// ====== 6) LOAD FLOWERS (Firestore realtime) ======
db.collection("flowers").onSnapshot(
  (snapshot) => {
    if (snapshot.empty) {
      catalogDiv.innerHTML =
        "<div style='padding:16px;color:#64748b'>Товаров нет. Добавь документы в коллекцию <b>flowers</b>.</div>";
      return;
    }
    renderProducts(snapshot);
  },
  (err) => {
    console.error(err);
    alert(
      "Ошибка Firestore: " +
        (err?.message || err) +
        "\n\nЧасто причина: Rules (permissions) или неверный firebaseConfig."
    );
  }
);

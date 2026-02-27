// =====================
// app.js (ORDER 1-CLICK, no cart)
// =====================

// ====== HELPERS ======
const money = (n) => (Number(n || 0)).toLocaleString("ru-RU") + " ₽";
const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

let toastTimer = null;
function showToast(text = "Отправляем заказ…") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = text;
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = "none"), 1500);
}

// ====== FIREBASE CONFIG ======
const firebaseConfig = {
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
  storageBucket: "flower-app-5a32c.firebasestorage.app",
  messagingSenderId: "540208840853",
  appId: "1:540208840853:web:250f64a9ceedde1620db9c",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====== TELEGRAM INIT ======
const tg = window.Telegram?.WebApp || null;
let tgUser = null;

if (tg) {
  tg.expand();
  tg.ready?.();
  tgUser = tg.initDataUnsafe?.user || null;
}

// ====== ORDER (ONE CLICK) ======
async function orderOneClick(productId, data) {
  const product = {
    id: productId,
    name: data.name || "Без названия",
    price: Number(data.price || 0),
  };

  const payload = {
    type: "quick_order",
    product,
    qty: 1,
    total: product.price,
    customer: {
      tgUserId: tgUser?.id || null,                 // главное
      tgUsername: tgUser?.username ? `@${tgUser.username}` : null, // ник (если есть)
      firstName: tgUser?.first_name || null,
      lastName: tgUser?.last_name || null,
    },
    createdAt: Date.now(),
  };

  // 1) Запись в Firestore (можно оставить)
  try {
    await db.collection("orders").add({
      ...payload,
      status: "new",
    });
  } catch (e) {
    console.error("Firestore orders add error:", e);
    // не блокируем отправку в бота
  }

  // 2) Отправка боту
  if (!tg?.sendData) {
    showToast("Открой мини-апп внутри Telegram");
    alert("Открой сайт через кнопку в боте, тогда заказ уйдёт в Telegram.");
    return;
  }

  try {
    showToast("Заказ отправлен ✅");

    // хаптик (если доступно)
    if (tg.HapticFeedback) {
      try { tg.HapticFeedback.impactOccurred("light"); } catch {}
    }

    tg.sendData(JSON.stringify(payload));

    // Закрываем мини-апп — пользователь вернётся в чат с ботом
    tg.close();
  } catch (e) {
    console.error("sendData error:", e);
    alert("Не удалось отправить заказ в Telegram. Проверь, что открыто внутри бота.");
  }
}

// ====== RENDER CATALOG ======
const catalogDiv = document.getElementById("catalog");

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
          <button class="buy" data-id="${escapeHtml(id)}">Заказать</button>
        </div>
      </div>
    `;
  });

  document.querySelectorAll("button.buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const doc = snapshot.docs.find((d) => d.id === id);
      if (!doc) return;
      orderOneClick(id, doc.data() || {});
    });
  });
}

// ====== LOAD FLOWERS ======
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
    alert("Ошибка Firestore: " + (err?.message || err));
  }
);

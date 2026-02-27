// =====================
// app.js (NO CART → ORDER via sendData)
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
  toastTimer = setTimeout(() => (t.style.display = "none"), 1400);
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
let tgUser = null;
const tg = window.Telegram?.WebApp || null;

if (tg) {
  tg.expand();
  tg.ready?.();
  tgUser = tg.initDataUnsafe?.user || null;
}

// ====== ORDER (ONE-CLICK) ======
async function orderOneClick(id, data) {
  const payload = {
    type: "quick_order",
    product: {
      id,
      name: data.name || "Без названия",
      price: Number(data.price || 0),
    },
    qty: 1,
    total: Number(data.price || 0),
    customer: {
      tgUserId: tgUser?.id || null,
      tgUsername: tgUser?.username || null,
      firstName: tgUser?.first_name || null,
      lastName: tgUser?.last_name || null,
    },
    createdAt: Date.now(),
  };

  // 1) Сохраним заказ в Firestore (опционально, но удобно)
  try {
    await db.collection("orders").add({
      ...payload,
      status: "new",
    });
  } catch (e) {
    console.error("orders add error", e);
    // даже если Firestore не записался — можем отправить в бота
  }

  // 2) Отправим в бота и закроем мини-апп
  if (tg?.sendData) {
    showToast("Заказ отправлен ✅");
    try {
      tg.sendData(JSON.stringify(payload));
      // небольшой хаптик
      if (tg.HapticFeedback) {
        try { tg.HapticFeedback.impactOccurred("light"); } catch {}
      }
      tg.close(); // после этого пользователь увидит личку, когда бот ответит
      return;
    } catch (e) {
      console.error("sendData error", e);
    }
  }

  alert("Открой мини-апп внутри Telegram, чтобы отправить заказ боту.");
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

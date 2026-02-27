// =====================
// app.js (ORDER 1-CLICK + ADMIN CRUD)
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
function showToast(text = "Готово ✅") {
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

// ====== ADMIN SETTINGS ======
const ADMIN_IDS = [41830773]; // твой Telegram user id
let isAdmin = false;
let editingFlowerId = null;

// ====== ADMIN UI refs ======
const adminBtn = document.getElementById("adminBtn");
const adminModalBg = document.getElementById("adminModalBg");
const adminClose = document.getElementById("adminClose");

const adName = document.getElementById("adName");
const adPrice = document.getElementById("adPrice");
const adCategory = document.getElementById("adCategory");
const adDesc = document.getElementById("adDesc");
const addImgRowBtn = document.getElementById("addImgRow");
const imgRows = document.getElementById("imgRows");
const adClear = document.getElementById("adClear");
const adSave = document.getElementById("adSave");
const adminList = document.getElementById("adminList");

// ====== SHOW ADMIN BTN ONLY FOR YOU ======
function initAdminAccess() {
  isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));

  if (adminBtn) {
    adminBtn.style.display = isAdmin ? "inline-flex" : "none";
  }
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
      tgUserId: tgUser?.id || null,
      tgUsername: tgUser?.username ? `@${tgUser.username}` : null,
      firstName: tgUser?.first_name || null,
      lastName: tgUser?.last_name || null,
    },
    createdAt: Date.now(),
  };

  // (опционально) записать в Firestore
  try {
    await db.collection("orders").add({
      ...payload,
      status: "new",
    });
  } catch (e) {
    console.error("Firestore orders add error:", e);
  }

  // отправка в бота
  if (!tg?.sendData) {
    showToast("Открой мини-апп внутри Telegram");
    alert("Открой сайт через кнопку в боте, тогда заказ уйдёт в Telegram.");
    return;
  }

  try {
    showToast("Заказ отправлен ✅");

    if (tg.HapticFeedback) {
      try {
        tg.HapticFeedback.impactOccurred("light");
      } catch {}
    }

    tg.sendData(JSON.stringify(payload));
    tg.close();
  } catch (e) {
    console.error("sendData error:", e);
    alert("Не удалось отправить заказ в Telegram. Проверь, что открыто внутри бота.");
  }
}

// ====== CATALOG RENDER ======
const catalogDiv = document.getElementById("catalog");
let lastCatalog = []; // [{id, ...data}]

function renderProducts(snapshot) {
  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    lastCatalog.push({ id, ...data });

    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    const img = images.length ? images[0] : "https://via.placeholder.com/600x400?text=Flower";

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

  // Order buttons
  document.querySelectorAll("button.buy").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const doc = snapshot.docs.find((d) => d.id === id);
      if (!doc) return;
      orderOneClick(id, doc.data() || {});
    });
  });

  // Admin list refresh (if open)
  if (isAdmin) renderAdminList();
}

// ====== LOAD FLOWERS ======
db.collection("flowers").onSnapshot(
  (snapshot) => {
    if (snapshot.empty) {
      catalogDiv.innerHTML =
        "<div style='padding:16px;color:#64748b'>Товаров нет. Добавь документы в коллекцию <b>flowers</b>.</div>";
      lastCatalog = [];
      if (isAdmin) renderAdminList();
      return;
    }
    renderProducts(snapshot);
  },
  (err) => {
    console.error(err);
    alert("Ошибка Firestore: " + (err?.message || err));
  }
);

// =====================
// ADMIN PANEL LOGIC
// =====================

// --- modal open/close ---
function openAdminModal() {
  if (!isAdmin) return;
  if (!adminModalBg) return;
  adminModalBg.style.display = "flex";
  renderAdminList();
}

function closeAdminModal() {
  if (!adminModalBg) return;
  adminModalBg.style.display = "none";
}

if (adminBtn) adminBtn.addEventListener("click", openAdminModal);
if (adminClose) adminClose.addEventListener("click", closeAdminModal);
if (adminModalBg) {
  adminModalBg.addEventListener("click", (e) => {
    // клик по фону закрывает
    if (e.target === adminModalBg) closeAdminModal();
  });
}

// --- images rows UI ---
function createImgRow(value = "") {
  const row = document.createElement("div");
  row.className = "img-row";

  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = "https://...jpg";
  input.value = value;

  const preview = document.createElement("img");
  preview.className = "img-preview";
  preview.alt = "preview";
  preview.src = value || "https://via.placeholder.com/80x80?text=+";
  preview.onerror = () => {
    preview.src = "https://via.placeholder.com/80x80?text=+";
  };

  input.addEventListener("input", () => {
    const v = input.value.trim();
    preview.src = v || "https://via.placeholder.com/80x80?text=+";
  });

  const del = document.createElement("button");
  del.className = "img-del";
  del.type = "button";
  del.textContent = "🗑";
  del.addEventListener("click", () => row.remove());

  row.appendChild(input);
  row.appendChild(preview);
  row.appendChild(del);

  return row;
}

function clearImgRows() {
  if (!imgRows) return;
  imgRows.innerHTML = "";
}

function getImagesFromRows() {
  if (!imgRows) return [];
  const inputs = Array.from(imgRows.querySelectorAll("input"));
  return inputs.map((i) => i.value.trim()).filter(Boolean);
}

function setImagesRows(images = []) {
  clearImgRows();
  if (!imgRows) return;

  const arr = Array.isArray(images) ? images : [];
  if (arr.length === 0) {
    imgRows.appendChild(createImgRow(""));
    return;
  }
  arr.forEach((url) => imgRows.appendChild(createImgRow(url)));
}

if (addImgRowBtn) {
  addImgRowBtn.addEventListener("click", () => {
    if (!imgRows) return;
    imgRows.appendChild(createImgRow(""));
  });
}

// --- form reset / fill ---
function clearAdminForm() {
  editingFlowerId = null;
  if (adName) adName.value = "";
  if (adPrice) adPrice.value = "";
  if (adCategory) adCategory.value = "";
  if (adDesc) adDesc.value = "";
  setImagesRows([]);
  if (adSave) adSave.textContent = "Сохранить";
}

function fillAdminFormById(id) {
  const p = lastCatalog.find((x) => x.id === id);
  if (!p) return;
  editingFlowerId = id;

  if (adName) adName.value = p.name || "";
  if (adPrice) adPrice.value = String(p.price ?? "");
  if (adCategory) adCategory.value = p.category || "";
  if (adDesc) adDesc.value = p.desc || p.description || ""; // на всякий случай
  setImagesRows(Array.isArray(p.images) ? p.images : []);

  if (adSave) adSave.textContent = "Обновить";
}

if (adClear) adClear.addEventListener("click", clearAdminForm);

// --- save / update ---
async function saveFlower() {
  if (!isAdmin) return;

  const name = (adName?.value || "").trim();
  const price = Number((adPrice?.value || "").trim());
  const category = (adCategory?.value || "").trim();
  const desc = (adDesc?.value || "").trim();
  const images = getImagesFromRows();

  if (!name) return alert("Название обязательно");
  if (!Number.isFinite(price) || price <= 0) return alert("Цена должна быть числом > 0");
  if (images.length < 1) return alert("Добавь хотя бы 1 ссылку на фото");

  const data = {
    name,
    price,
    category,
    desc,
    images,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  try {
    if (editingFlowerId) {
      await db.collection("flowers").doc(editingFlowerId).set(data, { merge: true });
      showToast("Обновлено ✅");
    } else {
      await db.collection("flowers").add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      showToast("Добавлено ✅");
    }
    clearAdminForm();
  } catch (e) {
    console.error(e);
    alert("Ошибка сохранения. Проверь Rules Firestore.");
  }
}

if (adSave) adSave.addEventListener("click", saveFlower);

// --- delete ---
async function deleteFlower(id) {
  if (!isAdmin) return;
  if (!confirm("Удалить товар?")) return;

  try {
    await db.collection("flowers").doc(id).delete();
    showToast("Удалено ✅");
    if (editingFlowerId === id) clearAdminForm();
  } catch (e) {
    console.error(e);
    alert("Ошибка удаления");
  }
}

// --- render list ---
function renderAdminList() {
  if (!adminList) return;

  if (!lastCatalog.length) {
    adminList.innerHTML = `<div class="admin-item"><div style="opacity:.7;">Пока нет товаров</div></div>`;
    return;
  }

  adminList.innerHTML = lastCatalog
    .map((p) => {
      const title = escapeHtml(p.name || "Без названия");
      const cat = p.category ? escapeHtml(p.category) : "";
      const price = money(p.price);
      const imgsCount = Array.isArray(p.images) ? p.images.length : 0;

      return `
        <div class="admin-item">
          <div style="min-width:0;">
            <div style="font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            <div style="opacity:.75; font-size:12px;">${cat ? cat + " · " : ""}${price} · фото: ${imgsCount}</div>
          </div>
          <div class="admin-actions">
            <button class="btn-secondary" data-edit="${escapeHtml(p.id)}" type="button">✏️</button>
            <button class="btn-secondary" data-del="${escapeHtml(p.id)}" type="button">🗑</button>
          </div>
        </div>
      `;
    })
    .join("");

  // bind edit/delete
  adminList.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => fillAdminFormById(b.getAttribute("data-edit")));
  });
  adminList.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", () => deleteFlower(b.getAttribute("data-del")));
  });
}

// ====== BOOT ======
initAdminAccess();
clearAdminForm(); // создаст 1 пустую строку для фото

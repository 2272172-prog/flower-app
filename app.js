// =====================
// app.js (CATALOG + PRODUCT MODAL GALLERY + ORDER + ADMIN CRUD)
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

// ====== UI refs ======
const catalogDiv = document.getElementById("catalog");

// Product modal
const productModalBg = document.getElementById("productModalBg");
const pmClose = document.getElementById("pmClose");
const pmTrack = document.getElementById("pmTrack");
const pmDots = document.getElementById("pmDots");
const pmTitle = document.getElementById("pmTitle");
const pmPrice = document.getElementById("pmPrice");
const pmOrder = document.getElementById("pmOrder");
let currentProduct = null;

// Admin modal
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

// State
let lastCatalog = []; // [{id, ...data}]

// ====== ADMIN ACCESS ======
function initAdminAccess() {
  isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));
  if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
}

// =====================
// ORDER (ONE CLICK)
// =====================
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

  // write to Firestore (optional but useful)
  try {
    await db.collection("orders").add({ ...payload, status: "new" });
  } catch (e) {
    console.error("Firestore orders add error:", e);
  }

  if (!tg?.sendData) {
    showToast("Открой мини-апп внутри Telegram");
    alert("Открой сайт через кнопку в боте, тогда заказ уйдёт в Telegram.");
    return;
  }

  try {
    showToast("Заказ отправлен ✅");

    if (tg.HapticFeedback) {
      try { tg.HapticFeedback.impactOccurred("light"); } catch {}
    }

    tg.sendData(JSON.stringify(payload));
    tg.close();
  } catch (e) {
    console.error("sendData error:", e);
    alert("Не удалось отправить заказ в Telegram. Проверь, что открыто внутри бота.");
  }
}

// =====================
// PRODUCT MODAL (GALLERY)
// =====================
function openProductModal(product) {
  currentProduct = product;

  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : ["https://via.placeholder.com/800x600?text=Flower"];

  pmTrack.innerHTML = images.map(url => `
    <div class="pm-slide">
      <img src="${escapeHtml(url)}"
           onerror="this.onerror=null;this.src='https://via.placeholder.com/800x600?text=Flower';">
    </div>
  `).join("");

  pmDots.innerHTML = images.map((_, i) =>
    `<div class="pm-dot ${i === 0 ? "active" : ""}"></div>`
  ).join("");

  pmTrack.scrollLeft = 0;
  pmTrack.onscroll = () => {
    const w = pmTrack.clientWidth || 1;
    const idx = Math.round(pmTrack.scrollLeft / w);
    Array.from(pmDots.children).forEach((d, i) => d.classList.toggle("active", i === idx));
  };

  pmTitle.textContent = product.name || "Без названия";
  pmPrice.textContent = money(product.price || 0);

  productModalBg.style.display = "flex";
}

function closeProductModal() {
  productModalBg.style.display = "none";
}

if (pmClose) pmClose.addEventListener("click", closeProductModal);
if (productModalBg) {
  productModalBg.addEventListener("click", (e) => {
    if (e.target === productModalBg) closeProductModal();
  });
}
if (pmOrder) {
  pmOrder.addEventListener("click", () => {
    if (!currentProduct) return;
    orderOneClick(currentProduct.id, currentProduct);
  });
}

// =====================
// CATALOG RENDER
// =====================
function renderProducts(snapshot) {
  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    const product = { id, ...data };
    lastCatalog.push(product);

    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    const cover = images.length ? images[0] : "https://via.placeholder.com/600x400?text=Flower";

    const title = escapeHtml(data.name || "Без названия");
    const price = money(data.price || 0);

    catalogDiv.innerHTML += `
      <div class="card" data-open="${escapeHtml(id)}">
        <img
          src="${escapeHtml(cover)}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Flower';"
        >
        <div class="card-body">
          <div class="card-title">${title}</div>
          <div class="price">${price}</div>
          <button class="buy" data-order="${escapeHtml(id)}" type="button">Заказать</button>
        </div>
      </div>
    `;
  });

  // Click card => open modal (not when clicking button)
  document.querySelectorAll("[data-open]").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-order]")) return;
      const id = card.getAttribute("data-open");
      const p = lastCatalog.find(x => x.id === id);
      if (p) openProductModal(p);
    });
  });

  // Order button => open modal and order inside (or direct order)
  document.querySelectorAll("[data-order]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-order");
      const p = lastCatalog.find(x => x.id === id);
      if (p) openProductModal(p); // заказ из модалки
    });
  });

  if (isAdmin) renderAdminList();
}

// ====== LOAD FLOWERS ======
db.collection("flowers").onSnapshot(
  (snapshot) => {
    if (snapshot.empty) {
      catalogDiv.innerHTML =
        "<div style='padding:16px;color:rgba(17,24,39,.65)'>Товаров нет. Добавь документы в коллекцию <b>flowers</b>.</div>";
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
// ADMIN PANEL
// =====================

// modal open/close
function openAdminModal() {
  if (!isAdmin) return;
  adminModalBg.style.display = "flex";
  renderAdminList();
}
function closeAdminModal() {
  adminModalBg.style.display = "none";
}

if (adminBtn) adminBtn.addEventListener("click", openAdminModal);
if (adminClose) adminClose.addEventListener("click", closeAdminModal);
if (adminModalBg) {
  adminModalBg.addEventListener("click", (e) => {
    if (e.target === adminModalBg) closeAdminModal();
  });
}

// images rows
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
  preview.onerror = () => { preview.src = "https://via.placeholder.com/80x80?text=+"; };

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
  imgRows.innerHTML = "";
}

function setImagesRows(images = []) {
  clearImgRows();
  const arr = Array.isArray(images) ? images : [];
  if (arr.length === 0) {
    imgRows.appendChild(createImgRow(""));
    return;
  }
  arr.forEach((url) => imgRows.appendChild(createImgRow(url)));
}

function getImagesFromRows() {
  const inputs = Array.from(imgRows.querySelectorAll("input"));
  return inputs.map((i) => i.value.trim()).filter(Boolean);
}

if (addImgRowBtn) {
  addImgRowBtn.addEventListener("click", () => {
    const row = createImgRow("");
    imgRows.appendChild(row);
    const input = row.querySelector("input");
    if (input) input.focus();
  });
}

function clearAdminForm() {
  editingFlowerId = null;
  adName.value = "";
  adPrice.value = "";
  adCategory.value = "";
  adDesc.value = "";
  setImagesRows([]);
  adSave.textContent = "Сохранить";
}

function fillAdminFormById(id) {
  const p = lastCatalog.find((x) => x.id === id);
  if (!p) return;

  editingFlowerId = id;
  adName.value = p.name || "";
  adPrice.value = String(p.price ?? "");
  adCategory.value = p.category || "";
  adDesc.value = p.desc || p.description || "";
  setImagesRows(Array.isArray(p.images) ? p.images : []);
  adSave.textContent = "Обновить";
}

if (adClear) adClear.addEventListener("click", clearAdminForm);

async function saveFlower() {
  if (!isAdmin) return;

  const name = (adName.value || "").trim();
  const price = Number((adPrice.value || "").trim());
  const category = (adCategory.value || "").trim();
  const desc = (adDesc.value || "").trim();
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
      const price = money(p.price || 0);
      const imgsCount = Array.isArray(p.images) ? p.images.length : 0;

      return `
        <div class="admin-item" data-edit="${escapeHtml(p.id)}">
          <div style="min-width:0;">
            <div style="font-weight:900; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
            <div style="opacity:.75; font-size:12px;">${cat ? cat + " · " : ""}${price} · фото: ${imgsCount}</div>
          </div>
          <div class="admin-actions">
            <button class="btn-secondary" data-editbtn="${escapeHtml(p.id)}" type="button">✏️</button>
            <button class="btn-secondary" data-del="${escapeHtml(p.id)}" type="button">🗑</button>
          </div>
        </div>
      `;
    })
    .join("");

  adminList.querySelectorAll("[data-editbtn]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      fillAdminFormById(b.getAttribute("data-editbtn"));
    });
  });

  adminList.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteFlower(b.getAttribute("data-del"));
    });
  });

  // click row -> edit
  adminList.querySelectorAll("[data-edit]").forEach((row) => {
    row.addEventListener("click", () => fillAdminFormById(row.getAttribute("data-edit")));
  });
}

// ====== BOOT ======
initAdminAccess();
clearAdminForm(); // создаст 1 строку фото

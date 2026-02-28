// ===============================
// MEMENTO FLOS — app.js (FULL, STABLE)
// Catalog + Admin + Storage upload
// ===============================

// ---------- HELPERS ----------
const money = (n) => (Number(n || 0)).toLocaleString("ru-RU") + " ₽";

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

let toastTimer = null;
function showToast(text = "Готово") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = text;
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = "none"), 1600);
}

// ---------- FIREBASE ----------
const firebaseConfig = {
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
  storageBucket: "flower-app-5a32c.firebasestorage.app",
  messagingSenderId: "540208840853",
  appId: "1:540208840853:web:250f64a9ceedde1620db9c",
};

if (!window.firebase) {
  alert("Firebase не загрузился. Проверь скрипты firebase-app.js");
}

if (!firebase.apps?.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// storage SDK обязателен
if (!firebase.storage) {
  alert("Storage SDK не подключен! Добавь firebase-storage.js в index.html");
}
const storage = firebase.storage();

// ---------- TELEGRAM ----------
const tg = window.Telegram?.WebApp || null;
let tgUser = null;
if (tg) {
  tg.expand();
  tg.ready?.();
  tgUser = tg.initDataUnsafe?.user || null;
}

// ---------- ADMIN ----------
const ADMIN_IDS = [41830773]; // твой Telegram user id
let isAdmin = false;
let adminOpen = false;
let editingFlowerId = null;

// ---------- DOM ----------
const catalogDiv = document.getElementById("catalog");

const adminBtn = document.getElementById("adminBtn");
const adminModalBg = document.getElementById("adminModalBg");
const adminClose = document.getElementById("adminClose");

const adName = document.getElementById("adName");
const adPrice = document.getElementById("adPrice");
const adCategory = document.getElementById("adCategory");
const adDesc = document.getElementById("adDesc");

const imgRows = document.getElementById("imgRows");
const addImgRowBtn = document.getElementById("addImgRow");

const adSave = document.getElementById("adSave");
const adClear = document.getElementById("adClear");

const adminList = document.getElementById("adminList");

// ---------- STATE ----------
let lastCatalog = [];

// ===============================
// INIT ADMIN ACCESS
// ===============================
function initAdminAccess() {
  isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));
  if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
}

// ===============================
// FIX "JUMPING" WHEN INPUT
// ===============================
function lockBodyScroll() {
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
}
function unlockBodyScroll() {
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
}

// ===============================
// ADMIN MODAL OPEN/CLOSE
// ===============================
function openAdminModal() {
  if (!isAdmin) return;
  adminOpen = true;
  if (adminModalBg) adminModalBg.style.display = "flex";
  lockBodyScroll();
  renderAdminList();
}

function closeAdminModal() {
  adminOpen = false;
  if (adminModalBg) adminModalBg.style.display = "none";
  unlockBodyScroll();
}

if (adminBtn) adminBtn.addEventListener("click", openAdminModal);
if (adminClose) adminClose.addEventListener("click", closeAdminModal);

if (adminModalBg) {
  adminModalBg.addEventListener("click", (e) => {
    if (e.target === adminModalBg) closeAdminModal();
  });
}

// ===============================
// STORAGE UPLOAD (WITH ALERT DEBUG)
// ===============================
async function uploadImage(file) {
  alert("Начинаю загрузку...");

  const safeName = (file.name || "image").replaceAll(" ", "_");
  const fileName = Date.now() + "_" + safeName;
  const ref = storage.ref().child("products/" + fileName);

  try {
    await ref.put(file);
    alert("Файл загружен ✅");

    const url = await ref.getDownloadURL();
    alert("URL получен ✅");

    return url;
  } catch (err) {
    alert("Ошибка upload: " + (err?.message || err));
    console.error("Upload error:", err);
    throw err;
  }
}

// ===============================
// IMAGE ROWS (URL + UPLOAD BUTTON)
// ===============================
function createImgRow(url = "") {
  const row = document.createElement("div");
  row.className = "img-row";

  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = "https://...jpg";
  input.value = url;

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast("Загрузка фото...");
      const uploadedUrl = await uploadImage(file);
      input.value = uploadedUrl;
      showToast("Фото загружено ✅");
    } catch (err) {
      // alert уже показан внутри uploadImage
    } finally {
      fileInput.value = "";
    }
  });

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "🗑";
  del.className = "btn-secondary";
  del.onclick = () => row.remove();

  row.appendChild(input);
  row.appendChild(fileInput);
  row.appendChild(del);

  return row;
}

function getImages() {
  if (!imgRows) return [];
  return Array.from(imgRows.querySelectorAll("input.input"))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

if (addImgRowBtn) {
  addImgRowBtn.addEventListener("click", () => {
    if (!imgRows) return;
    imgRows.appendChild(createImgRow());
  });
}

// ===============================
// CLEAR FORM
// ===============================
function clearAdminForm() {
  editingFlowerId = null;
  if (adName) adName.value = "";
  if (adPrice) adPrice.value = "";
  if (adCategory) adCategory.value = "";
  if (adDesc) adDesc.value = "";
  if (imgRows) imgRows.innerHTML = "";
}

if (adClear) {
  adClear.addEventListener("click", () => {
    clearAdminForm();
    showToast("Очищено");
  });
}

// ===============================
// SAVE FLOWER
// ===============================
if (adSave) {
  adSave.addEventListener("click", async () => {
    const data = {
      name: (adName?.value || "").trim(),
      price: Number(adPrice?.value || 0),
      category: (adCategory?.value || "").trim(),
      desc: (adDesc?.value || "").trim(),
      images: getImages(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!data.name) {
      alert("Название обязательно");
      return;
    }
    if (!Number.isFinite(data.price) || data.price <= 0) {
      alert("Цена должна быть числом > 0");
      return;
    }

    try {
      if (editingFlowerId) {
        await db.collection("flowers").doc(editingFlowerId).set(data, { merge: true });
      } else {
        await db.collection("flowers").add({
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }

      showToast("Сохранено ✅");
      clearAdminForm();
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка сохранения. Проверь Firestore Rules.");
    }
  });
}

// ===============================
// ADMIN LIST (EDIT/DELETE)
// ===============================
function renderAdminList() {
  if (!adminList) return;

  if (!lastCatalog.length) {
    adminList.innerHTML = `<div class="admin-item"><div style="opacity:.7;">Пока нет товаров</div></div>`;
    return;
  }

  adminList.innerHTML = lastCatalog
    .map(
      (p) => `
    <div class="admin-item" style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
      <div style="min-width:0;">
        <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(
          p.name || "Без названия"
        )}</div>
        <div style="opacity:.75;font-size:12px;">${money(p.price || 0)} · фото: ${p.images?.length || 0}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn-secondary" data-edit="${escapeHtml(p.id)}" type="button">✏️</button>
        <button class="btn-secondary" data-del="${escapeHtml(p.id)}" type="button">🗑</button>
      </div>
    </div>
  `
    )
    .join("");

  // handlers
  adminList.querySelectorAll("[data-edit]").forEach((b) => {
    b.addEventListener("click", () => {
      const id = b.getAttribute("data-edit");
      const p = lastCatalog.find((x) => x.id === id);
      if (!p) return;

      editingFlowerId = id;
      if (adName) adName.value = p.name || "";
      if (adPrice) adPrice.value = String(p.price || "");
      if (adCategory) adCategory.value = p.category || "";
      if (adDesc) adDesc.value = p.desc || "";

      if (imgRows) {
        imgRows.innerHTML = "";
        (p.images || []).forEach((u) => imgRows.appendChild(createImgRow(u)));
      }

      showToast("Редактирование");
    });
  });

  adminList.querySelectorAll("[data-del]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.getAttribute("data-del");
      if (!confirm("Удалить товар?")) return;
      try {
        await db.collection("flowers").doc(id).delete();
        showToast("Удалено ✅");
        if (editingFlowerId === id) clearAdminForm();
      } catch (err) {
        console.error(err);
        alert("Не удалось удалить");
      }
    });
  });
}

// ===============================
// CATALOG RENDER
// ===============================
function coverFallback() {
  // вместо via.placeholder, чтобы не падало у тебя
  return "data:image/svg+xml;utf8," + encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>
      <rect width='100%' height='100%' fill='#eef2ff'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
        font-family='Arial' font-size='28' fill='#64748b'>MEMENTO FLOS</text>
    </svg>
  `);
}

function renderProducts(snapshot) {
  if (!catalogDiv) return;

  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    lastCatalog.push({ id, ...data });

    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    const cover = images[0] || coverFallback();

    catalogDiv.innerHTML += `
      <div class="card">
        <img src="${escapeHtml(cover)}"
             loading="lazy"
             onerror="this.onerror=null;this.src='${coverFallback()}';">
        <div class="card-body">
          <div class="card-title">${escapeHtml(data.name || "Без названия")}</div>
          <div class="price">${money(data.price || 0)}</div>
        </div>
      </div>
    `;
  });

  if (isAdmin && adminOpen) renderAdminList();
}

// ===============================
// FIRESTORE SUBSCRIBE
// ===============================
db.collection("flowers").onSnapshot(
  (snapshot) => {
    if (!catalogDiv) return;

    if (snapshot.empty) {
      catalogDiv.innerHTML = "<div style='padding:20px;opacity:.75;'>Нет товаров</div>";
      lastCatalog = [];
      if (isAdmin && adminOpen) renderAdminList();
      return;
    }

    renderProducts(snapshot);
  },
  (err) => {
    console.error("Firestore error:", err);
    alert("Ошибка Firestore. Проверь Rules и настройки проекта.");
  }
);

// ===============================
// INIT
// ===============================
initAdminAccess();

// стартовые 1-2 строки для удобства (чтобы сразу можно было добавить фото)
if (imgRows && imgRows.children.length === 0) {
  imgRows.appendChild(createImgRow());
}
html.modal-open, body.modal-open {
  overflow: hidden;
  height: 100%;
}

.modal-bg .modal {
  max-height: 85vh;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

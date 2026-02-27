// ===============================
// MEMENTO FLOS — STABLE VERSION (CLEAN)
// Catalog + Admin + Storage Upload
// Fix: admin modal jumping + no duplicate declarations
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

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
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
const ADMIN_IDS = [41830773];
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
// ADMIN ACCESS
// ===============================
function initAdminAccess() {
  isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));
  if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
}

// ===============================
// ADMIN MODAL (FIX JUMPING)
// ===============================
function openAdminModal() {
  if (!isAdmin) return;
  adminOpen = true;
  if (adminModalBg) adminModalBg.style.display = "flex";

  // фикс прыжков/скролла при клавиатуре
  document.body.classList.add("modal-open");

  renderAdminList();
}

function closeAdminModal() {
  adminOpen = false;
  if (adminModalBg) adminModalBg.style.display = "none";
  document.body.classList.remove("modal-open");
}

if (adminBtn) adminBtn.addEventListener("click", openAdminModal);
if (adminClose) adminClose.addEventListener("click", closeAdminModal);

// (опционально) закрытие кликом по фону
if (adminModalBg) {
  adminModalBg.addEventListener("click", (e) => {
    if (e.target === adminModalBg) closeAdminModal();
  });
}

// ===============================
// STORAGE UPLOAD
// ===============================
async function uploadImage(file) {
  const fileName = Date.now() + "_" + file.name;
  const ref = storage.ref().child("products/" + fileName);
  await ref.put(file);
  return await ref.getDownloadURL();
}

// ===============================
// IMAGE ROWS (URL + Upload)
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
      console.error("Upload error:", err);
      alert("Не удалось загрузить фото. Проверь Firebase Storage Rules.");
    } finally {
      // сброс, чтобы можно было выбрать тот же файл повторно
      fileInput.value = "";
    }
  });

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "🗑";
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
// ADMIN LIST (does NOT touch the form)
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
      <div class="admin-item">
        <div>
          <strong>${escapeHtml(p.name || "Без названия")}</strong><br>
          <small>${money(p.price || 0)} · фото: ${p.images?.length || 0}</small>
        </div>
      </div>
    `
    )
    .join("");
}

// ===============================
// SAVE FLOWER
// ===============================
if (adClear) {
  adClear.addEventListener("click", () => {
    editingFlowerId = null;
    if (adName) adName.value = "";
    if (adPrice) adPrice.value = "";
    if (adCategory) adCategory.value = "";
    if (adDesc) adDesc.value = "";
    if (imgRows) imgRows.innerHTML = "";
    showToast("Очищено");
  });
}

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

    if (!data.name || !Number.isFinite(data.price) || data.price <= 0) {
      alert("Название и цена обязательны (цена > 0)");
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
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка сохранения. Проверь Firestore Rules.");
    }
  });
}

// ===============================
// CATALOG
// ===============================
function renderProducts(snapshot) {
  if (!catalogDiv) return;

  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    const product = { id, ...data };
    lastCatalog.push(product);

    const cover = data.images?.[0] || "https://via.placeholder.com/600x400?text=Flower";

    catalogDiv.innerHTML += `
      <div class="card">
        <img src="${escapeHtml(cover)}" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Flower';">
        <div class="card-body">
          <div class="card-title">${escapeHtml(data.name || "Без названия")}</div>
          <div class="price">${money(data.price || 0)}</div>
        </div>
      </div>
    `;
  });

  // обновляем список только если админка открыта
  if (isAdmin && adminOpen) renderAdminList();
}

db.collection("flowers").onSnapshot(
  (snapshot) => {
    if (!catalogDiv) return;

    if (snapshot.empty) {
      catalogDiv.innerHTML = "<div style='padding:20px;'>Нет товаров</div>";
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

// ===============================
// MEMENTO FLOS — STABLE VERSION
// Catalog + Modal + Order + Admin + Storage
// FIXED admin disappearing bug
// ===============================

// ---------- HELPERS ----------
const money = (n) =>
  (Number(n || 0)).toLocaleString("ru-RU") + " ₽";

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
// ===== ADMIN MODAL CONTROL (FIX JUMPING + DISAPPEAR BUG) =====

let adminOpen = false;

function openAdminModal() {
  adminOpen = true;
  if (adminModalBg) adminModalBg.style.display = "flex";

  // 🔥 фикс прыжков при клавиатуре
  document.body.classList.add("modal-open");

  renderAdminList(); // обновляем список только при открытии
}

function closeAdminModal() {
  adminOpen = false;
  if (adminModalBg) adminModalBg.style.display = "none";

  document.body.classList.remove("modal-open");
}

// кнопки
if (adminBtn) {
  adminBtn.addEventListener("click", openAdminModal);
}

if (adminClose) {
  adminClose.addEventListener("click", closeAdminModal);
}

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
// STORAGE UPLOAD
// ===============================
async function uploadImage(file) {
  const fileName = Date.now() + "_" + file.name;
  const ref = storage.ref().child("products/" + fileName);
  await ref.put(file);
  return await ref.getDownloadURL();
}

// ===============================
// CATALOG
// ===============================
function renderProducts(snapshot) {
  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    const product = { id, ...data };
    lastCatalog.push(product);

    const cover =
      data.images?.[0] ||
      "https://via.placeholder.com/600x400?text=Flower";

    catalogDiv.innerHTML += `
      <div class="card">
        <img src="${cover}">
        <div class="card-body">
          <div class="card-title">${escapeHtml(data.name)}</div>
          <div class="price">${money(data.price)}</div>
        </div>
      </div>
    `;
  });

  // 🔥 ВАЖНО — админ-лист обновляем ТОЛЬКО если модалка открыта
  if (isAdmin && adminOpen) renderAdminList();
}

db.collection("flowers").onSnapshot(snapshot => {
  if (snapshot.empty) {
    catalogDiv.innerHTML =
      "<div style='padding:20px;'>Нет товаров</div>";
    return;
  }
  renderProducts(snapshot);
});

// ===============================
// ADMIN MODAL
// ===============================
function openAdminModal() {
  if (!isAdmin) return;
  adminOpen = true;
  adminModalBg.style.display = "flex";
  renderAdminList();
}

function closeAdminModal() {
  adminOpen = false;
  adminModalBg.style.display = "none";
}

if (adminBtn) adminBtn.addEventListener("click", openAdminModal);
if (adminClose) adminClose.addEventListener("click", closeAdminModal);

// ===============================
// IMAGE ROWS
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

  fileInput.addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;

    showToast("Загрузка фото...");
    const uploadedUrl = await uploadImage(file);
    input.value = uploadedUrl;
    showToast("Фото загружено ✅");
  });

  const del = document.createElement("button");
  del.textContent = "🗑";
  del.onclick = () => row.remove();

  row.appendChild(input);
  row.appendChild(fileInput);
  row.appendChild(del);

  return row;
}

function getImages() {
  return Array.from(imgRows.querySelectorAll("input.input"))
    .map(i => i.value.trim())
    .filter(Boolean);
}

if (addImgRowBtn) {
  addImgRowBtn.addEventListener("click", () => {
    imgRows.appendChild(createImgRow());
  });
}

// ===============================
// SAVE FLOWER
// ===============================
if (adSave) {
  adSave.addEventListener("click", async () => {
    const data = {
      name: adName.value.trim(),
      price: Number(adPrice.value),
      category: adCategory.value.trim(),
      desc: adDesc.value.trim(),
      images: getImages(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!data.name || !data.price) {
      alert("Название и цена обязательны");
      return;
    }

    if (editingFlowerId) {
      await db.collection("flowers")
        .doc(editingFlowerId)
        .set(data, { merge: true });
    } else {
      await db.collection("flowers").add({
        ...data,
        createdAt:
          firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    showToast("Сохранено ✅");
  });
}

// ===============================
// ADMIN LIST (НЕ ТРОГАЕТ ФОРМУ)
// ===============================
function renderAdminList() {
  if (!adminList) return;

  adminList.innerHTML = lastCatalog.map(p => `
    <div class="admin-item">
      <div>
        <strong>${escapeHtml(p.name)}</strong><br>
        <small>${money(p.price)} · фото: ${p.images?.length || 0}</small>
      </div>
    </div>
  `).join("");
}

// ===============================
// INIT
// ===============================
initAdminAccess();

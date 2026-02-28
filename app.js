// ===============================
// MEMENTO FLOS — app.js (FULL, SAFE)
// Catalog + Admin + Storage upload
// No risky template strings (fix SyntaxError)
// ===============================

// ---------- HELPERS ----------
function money(n) {
  return (Number(n || 0)).toLocaleString("ru-RU") + " ₽";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer = null;
function showToast(text) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = text || "Готово";
  t.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.display = "none"), 1600);
}

// SVG placeholder (без template string)
function coverFallback() {
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>" +
    "<rect width='100%' height='100%' fill='#eef2ff'/>" +
    "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' " +
    "font-family='Arial' font-size='28' fill='#64748b'>MEMENTO FLOS</text>" +
    "</svg>";
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
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
  alert("Firebase не загрузился. Проверь firebase-app.js");
}

if (!firebase.apps || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

if (!firebase.storage) {
  alert("Storage SDK не подключен. Добавь firebase-storage.js");
}
const storage = firebase.storage();

// ---------- TELEGRAM ----------
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
let tgUser = null;

if (tg) {
  try {
    tg.expand();
    tg.ready();
    tgUser = (tg.initDataUnsafe && tg.initDataUnsafe.user) ? tg.initDataUnsafe.user : null;
  } catch (e) {}
}

// ---------- ADMIN ----------
const ADMIN_IDS = [41830773]; // твой TG user id
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

// ---------- BODY SCROLL LOCK ----------
function lockBodyScroll() {
  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");
}
function unlockBodyScroll() {
  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
}

// ---------- ADMIN ACCESS ----------
function initAdminAccess() {
  isAdmin = !!(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));
  if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
}

// ---------- ADMIN MODAL ----------
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
  adminModalBg.addEventListener("click", function (e) {
    if (e.target === adminModalBg) closeAdminModal();
  });
}

// ---------- STORAGE UPLOAD (debug alerts) ----------
async function uploadImage(file) {
  alert("Начинаю загрузку...");

  const safeName = String(file.name || "image").replaceAll(" ", "_");
  const fileName = Date.now() + "_" + safeName;
  const ref = storage.ref().child("products/" + fileName);

  try {
    await ref.put(file);
    alert("Файл загружен ✅");

    const url = await ref.getDownloadURL();
    alert("URL получен ✅");

    return url;
  } catch (err) {
    console.error(err);
    alert("Ошибка upload: " + (err && err.message ? err.message : err));
    throw err;
  }
}

// ---------- IMAGE ROW ----------
function createImgRow(url) {
  const row = document.createElement("div");
  row.className = "img-row";

  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = "https://...jpg";
  input.value = url || "";

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  fileInput.addEventListener("change", async function (e) {
    const file = e.target && e.target.files ? e.target.files[0] : null;
    if (!file) return;

    try {
      showToast("Загрузка фото...");
      const uploadedUrl = await uploadImage(file);
      input.value = uploadedUrl;
      showToast("Фото загружено ✅");
    } catch (err) {
      // alert уже показан
    } finally {
      fileInput.value = "";
    }
  });

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "🗑";
  del.className = "btn-secondary";
  del.addEventListener("click", function () {
    row.remove();
  });

  row.appendChild(input);
  row.appendChild(fileInput);
  row.appendChild(del);

  return row;
}

function getImages() {
  if (!imgRows) return [];
  const inputs = imgRows.querySelectorAll("input.input");
  const arr = [];
  inputs.forEach((i) => {
    const v = (i.value || "").trim();
    if (v) arr.push(v);
  });
  return arr;
}

// add row
if (addImgRowBtn) {
  addImgRowBtn.addEventListener("click", function () {
    if (!imgRows) return;
    imgRows.appendChild(createImgRow(""));
  });
}

// ---------- CLEAR FORM ----------
function clearAdminForm() {
  editingFlowerId = null;
  if (adName) adName.value = "";
  if (adPrice) adPrice.value = "";
  if (adCategory) adCategory.value = "";
  if (adDesc) adDesc.value = "";
  if (imgRows) imgRows.innerHTML = "";
}

if (adClear) {
  adClear.addEventListener("click", function () {
    clearAdminForm();
    showToast("Очищено");
  });
}

// ---------- SAVE FLOWER ----------
if (adSave) {
  adSave.addEventListener("click", async function () {
    const data = {
      name: (adName && adName.value ? adName.value : "").trim(),
      price: Number(adPrice && adPrice.value ? adPrice.value : 0),
      category: (adCategory && adCategory.value ? adCategory.value : "").trim(),
      desc: (adDesc && adDesc.value ? adDesc.value : "").trim(),
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
          name: data.name,
          price: data.price,
          category: data.category,
          desc: data.desc,
          images: data.images,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: data.updatedAt,
        });
      }

      showToast("Сохранено ✅");
      clearAdminForm();
    } catch (err) {
      console.error(err);
      alert("Ошибка сохранения. Проверь Firestore Rules.");
    }
  });
}

// ---------- ADMIN LIST ----------
function renderAdminList() {
  if (!adminList) return;

  if (!lastCatalog.length) {
    adminList.innerHTML = "<div class='admin-item'><div style='opacity:.7;'>Пока нет товаров</div></div>";
    return;
  }

  adminList.innerHTML = "";

  lastCatalog.forEach((p) => {
    const item = document.createElement("div");
    item.className = "admin-item";
    item.style.display = "flex";
    item.style.justifyContent = "space-between";
    item.style.alignItems = "center";
    item.style.gap = "12px";

    const left = document.createElement("div");
    left.style.minWidth = "0";

    const title = document.createElement("div");
    title.style.fontWeight = "900";
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.textContent = p.name || "Без названия";

    const meta = document.createElement("div");
    meta.style.opacity = ".75";
    meta.style.fontSize = "12px";
    meta.textContent = money(p.price || 0) + " · фото: " + ((p.images && p.images.length) ? p.images.length : 0);

    left.appendChild(title);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.gap = "8px";

    const editBtn = document.createElement("button");
    editBtn.className = "btn-secondary";
    editBtn.type = "button";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", function () {
      editingFlowerId = p.id;
      if (adName) adName.value = p.name || "";
      if (adPrice) adPrice.value = String(p.price || "");
      if (adCategory) adCategory.value = p.category || "";
      if (adDesc) adDesc.value = p.desc || "";

      if (imgRows) {
        imgRows.innerHTML = "";
        const imgs = Array.isArray(p.images) ? p.images : [];
        imgs.forEach((u) => imgRows.appendChild(createImgRow(u)));
        if (!imgs.length) imgRows.appendChild(createImgRow(""));
      }

      showToast("Редактирование");
    });

    const delBtn = document.createElement("button");
    delBtn.className = "btn-secondary";
    delBtn.type = "button";
    delBtn.textContent = "🗑";
    delBtn.addEventListener("click", async function () {
      if (!confirm("Удалить товар?")) return;
      try {
        await db.collection("flowers").doc(p.id).delete();
        if (editingFlowerId === p.id) clearAdminForm();
        showToast("Удалено ✅");
      } catch (err) {
        console.error(err);
        alert("Не удалось удалить");
      }
    });

    right.appendChild(editBtn);
    right.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(right);

    adminList.appendChild(item);
  });
}

// ---------- CATALOG ----------
function renderProducts(snapshot) {
  if (!catalogDiv) return;

  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const id = doc.id;

    lastCatalog.push({
      id: id,
      name: data.name,
      price: data.price,
      category: data.category,
      desc: data.desc,
      images: data.images,
    });

    const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
    const cover = images.length ? images[0] : coverFallback();

    const card = document.createElement("div");
    card.className = "card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = cover;
    img.onerror = function () {
      img.onerror = null;
      img.src = coverFallback();
    };

    const body = document.createElement("div");
    body.className = "card-body";

    const t = document.createElement("div");
    t.className = "card-title";
    t.innerHTML = escapeHtml(data.name || "Без названия");

    const p = document.createElement("div");
    p.className = "price";
    p.textContent = money(data.price || 0);

    body.appendChild(t);
    body.appendChild(p);

    card.appendChild(img);
    card.appendChild(body);

    catalogDiv.appendChild(card);
  });

  if (isAdmin && adminOpen) renderAdminList();
}

// ---------- FIRESTORE SUBSCRIBE ----------
db.collection("flowers").onSnapshot(
  function (snapshot) {
    if (!catalogDiv) return;

    if (snapshot.empty) {
      catalogDiv.innerHTML = "<div style='padding:20px;opacity:.75;'>Нет товаров</div>";
      lastCatalog = [];
      if (isAdmin && adminOpen) renderAdminList();
      return;
    }
    renderProducts(snapshot);
  },
  function (err) {
    console.error(err);
    alert("Ошибка Firestore. Проверь Rules и настройки проекта.");
  }
);

// ---------- INIT ----------
initAdminAccess();
if (imgRows && imgRows.children.length === 0) {
  imgRows.appendChild(createImgRow(""));
}

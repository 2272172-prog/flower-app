// ===============================
// MEMENTO FLOS — FREE VERSION
// Firestore + manual image URLs
// Admin: add multiple links, CRUD
// ===============================

const firebaseConfig = {
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Helpers ---
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
  toastTimer = setTimeout(() => (t.style.display = "none"), 1800);
}

// --- Telegram / Admin ---
const tg = window.Telegram?.WebApp || null;
let tgUser = null;
if (tg) tgUser = tg.initDataUnsafe?.user || null;

const ADMIN_IDS = [41830773];
const isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));

// --- DOM ---
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
const clearImgsBtn = document.getElementById("clearImgs");

const adSave = document.getElementById("adSave");
const adClear = document.getElementById("adClear");

const adminList = document.getElementById("adminList");

// --- State ---
let lastCatalog = [];
let editingId = null;
let adminOpen = false;

// --- Admin UI open/close ---
if (adminBtn) adminBtn.style.display = isAdmin ? "inline-block" : "none";

function openAdmin() {
  if (!isAdmin) return;
  adminOpen = true;
  adminModalBg.style.display = "flex";
  document.body.classList.add("modal-open");
  renderAdminList();
}

function closeAdmin() {
  adminOpen = false;
  adminModalBg.style.display = "none";
  document.body.classList.remove("modal-open");
}

if (adminBtn) adminBtn.addEventListener("click", openAdmin);
if (adminClose) adminClose.addEventListener("click", closeAdmin);
if (adminModalBg) {
  adminModalBg.addEventListener("click", (e) => {
    if (e.target === adminModalBg) closeAdmin();
  });
}

// --- Images rows ---
function createImgRow(url = "") {
  const row = document.createElement("div");
  row.className = "imgRow";

  const input = document.createElement("input");
  input.className = "input";
  input.placeholder = "https://...jpg";
  input.value = url;

  const del = document.createElement("button");
  del.className = "mini";
  del.type = "button";
  del.textContent = "🗑";
  del.onclick = () => row.remove();

  row.appendChild(input);
  row.appendChild(del);
  return row;
}

function getImages() {
  return Array.from(imgRows.querySelectorAll("input"))
    .map((i) => i.value.trim())
    .filter(Boolean);
}

function setImages(urls = []) {
  imgRows.innerHTML = "";
  (urls.length ? urls : [""]).forEach((u) => imgRows.appendChild(createImgRow(u)));
}

if (addImgRowBtn) addImgRowBtn.addEventListener("click", () => imgRows.appendChild(createImgRow("")));
if (clearImgsBtn) clearImgsBtn.addEventListener("click", () => setImages([]));

// --- Form reset ---
function clearForm() {
  editingId = null;
  adName.value = "";
  adPrice.value = "";
  adCategory.value = "";
  adDesc.value = "";
  setImages([]);
}

if (adClear) adClear.addEventListener("click", () => {
  clearForm();
  showToast("Форма очищена");
});

// --- Save (create/update) ---
if (adSave) {
  adSave.addEventListener("click", async () => {
    const data = {
      name: adName.value.trim(),
      price: Number(adPrice.value || 0),
      category: adCategory.value.trim(),
      desc: adDesc.value.trim(),
      images: getImages(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!data.name || !Number.isFinite(data.price) || data.price <= 0) {
      alert("Название и цена обязательны (цена > 0)");
      return;
    }

    try {
      if (editingId) {
        await db.collection("flowers").doc(editingId).set(data, { merge: true });
        showToast("Обновлено ✅");
      } else {
        await db.collection("flowers").add({
          ...data,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        showToast("Добавлено ✅");
      }
      clearForm();
    } catch (e) {
      console.error(e);
      alert("Ошибка сохранения. Проверь Firestore Rules.");
    }
  });
}

// --- Admin list ---
function renderAdminList() {
  if (!adminList) return;

  if (!lastCatalog.length) {
    adminList.innerHTML = `<div class="adminItem"><div class="small">Пока нет товаров</div></div>`;
    return;
  }

  adminList.innerHTML = lastCatalog
    .map(
      (p) => `
      <div class="adminItem">
        <div style="min-width:0;">
          <div style="font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name || "Без названия")}</div>
          <div class="small">${money(p.price || 0)} · фото: ${p.images?.length || 0}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="mini" type="button" onclick="window.__editFlower('${p.id}')">✏️</button>
          <button class="mini" type="button" onclick="window.__delFlower('${p.id}')">🗑</button>
        </div>
      </div>
    `
    )
    .join("");
}

window.__editFlower = function (id) {
  const p = lastCatalog.find((x) => x.id === id);
  if (!p) return;

  editingId = id;
  adName.value = p.name || "";
  adPrice.value = String(p.price || "");
  adCategory.value = p.category || "";
  adDesc.value = p.desc || "";
  setImages(Array.isArray(p.images) ? p.images : []);
  showToast("Режим редактирования");
};

window.__delFlower = async function (id) {
  if (!confirm("Удалить товар?")) return;
  try {
    await db.collection("flowers").doc(id).delete();
    showToast("Удалено ✅");
    if (editingId === id) clearForm();
  } catch (e) {
    console.error(e);
    alert("Ошибка удаления. Проверь Rules.");
  }
};

// --- Catalog render (показываем 1-е фото как обложку) ---
function renderCatalog(snapshot) {
  lastCatalog = [];
  catalogDiv.innerHTML = "";

  snapshot.forEach((doc) => {
    const d = doc.data() || {};
    const p = { id: doc.id, ...d };
    lastCatalog.push(p);

    const cover = (Array.isArray(p.images) && p.images[0]) ? p.images[0] : "https://via.placeholder.com/600x400?text=Flower";

    catalogDiv.innerHTML += `
      <div class="card">
        <img src="${escapeHtml(cover)}" onerror="this.onerror=null;this.src='https://via.placeholder.com/600x400?text=Flower';">
        <div class="cb">
          <div class="ct">${escapeHtml(p.name || "Без названия")}</div>
          <div class="price">${money(p.price || 0)}</div>
        </div>
      </div>
    `;
  });

  if (isAdmin && adminOpen) renderAdminList();
}

db.collection("flowers").orderBy("createdAt", "desc").onSnapshot(
  (snap) => {
    if (snap.empty) {
      catalogDiv.innerHTML = `<div style="padding:18px;color:rgba(0,0,0,.6)">Товаров нет</div>`;
      lastCatalog = [];
      if (isAdmin && adminOpen) renderAdminList();
      return;
    }
    renderCatalog(snap);
  },
  (err) => {
    console.error(err);
    alert("Ошибка Firestore: " + (err?.message || err));
  }
);

// init form images
setImages([]);

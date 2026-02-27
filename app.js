// =====================
// MEMENTO FLOS FULL APP
// Catalog + Modal Gallery + Order + Admin CRUD + Storage Upload
// =====================

// ===== HELPERS =====
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
  toastTimer = setTimeout(() => (t.style.display = "none"), 1600);
}

// ===== FIREBASE =====
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

// ===== TELEGRAM =====
const tg = window.Telegram?.WebApp || null;
let tgUser = null;

if (tg) {
  tg.expand();
  tg.ready?.();
  tgUser = tg.initDataUnsafe?.user || null;
}

// ===== ADMIN SETTINGS =====
const ADMIN_IDS = [41830773];
let isAdmin = false;
let editingFlowerId = null;

// ===== DOM =====
const catalogDiv = document.getElementById("catalog");

// Product modal
const productModalBg = document.getElementById("productModalBg");
const pmClose = document.getElementById("pmClose");
const pmTrack = document.getElementById("pmTrack");
const pmDots = document.getElementById("pmDots");
const pmTitle = document.getElementById("pmTitle");
const pmPrice = document.getElementById("pmPrice");
const pmOrder = document.getElementById("pmOrder");

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

// ===== STATE =====
let lastCatalog = [];
let currentProduct = null;

// ===== ADMIN ACCESS =====
function initAdminAccess() {
  isAdmin = Boolean(tgUser && ADMIN_IDS.includes(Number(tgUser.id)));
  if (adminBtn) adminBtn.style.display = isAdmin ? "inline-flex" : "none";
}

// =====================
// STORAGE UPLOAD
// =====================
async function uploadImage(file) {
  const fileName = Date.now() + "_" + file.name;
  const ref = storage.ref().child("products/" + fileName);
  await ref.put(file);
  return await ref.getDownloadURL();
}

// =====================
// PRODUCT MODAL
// =====================
function openProductModal(product) {
  currentProduct = product;

  const images = product.images?.length
    ? product.images
    : ["https://via.placeholder.com/800x600?text=Flower"];

  pmTrack.innerHTML = images.map(url => `
    <div class="pm-slide">
      <img src="${escapeHtml(url)}">
    </div>
  `).join("");

  pmDots.innerHTML = images.map((_, i) =>
    `<div class="pm-dot ${i === 0 ? "active" : ""}"></div>`
  ).join("");

  pmTrack.scrollLeft = 0;
  pmTrack.onscroll = () => {
    const w = pmTrack.clientWidth || 1;
    const idx = Math.round(pmTrack.scrollLeft / w);
    Array.from(pmDots.children).forEach((d, i) =>
      d.classList.toggle("active", i === idx)
    );
  };

  pmTitle.textContent = product.name || "";
  pmPrice.textContent = money(product.price || 0);
  productModalBg.style.display = "flex";
}

function closeProductModal() {
  productModalBg.style.display = "none";
}

if (pmClose) pmClose.addEventListener("click", closeProductModal);
if (productModalBg) {
  productModalBg.addEventListener("click", e => {
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
// ORDER
// =====================
async function orderOneClick(productId, data) {
  const payload = {
    type: "quick_order",
    product: {
      id: productId,
      name: data.name,
      price: data.price,
    },
    total: data.price,
    tgUserId: tgUser?.id || null,
    createdAt: Date.now(),
  };

  try {
    await db.collection("orders").add({ ...payload, status: "new" });
  } catch (e) {}

  if (!tg?.sendData) {
    alert("Открой через Telegram");
    return;
  }

  tg.sendData(JSON.stringify(payload));
  tg.close();
}

// =====================
// CATALOG
// =====================
function renderProducts(snapshot) {
  catalogDiv.innerHTML = "";
  lastCatalog = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const id = doc.id;

    const product = { id, ...data };
    lastCatalog.push(product);

    const cover = data.images?.[0] || "https://via.placeholder.com/600x400?text=Flower";

    catalogDiv.innerHTML += `
      <div class="card" data-open="${id}">
        <img src="${cover}">
        <div class="card-body">
          <div class="card-title">${escapeHtml(data.name)}</div>
          <div class="price">${money(data.price)}</div>
          <button class="buy">Заказать</button>
        </div>
      </div>
    `;
  });

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.getAttribute("data-open");
      const p = lastCatalog.find(x => x.id === id);
      if (p) openProductModal(p);
    });
  });

  if (isAdmin) renderAdminList();
}

db.collection("flowers").onSnapshot(snapshot => {
  if (snapshot.empty) {
    catalogDiv.innerHTML = "<div style='padding:20px;'>Нет товаров</div>";
    return;
  }
  renderProducts(snapshot);
});

// =====================
// ADMIN PANEL
// =====================
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

if (adClear) {
  adClear.addEventListener("click", () => {
    editingFlowerId = null;
    adName.value = "";
    adPrice.value = "";
    adCategory.value = "";
    adDesc.value = "";
    imgRows.innerHTML = "";
  });
}

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
      await db.collection("flowers").doc(editingFlowerId).set(data, { merge: true });
    } else {
      await db.collection("flowers").add({
        ...data,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

    showToast("Сохранено ✅");
  });
}

function renderAdminList() {
  if (!adminList) return;

  adminList.innerHTML = lastCatalog.map(p => `
    <div class="admin-item">
      <div>
        <strong>${escapeHtml(p.name)}</strong><br>
        <small>${money(p.price)} · фото: ${p.images?.length || 0}</small>
      </div>
      <div>
        <button onclick="editFlower('${p.id}')">✏️</button>
        <button onclick="deleteFlower('${p.id}')">🗑</button>
      </div>
    </div>
  `).join("");
}

window.editFlower = function(id) {
  const p = lastCatalog.find(x => x.id === id);
  if (!p) return;

  editingFlowerId = id;
  adName.value = p.name || "";
  adPrice.value = p.price || "";
  adCategory.value = p.category || "";
  adDesc.value = p.desc || "";
  imgRows.innerHTML = "";
  p.images?.forEach(url => imgRows.appendChild(createImgRow(url)));
};

window.deleteFlower = async function(id) {
  if (!confirm("Удалить?")) return;
  await db.collection("flowers").doc(id).delete();
  showToast("Удалено ✅");
};

// ===== BOOT =====
initAdminAccess();

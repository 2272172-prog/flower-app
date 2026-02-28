(function () {
  "use strict";

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
    toastTimer = setTimeout(() => (t.style.display = "none"), 1800);
  }

  function coverFallback() {
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500'>" +
      "<rect width='100%' height='100%' fill='#eef2ff'/>" +
      "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' " +
      "font-family='Arial' font-size='28' fill='#64748b'>MEMENTO FLOS</text>" +
      "</svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function getProductLink(productId) {
    return "https://flower-app-ten.vercel.app/?p=" + encodeURIComponent(productId);
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
    return;
  }
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const db = firebase.firestore ? firebase.firestore() : null;
  if (!db) {
    alert("Firestore SDK не подключен. Добавь firebase-firestore.js");
    return;
  }

  const storage = firebase.storage ? firebase.storage() : null;
  if (!storage) console.warn("Storage SDK не подключен — загрузка файлов недоступна.");

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

  // Product modal
  const productModalBg = document.getElementById("productModalBg");
  const pmTrack = document.getElementById("pmTrack");
  const pmTitle = document.getElementById("pmTitle");
  const pmPrice = document.getElementById("pmPrice");
  const pmDesc = document.getElementById("pmDesc");
  const pmOrder = document.getElementById("pmOrder");
  const pmClose = document.getElementById("pmClose");

  // ---------- STATE ----------
  let lastCatalog = [];
  let openedFromUrlOnce = false;

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

  // ---------- PRODUCT MODAL ----------
  function openProduct(p) {
    if (!productModalBg) return;

    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    const list = images.length ? images : [coverFallback()];

    if (pmTrack) {
      pmTrack.innerHTML = "";
      list.forEach((src) => {
        const slide = document.createElement("div");
        slide.className = "pm-slide";
        const img = document.createElement("img");
        img.src = src;
        img.onerror = function () {
          img.onerror = null;
          img.src = coverFallback();
        };
        slide.appendChild(img);
        pmTrack.appendChild(slide);
      });
    }

    if (pmTitle) pmTitle.textContent = p.name || "Без названия";
    if (pmPrice) pmPrice.textContent = money(p.price || 0);
    if (pmDesc) pmDesc.textContent = (p.desc || "").trim();

    // ✅ Заказ -> отправка в бота
    if (pmOrder) {
      pmOrder.onclick = function () {
        const payload = {
          type: "order",
          id: p.id,
          name: p.name || "Букет",
          price: Number(p.price || 0),
          desc: (p.desc || "").trim(),
          img: (Array.isArray(p.images) && p.images[0]) ? String(p.images[0]) : "",
          link: getProductLink(p.id),
        };

        if (!tg) {
          alert("Откройте сайт внутри Telegram (через бота), чтобы отправить заказ.");
          return;
        }

        try {
          tg.sendData(JSON.stringify(payload));
          showToast("Заявка отправлена ✅");
        } catch (e) {
          alert("Не удалось отправить заказ. Откройте через Telegram.");
        }
      };
    }

    productModalBg.style.display = "flex";
    lockBodyScroll();
  }

  function closeProduct() {
    if (!productModalBg) return;
    productModalBg.style.display = "none";
    unlockBodyScroll();
  }

  if (pmClose) pmClose.addEventListener("click", closeProduct);
  if (productModalBg) {
    productModalBg.addEventListener("click", function (e) {
      if (e.target === productModalBg) closeProduct();
    });
  }

  // ---------- STORAGE UPLOAD ----------
  async function uploadImage(file) {
    if (!storage) {
      alert("Storage не подключен (firebase-storage.js).");
      throw new Error("Storage not available");
    }

    const safeName = String(file.name || "image").replaceAll(" ", "_");
    const fileName = Date.now() + "_" + safeName;
    const ref = storage.ref().child("products/" + fileName);

    await ref.put(file);
    return await ref.getDownloadURL();
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
        console.error(err);
        alert("Ошибка загрузки фото");
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

  function addImgRow() {
    if (!imgRows) return;
    imgRows.appendChild(createImgRow(""));
  }
  if (addImgRowBtn) addImgRowBtn.addEventListener("click", addImgRow);

  // ---------- CLEAR FORM ----------
  function clearAdminForm() {
    editingFlowerId = null;
    if (adName) adName.value = "";
    if (adPrice) adPrice.value = "";
    if (adCategory) adCategory.value = "";
    if (adDesc) adDesc.value = "";
    if (imgRows) imgRows.innerHTML = "";
    if (imgRows) imgRows.appendChild(createImgRow(""));
  }

  if (adClear) {
    adClear.addEventListener("click", function () {
      clearAdminForm();
      showToast("Очищено");
    });
  }

  // ---------- SAVE FLOWER ----------
  async function saveFlower() {
    const data = {
      name: (adName && adName.value ? adName.value : "").trim(),
      price: Number(adPrice && adPrice.value ? adPrice.value : 0),
      category: (adCategory && adCategory.value ? adCategory.value : "").trim(),
      desc: (adDesc && adDesc.value ? adDesc.value : "").trim(),
      images: getImages(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    if (!data.name) return alert("Название обязательно");
    if (!Number.isFinite(data.price) || data.price <= 0) return alert("Цена должна быть числом > 0");

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
  }
  if (adSave) adSave.addEventListener("click", saveFlower);

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
      meta.textContent = money(p.price || 0) + " · фото: " + (p.images && p.images.length ? p.images.length : 0);

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

  // ---------- OPEN FROM URL ?p=ID ----------
  function tryOpenFromUrl() {
    if (openedFromUrlOnce) return;
    const pid = new URLSearchParams(window.location.search).get("p");
    if (!pid) return;
    const found = lastCatalog.find((x) => x.id === pid);
    if (found) {
      openedFromUrlOnce = true;
      openProduct(found);
    }
  }

  // ---------- CATALOG ----------
  function renderProducts(snapshot) {
    if (!catalogDiv) return;

    catalogDiv.innerHTML = "";
    lastCatalog = [];

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const product = {
        id: doc.id,
        name: data.name,
        price: data.price,
        category: data.category,
        desc: data.desc,
        images: data.images,
      };

      lastCatalog.push(product);

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

      const pr = document.createElement("div");
      pr.className = "price";
      pr.textContent = money(data.price || 0);

      body.appendChild(t);
      body.appendChild(pr);

      card.appendChild(img);
      card.appendChild(body);

      card.addEventListener("click", function () {
        openProduct(product);
      });

      catalogDiv.appendChild(card);
    });

    tryOpenFromUrl();
    if (isAdmin && adminOpen) renderAdminList();
  }

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
})();

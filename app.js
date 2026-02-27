<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>MEMENTO FLOS</title>

  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@500;600&display=swap" rel="stylesheet">

  <!-- Firebase v8 -->
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-firestore.js"></script>

  <!-- Telegram WebApp -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>

  <style>
    :root{ --bg:#f8f6f3; --card:#fff; --text:#111; --muted:rgba(0,0,0,.6); --line:rgba(0,0,0,.08); --r:22px; }
    *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
    body{margin:0;background:var(--bg);font-family:Manrope,system-ui;color:var(--text)}
    body.modal-open{position:fixed;width:100%}

    .header{position:sticky;top:0;background:linear-gradient(180deg,rgba(248,246,243,1) 70%, rgba(248,246,243,0));padding:24px 16px 12px;text-align:center;z-index:5}
    .brand{font-family:"Cormorant Garamond",serif;font-weight:700;font-size:36px;letter-spacing:6px;margin:0}
    .adminBtn{margin-top:10px;border:1px solid var(--line);background:#fff;border-radius:14px;padding:10px 12px;font-weight:800;cursor:pointer;display:none}

    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px}
    .card{background:var(--card);border-radius:var(--r);overflow:hidden;border:1px solid var(--line);cursor:pointer}
    .card img{width:100%;height:190px;object-fit:cover;display:block}
    .cb{padding:12px}
    .ct{font-weight:700;font-size:14px;min-height:38px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .price{margin-top:6px;font-weight:800;color:#111}

    .toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);background:#111;color:#fff;padding:10px 12px;border-radius:14px;font-weight:800;display:none;z-index:9999}

    /* MODAL base */
    .bg{position:fixed;inset:0;background:rgba(17,24,39,.55);display:none;align-items:center;justify-content:center;padding:12px;z-index:9998}
    .modal{width:100%;max-width:560px;background:var(--bg);border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,.2);max-height:88dvh;display:flex;flex-direction:column}
    .mh{background:#fff;border-bottom:1px solid var(--line);padding:12px 14px;display:flex;align-items:center;justify-content:space-between}
    .mt{font-weight:900}
    .x{width:40px;height:40px;border-radius:14px;border:1px solid var(--line);background:#fff;font-weight:900;cursor:pointer}
    .mb{padding:14px;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:120px}

    .input,.ta{width:100%;border:1px solid var(--line);border-radius:14px;background:#fff;padding:12px;font-size:14px;outline:none}
    .ta{min-height:120px;line-height:1.35;resize:vertical}
    .row2{display:flex;gap:10px;margin-top:10px}
    .row2 > *{flex:1}
    .btn{border:none;border-radius:14px;padding:12px;font-weight:900;cursor:pointer;background:#111;color:#fff}
    .btn2{border:1px solid var(--line);border-radius:14px;padding:12px;font-weight:900;cursor:pointer;background:#fff;color:#111}
    .hr{height:1px;background:var(--line);margin:14px 0}
    .hint{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.35}

    .imgRow{display:flex;gap:10px;align-items:center;margin-top:10px}
    .imgRow input{flex:1}
    .mini{width:44px;height:44px;border-radius:14px;border:1px solid var(--line);background:#fff;cursor:pointer;font-weight:900}
    .adminList{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden}
    .adminItem{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px;border-bottom:1px solid rgba(0,0,0,.06)}
    .adminItem:last-child{border-bottom:none}
    .small{font-size:12px;color:var(--muted)}
  </style>
</head>

<body>
  <div class="header">
    <h1 class="brand">MEMENTO FLOS</h1>
    <button id="adminBtn" class="adminBtn" type="button">Админ</button>
  </div>

  <div id="toast" class="toast">Готово ✅</div>

  <div id="catalog" class="grid"></div>

  <!-- ADMIN MODAL -->
  <div id="adminModalBg" class="bg">
    <div class="modal" onclick="event.stopPropagation()">
      <div class="mh">
        <div class="mt">🛠 Админка</div>
        <button id="adminClose" class="x" type="button">✕</button>
      </div>

      <div class="mb">
        <div class="small">Фото добавляем ссылками (каждая ссылка = отдельное фото). Работает бесплатно.</div>

        <div class="hr"></div>

        <input id="adName" class="input" placeholder="Название" />
        <div class="row2">
          <input id="adPrice" class="input" placeholder="Цена (число)" inputmode="numeric" />
          <input id="adCategory" class="input" placeholder="Категория (опционально)" />
        </div>
        <textarea id="adDesc" class="ta" placeholder="Описание"></textarea>

        <div class="hr"></div>

        <div style="font-weight:900;">Фото (ссылки)</div>
        <div id="imgRows"></div>
        <div class="row2">
          <button id="addImgRow" class="btn2" type="button">+ Добавить ссылку</button>
          <button id="clearImgs" class="btn2" type="button">Очистить фото</button>
        </div>
        <div class="hint">Где брать ссылки: postimages.org / imgbb.com — загрузил → скопировал прямую ссылку на картинку.</div>

        <div class="hr"></div>

        <div class="row2">
          <button id="adClear" class="btn2" type="button">Очистить форму</button>
          <button id="adSave" class="btn" type="button">Сохранить</button>
        </div>

        <div class="hr"></div>

        <div style="font-weight:900;margin-bottom:10px;">Товары</div>
        <div id="adminList" class="adminList"></div>
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>

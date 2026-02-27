
// ====== FIREBASE CONFIG ======
const firebaseConfig = {
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ====== ADMIN SETTINGS ======
const ADMIN_IDS = [2272172];

// ====== TELEGRAM INIT ======
let tgUser = null;
let isAdmin = false;

if (window.Telegram?.WebApp) {
  Telegram.WebApp.expand();
  Telegram.WebApp.ready();

  tgUser = Telegram.WebApp.initDataUnsafe?.user || null;

  if (tgUser && ADMIN_IDS.includes(Number(tgUser.id))) {
    isAdmin = true;
    document.getElementById("adminBtn").style.display = "block";
  }
}

// ====== LOAD FLOWERS ======
const catalogDiv = document.getElementById("catalog");

db.collection("flowers").onSnapshot(snapshot => {
  catalogDiv.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();
    const img = (data.images && data.images.length)
      ? data.images[0]
      : "https://via.placeholder.com/600x400?text=Flower";

   catalogDiv.innerHTML += `
  <div class="card">
    <img 
      src="${img}"
      onerror="this.src='https://via.placeholder.com/600x400?text=Flower';"
    >
    <div class="card-body">
      <div>${data.name}</div>
      <div class="price">${data.price} ₽</div>
      <button class="buy">В корзину</button>
    </div>
  </div>
`;
    `;
  });
});

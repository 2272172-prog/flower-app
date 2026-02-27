// Firebase
firebase.initializeApp({
  apiKey: "AIzaSyAL1CfJ2NaTiu1uc4ybH8lUdnUeBNNpXLw",
  authDomain: "flower-app-5a32c.firebaseapp.com",
  projectId: "flower-app-5a32c",
  storageBucket: "flower-app-5a32c.appspot.com",
});

const db = firebase.firestore();
const storage = firebase.storage();

const tg = window.Telegram?.WebApp;
let tgUser = tg?.initDataUnsafe?.user || null;

const ADMIN_IDS = [41830773];
const isAdmin = tgUser && ADMIN_IDS.includes(Number(tgUser.id));
if (isAdmin) document.getElementById("adminBtn").style.display = "block";

const catalog = document.getElementById("catalog");
const toast = document.getElementById("toast");

// ================= CATALOG =================
db.collection("flowers").onSnapshot(snap=>{
  catalog.innerHTML="";
  snap.forEach(doc=>{
    const d=doc.data();
    const img=d.images?.[0]||"https://via.placeholder.com/600";
    catalog.innerHTML+=`
      <div class="card" onclick="openProduct('${doc.id}')">
        <img src="${img}">
        <div class="card-body">
          <div>${d.name}</div>
          <div class="price">${d.price} ₽</div>
        </div>
      </div>
    `;
  });
});

// ================= PRODUCT =================
let currentProduct=null;

function openProduct(id){
  db.collection("flowers").doc(id).get().then(doc=>{
    const d=doc.data();
    currentProduct=d;
    const track=document.getElementById("pmTrack");
    track.innerHTML="";
    d.images?.forEach(img=>{
      track.innerHTML+=`<img src="${img}">`;
    });
    document.getElementById("pmTitle").innerText=d.name;
    document.getElementById("pmPrice").innerText=d.price+" ₽";
    document.getElementById("productModalBg").style.display="flex";
  });
}

function closeProduct(){
  document.getElementById("productModalBg").style.display="none";
}

document.getElementById("pmOrder").onclick=()=>{
  if(!tg) return alert("Открой через Telegram");
  tg.sendData(JSON.stringify(currentProduct));
  tg.close();
};

// ================= ADMIN =================
document.getElementById("adminBtn").onclick=()=>{
  document.getElementById("adminModalBg").style.display="flex";
  document.body.classList.add("modal-open");
};

function closeAdmin(){
  document.getElementById("adminModalBg").style.display="none";
  document.body.classList.remove("modal-open");
}

function addImgRow(){
  const row=document.createElement("div");
  row.className="img-row";
  row.innerHTML=`<input type="file">`;
  row.querySelector("input").onchange=async e=>{
    const file=e.target.files[0];
    const ref=storage.ref("products/"+Date.now()+file.name);
    await ref.put(file);
    const url=await ref.getDownloadURL();
    const hidden=document.createElement("input");
    hidden.value=url;
    hidden.type="hidden";
    row.appendChild(hidden);
  };
  document.getElementById("imgRows").appendChild(row);
}

function saveFlower(){
  const name=document.getElementById("adName").value;
  const price=Number(document.getElementById("adPrice").value);
  const desc=document.getElementById("adDesc").value;
  const images=[...document.querySelectorAll("#imgRows input[type=hidden]")].map(i=>i.value);
  db.collection("flowers").add({name,price,desc,images});
  toast.innerText="Сохранено";
  toast.style.display="block";
  setTimeout(()=>toast.style.display="none",1500);
}

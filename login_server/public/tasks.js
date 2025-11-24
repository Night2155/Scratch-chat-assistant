// import { getFirestore, collection, getDocs } from "firebase/firestore";
// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const params = new URLSearchParams(window.location.search);
const name = params.get("name");
const className = params.get("class");
const firebaseConfig = {
  apiKey: "AIzaSyBYg4xnd5il5QcsYfJu1Zj89wdoYHqjlAo",
  authDomain: "scratch-ct-chatbot-2025.firebaseapp.com",
  projectId: "scratch-ct-chatbot-2025",
  storageBucket: "scratch-ct-chatbot-2025.firebasestorage.app",
  messagingSenderId: "890112360772",
  appId: "1:890112360772:web:7b9911703cbb6f8b171711"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

// 初始化任務資料結構
let tasksData = {
  basic: [],
  advanced: []
};

// 從 Firestore 載入任務
async function loadTasksFromFirestore() {
  // const querySnapshot = await getDocs(collection(window.db, "tasks"));
  const querySnapshot = await getDocs(collection(db, "tasks"));
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    const task = {
      id: doc.id,
      title: data.title,
      desc: data.desc,
      sb3Path: data.sb3Path,
      // img: data.sb3Path && data.sb3Path.trim() !== "" ? data.sb3Path : 'login.png'
    };

    // 根據文件 id 決定分類（你也可用欄位判斷）
    if (doc.id.startsWith("basic")) {
      tasksData.basic.push(task);
    } else if (doc.id.startsWith("advance")) {
      tasksData.advanced.push(task);
    }
  });

  renderTasks('basic');  // 預設顯示基礎題
  document.querySelectorAll('.tab').forEach(t => {
    if (t.dataset.category === 'basic') {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

// 呼叫 Firestore 載入任務
loadTasksFromFirestore();

if (name && className) {
  // 顯示在右上角
  document.getElementById("userInfo").textContent = `${name} ｜ ${className}`;
  
  // 可選：存入 localStorage 供未來使用
  localStorage.setItem("user", JSON.stringify({ name, class: className }));
} else {
  // 沒參數就從 localStorage 拿
  const user = JSON.parse(localStorage.getItem("user"));
  if (user) {
    document.getElementById("userInfo").textContent = `${user.name} ｜ ${user.class}`;
  } else {
    window.location.href = "/login.html";
  }
}

// ✅ 切換分類顯示
function showCategory(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  const category = tab.dataset.category;
  renderTasks(category);
}

// ✅ 動態渲染任務卡片
function renderTasks(category) {
  const container = document.getElementById("taskContainer");
  container.innerHTML = '';  // 清空原任務卡片
  const user = JSON.parse(localStorage.getItem("user"));
  (tasksData[category] || []).forEach(task => {
    const card = document.createElement("a");
    card.className = "task-card";
    // card.href = `http://localhost:8060/?p=${task.title}&name=${user.name}&classno=${user.class}&sb3=${encodeURIComponent(task.sb3Path)}`;  // ✅ 開啟的網址
    // card.target = "_blank";                                // ✅ 新分頁開啟
    card.onclick = (e) => {
      e.preventDefault(); // 阻止預設開啟連結
      // 儲存 sb3Path 到 localStorage
      // localStorage.setItem("sb3Path", task.sb3Path || "");
      // 再開啟 Scratch 頁面
      window.open(`http://localhost:8060/?p=${task.title}&name=${user.name}&classno=${user.class}&sb3=${encodeURIComponent(task.sb3Path)}`, "_blank");
    };
    card.style.textDecoration = "none";                    // ✅ 移除連結底線
    card.style.color = "inherit";                          // ✅ 保留文字原色

    const img = document.createElement("img");
    const imageName = task.img && task.img.trim() !== '' ? task.img : 'login.png';
    img.src = `images/${imageName}`;
    // img.src = `images/${task.img || 'login.png'}`;
    img.alt = task.title;
    img.className = "task-image";
    img.onerror = () => {
      img.src = 'images/login.png'; // 圖片載入失敗時改成預設圖
    };

    const content = document.createElement("div");
    content.className = "task-content";
    const descLines = task.desc.split(' ').join('<br>');
    content.innerHTML = `
      <h2>${task.title}</h2>
      <hr>
      <p class="desc-text">${descLines}</p>
    `;

    card.appendChild(img);
    card.appendChild(content);
    container.appendChild(card);
  });
}

// ✅ 顯示使用者資訊
const user = JSON.parse(localStorage.getItem("user"));
if (user) {
  document.getElementById("userInfo").textContent = `${user.name} ｜ ${user.class}`;
} else {
  window.location.href = "/login.html";
}

//把函式手動掛到 window
window.showCategory = showCategory;

// ===================sb3檔載入的遮罩==============
// 1. 原本的旗標
let flag = false;
// 2. 把 flag 暴露出去（方便除錯）
window.getFlag = () => flag;
// ===============================================
// ===================log檔儲存機制 ===============
/**
 * - 暫存資料：管理 logs 陣列。
 * - 計時器管理：統一管理「閒置計時」與「定期儲存」。
 * - 格式化：統一 CSV 格式，避免欄位錯亂。
 * - 上傳：處理 Firebase 上傳與清空暫存。
 */
const LogManager = {
    // --- 設定區 ---
    IDLE_LIMIT: 2 * 60 * 1000,    // 閒置判定時間 (2分鐘)
    AUTO_SAVE_INTERVAL: 5 * 60 * 1000, // 自動儲存間隔 (5分鐘)
    
    // --- 狀態區 ---
    buffer: [],           // 暫存的 log 資料
    idleTimer: null,      // 閒置計時器
    autoSaveTimer: null,  // 定期存檔計時器
    isIdle: false,        // 目前是否處於閒置狀態
    isRestoring: true,  // 預設為 true (鎖定中)，表示正在載入範例檔，不紀錄 Log
    
    // --- 初始化 ---
    init: function() {
        console.log("LogManager 初始化...");
        this.startAutoSave();
        this.resetIdleTimer();
        this.bindUserActivity();
    },

    // --- 核心功能：新增紀錄 ---
    // type: 動作類型 (如 "新增積木", "執行", "閒置")
    // details: 詳細內容 (積木名稱、Snaphost、對話內容)
    // --- 核心功能：新增紀錄 (修正版：加入 code 參數) ---
    // code: 動作代號 (如 "IS", "EP", "ADD", "DEL", "AI")
    // action: 動作名稱 (如 "新增積木", "執行專案")
    // details: 詳細內容
    add: function(code, action, details) {
        const timestamp = new Date();
        const dateStr = `${timestamp.getFullYear()}/${timestamp.getMonth() + 1}/${timestamp.getDate()}`;
        const hours = timestamp.getHours().toString().padStart(2, '0');
        const minutes = timestamp.getMinutes().toString().padStart(2, '0');
        const seconds = timestamp.getSeconds().toString().padStart(2, '0');
        const timeStr = `${hours}:${minutes}:${seconds}`;

        // 統一取得積木數量 (假設您已有 getBlockCount 函式)
        const blockCount = (typeof getBlockCount === 'function') ? getBlockCount() : 0;

        // 組合標準 CSV 格式 (Code, Date, Time, Action, Details, BlockCount)
        // 這裡可以加入一個隨機碼或流水號作為 Code，或留空
        const logEntry = `\n${code},${dateStr},${timeStr},${action},${details},${blockCount}`;
        
        this.buffer.push(logEntry);
        console.log(`[Log] ${action}: ${details}`);

        // 如果使用者有動作，且之前是閒置狀態，記錄「結束閒置」
        if (this.isIdle && action !== 'IS') {
            this.isIdle = false;
            this.add('IS','閒置結束', '使用者恢復操作');
        }
    },

    // --- 核心功能：執行儲存 ---
    save: function(reason) {
        if (this.buffer.length === 0) {
            console.log(`[Save] 觸發原因: ${reason} (無新資料，跳過)`);
            return;
        }

        console.log(`[Save] 正在上傳... 觸發原因: ${reason}`);
        
        // 這裡呼叫您原本的 Firebase 上傳邏輯
        // 注意：要將 this.buffer 傳進去，並在成功後清空
        this.uploadToFirebase(this.buffer).then(() => {
            console.log("[Save] 上傳成功，清空暫存");
            this.buffer = []; // 清空暫存
        }).catch(err => {
            console.error("[Save] 上傳失敗，保留暫存", err);
        });
    },

    // --- 內部邏輯：Firebase 上傳 (整合您原本的 getDbFile 邏輯) ---
    uploadToFirebase: function(logsToSave) {
        const storage = firebase.storage();
        // 根據您的路徑規則
        const filePath = `${localStorage.classno}/${localStorage.username}/Projects/${urlParams.get("p")}/${localStorage.username}_${urlParams.get("p")}.csv`;
        const fileRef = storage.ref(filePath);

        return fileRef.getDownloadURL()
            .then(async (url) => {
                // 1. 舊檔案存在：下載並串接
                const response = await fetch(url);
                const oldContent = await response.text();
                // 這裡做個小檢查：如果讀出來的舊內容開頭已經有 BOM，就不要重複加，避免格式怪異
                // 但通常 response.text() 會自動處理掉 BOM，所以我們儲存時統一加回去比較保險

                const newContent = oldContent + logsToSave.join(" ");

                // 【關鍵修改】在內容最前面加上 "\uFEFF" (BOM)
                const blob = new Blob(["\uFEFF" + newContent], { type: "text/csv;charset=utf-8" });
                return fileRef.put(blob);
            })
            .catch((error) => {
                // 2.檔案不存在，建立新檔
                const header = "\uFEFFCode,Date,Time,Action,Details,BlockCount";
                const newContent = header + logsToSave.join(" ");
                const blob = new Blob(["\uFEFF" + newContent], { type: "text/csv;charset=utf-8" });
                return fileRef.put(blob);
            });
    },

    // --- 計時器邏輯：重置閒置計時 ---
    resetIdleTimer: function() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        
        this.idleTimer = setTimeout(() => {
            this.isIdle = true;
            this.add('IS','閒置狀態', '使用者超過2分鐘無操作');
            this.save('閒置儲存');
        }, this.IDLE_LIMIT);
    },

    // --- 計時器邏輯：定期存檔 ---
    startAutoSave: function() {
        if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
        
        this.autoSaveTimer = setInterval(() => {
            this.save('定期自動儲存(5分鐘)');
        }, this.AUTO_SAVE_INTERVAL);
    },

    // --- 監聽器：綁定使用者活動 ---
    bindUserActivity: function() {
        const activityEvents = ['mousedown', 'keydown', 'touchstart'];
        const _this = this;
        
        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                _this.resetIdleTimer();
            });
        });
        
        // 分頁切換監聽
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                _this.add('PS','分頁切換', '使用者切換到其他視窗');
                _this.save('分頁切換儲存');
            }
            setInterval(updateBlockCountDisplay, 2000); // 每2秒校正一次 (保險機制)
        });
    },

    // --- 新增控制方法：解除載入鎖定 ---
    enableLogging: function() {
        // 稍微延遲一下，確保所有積木都渲染完畢才開啟
        setTimeout(() => {
            this.isRestoring = false;
            console.log("[LogManager] 專案載入完成，開始記錄使用者操作");
            
            // 這裡可以選擇性地清空 Buffer，確保乾淨
            this.buffer = []; 
        }, 1000);
    }
};
// ===============================================
// ============= 更新積木數量與UI的函式 ==============
function getBlockCount() {
    // 防呆：確認 Blockly 是否存在
    if (typeof Blockly === 'undefined' || !Blockly.getMainWorkspace()) {
        return 0;
    }

    const allBlocks = Blockly.getMainWorkspace().getAllBlocks(false);
    
    // ✅ 核心修正：嚴格過濾
    const realBlocks = allBlocks.filter(block => {
        return !block.isShadow() &&           // 排除陰影積木 (輸入框、選單)
               !block.isInsertionMarker();    // 排除拖曳時的預覽殘影
    });
    
    return realBlocks.length;
}

function updateBlockCountDisplay() {
    const BlockCount = getBlockCount();
    // 3. 更新 UI
    const counterEl = document.getElementById("ui-block-counter");
    if (counterEl) {
        counterEl.innerText = BlockCount;
        
        // (選用) 做一個簡單的小動畫，數字變動時閃一下顏色
        counterEl.style.color = "#ffeb3b"; // 變黃色
        setTimeout(() => { counterEl.style.color = "white"; }, 500); // 變回白色
    }
}


// ================================================

const siteUrl = "https://scratch-ct.web.app/"; //(學生端介面)
// const guiUrl = 'http://140.116.226.210:8060/';  //scratch操作介面的網址
const guiUrl = "http://localhost:8060/"; //scratch操作介面的網址
const config = {
    apiKey: "AIzaSyBsdW_1iVQKLv7EPMHyMm7d4Sv95PSWrdM",
    authDomain: "scratch-ct.firebaseapp.com",
    databaseURL: "https://scratch-ct-default-rtdb.firebaseio.com",
    projectId: "scratch-ct",
    storageBucket: "scratch-ct.appspot.com",
    messagingSenderId: "177772303241",
    appId: "1:177772303241:web:2b2fd7beffd8e12a19c758",
};
// 資料庫 API
// npm install -g firebase-tools 下載firebase函式庫
// const firebaseConfig = {
//   apiKey: "AIzaSyBYg4xnd5il5QcsYfJu1Zj89wdoYHqjlAo",
//   authDomain: "scratch-ct-chatbot-2025.firebaseapp.com",
//   projectId: "scratch-ct-chatbot-2025",
//   storageBucket: "scratch-ct-chatbot-2025.firebasestorage.app",
//   messagingSenderId: "890112360772",
//   appId: "1:890112360772:web:7b9911703cbb6f8b171711",
//   databaseURL: "https://scratch-ct-12a21.firebaseio.com"
// };
const firebaseConfig = {
    apiKey: "AIzaSyBYg4xnd5il5QcsYfJu1Zj89wdoYHqjlAo",
    authDomain: "scratch-ct-chatbot-2025.firebaseapp.com",
    projectId: "scratch-ct-chatbot-2025",
    storageBucket: "scratch-ct-chatbot-2025.firebasestorage.app",
    messagingSenderId: "890112360772",
    appId: "1:890112360772:web:7b9911703cbb6f8b171711",
    databaseURL: "https://scratch-ct-12a21.firebaseio.com"
};
//http://localhost:8060/?p=xxx&name=student1&classno=control&sb3=sb3_files/xxx.sb3
// 讀取學生資料庫資料
firebase.initializeApp(firebaseConfig); //做firebase初始化的設定
localStorage.clear(); //將本地端的設定清除
// let logs = []; //宣告logs陣列來儲存資料
var clickCatTimes = 0; //宣告點擊程式事件次數
var handsUpTimes = 0; //宣告舉手次數
let urlParams = new URLSearchParams(window.location.search); //宣告一個物件來取得網頁url的參數(classno=null&no=null&name=null&p=test&i=null)
//設定網頁的url參數，這樣做的目的是為了將這些查詢參數的值存儲在本地存儲中，以便在頁面加載時或之後的操作中可以輕鬆地讀取和使用這些值。例如，如果需要將這些值傳遞給後端服務器，可以從本地存儲中獲取它們。
identity = urlParams.get("i");
localStorage.identity = identity;

classno = urlParams.get("classno");
localStorage.classno = classno;

userno = urlParams.get("no");
localStorage.no = userno;

example = urlParams.get("ex");
localStorage.example = example;

token = urlParams.get("token");
localStorage.token = token;
//name 學生姓名(學生帳號)
username = urlParams.get("name");
localStorage.username = username;
//p 任務名稱
ProjName = urlParams.get("p");
localStorage.ProjName = ProjName;
//sb3 檔案名稱
sb3Path = urlParams.get("sb3");
localStorage.sb3Path = sb3Path;
//如果沒有userno會導回登入介面https://mmn.easylearn.org/
// if (userno == null) {
//     window.location.href = siteUrl + '/Login';
// }

// 頁面一開始先隱藏 body，避免閃爍
// const style = document.createElement("style");
// style.innerHTML = `
//   body {
//     visibility: unvisabile;
//   }
// `;
// document.head.appendChild(style);

// ================== Loading 遮罩相關 ==================


// ⭐ 確保樣式和節點都存在
function ensureLoadingOverlay() {
    injectLoadingStyles();
    setupLoadingOverlay();
}

// 對外提供控制函式（給 sb-file-uploader2.jsx 呼叫）
window.showLoading = function () {
    // 每次顯示前都確保 overlay 已經準備好
    // ensureLoadingOverlay();
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
};

window.hideLoading = function () {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
};

// 如果此時文件已經載入完成，也主動初始化一次
// if (document.readyState === 'complete' || document.readyState === 'interactive') {
//     // ensureLoadingOverlay();
// } else {
//     window.addEventListener('load', ensureLoadingOverlay);
// }
// 顯示內容並移除遮罩的函式
window.revealInterface = function() {
    const overlay = document.getElementById('static-loading-overlay');
    const appRoot = document.getElementById('react-root'); // 或 document.body

    if (overlay) {
        // 1. 遮罩淡出
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.5s ease';
        
        // 2. 內容淡入
        // if(appRoot) appRoot.style.opacity = '1';

        // 3. 動畫結束後移除節點，避免擋住滑鼠點擊
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 500);
    }
};

// 綁定到原本的 hideLoading 接口 (相容舊程式)
window.hideLoading = window.revealInterface;

// 綁定到 onSb3Loaded (確保 sb3 載入後才開燈)
window.onSb3Loaded = function () {
    flag = true;
    console.log('[script3] sb3 載入成功，準備顯示介面');
    // 1. 移除遮罩
    window.revealInterface();
    // 2. 【新增】解除 Log 鎖定，開始記錄學生操作
    LogManager.enableLogging();
    // 3.  載入完成後，立刻更新一次積木數量
    updateBlockCountDisplay();
};

// =====================================================


//$(document)類似window.document
//要用JavaScript操縱網頁的DOM元素時，必須等網頁完全載入後才可安全地進行操作，而要確保網頁載入，可使用jQuery的$( document ).ready()
//$( document ).on():當頁面動態更新時，新載入的元素還是有綁訂到上面
$(document).ready(function () {
    const style = document.createElement("style");
    style.innerHTML = `
    body {
        visibility: unvisible;
    }
    `;
    LogManager.init(); // 啟動管理器
    document.head.appendChild(style);
    $(document).on("keydown", disableF5); //禁用F5更新功能
    $(document).on("keydown", enableSpace); //當按下空白鍵時會被觸發
    // checkExample();
    // document.getElementsByClassName('menu_menu-item_3EwYA menu_hoverable_3u9dt menu_menu-section_2U-v6')[1].setAttribute('onclick', 'checkLoadProjName(ProjName)');
    // checkProjName();
    // 載入sb3檔案
    eventCore();
    removeUI();
    createUI();
    createChat()
    changeScratchUI();
    // createFindBlockUI()
    // if (identity != "t") {
    //     ipBoo();
    // }
    // handsUpBoo();
    // newUrlBoo();

    document
        .getElementsByClassName("menu_menu-item_3EwYA menu_hoverable_3u9dt")[3]
        .click();
    // 如果是測試用的，會將專案名稱、教程隱藏
    if (identity == "t") {
        document.getElementsByClassName(
            "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
        )[1].style.display = "none";
        document.getElementsByClassName(
            "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
        )[2].style.display = "none";
        document.getElementsByClassName(
            "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
        )[3].style.display = "none";
    }
    document.title = urlParams.get("p"); //將網頁的title命名為專案名稱
    /**
     * loading 遮罩相關
     */
    // 【新增這段】保險機制：如果是新建專案 (沒有 p 或 ex 參數)，直接顯示介面
    // 避免因為沒有觸發載入事件而一直卡在遮罩
    if (!urlParams.get("p") && !urlParams.get("ex")) {
        console.log("沒有指定專案檔 (新建專案模式)，直接顯示介面");
        // 稍微延遲一下，確保 UI 修改 (removeUI/createUI) 都執行完了再開燈
        setTimeout(window.revealInterface, 500); 
    }
    // 檢查是否為新建專案 (沒有指定 sb3)
    if (!urlParams.get("p") && !urlParams.get("ex") && !urlParams.get("sb3")) {
        console.log("新建專案模式，直接啟用 Log");
        
        window.revealInterface(); // 移除遮罩
        LogManager.enableLogging(); // 【新增】直接解鎖，因為沒有積木要載入
    }
    // document.body.style.visibility = "visible";
    // const script1 = document.createElement('script');
    // script1.src = "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js";
    // document.head.appendChild(script1);

    // const script2 = document.createElement('script');
    // script2.src = "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js";
    // document.head.appendChild(script2);

});

function addmissioncard() {
    var missioncard = document.createElement("div");
    classname.setAttribute("id", "classname");
    classname.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    classname.textContent = "班級： " + classno;
    menubarL2.appendChild(classname);
}

// 更改Scratch UI
function changeScratchUI() {
    //移除檔案按鈕
    // $(".stage-header_stage-size-row_14N65").remove();
    // document.getElementsByClassName(
    //     "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
    // )[1].style.display = "none";
    //移除編輯
    document.getElementsByClassName(
        "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
    )[2].style.display = "none";
    //移除儲存並下載檔案
    document.getElementsByClassName(
        "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
    )[3].style.display = "none";
    //移除教程按鈕
    document.getElementsByClassName(
        "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
    )[4].style.display = "none";
    //移除舞台上方按鈕
    $(".stage-header_stage-size-row_14N65").remove();
    //更改網頁最上方的顏色
    $(".menu-bar_main-menu_3wjWH").css("background-color", "#b366ff");
    $(".menu-bar_account-info-group_MeJZP").css("background-color", "#b366ff");
    // stage_button.style.display = 'none';

}

// ======================== 高亮程式積木功能 =========================

/***** ===== 純函式版：根據 data-id 定位並高亮積木 ===== *****/

/** 1) Scratch 3.0 opcode => 類別對照表（沿用/擴充你的版本） */
const BLOCK_CATEGORY_MAP = {
    // Motion 動作
    "motion_movesteps": "motion",
    "motion_turnright": "motion",
    "motion_turnleft": "motion",
    "motion_goto": "motion",
    "motion_gotoxy": "motion",
    "motion_glideto": "motion",
    "motion_glidesecstoxy": "motion",
    "motion_pointindirection": "motion",
    "motion_pointtowards": "motion",
    "motion_changexby": "motion",
    "motion_setx": "motion",
    "motion_changeyby": "motion",
    "motion_sety": "motion",
    "motion_ifonedgebounce": "motion",
    "motion_setrotationstyle": "motion",
    "motion_xposition": "motion",
    "motion_yposition": "motion",
    "motion_direction": "motion",

    // Looks 外觀
    "looks_sayforsecs": "looks",
    "looks_say": "looks",
    "looks_thinkforsecs": "looks",
    "looks_think": "looks",
    "looks_show": "looks",
    "looks_hide": "looks",
    "looks_switchcostumeto": "looks",
    "looks_nextcostume": "looks",
    "looks_switchbackdropto": "looks",
    "looks_nextbackdrop": "looks",
    "looks_changesizeby": "looks",
    "looks_setsizeto": "looks",
    "looks_changeeffectby": "looks",
    "looks_seteffectto": "looks",
    "looks_cleargraphiceffects": "looks",
    "looks_gotofrontback": "looks",
    "looks_goforwardbackwardlayers": "looks",
    "looks_costumenumbername": "looks",
    "looks_backdropnumbername": "looks",
    "looks_size": "looks",

    // Sound 聲音
    "sound_playuntildone": "sound",
    "sound_play": "sound",
    "sound_stopallsounds": "sound",
    "sound_setvolumeto": "sound",
    "sound_changevolumeby": "sound",
    "sound_volume": "sound",
    "sound_seteffectto": "sound",
    "sound_changeeffectby": "sound",
    "sound_cleareffects": "sound",

    // Events 事件
    "event_whenflagclicked": "events",
    "event_whenkeypressed": "events",
    "event_whenthisspriteclicked": "events",
    "event_whenbackdropswitchesto": "events",
    "event_whengreaterthan": "events",
    "event_broadcast": "events",
    "event_broadcastandwait": "events",

    // Control 控制
    "control_wait": "control",
    "control_repeat": "control",
    "forever": "control",
    "control_if": "control",
    "control_if_else": "control",
    "control_wait_until": "control",
    "control_repeat_until": "control",
    "control_stop": "control",
    "control_create_clone_of": "control",
    "control_delete_this_clone": "control",
    "control_start_as_clone": "control",

    // Sensing 偵測
    "sensing_touchingobject": "sensing",
    "sensing_touchingobjectmenu": "sensing",
    "sensing_touchingcolor": "sensing",
    "sensing_coloristouchingcolor": "sensing",
    "sensing_distanceto": "sensing",
    "sensing_distancetomenu": "sensing",
    "sensing_askandwait": "sensing",
    "sensing_answer": "sensing",
    "sensing_keypressed": "sensing",
    "sensing_mousedown": "sensing",
    "sensing_mousex": "sensing",
    "sensing_mousey": "sensing",
    "sensing_setdragmode": "sensing",
    "sensing_loudness": "sensing",
    "sensing_timer": "sensing",
    "sensing_resettimer": "sensing",
    "sensing_of": "sensing",
    "sensing_current": "sensing",
    "sensing_dayssince2000": "sensing",
    "sensing_username": "sensing",

    // Operators 運算
    "operator_add": "operators",
    "operator_subtract": "operators",
    "operator_multiply": "operators",
    "operator_divide": "operators",
    "operator_random": "operators",
    "operator_gt": "operators",
    "operator_lt": "operators",
    "operator_equals": "operators",
    "operator_and": "operators",
    "operator_or": "operators",
    "operator_not": "operators",
    "operator_join": "operators",
    "operator_letter_of": "operators",
    "operator_length": "operators",
    "operator_contains": "operators",
    "operator_mod": "operators",
    "operator_round": "operators",
    "operator_mathop": "operators",

    // Data 變數/清單
    "data_variable": "data",
    "data_setvariableto": "data",
    "data_changevariableby": "data",
    "data_showvariable": "data",
    "data_hidevariable": "data",
    "data_listcontents": "data",
    "data_addtolist": "data",
    "data_deleteoflist": "data",
    "data_deletealloflist": "data",
    "data_insertatlist": "data",
    "data_replaceitemoflist": "data",
    "data_itemoflist": "data",
    "data_lengthoflist": "data",
    "data_listcontainsitem": "data",
    "data_showlist": "data",
    "data_hidelist": "data",

    // My Blocks 自訂積木
    "procedures_definition": "procedures",
    "procedures_call": "procedures",
    "procedures_prototype": "procedures"
};

/** 2) 推論分類（用字典；找不到就預設 motion 避免報錯） */
function inferCategoryFromId(blockId) {
    return BLOCK_CATEGORY_MAP[blockId] || "motion";
}

/** 3) 用「點擊」切換分類（確保 Blockly 真的渲染 flyout） */
async function openCategoryByClick(catId) {
    const sel = `.scratchCategoryMenu .scratchCategoryId-${catId}`;
    let el = document.querySelector(sel);
    if (!el) {
        const all = Array.from(document.querySelectorAll(".scratchCategoryMenu .scratchCategoryMenuItem"));
        el = all.find(x =>
            x.classList.contains(`scratchCategoryId-${catId}`) ||
            x.id === catId ||
            (x.textContent || "").trim().toLowerCase().includes(catId)
        ) || null;
    }
    if (el) {
        el.click();
        await new Promise(r => setTimeout(r, 160)); // 等待 flyout 重繪
        return true;
    }
    return false;
}

/** 4) 捲動：先點分類，再把目標積木頂端貼齊（避免過頭） */
async function scrollBlockToTopAfterClick(blockId, catId, { topPadding = 10 } = {}) {
    const opened = await openCategoryByClick(catId);
    if (!opened) return false;

    await new Promise(r => setTimeout(r, 30));
    await waitFor(() => !!document.querySelector(`.blocklyFlyout g[data-id="${blockId}"]`), 800);

    const ws = window.Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
    const toolbox = ws && (ws.getToolbox ? ws.getToolbox() : ws.toolbox_);
    const flyout = toolbox && (toolbox.getFlyout ? toolbox.getFlyout() : (ws && ws.getFlyout ? ws.getFlyout() : null));
    const fws = flyout && (flyout.getWorkspace ? flyout.getWorkspace() : flyout.workspace_);
    const fblock = fws && fws.getBlockById && fws.getBlockById(blockId);

    if (!(flyout && fws && fblock)) {
        const el = document.querySelector(`.blocklyFlyout g[data-id="${blockId}"]`);
        return el ? domScrollToTop(el, topPadding) : false;
    }

    const scale = Number(fws.scale || 1);
    const xy = fblock.getRelativeToSurfaceXY(); // 未縮放
    const yPx = xy.y * scale;

    const m = (flyout.getMetrics && flyout.getMetrics()) || (flyout.getMetrics_ && flyout.getMetrics_()) || {};
    const viewH = Number(m.viewHeight || m.height || 0);
    const contentH = Number(m.contentHeight || 0);
    const contentTop = Number(m.contentTop || 0);

    let targetY = Math.max(0, (yPx - contentTop) - topPadding);
    if (viewH > 0 && contentH > 0) {
        const maxScrollY = Math.max(0, contentH - viewH);
        if (!Number.isFinite(targetY)) targetY = 0;
        targetY = Math.min(Math.max(0, targetY), maxScrollY);
    } else {
        targetY = Math.max(0, targetY);
    }

    if (flyout.scrollbar_?.set) {
        flyout.scrollbar_.set(targetY);
    } else if (flyout.scrollbar?.set) {
        flyout.scrollbar.set(targetY);
    } else if (flyout.setScrollY) {
        flyout.setScrollY(targetY);
    } else {
        const el = document.querySelector(`.blocklyFlyout g[data-id="${blockId}"]`);
        return el ? domScrollToTop(el, topPadding) : false;
    }
    return true;

    // ---- helpers ----
    function domScrollToTop(el, padding) {
        const host =
            findScrollableAncestor(el) ||
            document.querySelector(".blocklyFlyout")?.closest(".injectionDiv, .blocklyWorkspace, .blocklyFlyout") ||
            document.scrollingElement;

        if (!host) return false;

        const elRect = el.getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        let targetTop = host.scrollTop + (elRect.top - hostRect.top) - padding;

        const maxTop = Math.max(0, host.scrollHeight - host.clientHeight);
        if (!Number.isFinite(targetTop)) targetTop = 0;
        targetTop = Math.min(Math.max(0, targetTop), maxTop);

        try { host.scrollTo({ top: targetTop, behavior: "smooth" }); }
        catch { host.scrollTop = targetTop; }
        return true;
    }

    function findScrollableAncestor(node) {
        let n = node;
        while (n && n !== document.body) {
            if (n instanceof Element) {
                const s = getComputedStyle(n);
                const oy = s.overflowY || s.overflow;
                if (/(auto|scroll)/i.test(oy || "") && n.scrollHeight > n.clientHeight) return n;
            }
            n = n.parentNode;
        }
        return null;
    }

    function waitFor(predicate, timeoutMs = 600) {
        return new Promise((resolve) => {
            const t0 = performance.now();
            (function loop() {
                if (predicate()) return resolve(true);
                if (performance.now() - t0 > timeoutMs) return resolve(false);
                requestAnimationFrame(loop);
            })();
        });
    }
}

/** 5) 視覺效果：可選 blink / outline / spotlight */
// function blinkSvg(el, { times = 6, interval = 220 } = {}) {
//     let on = false, count = 0;
//     const orig = el.style.filter || "";
//     const timer = setInterval(() => {
//         on = !on;
//         el.style.filter = on ? "brightness(1.6) drop-shadow(0 0 6px gold)" : orig;
//         count++;
//         if (count >= times) {
//             clearInterval(timer);
//             el.style.filter = orig;
//         }
//     }, interval);
// }
function blinkSvg(el, { times = 8, interval = 300 } = {}) {
    let on = false, count = 0;
    const orig = el.style.filter || "";
    const timer = setInterval(() => {
        on = !on;
        el.style.filter = on
            ? "drop-shadow(0 0 15px #FFD700) brightness(1.8)"
            : orig;
        count++;
        if (count >= times) {
            clearInterval(timer);
            el.style.filter = orig;
        }
    }, interval);
}
function outlineBlock(el) {
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const bbox = el.getBBox();
    outline.setAttribute("x", bbox.x - 3);
    outline.setAttribute("y", bbox.y - 3);
    outline.setAttribute("width", bbox.width + 6);
    outline.setAttribute("height", bbox.height + 6);
    outline.setAttribute("rx", 8);
    outline.setAttribute("ry", 8);
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", "#FFD700");
    outline.setAttribute("stroke-width", "4");
    outline.setAttribute("stroke-dasharray", "8 3");
    outline.classList.add("block-outline");
    el.appendChild(outline);
    outline.animate([{ opacity: 1 }, { opacity: 0.8 }, { opacity: 0 }], { duration: 3000, easing: "ease-out" })
        .onfinish = () => outline.remove();
}

function spotlightBlock(el) {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.6)",
        zIndex: 9999, pointerEvents: "none"
    });
    const rect = el.getBoundingClientRect();
    const hole = document.createElement("div");
    Object.assign(hole.style, {
        position: "absolute",
        left: `${rect.left - 20}px`, top: `${rect.top - 20}px`,
        width: `${rect.width + 40}px`, height: `${rect.height + 40}px`,
        borderRadius: "20px", boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
        pointerEvents: "none"
    });
    overlay.appendChild(hole);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.remove(), 2200);
}

/** 6) 對外主函式：需要時呼叫它即可 */
async function highlightBlockById(blockId, options = {}) {
    const { effect = "spotlight", topPadding = 10 } = options;
    if (!blockId || typeof blockId !== "string") {
        console.warn("[highlightBlockById] 需要正確的 blockId (data-id)");
        return false;
    }
    const cat = inferCategoryFromId(blockId);
    const ok = await scrollBlockToTopAfterClick(blockId, cat, { topPadding });
    if (!ok) {
        console.warn(`[highlightBlockById] 找不到積木或分類：${blockId} / ${cat}`);
        return false;
    }
    const target =
        document.querySelector(`.blocklyFlyout g[data-id="${blockId}"]`) ||
        document.querySelector(`.blocklyFlyout .blocklyDraggable[data-id="${blockId}"]`);
    if (!target) return false;

    // 套用效果
    if (effect === "blink") {
        blinkSvg(target);
    }
    else if (effect === "outline") {
        outlineBlock(target);
    }
    else if (effect === "spotlight") {
        // 👉 改成同時使用 spotlight + blink
        spotlightBlock(target);
        blinkSvg(target);
    }

    return true;
}
/* ========= {可有可無} 工具：提示泡泡(Message) => 輸入後顯示訊息 ========= */
function toast(msg) {
    const div = document.createElement("div");
    div.textContent = msg;
    Object.assign(div.style, {
        position: "fixed", top: "72px", right: "12px", zIndex: 10002,
        background: "#111", color: "#fff", padding: "8px 12px",
        borderRadius: "10px", opacity: "0", transition: "opacity .2s ease"
    });
    document.body.appendChild(div);
    requestAnimationFrame(() => div.style.opacity = "0.95");
    setTimeout(() => { div.style.opacity = "0"; setTimeout(() => div.remove(), 250); }, 1800);
}

// ------------------------------------------------------


// ----------------------Gemini--------------------------------
// gemini 返回訊息
async function getBotResponse(userMessage) {
    const apiKey = "AIzaSyAHBZiVVBn1owVUNFA1fHK95PCZ0RnDww4";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const systemPrompt = `
你是一位 Scratch 教學助教，負責輔導小學生學習程式設計。

你的任務是依照 CT 四大技能（分解、模式識別、抽象化、演算法思維）引導學生完成任務。

請不要直接給答案，而是透過提問與提示幫助學生思考。例如：
-「這題你可以分成幾個步驟？」
-「角色有沒有重複做某些動作？」
-「這個動作要做幾次？可以用什麼積木？」

請使用淺顯易懂的語言，並保持鼓勵與耐心。
`;
    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: systemPrompt + userMessage
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        const data = await response.json();
        const botMessage = data.candidates[0].content.parts[0].text;
        console.log(botMessage);
        return botMessage;
    } catch (error) {
        console.error("Error:", error);
    }
}

// 使用者傳送訊息到Gemini
async function sendMessage() {
    const userMessage = document.getElementById("message-input").value.trim();
    if (userMessage) {
        appendMessage(userMessage, "user");
        document.getElementById("message-input").value = "";
        const response = await getBotResponse(userMessage);
        LogManager.add("AI", "AI_QA", `問:${userMessage} | 答:${response}`);
        LogManager.save("對話後儲存");
        setTimeout(() => appendMessage(`${response}`, "bot"), 1000);
    }
}

// ======================= 聊天機器人視窗 =====================================

/**
* 顯示訊息在聊天室視窗
* 用法 : appendMessage("訊息","user"/"bot")
*/

function appendMessage(text, sender) {
    const chatMessages = document.getElementById('chat-messages');

    const row = document.createElement('div');
    row.className = `message-container ${sender}`;

    const botimg = '/static/images/bot.png';
    const userimg = '/static/images/kitty.png';

    const avatar = document.createElement('img');
    avatar.className = 'avatar';
    avatar.src = sender === 'bot' ? botimg : userimg;
    avatar.alt = sender === 'bot' ? 'bot' : 'me';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text; // 如果之後要支援換行/連結，可改成 innerHTML（注意安全）

    if (sender === 'user') {
        row.appendChild(bubble);
        row.appendChild(avatar);
    } else {
        row.appendChild(avatar);
        row.appendChild(bubble);
    }

    chatMessages.appendChild(row);
    // 自動滑到底
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ===== 取代原本的 createChatroom()，把「浮動視窗」改成「右側面板」 =====
function createChat() {
    // 避免重複建立
    if (document.getElementById("chat-container")) return;

    // 找到 Scratch GUI 的主要 flex wrapper
    const flexWrapper = document.querySelector('.gui_flex-wrapper_uXHkj.box_box_2jjDp');
    if (!flexWrapper) {
        console.warn('找不到 .gui_flex-wrapper_uXHkj.box_box_2jjDp，稍後再試');
        return;
    }

    // 建立右側面板
    const chatPanel = document.createElement('div');
    chatPanel.id = 'chat-container';
    chatPanel.style.display = 'flex';
    chatPanel.style.flexDirection = 'column';
    chatPanel.style.flex = '0 0 320px'; // 固定寬度
    chatPanel.style.height = '100%';
    chatPanel.style.background = '#ffffff';
    chatPanel.style.borderLeft = '2px solid #ddd';
    chatPanel.style.boxSizing = 'border-box';
    chatPanel.style.padding = '8px';
    chatPanel.style.minWidth = '280px';
    chatPanel.style.maxWidth = '420px';
    chatPanel.style.zIndex = '1';

    // header
    const header = document.createElement('div');
    header.id = 'chat-header';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '6px 8px';
    header.style.background = '#4c97ff';
    header.style.color = '#fff';
    header.style.borderRadius = '8px';
    header.style.marginBottom = '8px';
    header.innerHTML = `<span>運算思維小幫手</span>`;

    // 訊息列表
    const messages = document.createElement('div');
    messages.id = 'chat-messages';
    messages.style.flex = '1';
    messages.style.overflowY = 'auto';
    messages.style.background = 'url("/static/images/messages_light_colour_background.jpg")';
    messages.style.backgroundSize = 'cover';     // 或 'contain'
    messages.style.backgroundRepeat = 'repeat';  // 這張圖適合 repeat
    messages.style.backgroundPosition = 'center';
    messages.style.backgroundPosition = 'top left';
    messages.style.backgroundAttachment = 'fixed'; // 視窗捲動時背景固定（有淡淡浮動感）
    messages.style.borderRadius = '8px';
    messages.style.padding = '8px';

    // 輸入列
    const inputRow = document.createElement('div');
    inputRow.style.display = 'flex';
    inputRow.style.gap = '8px';
    inputRow.style.marginTop = '8px';

    const input = document.createElement('input');
    input.id = 'message-input';
    input.type = 'text';
    input.placeholder = '輸入訊息...';
    input.style.flex = '1';
    input.style.padding = '8px';

    const sendBtn = document.createElement('button');
    sendBtn.id = 'send-button';
    sendBtn.textContent = '送出';
    sendBtn.style.border = 'none';
    sendBtn.style.padding = '8px 12px';
    sendBtn.style.cursor = 'pointer';
    sendBtn.innerHTML = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path>
  </svg>
`;
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);

    chatPanel.appendChild(header);
    chatPanel.appendChild(messages);
    chatPanel.appendChild(inputRow);

    // 真的掛上去並壓縮左側/中間寬度
    mountChatPanel(flexWrapper, chatPanel);

    // 綁定你原本的傳送流程（保留舊的 sendMessage / appendMessage / getBotResponse）
    const sendHandler = () => window.sendMessage && window.sendMessage();
    sendBtn.addEventListener('click', sendHandler);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendHandler();
    });

}

// ===== 把面板掛到右側並調整舞台/編輯區寬度 =====
function mountChatPanel(flexWrapper, chatPanel) {
    // 先掛上去
    flexWrapper.appendChild(chatPanel);

    const editorWrapper = flexWrapper.querySelector('.gui_editor-wrapper_2DYcj.box_box_2jjDp');
    const stageWrapper = flexWrapper.querySelector('gui_stage-and-target-wrapper_69KBf.gui_large_yTJBa.box_box_2jjDp');

    // --- 關鍵：把容器方向強制為 row（由左到右） ---
    flexWrapper.style.flexDirection = 'row';

    // 寬度配置
    chatPanel.style.flex = '0 0 400px';
    chatPanel.style.flexShrink = '0';
    chatPanel.style.position = 'static';
    chatPanel.style.margin = '0';

    if (editorWrapper) {
        editorWrapper.style.flex = '1 1 60%';
        editorWrapper.style.minWidth = '420px';
    }
    if (stageWrapper) {
        stageWrapper.style.flex = '0 1 34%';
        stageWrapper.style.minWidth = '360px';
    }

    // --- 明確指定順序：舞台(0)｜積木區(1)｜聊天室(2) ---
    if (stageWrapper) stageWrapper.style.order = 0;
    if (editorWrapper) editorWrapper.style.order = 1;
    chatPanel.style.order = 2;

    // 編輯區避免被覆蓋 & 正確縮放
    if (editorWrapper) {
        editorWrapper.style.overflow = 'hidden';
        editorWrapper.style.boxSizing = 'border-box';
    }

    // 聊天室不要用浮動定位，維持 flex 區塊就好
    chatPanel.style.position = 'relative';
    chatPanel.style.zIndex = '0';
    injectChatCSS()
    // … 你原本的 order / flex 設置 …
    forceRelayout();

}

// ===== 強制重算：避免初次載入時編輯區被遮到，要手動觸發 layout/resize =====
function forceRelayout() {
    const flexWrapper = document.querySelector('.gui_body-wrapper_-N0sA'); // 你的最外層 flex 容器（依實際 class）
    if (!flexWrapper) return;

    // 1) 先讀一次幾何屬性，強制 reflow
    void flexWrapper.offsetHeight;

    // 2) 觸發瀏覽器與 React 內部的 resize 邏輯
    setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
        try {
            // 3) 通知 Blockly/Scratch 編輯區更新尺寸
            const ws = window.Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
            if (ws && Blockly.svgResize) Blockly.svgResize(ws);
            // Scratch GUI 對舞台與目標區也常用這個
            if (ws && ws.resizeContents) ws.resizeContents();
        } catch (e) {
            console.warn('[forceRelayout] resize error:', e);
        }
    }, 0);
}
// ============ 聊天室內的CSS ==============
function injectChatCSS() {
    const style = document.createElement('style');
    style.id = 'chat-style';
    style.textContent = `
  /* 面板本身 */
  #chat-panel { display:flex; flex-direction:column; height:100%; min-width:300px; }
  #chat-messages {
    flex: 1 1 auto;
    overflow-y: auto;
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fafafa;
    border-left: 1px solid #eee;
  }
  #chat-input-bar { display:flex; gap:8px; padding:10px; border-top:1px solid #eee; background:#fff; }
  #message-input { flex:1 1 auto; height:36px; padding:8px 10px; border:1px solid #ddd; border-radius:8px; outline:none; }
  #send-btn { padding:8px 12px; border:0; border-radius:8px; background:#7c3aed; color:#fff; cursor:pointer; }

  /* 訊息列 */
  .message-container { display:flex; align-items:flex-end; gap:8px; max-width:100%; }
  .message-container.user { justify-content:flex-end; }
  .message-container.bot { justify-content:flex-start; }

  /* 頭像 */
  .message-container .avatar {
    width:40px; height:40px; border-radius:50%; flex:0 0 28px;
    box-shadow: 0 1px 2px rgba(0,0,0,.15);
  }
  .message-container.user .avatar { order:2; } /* 使用者頭像在右邊 */
  .message-container.user .bubble { order:1; }

  /* 泡泡 */
  .bubble {
    max-width: 72%;
    padding: 8px 12px;
    border-radius: 14px;
    line-height: 1.45;
    box-shadow: 0 1px 2px rgba(0,0,0,.08);
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: pre-wrap; /* 保留換行 */
    background: #fff;
    border: 1px solid #eee;
  }
  .message-container.user .bubble {
    background: #e9f2ff; border-color:#d6e6ff;
    border-top-right-radius: 6px; border-top-left-radius:14px;
  }
  .message-container.bot .bubble  {
    background: #ffffff; border-top-left-radius: 6px; border-top-right-radius:14px;
  }

  /* 內嵌圖片/程式碼等的保護 */
  .bubble img { max-width:100%; height:auto; border-radius:6px; }
  .bubble code, .bubble pre { white-space: pre-wrap; word-break: break-word; }
  /* 輸入列容器：排成一行、留一點間距 */
  #chat-input { 
    display:flex; 
    align-items:center; 
    gap:10px; 
    padding:10px; 
  }

  /* 膠囊輸入框 */
  #message-input{
    flex:1;
    height:44px;
    padding:0 16px;
    border:1px solid rgba(0,0,0,.10);
    border-radius:9999px;
    background:#fff;
    font-size:16px;
    outline:none;
    box-shadow:
      0 1px 2px rgba(0,0,0,.06) inset,
      0 1px 2px rgba(0,0,0,.08);
  }
  #message-input::placeholder{ color:#9aa3af; }

  /* 藍色圓形送出鈕（支援 #send-button 與 #send-btn 兩種 id） */
  #send-button, #send-btn{
    flex:0 0 44px;
    width:44px; height:44px;
    border:none; border-radius:50%;
    background:#1a73e8;  /* 主藍 */
    color:#fff;
    display:flex; align-items:center; justify-content:center;
    cursor:pointer;
    box-shadow:0 4px 10px rgba(26,115,232,.35);
    transition:transform .04s ease, box-shadow .2s ease, background .2s ease;
  }
  #send-button:hover, #send-btn:hover{
    background:#1b66c9;
    box-shadow:0 6px 14px rgba(26,115,232,.45);
  }
  #send-button:active, #send-btn:active{ transform:translateY(1px); }

  /* 若按鈕裡是 SVG/字，都會自動置中 */
  #send-button svg, #send-btn svg{ width:18px; height:18px; fill:currentColor; }

  /* 小尺寸裝置微調 */
  @media (max-width:640px){
    #message-input{ height:40px; }
    #send-button, #send-btn{ width:40px; height:40px; }
  }
  `;
    document.head.appendChild(style);
}

// 從 Firebase Storage 載入 sb3 檔案並觸發 Scratch GUI 的自動匯入
function loadProjectFromSb3() {
    // ✅ 從網址參數取得 sb3 檔案路徑（已經 URL 編碼）
    // const sb3Path = urlParams.get("sb3");
    if (!sb3Path) {
        console.log("沒有 sb3 參數，跳過載入");
        return; // 沒有 sb3，就不載入
    }

    console.log("指定的 sb3 路徑為：", sb3Path);

    // ✅ 從 Firebase Storage 取得檔案參考
    const fileRef = firebase.storage().ref(decodeURIComponent(sb3Path)); // decodeURIComponent 轉回原始路徑

    // ✅ 使用 Firebase 的 getDownloadURL 取得下載連結
    fileRef.getDownloadURL().then(sb3Url => {
        console.log("sb3 下載連結為：", sb3Url);

        // ✅ 下載 sb3 檔案（以 blob 格式）
        fetch(sb3Url)
            .then(res => res.blob())
            .then(blob => {
                // ✅ 將 blob 轉為 JavaScript 的 File 物件（模擬使用者上傳檔案）
                const file = new File([blob], "project.sb3", {
                    type: "application/octet-stream"
                });

                // ✅ 使用 DataTransfer API 模擬選檔事件
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);

                // ✅ 找到 Scratch GUI 中的 input[type="file"]，也就是「從電腦選擇」按鈕背後的 input 元素
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) {
                    // ✅ 將我們準備好的 sb3 檔案指定給這個 input
                    fileInput.files = dataTransfer.files;

                    // ✅ 觸發 change 事件，讓 Scratch GUI 自動匯入這個 sb3
                    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

                    console.log("✅ 成功觸發 Scratch GUI 載入 .sb3");
                } else {
                    console.error("❌ 找不到 Scratch 的 input[type=file] 元素");
                }
            });
    }).catch(error => {
        // ❌ 若 Firebase 檔案不存在，或下載失敗
        console.error("❌ 無法取得 Firebase 檔案：", error);
    });
}

// ==============================================

//紀錄按下空白鍵的log
function enableSpace(e) {
    //e.which || e.keyCode:哪個鍵被按下，會回傳鍵的按鍵碼
    if ((e.which || e.keyCode) == 32) {
        console.log("空白鍵被按下");
        /**
         * 待更新.....
         */
        // logs.push(`\n${getDate()},${getTime()},執行,點擊透過空白鍵執行`);
        // saveLastWorkSpace();
        // Object.keys(localStorage).forEach(function (key) {
        //     //檢查所有localstorage的鍵
        //     if (/^sprite:/.test(key)) {
        //         //檢查每個鍵是否以"sprite:"字串開頭
        //         console.log("\n" + key + "\n " + localStorage[key]);
        //         logs.push(
        //             `\nEP,${getDate()},${getTime()},執行,點擊透過空白鍵執行 ${key}工作區：${localStorage[key]
        //             }`
        //         );
        //         getDbFile(); //將log傳到資料庫儲存起來
                
        //     }
        // });
    }
}
//編寫停用F5更新的事件
//function disableF5(e) { if ((e.which || e.keyCode) == 116 || (e.which || e.keyCode) == 82) e.preventDefault(); };  //e.preventDefault():停止事件的默認動作
function disableF5(e) {
    if ((e.which || e.keyCode) == 116) e.preventDefault();
} //e.preventDefault():停止事件的默認動作

//回傳當下的年月日
function getDate() {
    let d = new Date();
    let getDate =
        d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
    return getDate;
}

//回傳當下的時分秒
function getTime() {
    let d = new Date();
    let getTime = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
    return getTime;
}

//檢查是否有輸入專案名稱(已存在舊專案)
function checkExample() {
    if (
        example != null &&
        (ProjName == null || ProjName == "" || ProjName == "null")
    ) {
        do {
            ProjName = prompt("請輸入新專案名稱", "");
            localStorage.ProjName = ProjName;
            window.location.href = `${guiUrl}?ex=${example}&classno=${classno}&no=${userno}&name=${username}&p=${ProjName}&i=${identity}`;
        } while (
            localStorage.ProjName == "null" ||
            localStorage.ProjName == ""
        );
    } else if (
        example != null &&
        (ProjName != null || ProjName != "" || ProjName != "null")
    ) {
        // console.log(`${getDate()},${getTime()},讀取專案,${example}`);
        // logs.push(`\n${getDate()},${getTime()},讀取專案,${example}`);
        // console.log(`${getDate()},${getTime()},改編專案,${ProjName}`);
        // logs.push(`\n${getDate()},${getTime()},改編專案,${ProjName}`);
        // console.log(`${getDate()},${getTime()},建立專案,${ProjName}`);
        // logs.push(`\nCP,${getDate()},${getTime()},建立專案,${ProjName}`);
        LogManager.add("建立專案", 'code : CP'); // 這邊要修改
    }
    // document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value = ProjName;
    // document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].setAttribute('value', ProjName);
}

//檢查是否有輸入專案名稱(全新的專案)
function checkProjName() {
    if (
        example == null &&
        (ProjName == null || ProjName == "" || ProjName == "null")
    ) {
        do {
            ProjName = prompt("請輸入專案名稱", "");
            localStorage.ProjName = ProjName;
            window.location.href = `${guiUrl}?classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${ProjName}&i=${localStorage.identity}`;
        } while (
            localStorage.ProjName == "null" ||
            localStorage.ProjName == ""
        );
    } else if (
        example == null &&
        (ProjName != null || ProjName != "" || ProjName != "null")
    ) {
        console.log(`${getDate()},${getTime()},建立專案,${ProjName}`);
        // logs.push(`\nCP,${getDate()},${getTime()},建立專案,${ProjName}`);
    }
    // document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].setAttribute('value', ProjName);
}

//檢查現在的專案是否跟新增的專案一樣(尚未測試的function)
function checkLoadProjName(ProjName) {
    var nowProjName = ProjName;
    var loadProjName = document.getElementsByClassName(
        "menu-bar_title-field-growable_3qr4G"
    )[0].value;
    if (loadProjName != nowProjName) {
        console.log(`${getDate()},${getTime()},讀取專案,${loadProjName}`);
        // logs.push(`\nRP,${getDate()},${getTime()},讀取專案,${loadProjName}`);
    }
}

//紀錄當前拉方塊事件
function eventCore() {
    if (document.addEventListener) {
        document.addEventListener("click", function (event) {
            var targetElement = event.target || event.srcElement; //宣告當前事件的事件源
            clickUI(targetElement); // record click button or another UI on the page
            clickSprite(targetElement); // record click Sprite events
            clickCat(targetElement); // record click category events
            // clicknewBlock();
        });
    } else if (document.attachEvent) {
        document.attachEvent("onclick", function () {
            var targetElement = event.target || event.srcElement;
            clickUI(targetElement); // record click button or another UI on the page
            clickSprite(targetElement); // record click Sprite events
            clickCat(); // record click category events
            // clicknewBlock();
        });
    }
}

//問
//移除UI介面
function removeUI() {
    $(".menu-bar_mystuff-button_16jPf").remove(); // 移除資料夾
    $(".menu-bar_feedback-link_1BnAR").remove(); // 移除回饋意見
    $(".community-button_community-button_2Lo_g").remove(); // 移除切換專案頁面按鈕
    $(".share-button_share-button_Nxxf0").remove(); // 移除分享按鈕
    $(".menu-bar_dropdown-caret-icon_FkdUe").remove(); // 移除右上角使用者名稱旁的下拉選單icon 三角形
    $(".backpack_backpack-container_2_wGr").remove(); // 移除背包
    $(".__react_component_tooltip").remove(); // 移除提示
    //document.querySelector('[aria-label="教程"]').style.display = "none"; // 移除教程
    $(".menu-bar_divider_2VFCm").remove(); // 移除分隔虛線
    $(".menu-bar_menu-bar-item_oLDa-")[0].style.display = "none"; // 移除Scratch logo
    // Because comment out "if (!open) return null" cause dropdown menu always open. So hide dropdown menu, file and edit.

    document.getElementsByClassName(
        "menu-bar_menu-bar-menu_239MD"
    )[0].style.display = "none"; // file menu
    document.getElementsByClassName(
        "menu-bar_menu-bar-menu_239MD"
    )[1].style.display = "none"; // edit menu
    document.getElementsByClassName(
        "menu-bar_language-menu_2JEDx"
    )[0].style.display = "none"; // 隱藏語言選單
    document.getElementsByClassName(
        "menu-bar_coming-soon_3yU1L"
    )[3].style.display = "none"; // 隱藏右上角username
    if (/^test/.test(localStorage.classno)) {
        document.getElementsByClassName(
            "green-flag_green-flag_1kiAo"
        )[0].style.display = "none"; //隱藏旗子
    }
    document.getElementsByClassName(
        "menu-bar_menu-bar-item_oLDa- menu-bar_growable_1sHWN"
    )[0].style.display = "none"; // 隱藏輸入專案名稱
    document.getElementsByClassName(
        "menu_menu-item_3EwYA menu_hoverable_3u9dt"
    )[3].style.display = "none"; //隱藏表單(檔案中的從你電腦挑選)
}

//連結到教材的網頁
//_blank：URL加载到一个新的窗口
// const tutor_url='https://hackmd.io/@Denny310647/HyoyJMC2h';
// const tutor_url_loop='https://hackmd.io/@Denny310647/HyoyJMC2h#迴圈Loop';
// const tutor_url_function='https://hackmd.io/@Denny310647/HyoyJMC2h#函式Function';
// const CT_url='https://hackmd.io/@Denny310647/HyapaVW16';
var Move_count = 0; //紀錄拖拉的次數
function link_tutor(url) {
    window.open(url, "_blank");
}
// 教材連結
// function hint_link() {
//     let url = "";
//     if (localStorage.ProjName == "任務2") {
//         url = "https://hackmd.io/@Denny310647/By7uVH-X6";
//     } else if (localStorage.ProjName == "任務3") {
//         url = "https://hackmd.io/@Denny310647/SyyZ5Z-mp";
//     } else if (localStorage.ProjName == "任務4") {
//         url = "https://hackmd.io/@Denny310647/SJWmnW-ma";
//     } else if (localStorage.ProjName == "任務5") {
//         url = "https://hackmd.io/@Denny310647/By6kxLWXT";
//     } else if (localStorage.ProjName == "進階挑戰1") {
//         url = "https://hackmd.io/@Denny310647/H16S4IWXT";
//     } else if (localStorage.ProjName == "進階挑戰2") {
//         url = "https://hackmd.io/@Denny310647/HJHGdUbm6";
//     } else if (localStorage.ProjName == "進階挑戰3") {
//         url = "https://hackmd.io/@Denny310647/r1yvFUWQa";
//     } else if (localStorage.ProjName == "進階挑戰4") {
//         url = "https://hackmd.io/@Denny310647/r1EDi8ZQT";
//     } else if (localStorage.ProjName == "進階挑戰5") {
//         url = "https://hackmd.io/@Denny310647/SJag6Lbm6";
//     }
//     window.open(url, "_blank");
// }

// function startBlinking() {
//     const icon = document.getElementById("blinking-icon");
//     icon.classList.add("blinking-icon");
// }

// function stopBlinking() {
//     const icon = document.getElementById("blinking-icon");
//     icon.classList.remove("blinking-icon");
// }

//新增UI介面
function createUI() {
    // must remove UI first, otherwise the sequence will be wrong
    var menubarR = document.getElementsByClassName(
        "menu-bar_account-info-group_MeJZP"
    )[0];

    // create loge div upper left corner
    var menubarL = document.getElementsByClassName(
        "menu-bar_file-group_1_CHX"
    )[0];
    var scratchLogDiv = document.createElement("div");
    scratchLogDiv.setAttribute("id", "scratchLogDiv");
    scratchLogDiv.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    scratchLogDiv.setAttribute(
        "onclick",
        "location.href='https://scratch-ct.web.app/';"
    );
    scratchLogDiv.style.cssText = "padding-left: 1.25rem;";
    menubarL.prepend(scratchLogDiv);

    // create 儲存檔案 div
    var downloadSB3 = document.createElement("div");
    downloadSB3.setAttribute(
        "class",
        "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB"
    );
    downloadSB3.setAttribute("id", "downloadSB3");
    downloadSB3.textContent = "儲存並下載檔案";
    menubarL.appendChild(downloadSB3);

    // 在儲存檔案旁建立分隔虛線
    var divLine = document.createElement("div");
    divLine.setAttribute(
        "class",
        "divider_divider_1_Adi menu-bar_divider_2VFCm"
    );
    menubarL.appendChild(divLine);
    // 輸入專案名稱旁加入文字標題
    var projLable = document.createElement("div");
    // 專案名稱旁建立分隔虛線
    projLable.setAttribute("id", "projName");
    projLable.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    projLable.textContent = "目前任務： " + urlParams.get("p");
    menubarL.appendChild(projLable);
    // 將載入畫面時輸入的使用者資訊顯示出來
    var menubarL2 = document.getElementsByClassName(
        "menu-bar_main-menu_3wjWH"
    )[0];
    var divLine = document.createElement("div");
    divLine.setAttribute(
        "class",
        "divider_divider_1_Adi menu-bar_divider_2VFCm"
    );
    menubarL2.appendChild(divLine);
    // 加入班級名稱
    // var classname = document.createElement("div");
    // classname.setAttribute("id", "classname");
    // classname.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    // classname.textContent = "班級： " + classno;
    // menubarL2.appendChild(classname);
    // 顯示學生名稱
    var name = document.createElement("div");
    name.setAttribute("id", "username");
    name.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    name.textContent = "學生姓名： " + username;
    menubarL2.appendChild(name);
    // 在儲存檔案旁建立分隔虛線
    var divLine = document.createElement("div");
    divLine.setAttribute("class", "divider_divider_1_Adi menu-bar_divider_2VFCm");
    menubarL2.appendChild(divLine);
    // ===================== 積木數量顯示 ====================
    const blockCount = document.createElement('div');
    blockCount.style.marginLeft = '20px';
    blockCount.style.fontSize = '14px';
    blockCount.style.fontWeight = 'bold';
    blockCount.innerHTML = `目前積木數量 : <span id="ui-block-counter">0</span>`;
    menubarL2.appendChild(blockCount);
    // navbar.appendChild(blockCount);
    // ======================================================
    // 顯示目前新增的block數
    // var blocklynum = document.createElement("span");
    // blocklynum.setAttribute("class", "menu-bar_menu-bar-item_oLDa-1");
    // blocklynum.textContent = "積木數量： " + Move_count;
    // menubarL2.appendChild(blocklynum);
    // blocklynum.style.display = "none"; //隱藏顯示積木的次數
    
    // 在儲存檔案旁建立分隔虛線
    // var divLine1 = document.createElement("div");
    // divLine1.setAttribute("class", "divider_divider_1_Adi menu-bar_divider_2VFCm");
    // menubarL2.appendChild(divLine1);
    // 重製按鈕
    // var resetbtn = document.createElement('img');
    // resetbtn.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAHYAAAB2AH6XKZyAAAAGXRFWHRTb2Z0d2FyZQB3d3cuaW5rc2NhcGUub3Jnm+48GgAAB69JREFUeJzdm2tsVMcVgL/Zvfba4Ad2aoIfEIzXjuqgJBWulDiF2kBFFVXtn5Q2xVIiVVVLKxtwQ/pQK1tpFCUo5bGI0vyq2lCpoolapUUlCYkJEBIldUVICbVZu+AXxpSHH4m9eHenP2YdO+aO9871es3ySVeyZu4cnzk7c+acmbkCQ2qapdWdx2ohqBGCKimpAO4AFgHCVJ5LJHAduCKhTUArgpaSK5w42izCJoIcK1y2Ty4VEbYAdcCdZvomjX4hOCDG2d3eKHqdNIhrgBUvyFwR4ikBPwDSZ61icggB+4GmYIMYmunFGQ1QEZDrI/AHAYWJ1C6J9ElJXccW0aJ7waOrKA/I7VF4NYU7D1AkBK/798ptuhdsDeDfK5+RsENXn2J4kewsC8hf2VXeNAXKA3J7rPO3H4LGYL3Y9dmiKZTtkbVC8DrgTapiySPqgQ3tDeLIRMGnBoh5+7MpPufjI+hFUjmxOliflqul7pbufFURPFACmRZkpkGaB7J9cO4K7HvfoRBJMZJmoBFiI8AfkCVAB7f4Ov+jL8LWB24u/2cfPPqykaiQJ0xZe6PonRgBW5njzgug/A7w56unYAEIATk+uDYKfcPQOwwfXILuQXsZo5ogd0GasTq+iMUW4EmrpllaPbDJWIRDHiyBr/ph/QpYvNBZm94hON4FB8/AhwOT5aPj9u9nWPblcajjoPyZSmxgiSsRGgTwlTLYXAUrF5u3L86Bb69Uz+lL8EIrvNYBY5oR4MYAAgor+qm2gFrz5nrK8uG5dXBfgkx6752w72E42Q3vadKbTHcjgKhgreXxsEpK9wpO5btfgG0Pgm8OoojqpeqxI8PcBygkqywpKXetVQyvgKYaeHTlbCW5I8NS0870d5RQYQEuZukkXo8aoutKnb0/HoGOa9B5DYZCquxzC2BpLvjzlDxTBMoIulVihnaLLSDL/F9O0vzl+J2PSjjSCa+0wbEuvTfP8alh/s1KWH2X2faSz4UBgGyLWcT9j9+vPPVMtJyHHW9D8Gp8eUMhOBxUjz8ffrlGP++nk2mpPTJDLJf+E0rz4Ilqff1oGJpa4C//iS9rbSmU5UGaFxamqV/T54Wro8ooOb74Mtw6QlcGEMAza/Xe/voYfO9vcKrfmby6e2H1MjeaTOJ2KXS14VFbqhITO0IR+P7fnXce9AGOCS6jQXcG2Fylr2tqgX9dNJOXUga4bwncr4nyjnfBy2fNldCtCiYkbQo87Lcvl8CvT7pTIhEjIDNZTnCDxgBvnYczl90p0TME/x5QhrgRgZEbEI6qFWA8qkbIaKxuOKTqRm4ofzMWhk/G4byLNRAMDbAkC4qz7eteaXOnAMDvTqlnPjCaApUF9uUSOHYhAdrMA0YGKMuzL+8ahMFQItRJPkYGyM2wL+/SbGGlAkY+IM1j/0tfGkmUOslH+AOJ2g5JLs+uV/uM03npI3j2hHM5rpOh+WZJFuTaJEnjETM5KXv4uTzXvvz6mJmclDRAXiYU5djXOdl3mEpKGqB2uX63yDQadeUDFmXA8kXqRCYjtnmRlQ5W7Kwu3fvZ87scn6rLSld1GZaKHN1Gf1+/2768axD+94mZLFcG+NIy2LXBTctJWg1T5gk+X6DfJvtH0FyeqykwX+mrAH76kH74H06aAeYpff3WSv2v33pRZZSmuDJAKAEGMD09qipSu8Q69ju9HzCNlBgBVUXw268pB2rHe73us1FXTtCpAYZCSrGJzYtQGD4enzwdcsIjldBcox8xo2H4+Rvmx2ITuDLAmEMnmOOD/Ez4zftwzjBAKc+HJx+CmuUzv/fcCbgwi2zUAiIYng6ZTIHqpXBoExy/oBKVk936vYOF6bBmmVrn162IfzR24DT88UPnutgQtoARQBNZ22PqBAWw5i71RKQ6GO0ahMsfq/q8TFiRB6WLVMDkhNc64OljZnrYMGwBAxgaYCys5pybu/FeoYZ3eb6LxjFe+gh+0aKMORskDFgS2gVmdwQkyghu9+LdMhaG50/C7z9IjDwBbR4Bra6U0TjC3e/C292zUcueU/3wjT8lrvMxWj0ItFfJZ0LnCPuG4fG/wuZDZueDOk5fgh8ego1/Vr4jkUQlb1olVzjRk08/hjfF4t3YOtKpnnsKYOM9KoFa5tDTXBxRbQ8H9RejEkBfZyHvWEebRbh8rzwgJU+YtNYZYHqEd+YyNB1Vfxdnq3PFwmwoyobs9Ek5F0eg46qKF/57zX1gY8CLbBQRC0BK9gD1gIOrCArdFJjplLY3dhv0FiDkFQQgFgkGG0SPPyD3o67MOuL4BegfUWd1U8/v5nDIJgwh2NtWL/pgylLuD8gc4Cygufpw29DjHaWy7SdiGKZkg7H7899Bhca3K1EpeGyi8zAtHQ42iLcQbE++XslBwLaOevHm1LKbIu9gvdgl4enkqZU0njrXIALTC7XhvH+PbESwg9T/figs4Md2nYc4+UzZHlkrPLyIpHhudJtzekSUTee2Cm3eOGPy2bFFtCCpBHaiPkdNFcaE4HnvKJUzdR4MMtqKnbI49plJ3S38cVWflBxIj7L77Dbh6OTBPKU/KL0V/VRHBWuRrALuBgpQewrJOmqLAoMSBgS0I2iNRnmjs5B32CiMlvH/A0fzXsZ5CrGvAAAAAElFTkSuQmCC';
    // resetbtn.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // resetbtn.setAttribute('onclick','window.location.reload()');
    // menubarL2.appendChild(resetbtn);
    // if(!(/^test/).test(classno)){
    //     blocklynum.style.display = 'none';
    //     divLine1.style.display = 'none';
    // }
    // 在儲存檔案旁建立分隔虛線
    var divLine2 = document.createElement("div");
    divLine2.setAttribute(
        "class",
        "divider_divider_1_Adi menu-bar_divider_2VFCm"
    );
    menubarL2.appendChild(divLine2);
}

function clickUI(targetElement) {
    // because comment out "if (!open) return null" cause dropdown menu always open, this code can bring back functioning normally
    if (
        targetElement.textContent == "檔案" ||
        targetElement.textContent == "檔案新建專案從你的電腦挑選下載到你的電腦"
    ) {
        document.getElementsByClassName(
            "menu-bar_menu-bar-menu_239MD"
        )[1].style.display = "none";
        if (
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0]
                .style.display == "none"
        ) {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[0].style.display = "inline";
        } else {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[0].style.display = "none";
        }
    } else if (
        targetElement.textContent == "編輯" ||
        targetElement.textContent == "編輯復原開啟加速模式"
    ) {
        document.getElementsByClassName(
            "menu-bar_menu-bar-menu_239MD"
        )[0].style.display = "none";
        if (
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1]
                .style.display == "none"
        ) {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[1].style.display = "inline";
        } else {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[1].style.display = "none";
        }
    } else {
        if (
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0]
                .style.display == "inline" ||
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1]
                .style.display == "inline"
        ) {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[0].style.display = "none";
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[1].style.display = "none";
        } else {
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[0].style.display = "none";
            document.getElementsByClassName(
                "menu-bar_menu-bar-menu_239MD"
            )[1].style.display = "none";
        }
    }

    if (targetElement.id == "downloadSB3") {
        // cilck 下載到你的電腦 in file dropdown menu 觸發 gui download-blob.js
        var loadProjName = document.getElementsByClassName(
            "menu-bar_title-field-growable_3qr4G"
        )[0].value;
        console.log(`${getDate()},${getTime()},儲存專案,${loadProjName}`);
        console.log(getDate() + "," + getTime());
        // logs.push(`\nSP,${getDate()},${getTime()},儲存專案,${loadProjName}`);
        document
            .getElementsByClassName(
                "menu_menu-item_3EwYA menu_hoverable_3u9dt"
            )[2]
            .click();
        getDbFile();
    }

    if (targetElement.className == "green-flag_green-flag_1kiAo") {
        // when click green flag, puts logs and save blocls on the sprite's workspace to the localStorage
        // logs.push(`\n${getDate()},${getTime()},執行,點擊執行旗幟`);

        const snapshot = getWorkspaceContext(); // 取得快照
        LogManager.add("EP", "執行專案", snapshot.replace(/\n/g, ' | '));
        LogManager.save("執行時立即儲存"); // 重要時刻立即存
        // saveLastWorkSpace();
        // Object.keys(localStorage).forEach(function (key) {
        //     if (/^sprite:/.test(key)) {
        //         console.log("\n" + key + "\n " + localStorage[key]);
        //         console.log(getDate() + "," + getTime());
        //         logs.push(
        //             `\nEP,${getDate()},${getTime()},執行,點擊綠旗 ${key}工作區：${localStorage[key]
        //             }`
        //         );
        //         getDbFile(); //將log傳到資料庫儲存起來
        //     }
        // });
    }

    if (targetElement.className == "stop-all_stop-all_1Y8P9") {
        // record click stop icon
        // logs.push(`\nCP,${getDate()},${getTime()},暫停,點擊暫停`);
        LogManager.add("CP", "暫停", "點擊暫停按鍵");
        console.log("stop");
        console.log(getDate() + "," + getTime());
    }

    if (targetElement.textContent == "新建專案") {
        var creatNew = confirm("新建專案並捨棄目前專案嗎？");
        if (creatNew == true) {
            window.location.href = `${guiUrl}?classno=${classno}&no=${userno}&name=${username}&i=${identity}`;
        }
    }
}
// 紀錄角色區塊被動作時的log紀錄
function clickSprite(targetElement) {
    // this function is for Bottom right corner, sprite area
    if (targetElement.className == "delete-button_delete-icon_3b8wH") {
        console.log("(刪除角色)");
        console.log(getDate() + "," + getTime());
        // logs.push(`\nRR,${getDate()},${getTime()},刪除角色,刪除角色`);
        LogManager.add("RR", "刪除角色", "使用者刪除角色");
    }

    // if click sprite img to chang sprite's workspace will run this code
    if (
        targetElement.className ==
        "sprite-selector-item_sprite-image-inner_3oSwi" ||
        targetElement.className == "sprite-selector-item_sprite-name_1PXjh" ||
        targetElement.className == "sprite-selector-item_sprite-info_-I0i_" ||
        targetElement.className ==
        "react-contextmenu-wrapper sprite-selector_sprite_21WnR sprite-selector-item_sprite-selector-item_kQm-i sprite-selector-item_is-selected_24tQj"
    ) {
        //(後)saveLastWorkSpace();
        console.log(
            "(切換角色)在 " +
            document.getElementsByClassName(
                "sprite-info_sprite-input_17wjb"
            )[0].value +
            " WorkSpace 上的 Blocks 如下"
        );
        console.log(getDate() + "," + getTime());
        // logs.push(`\nCR,${getDate()},${getTime()},切換角色,切換角色`);
        // logs.push(`\nWC,${getDate()},${getTime()},畫布變更,`);
        LogManager.add("CR", "切換角色", "切換角色");
        LogManager.add("WC", "畫布變更", "畫布變更");
        if (
            document.getElementsByClassName("blocklyBlockCanvas")[0].childNodes
                .length != 0
        ) {
            for (
                i = 0;
                i <
                document.getElementsByClassName("blocklyBlockCanvas")[0]
                    .childNodes.length;
                i++
            ) {
                console.dir(
                    ">" +
                    document.getElementsByClassName("blocklyBlockCanvas")[0]
                        .childNodes[i].textContent
                );
                /**
                 * 待更新 這邊不知道有甚麼功能
                 */
                // logs.push(
                //     ">" +
                //     document.getElementsByClassName("blocklyBlockCanvas")[0]
                //         .childNodes[i].textContent
                // );
            }
        } else {
            //(後)console.log('(空白)');
            //(後)logs.push('> (空白)');
        }
    }

    // if click add sprite icon on the bottom right corner
    if (
        targetElement.className ==
        "action-menu_button_1qbot action-menu_main-button_3ccfy" ||
        targetElement.className == "action-menu_button_1qbot " ||
        targetElement.className == "action-menu_main-icon_1ktMc"
    ) {
        console.log("(新增角色)");
        logs.push(`\nCR,${getDate()},${getTime()},新增角色,新增角色`);
        LogManager.add("CR", "新增角色", "新增角色");
        console.log(getDate() + "," + getTime());
        //(後)saveLastWorkSpace();
    }
}

//計算某function出現的次數，array為記錄拖拉的主陣列, subarray為我們自定義的function子陣列
function countSubarrayOccurrences(array, subarray) {
    let count = 0;
    for (let i = 0; i <= array.length - subarray.length; i++) {
        let matched = true;
        for (let j = 0; j < subarray.length; j++) {
            if (array[i + j] !== subarray[j]) {
                matched = false;
                break;
            }
        }
        if (matched) count++;
    }
    return count;
}

//刪掉主陣列中那些重複出現的子陣列
function removeDuplicateSubarrays(array, subarray) {
    //i <= array.length - subarray.length是保證在不越界的情況下能夠比較主陣列中的每一個可能的子序列
    for (let i = 0; i <= array.length - subarray.length; i++) {
        let matched = true;
        for (let j = 0; j < subarray.length; j++) {
            if (array[i + j] !== subarray[j]) {
                matched = false;
                break;
            }
        }
        if (matched) {
            // splice 方法來刪除主陣列中位置 i 開始的 subarray.length 個元素，也就是刪除子陣列。這麼做的效果是，將重複的子陣列從主陣列中刪除。
            // 由於使用 splice 後陣列長度減少，為了不遺漏可能的連續出現的子陣列，我們減少 i 的值，使下一輪迴圈仍然從相同位置檢查是否有重複的子陣列。
            array.splice(i, subarray.length);
            i--; // 調整 i 以處理連續出現的子陣列
        }
    }
}

//判斷是否出現連續三個相同的元素
// 確認學生是否拖拉連續三個積木 -> 推薦學生使用迴圈
function hasConsecutiveTriple(arr) {
    let count = 1;
    //i <= array.length - subarray.length是保證在不越界的情況下能夠比較主陣列中的每一個可能的子序列
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
            count++;
            if (count === 3) {
                return true;
            }
        } else {
            count = 1;
        }
    }

    return false;
}

// 取出陣列中的連續值，用來判斷積木是否有適合為函式(不會用到，被countSubarrayOccurrences()取代)
function extractSubArrayAfterValue(arr, startValue, count) {
    const startIndex = arr.indexOf(startValue);
    if (startIndex !== -1) {
        var subArray = [];
        for (
            let i = startIndex;
            i < startIndex + 1 + count && i < arr.length;
            i++
        ) {
            subArray.push(arr[i]);
        }
        return subArray;
    } else {
        return [];
    }
}

// 刪除陣列中兩個以上不同的特定值
function removeMultipleValues(arr, valuesToRemove) {
    return arr.filter((item) => !valuesToRemove.includes(item));
}

// 計算某(些)積木重複出現的次數
function countblockly(arr) {
    var test = {};
    // 將陣列中的元素透過reduce來管理，並統計出現次數
    test = arr.reduce(function (block, blockname) {
        if (block.hasOwnProperty(blockname)) {
            block[blockname]++;
        } else {
            block[blockname] = 1;
        }
        return block;
    }, {});
    var looptime =
        test[
        document.getElementsByClassName(
            "blocklyDraggable blocklySelected"
        )[0].textContent
        ];
    console.log(looptime);
    console.log(test);
    return looptime;
}

//移除陣列中的某數值
function removeLatestDuplicate(arr, value) {
    const reversedArr = arr.slice().reverse(); // 反轉數組，從最後一個元素開始搜尋
    const indexToRemove = reversedArr.findIndex((item) => item === value);

    if (indexToRemove !== -1) {
        const actualIndex = arr.length - 1 - indexToRemove; // 回復實際索引
        arr.splice(actualIndex, 1); // // 刪除陣列中的值用splice()
    }
}

function matchCustomPattern(text) {
    const regexList = [
        /^(\-|\+)?\d*圖像效果.*設為/,
        /背景換成下一個/,
        /圖像效果清除/,
        /^背景(.+)*/,
        /(.+?\d+)說出持續秒/,
        /^.*說出/,
        /^.*想著/,
        /(.+?\d+)想著持續秒/,
        /^.*造型換成/,
        /造型換成下一個/,
        /^.*背景換成/,
        /^(\-|\+)?\d*尺寸改變/,
        /^(\-|\+)?\d*尺寸設為%/,
        /顯示/,
        /隱藏/,
        /圖層移到.*層/,
        /^(\-|\+)?\d*圖層.*移層/,
        /^造型(.+)*/,
        /尺寸/,
        /^(\-|\+)?\d*圖像效果.*改變/,
        /^(\-|\+)?\d*圖像效果.*設為/,
        /停播所有音效/,
        /^(\-|\+)?\d*聲音效果.*改變/,
        /^(\-|\+)?\d*聲音效果.*設為/,
        /聲音效果清除/,
        /^(\-|\+)?\d*音量改變/,
        /^(\-|\+)?\d*音量設為%/,
        /^.*播放音效直到結束/,
        /^.*播放音效/,
        /音量/,
        /當被點擊/,
        /當.*鍵被按下/,
        /^(\-|\+)?\d*當.*>/,
        /當角色被點擊/,
        /當背景換成.*/,
        /當收到訊息.*/,
        /^.*廣播訊息/,
        /^.*廣播訊息並等待/,
        /^\d+圖像效果.*改變/,
        /^\d+等待秒/,
        /^\d+重複次/,
        /重複無限次/,
        /如果那麼/,
        /如果那麼否則/,
        /等待直到/,
        /重複直到/,
        /當分身產生/,
        /^.*建立的分身/,
        /分身刪除/,
        /停止.*/,
        /^.*碰到?/,
        /碰到顏色?/,
        /顏色碰到^.*顏色?/,
        /^.*與的間距/,
        /拖曳方式設為.*/,
        /舞台的.*/,
        /用戶名稱/,
        /2000年迄今日數/,
        /目前時間的.*/,
        /計時器重置/,
        /計時器/,
        /聲音響度/,
        /鼠標的 x/,
        /鼠標的 y/,
        /滑鼠鍵被按下?/,
        /^.*鍵被按下?/,
        /詢問的答案/,
        /^.*詢問並等待/,
        /^\d+[^0-9]+/,
        /my variable/,
        /^(\-|\+)?\d*變數*.改變/,
        /^(\-|\+)?\d*變數*.設為/,
        /變數*.顯示/,
        /變數*.隱藏/,
        /\+$/,
        /\-$/,
        /\*$/,
        /\/$/,
        /^(\-|\+)?\d*隨機取數到/,
        / 50>/,
        / 50</,
        / 50=/,
        /且/,
        /或/,
        /不成立/,
        />$/,
        /<$/,
        /=$/,
        /^.*字串組合/,
        /^\d*.*字串的第字/,
        /^.*字串的長度/,
        /^.*字串包含?/,
        /除以的餘數$/,
        /四捨五入數值$/,
        /^.*數值/,
        /^(\-|\+)?\d*移動點/,
        /^(\-|\+)?\d*右轉度/,
        /^(\-|\+)?\d*左轉度/,
        /^.*定位到位置/,
        /^(\-|\+)?\d*定位到 x:y:/,
        /^\d*.*滑行秒到位置/,
        /^\d*滑行秒到 x:y:/,
        /^(\-|\+)?\d*面朝度/,
        /^.*面朝向/,
        /^(\-|\+)?\d*x 改變/,
        /^(\-|\+)?\d*x 設為/,
        /^(\-|\+)?\d*y 改變/,
        /^(\-|\+)?\d*y 設為/,
        /碰到邊緣就反彈/,
        /迴轉方式設為*.*/,
        /x 座標/,
        /y 座標/,
        /方向/,
        /.*/,
    ];

    for (const regex of regexList) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為動作(藍色)類別的積木
function matchaction(text) {
    var action_blockly = [
        /^(\-|\+)?\d*移動點/,
        /^(\-|\+)?\d*右轉度/,
        /^(\-|\+)?\d*左轉度/,
        /^.*定位到位置/,
        /^(\-|\+)?\d*定位到 x:y:/,
        /^\d*.*滑行秒到位置/,
        /^\d*滑行秒到 x:y:/,
        /^(\-|\+)?\d*面朝度/,
        /^.*面朝向/,
        /^(\-|\+)?\d*x 改變/,
        /^(\-|\+)?\d*x 設為/,
        /^(\-|\+)?\d*y 改變/,
        /^(\-|\+)?\d*y 設為/,
        /碰到邊緣就反彈/,
        /迴轉方式設為*.*/,
        /x 座標/,
        /y 座標/,
        /方向/,
    ];
    for (const regex of action_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為外觀(紫色)類別的積木
function matchlook(text) {
    var look_blockly = [
        /^(\-|\+)?\d*圖像效果.*設為/,
        /背景換成下一個/,
        /圖像效果清除/,
        /^背景(.+)*/,
        /(.+?\d+)說出持續秒/,
        /^.*說出/,
        /^.*想著/,
        /(.+?\d+)想著持續秒/,
        /^.*造型換成/,
        /造型換成下一個/,
        /^.*背景換成/,
        /^(\-|\+)?\d*尺寸改變/,
        /^(\-|\+)?\d*尺寸設為%/,
        /顯示/,
        /隱藏/,
        /圖層移到.*層/,
        /^(\-|\+)?\d*圖層.*移層/,
        /^造型(.+)*/,
        /尺寸/,
        /^(\-|\+)?\d*圖像效果.*改變/,
    ];
    for (const regex of look_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為音效類別的積木
function matchsound(text) {
    var sound_blockly = [
        /停播所有音效/,
        /^(\-|\+)?\d*聲音效果.*改變/,
        /^(\-|\+)?\d*聲音效果.*設為/,
        /聲音效果清除/,
        /^(\-|\+)?\d*音量改變/,
        /^(\-|\+)?\d*音量設為%/,
        /^.*播放音效直到結束/,
        /^.*播放音效/,
        /音量/,
    ];
    for (const regex of sound_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為控制(迴圈、黃色)類別的積木
function matchcontrol(text) {
    var control_blockly = [
        /^\d+等待秒/,
        /^\d+重複次/,
        /重複無限次/,
        /如果那麼/,
        /如果那麼否則/,
        /等待直到/,
        /重複直到/,
        /當分身產生/,
        /^.*建立的分身/,
        /分身刪除/,
        /停止.*/,
    ];
    for (const regex of control_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為事件類別的積木
function matchevent(text) {
    var event_blockly = [
        /當被點擊/,
        /當.*鍵被按下/,
        /^(\-|\+)?\d*當.*>/,
        /當角色被點擊/,
        /當背景換成.*/,
        /當收到訊息.*/,
        /^.*廣播訊息/,
        /^.*廣播訊息並等待/,
    ];
    for (const regex of event_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為變數類別的積木
function matchvariable(text) {
    var variable_blockly = [
        /my variable/,
        /^(\-|\+)?\d*變數*.改變/,
        /^(\-|\+)?\d*變數*.設為/,
        /變數*.顯示/,
        /變數*.隱藏/,
    ];
    for (const regex of variable_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為偵測類別的積木
function matchscan(text) {
    var scan_blockly = [
        /^.*碰到?/,
        /碰到顏色?/,
        /顏色碰到^.*顏色?/,
        /^.*與的間距/,
        /拖曳方式設為.*/,
        /舞台的.*/,
        /用戶名稱/,
        /2000年迄今日數/,
        /目前時間的.*/,
        /計時器重置/,
        /計時器/,
        /聲音響度/,
        /鼠標的 x/,
        /鼠標的 y/,
        /滑鼠鍵被按下?/,
        /^.*鍵被按下?/,
        /詢問的答案/,
        /^.*詢問並等待/,
    ];
    for (const regex of scan_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}
// 判斷積木是否為數學運算類別的積木
function matchcal(text) {
    var calculte_blockly = [
        /\+$/,
        /\-$/,
        /\*$/,
        /\/$/,
        /^(\-|\+)?\d*隨機取數到/,
        / 50>/,
        / 50</,
        / 50=/,
        /且/,
        /或/,
        /不成立/,
        />$/,
        /<$/,
        /=$/,
        /^.*字串組合/,
        /^\d*.*字串的第字/,
        /^.*字串的長度/,
        /^.*字串包含?/,
        /除以的餘數$/,
        /四捨五入數值$/,
        /^.*數值/,
    ];
    for (const regex of calculte_blockly) {
        if (regex.test(text)) {
            return true;
        }
    }

    return false;
}

// 判斷學生目前所使用的積木序列是不是有使用到迴圈的規則
/**
 * 提示學生功能要再改寫
 */
function ismatchfunction(judge_blockly_funct, funct) {
    if (countSubarrayOccurrences(judge_blockly_funct, funct) > 1) {
        const note3 = console.log(judge_blockly_funct);
        confirm(
            "同學你好，你目前的狀況可以用函式(Function)的概念改進，如果你已經使用到函式，但還是不清楚用法，可以參考講義的「函式」章節"
        );
        alert_times++;
        console.log(`紀錄提示次數：${alert_times}`);
        // logs.push(`\n,${getDate()},${getTime()},系統提示,第${alert_times}次提示`);
        // if (note3 == true) {
        //     document.getElementById('blinking-icon').style.display='block';
        // }else {
        //     document.getElementById('blinking-icon').style.display='block';
        // }
        // tutorialimg.setAttribute("onclick","link_tutor(tutor_url_function)");
        removeDuplicateSubarrays(judge_blockly_funct, funct);
        console.log(judge_blockly_funct);
        // setTimeout(()=>{
        // document.getElementById('blinking-icon').style.display='none';
        // tutorialimg.setAttribute("onclick","link_tutor(tutor_url)");
        // },8000);
    }
}

function highlightPaletteBlockByText(blockText) {
    // 1. palette 區域的積木 SVG 容器
    // const paletteArea = document.querySelector('.blocks_palette_scroll-content');
    const paletteArea = document.querySelector('.blocklyBlockCanvas');
    if (!paletteArea) {
        alert('找不到 palette 區域');
        return;
    }
    // 2. 找 palette 下所有 <g> group（每個積木都是一個 group）
    const blockGroups = paletteArea.querySelectorAll('g.blocklyDraggable');
    let found = false;
    blockGroups.forEach(g => {
        // 該 group 下所有文字
        const textNodes = g.querySelectorAll('text');
        for (let t of textNodes) {
            if (t.textContent.trim().includes(blockText)) {
                // 清除已經有的高亮
                paletteArea.querySelectorAll('.block-highlight-flash').forEach(gg => {
                    gg.classList.remove('block-highlight-flash');
                });
                // 加上自訂 class
                g.classList.add('block-highlight-flash');
                found = true;
                break;
            }
        }
    });
    if (!found) alert('找不到 palette 中對應積木');
}

function highlightPaletteBlockByIndex(index = 0) {
    const paletteArea = document.querySelector('.blocklyBlockCanvas');
    if (!paletteArea) {
        alert('找不到 palette 區域');
        return;
    }
    // 取得所有積木 group
    const blockGroups = paletteArea.querySelectorAll('g.blocklyDraggable');
    if (blockGroups.length === 0) {
        alert('palette 沒有積木');
        return;
    }
    // 先清除其它高亮
    paletteArea.querySelectorAll('.block-highlight-flash').forEach(gg => {
        gg.classList.remove('block-highlight-flash');
    });
    if (blockGroups[index]) {
        blockGroups[index].classList.add('block-highlight-flash');
    } else {
        alert('指定 index 的積木不存在');
    }
}

//寫入積木發亮的 CSS
function injectHighlightCss() {
    // 檢查是否已經插入，避免重複插入
    if (document.getElementById('block-highlight-style')) return;

    const style = document.createElement('style');
    style.id = 'block-highlight-style';
    style.textContent = `
    @keyframes highlightFlash {
        0% { filter: drop-shadow(0 0 8px #ffd700); }
        50% { filter: drop-shadow(0 0 16px #ffd700) brightness(1.4); }
        100% { filter: drop-shadow(0 0 8px #ffd700); }
    }
    .block-highlight-flash {
        animation: highlightFlash 1s infinite;
    }
    `;
    document.head.appendChild(style);
}
injectHighlightCss();


//var blockly_count=[]
var new_blockly_record = []; //全新積木的紀錄
var judge_blockly_loop = []; //用來判斷積木是否有適合為loop或function的紀錄
var judge_blockly_funct = []; //用來判斷積木是否有適合為函式的紀錄
var record_funct = []; //用來判斷是否有用到funct或loop的紀錄
var alert_times = 0; //宣告提示的次數

// ==================== 新的積木偵測寫法 ==================

/**
 * 以 Blockly 原生事件系統重構的 clickCat()
 * 功能：
 * - 監聽學生積木操作（新增、刪除、移動）
 * - 實驗組邏輯檢查
 * - 更新積木數量
 * - 提示使用迴圈的鼓勵訊息
 * - 將操作記錄上傳到 Firebase
 */
function clickCat() {
    const workspace = Blockly.getMainWorkspace();

    // === 1️⃣ 先移除舊的監聽器，避免重複掛載 ===
    workspace.removeChangeListener(handleBlockEvent);

    console.log("移除事件監聽器");

    // === 2️⃣ 加上新的 Blockly 事件監聽器 ===
    workspace.addChangeListener(handleBlockEvent);

    console.log("✅ clickCat 已啟用 Blockly 事件監聽模式");
}

/**
 * 從刪除事件的 oldXml 解析出整疊積木的類型清單
 * 
 * - 解析刪除事件的 oldXml，把「整個被刪掉的結構」裡所有積木類型抓出來
 * - 會同時走 <next> 鏈和 <statement> 巢狀
 * - 回傳例子：["control_forever", "motion_movesteps", "motion_turnright", ...]
 */
function extractDeletedStackTypes(oldXmlNode) {
    const types = [];
    if (!oldXmlNode) return types;

    // 取得真正起點：可能是 <xml> 包第一個 <block>，也可能直接就是 <block>
    const rootBlockNode =
        oldXmlNode.tagName && oldXmlNode.tagName.toLowerCase() === "xml"
            ? oldXmlNode.firstElementChild
            : oldXmlNode;

    // 遞迴走訪
    function visitBlock(blockNode) {
        if (
            !blockNode ||
            !blockNode.tagName ||
            blockNode.tagName.toLowerCase() !== "block"
        ) {
            return;
        }

        // 1. 記錄目前這塊積木
        const t = blockNode.getAttribute("type") || "unknown";
        types.push(t);

        // 2. 處理所有 <statement>（控制積木的身體，例如 forever 內的東西）
        //    一個 block 可能有多個 statement（像 if/else 有兩個body）
        for (let i = 0; i < blockNode.children.length; i++) {
            const child = blockNode.children[i];
            if (
                child.tagName &&
                child.tagName.toLowerCase() === "statement"
            ) {
                // <statement> 底下理論上會直接有一個 <block> 當 body 的第一塊
                for (let j = 0; j < child.children.length; j++) {
                    if (
                        child.children[j].tagName &&
                        child.children[j].tagName.toLowerCase() === "block"
                    ) {
                        visitBlock(child.children[j]); // 進去 body
                    }
                }
            }
        }

        // 3. 再處理同一層往下接的 <next><block>
        //    也就是一條縱向串下去的兄弟積木
        for (let i = 0; i < blockNode.children.length; i++) {
            const child = blockNode.children[i];
            if (
                child.tagName &&
                child.tagName.toLowerCase() === "next"
            ) {
                // next 裡第一個 <block> 是下一塊
                for (let j = 0; j < child.children.length; j++) {
                    if (
                        child.children[j].tagName &&
                        child.children[j].tagName.toLowerCase() === "block"
                    ) {
                        visitBlock(child.children[j]); // 處理下一塊
                    }
                }
            }
        }
    }

    visitBlock(rootBlockNode);
    return types;
}

window.isProjectLoading = true; // 預設為正在載入中
/**
 * 紀錄積木更動的事件
 * - 將變更積木區的紀錄放入陣列
 */
function handleBlockEvent(event) {
    // 1. 如果正在載入範例檔，直接忽略所有事件，不紀錄
    if (LogManager.isRestoring) return;

    const workspace = Blockly.getMainWorkspace();
    const userId = localStorage.username || "guest";
    const now = `${getDate()} ${getTime()}`;
    const block = workspace.getBlockById(event.blockId);
    const blockType = getBlockTypeFromEvent(event, workspace);
    const blockCount = workspace.getAllBlocks(false).length;   // BlockCount 欄位

    // 建立通用的 log line
    // function pushLog(action, details) {
    //     const line =
    //         `\n,${getDate()},${getTime()},${action},${details},${blockCount}`;
    //     logs.push(line);
    // }

    // === 偵測積木新增 ===
    if (event.type === 'create') {   // ✅ 改成字串

        console.log(`🟩 新增積木：${blockType}`);
        // pushLog("新增積木", blockType);
        LogManager.add("ADD", "新增積木", blockType);
        // logs.push(`${getDate()},${getTime()},新增積木,${blockType}`);
        if (isExperimentGroup()) checkExperimentCondition();
        updateBlockCountDisplay();
    }

    // === 偵測積木刪除 ===
    if (event.type === 'delete') {
        const xmlNode = event.oldXml;

        // 用上面的解析器拿整串積木
        const deletedStackTypes = xmlNode
            ? extractDeletedStackTypes(xmlNode)
            : [];

        // 只是檢查一下我們真的抓到了
        console.log("🟥 刪除事件：", deletedStackTypes);
        // CSV 如果要寫陣列 → 用 | 連接
        const details = deletedStackTypes.join("|") || "unknown";
        // pushLog("刪除積木", details);
        LogManager.add("DEL", "刪除積木", details);
        // logs.push(`${getDate()},${getTime()},刪除積木,${deletedStackTypes.join('|')}`);
        // 上傳到 Firebase 的紀錄（整疊）
        // uploadLogToFirebase(userId, {
        //     time: now,
        //     action: "delete",
        //     blocks: deletedStackTypes,
        //     xml: xmlNode ? new XMLSerializer().serializeToString(xmlNode) : ""
        // });

        updateBlockCountDisplay();
    }

    // === 偵測積木移動 ===
    // if (event.type === 'move') {     // ✅ 改成字串
    //     console.log(`🟨 積木移動：${blockType}`);
    //     uploadLogToFirebase(userId, { time: now, action: "move", blockId: event.blockId });
    // }

    // === 額外檢查迴圈 ===
    // 這裡要更改成檢察學生所新增的log紀錄內有無使用到迴圈或是函式
    const loopUsed = workspace.getAllBlocks(false).some(b =>
        ["repeat", "repeat_until", "forever"].some(key =>
            b.type.includes(key)
        )
    );

    // if (loopUsed) showEncouragementMessage("你已經學會使用迴圈囉！👍");
}


/**
 * 更新積木數量統計與畫面顯示
 */
function updateBlockStats(workspace) {
    var blocklynum = document.querySelector(
        ".menu-bar_menu-bar-item_oLDa-1"
    );
    // 這裡積木數量邏輯有問題
    const blocks = workspace.getAllBlocks(false);
    const count = blocks.length;
    blocklynum.textContent = `目前積木數量：${count}`;
}

/**
 * 判斷當前是否為實驗組題目
 */
function isExperimentGroup() {
    return window.currentTaskGroup === "experiment"; // 可根據你的任務設定修改
}

/**
 * 實驗組特定邏輯，例如比對積木模式、檢查是否符合題目條件
 */
function checkExperimentCondition() {
    const workspace = Blockly.getMainWorkspace();
    const blocks = workspace.getAllBlocks(false);

    // 例如：檢查是否使用了「控制」類別積木
    const usedControl = blocks.some(b => b.type.includes("control_"));
    if (usedControl) {
        showEncouragementMessage("很好！你開始使用控制積木囉！");
    }
}

/**
 * 顯示鼓勵訊息（可整合你的聊天室或提示框）
 */
function showEncouragementMessage(msg) {

    console.log(`💬 鼓勵訊息：${msg}`);
}


/**
 * 工具函式：取得目前日期與時間
 */
function getDate() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getTime() {
    const d = new Date();
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/**
 * 取得事件中的積木資料
 */
function getBlockTypeFromEvent(event, workspace) {
    // 若積木仍存在（例如新增、移動）
    const block = workspace.getBlockById(event.blockId);
    if (block) return block.type;

    // 若是刪除事件，從 oldXml 抓取
    if (event.oldXml) {
        const tag = event.oldXml.tagName === "xml" ? event.oldXml.firstChild : event.oldXml;
        console.log(`🟥 刪除事件 ：`, event.oldXml);
        return tag?.getAttribute("type") || "unknown";
    }

    return "unknown";
}

// ===================================


/**
 * 把文字內容上傳到指定的 Firebase Storage 位置
 * 取代舊的 create() 核心功能
 */
function uploadCsvToFirebase(storageRef, csvText) {
    const file = new Blob([csvText], { type: "text/csv;charset=utf-8" });
    return storageRef.put(file); // 回傳 Promise
}

/**
 * 建立「第一次儲存 / 沒有舊檔案」用的 CSV 內容
 * logs：全域的 logs 陣列，裡面已經是一行一行的紀錄字串
 */
function buildCsvContentForNew(logs) {
    const header = "\uFEFFCode,Date,Time,Action,Details,BlockCount";
    const body = logs.join(" "); // 你原本就用空白串起來
    return header + body;
}

/**
 * 建立「有舊檔，且為編輯模式」要覆寫的 CSV 內容
 * storedText：舊檔案完整內容
 */
function buildCsvContentForEdit(storedText, logs) {
    const editMetaLine =
        `\n\n${getDate()},${getTime()},修改專案,${urlParams.get("p")}`; // 額外插入的那一行說明
    const body = logs.join(" ");
    return "\uFEFF" + storedText + editMetaLine + body;
}

/**
 * 讀取 Firebase Storage 的 log 檔，
 * 再把目前的 logs 內容合併後上傳覆蓋。
 */
// function getDbFile() {
//     // 如果目前沒有新的 log，直接結束，不要浪費流量下載/上傳
//     if (logs.length === 0) {
//         console.log("沒有新的 Log，跳過儲存");
//         return; 
//     }
//     const projName = urlParams.get("p");
//     const isEditMode = urlParams.get("edit") === "true";

//     // 1. 準備 Storage 參考
//     const storage = firebase.storage();
//     const logsFileRef = storage.ref(
//         `${classno}/${username}/Projects/${projName}/${username}_${projName}.csv`
//     );

//     // 2. 試著取得下載 URL，判斷有沒有舊檔
//     logsFileRef
//         .getDownloadURL()
//         .then(async (foundURL) => {
//             // ========= 檔案存在：下載舊內容 =========
//             const response = await fetch(foundURL);
//             const storedText = await response.text();
//             // 要寫入的log儲存變數
//             let csvText;
//             csvText = storedText + logs.join(" ");
            
//             await uploadCsvToFirebase(logsFileRef, csvText);
//             console.log("儲存成功，清空暫存 Logs");
//             logs = [];

//         })
//         .catch((error) => {
//             // ========= 檔案不存在：第一次儲存 =========
//             console.log("log 檔不存在，建立新的檔案", error.code);

//             const csvText = buildCsvContentForNew(logs);
//             uploadCsvToFirebase(logsFileRef, csvText).then(() => {
//                  logs = []; // ✅ 這裡也要清空
//             });
//         });
// }
// ============================================

//案執行後會記住所有動作的log到localStorage中
function saveLastWorkSpace() {
    var tmpLogs = []; // 建立暫時用陣列
    if (
        document.getElementsByClassName("blocklyBlockCanvas")[0].childNodes
            .length != 0
    ) {
        for (
            i = 0;
            i <
            document.getElementsByClassName("blocklyBlockCanvas")[0].childNodes
                .length;
            i++
        ) {
            // 將當前 workspace 中的 blocks 存到 暫時用陣列
            tmpLogs.push(
                ">" +
                document.getElementsByClassName("blocklyBlockCanvas")[0]
                    .childNodes[i].textContent
            );
        }
    } else {
        console.log("> (空白)");
    }
    var spriteName = document.getElementsByClassName(
        "sprite-info_sprite-input_17wjb"
    )[0].value;
    localStorage.setItem("sprite:" + spriteName, tmpLogs.join(" ")); // 將當前角色與workspace 中的 blocks 儲存到 localStorage
}

function ipBoo() {
    // $.getJSON('https://ipapi.co/json/', (data) => {
    //     const studentsIpRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/lastIp`);
    //     studentsIpRef.on('value', (snapshot2) => {
    //         const lastIp = snapshot2.val();
    //         if (data.ip !== lastIp) {
    //             alert('此設備已被登出');
    //             window.location.href = siteUrl + '/Login';
    //         }
    //     });
    // });
}

/*
function handsUpBoo() {
    const studentshandsUpRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/handsUp/state`);
    studentshandsUpRef.on('value', (snapshot3) => {
        const handsUpstate = snapshot3.val();
        if (handsUpstate == true) {
            alert('已舉手讓老師知道');
            document.getElementById("handsUp").style.display = 'none';
        } else {
            document.getElementById("handsUp").style.display = 'block';
        }
    });
}
*/

function newUrlBoo() {
    const studentsnewUrlRef = firebase
        .database()
        .ref(
            `${localStorage.identity}/${localStorage.classno}/${localStorage.no}/newUrl`
        );
    studentsnewUrlRef.on("value", (snapshot4) => {
        let newUrl = snapshot4.val();
        if (newUrl != null) {
            if (newUrl !== "#") {
                if (newUrl !== window.location.href) {
                    alert("更改網址為：" + newUrl);

                    if (newUrl.match("http") == null) {
                        const head = "http://";
                        newUrl = `${head}${newUrl}`;
                    } else {
                        newUrl = newUrl;
                    }
                    window.location.href = newUrl;
                }
            }
        }
    });
    const studentsnewProjRef = firebase
        .database()
        .ref(
            `${localStorage.identity}/${localStorage.classno}/${localStorage.no}/newProjName`
        );
    studentsnewProjRef.on("value", (snapshot5) => {
        let newProj = snapshot5.val();
        if (newProj != null) {
            if (newProj !== "#") {
                if (newProj !== urlParams.get("p")) {
                    alert("更改專案名稱為：" + newProj);
                    window.location.href = `${guiUrl}?classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${newProj}&i=${localStorage.identity}`;
                }
            }
        }
    });
}

function checkClickCat() {
    if (clickCatTimes > 10) {
        var q1 = confirm("在找什麼嗎？");
        if (q1 == true) {
            var q2 = confirm("需要老師幫忙嗎？");
            if (q2 == true) {
                document.getElementById("handsUp").click();
                alert("已舉手呼叫老師");
                clickCatTimes = 0;
            } else {
                clickCatTimes = 0;
            }
        } else {
            clickCatTimes = 0;
        }
    } else {
        clickCatTimes++;
    }
}

function setToken() {
    promptToken = prompt("請輸入令牌", "");
    localStorage.token = promptToken;
    window.location.href = `${guiUrl}?token=${localStorage.token}&classno=${localStorage.classno
        }&no=${localStorage.no}&name=${localStorage.username}&p=${urlParams.get(
            "p"
        )}&i=${localStorage.identity}`;
}

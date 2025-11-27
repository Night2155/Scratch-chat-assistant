
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
    add: function(action, details) {
        const timestamp = new Date();
        const dateStr = `${timestamp.getFullYear()}/${timestamp.getMonth() + 1}/${timestamp.getDate()}`;
        const timeStr = `${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
        
        // 統一取得積木數量 (假設您已有 getBlockCount 函式)
        const blockCount = (typeof getBlockCount === 'function') ? getBlockCount() : 0;

        // 組合標準 CSV 格式 (Code, Date, Time, Action, Details, BlockCount)
        // 這裡可以加入一個隨機碼或流水號作為 Code，或留空
        const logEntry = `\n,${dateStr},${timeStr},${action},${details},${blockCount}`;
        
        this.buffer.push(logEntry);
        console.log(`[Log] ${action}: ${details}`);

        // 如果使用者有動作，且之前是閒置狀態，記錄「結束閒置」
        if (this.isIdle && action !== '閒置狀態') {
            this.isIdle = false;
            this.add('閒置結束', '使用者恢復操作');
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
            this.add('閒置狀態', '使用者超過2分鐘無操作');
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
                _this.add('分頁切換', '使用者切換到其他視窗');
                _this.save('分頁切換儲存');
            }
        });
    }
};
// ===============================================
// 每五分鐘儲存專案
// var oTimerId;
// function ReCalculate() {
//     clearTimeout(oTimerId); //清除存在的計時器
//     oTimerId = setTimeout("Timeout()", 5 * 60 * 1000); //設定計時5分鐘
// }
// function Timeout() {
//     ReCalculate(); //每五分鐘重設一次計時器
//     getDbFile(); //將log傳到資料庫儲存起來
//     console.log("每5分鐘儲存");
//     console.log(getDate() + "," + getTime());
//     // logs.push(`\n${getDate()},${getTime()},自動儲存,每五分鐘儲存`);
// }

// 閒置2分鐘儲存檔案
// var oTimerId2;
// function Timeout2() {
//     ReCalculate2(); //每2分鐘重設一次計時器
//     getDbFile(); //將log傳到資料庫儲存起來
//     console.log("閒置120秒儲存");
//     console.log(getDate() + "," + getTime());
//     logs.push(`\nIS,${getDate()},${getTime()},閒置儲存,閒置120秒儲存`);
// }
// function ReCalculate2() {
//     clearTimeout(oTimerId2); //清除存在的計時器
//     oTimerId2 = setTimeout("Timeout2()", 2 * 60 * 1000); //設定計時2分鐘
// }

//滑鼠向下案就會觸發重設兩分鐘及5分鐘的事件
//當玩家點擊左列9大類項目時重設
// document
//     .getElementsByClassName("scratchCategoryMenu")[0]
//     .addEventListener("mousedown", () => {
//         console.log("開始動作");
//         clearTimeout(oTimerId2);
//         clearTimeout(oTimerId);
//     });

//當玩家拖拉方塊時重設
// document
//     .getElementsByClassName("blocklyMainBackground")[0]
//     .addEventListener("mouseup", () => {
//         console.log("開始動作");
//         clearTimeout(oTimerId2);
//         clearTimeout(oTimerId);
//     });

// ReCalculate();
// ReCalculate2();

// 切換分頁的話儲存專案，並記錄log檔
// if (document.hidden !== undefined) {
//     //當頁面有改變的時候會觸發這個function
//     document.addEventListener("visibilitychange", () => {
//         if (document.hidden == true) {
//             getDbFile(); //將log傳到資料庫儲存起來
//             console.log("切換分頁儲存");
//             console.log(getDate() + "," + getTime());
//             logs.push(`\nPS,${getDate()},${getTime()},分頁切換,切換分頁儲存`); //將切換分頁的日期時間放入logs陣列裡
//         }
//     });
// }

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
    
    // 這裡執行顯示介面
    window.revealInterface();
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
        LogManager.add("AI_QA", `問:${userMessage} | 答:${response}`);
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
        LogManager.add("建立專案", 'code : CP');
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

    // //adapter 指示燈
    // var connectImg = document.createElement("img");
    // connectImg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // connectImg.setAttribute("id", "connectImg");
    // if ((localStorage.token == '') || (localStorage.token == "null")) {
    //     connectImg.src = 'data:image/png;base64,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';
    // } else {
    //     connectImg.src = "data:image/png;base64,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";
    // }
    // connectImg.setAttribute("onclick", "setToken()");
    // menubarR.appendChild(connectImg);

    // if((/^[^test]/).test(classno)){
    //     document.getElementById('chatbotButton').style.display='none';
    // }

    // 輔助教材 icon
    // var tutorialimg = document.createElement('img');
    // tutorialimg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // tutorialimg.setAttribute("id","tutorialimg");
    // tutorialimg.src = 'data:image/png;base64,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';
    // tutorialimg.setAttribute("onclick","link_tutor(tutor_url)");
    // menubarR.prepend(tutorialimg);
    // if((/^[^test]/).test(classno)){
    //     document.getElementById('tutorialimg').style.display='none';
    // }
    //指向教材的箭頭
    // var arrow =document.createElement('img');
    // arrow.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // arrow.setAttribute("id","blinking-icon");
    // arrow.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAB2AAAAdgB+lymcgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAO4SURBVHic7ZrPa1xVFMc/38lgKlJX6koXLnTTjc2ktbbdCMWNIk11oYIQauZFRFFBsbVq0zaKCCIi9ceM1eKPigj+AwohVVTMm3bnj1CFzHuzqDUhYqiZTGeOi5naNJmfnclLxtzP8twz533PZe659573wOFwOBwOh8PhcDgcjnWHVltAK9hE8l7E05gmKRT3a/uxmXZjds0E2I+P3UTswu9AvGKaRMW7lTh2pp24sfalRUTswvVcSh7gVqzne/O9nW2FbU9VhCRSp4HTS6zXAV+b7z10pWG7ZgIkjJI9DtiSoV7gE5vwRsxaX9JdUwMuYn7yBOjB6oN8ztzCoO48Pt9sPJkhTiWHsNguZHlKBIgQWYBiAYV4qNuPTncsgzaxH4ZuJB77BbimqoMYJ1/c0+wOIfO9w8CLDfz+AbIYISIEskghJUJQlvh8qM3HZ1tJpB3MH34B7Egdl6Z3CJnvnaNcTNplDshCZZJKBKCAWClEsYDzhUA7P/i7A8/BxgY3sPGqn4Cb67j9CQyoP/VtvVgy3zsL3NAJYU3wFxCCTUEsB6UQNIVZDikEsupPnW8mkGWSA5i+bOCWB/aqP3WiloPMT+4HvdJ8DivODFSWFhZg5EBBealZjtl8cLHIWcb7CmNXg3gGHCSRGpWW7SCVIphJvgl6YgWSWSn+AELK2/htzf3EPuLq2aQ2fbGw2PrfNmgZbxTjQAdFrj3Ed6iwW30fnrtkWoT5w4fAXopeWaScwXru0ZZ3foUqByHzh58DezV6XZEyQ0wD6nvvZNWToE14BxCjUauKmHng/ppHYct4z2K8FqGg1SDomsvQSlF9CWS85zFejlpMxOSRLV8C66YIlmyPtqbHL1sClW3w/578b1jPdm1Nj4M7CBEvH4WH38DsydXU1iKtH4XFx1zbm9Qtqfxic5xMch+sqeSngVwLl6FGGNgIfekj1S5DcdBTnc+hJh2+Dje8CeaRPaJE+tNaDnE61xit3xDp7clq09tznXiQjQ1uwPR6A7dpYLcS6boNkTjGUcTBBsGWtMQ0hcitVkuMjb3PgNXrBrXQEjOEP7wXcVdXNEXLb4h+plZT1DhJoTjQdFO0k+KiwDLeZxgPVB+8grZ4x5RFgE08ugOVvmG5bsM4TH/qULVKX4+uuQyZIVR6i+XJ55E9rC2pkVaTh8tfNq5tTg31AZuXWJuq9PXomn8ABc4ChUWWSVTc1qjv34iumQBtez9Eug8YA3uXheId7X4b4HA4HA6Hw+FwOBwOxzrlX4/1nMvFunzMAAAAAElFTkSuQmCC";
    // menubarR.prepend(arrow);
    // document.getElementById('blinking-icon').style.display='none';

    //CT教材 icon
    // var CTimg = document.createElement('img');
    // CTimg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // CTimg.setAttribute("id","CTimg");
    // CTimg.src='data:image/png;base64,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';
    // CTimg.setAttribute("onclick","link_tutor(CT_url)");
    // menubarR.appendChild(CTimg);
    // if((/^[^test]/).test(classno)){
    //     document.getElementById('CTimg').style.display='none';
    // }
    // 電子舉手
    /*
    var handsUpImg = document.createElement("img");
    handsUpImg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    handsUpImg.setAttribute("id", "handsUp");
    handsUpImg.src = 'data:image/png;base64,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';
    menubarR.prepend(handsUpImg);
    */

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
    // put the new logo in loge div
    // var scratchLogo = document.createElement("img");
    // scratchLogo.setAttribute("class", "menu-bar_scratch-logo_2uReV");
    // scratchLogo.src = "data:image/png;base64,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";
    // scratchLogDiv.prepend(scratchLogo);
    // const style = document.createElement("style");
    // style.innerHTML = `
    // .menu-bar_scratch-logo_2uReV {
    //     width: 70px !important;
    //     height: 60px !important;
    // }
    // `;
    // document.head.appendChild(style);
    // document.getElementsByClassName(
    //     "menu-bar_menu-bar-item_oLDa-"
    // )[1].style.display = "none"; // hide the blank div
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
    // 顯示目前新增的block數
    var blocklynum = document.createElement("span");
    blocklynum.setAttribute("class", "menu-bar_menu-bar-item_oLDa-1");
    blocklynum.textContent = "積木數量： " + Move_count;
    menubarL2.appendChild(blocklynum);
    // blocklynum.style.display = "none"; //隱藏顯示積木的次數
    // 在儲存檔案旁建立分隔虛線
    // var divLine1 = document.createElement("div");
    // divLine1.setAttribute("class", "divider_divider_1_Adi menu-bar_divider_2VFCm");
    // menubarL2.appendChild(divLine1);
    // 重製按鈕
    // var resetbtn = document.createElement('img');
    // resetbtn.src = 'data:image/png;base64,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';
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


    // hint text 提示文字
    // var hint_txt = document.createElement('span');
    // hint_txt.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    // hint_txt.setAttribute("id","hinttext");
    // hint_txt.textContent = "任務提示：";
    // menubarL2.appendChild(hint_txt);
    // hint icon 提示 icon
    // var hint = document.createElement('img');
    // hint.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    // hint.setAttribute("id","hintimg");
    // hint.src = 'data:image/png;base64,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';
    // hint.setAttribute("onclick","hint_link()");
    // menubarL2.appendChild(hint);
    // if(!(/^test/).test(classno) || localStorage.ProjName == '任務1' || localStorage.ProjName == '特別任務1' || localStorage.ProjName == '特別任務2'){
    //     hint.style.display = 'none';
    //     hint_txt.style.display='none';
    //     divLine2.style.display = 'none';
    // }
    // 任務提示出現
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
        LogManager.add("執行專案", snapshot.replace(/\n/g, ' | '));
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
        LogManager.add("CP 暫停", "點擊暫停按鍵");
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
        LogManager.add("RR", "刪除角色");
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
        LogManager.add("CR", "切換角色");
        LogManager.add("WC", "畫布變更");
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
        LogManager.add("CR 新增角色", "新增角色");
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
        LogManager.add("新增積木", blockType);
        // logs.push(`${getDate()},${getTime()},新增積木,${blockType}`);
        updateBlockStats(workspace);
        if (isExperimentGroup()) checkExperimentCondition();

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
        LogManager.add("刪除積木", details);
        // logs.push(`${getDate()},${getTime()},刪除積木,${deletedStackTypes.join('|')}`);
        // 上傳到 Firebase 的紀錄（整疊）
        // uploadLogToFirebase(userId, {
        //     time: now,
        //     action: "delete",
        //     blocks: deletedStackTypes,
        //     xml: xmlNode ? new XMLSerializer().serializeToString(xmlNode) : ""
        // });

        updateBlockStats(workspace);
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

    if (loopUsed) showEncouragementMessage("你已經學會使用迴圈囉！👍");
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

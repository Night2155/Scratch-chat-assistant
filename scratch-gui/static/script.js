const siteUrl = 'https://mmn.easylearn.org/';
const config = { apiKey: "\x41\x49\x7a\x61\x53\x79\x42\x32\x56\x6d\x37\x66\x39\x38\x6c\x61\x59\x41\x76\x4a\x74\x6e\x72\x42\x63\x71\x59\x41\x57\x6f\x51\x37\x75\x77\x33\x34\x71\x63\x45", authDomain: "\x66\x69\x72\x65\x75\x70\x6c\x6f\x61\x64\x2d\x65\x64\x34\x36\x64\x2e\x66\x69\x72\x65\x62\x61\x73\x65\x61\x70\x70\x2e\x63\x6f\x6d", databaseURL: "\x68\x74\x74\x70\x73\x3a\x2f\x2f\x66\x69\x72\x65\x75\x70\x6c\x6f\x61\x64\x2d\x65\x64\x34\x36\x64\x2e\x66\x69\x72\x65\x62\x61\x73\x65\x69\x6f\x2e\x63\x6f\x6d", projectId: "\x66\x69\x72\x65\x75\x70\x6c\x6f\x61\x64\x2d\x65\x64\x34\x36\x64", storageBucket: "\x66\x69\x72\x65\x75\x70\x6c\x6f\x61\x64\x2d\x65\x64\x34\x36\x64\x2e\x61\x70\x70\x73\x70\x6f\x74\x2e\x63\x6f\x6d", messagingSenderId: "\x34\x30\x39\x37\x38\x39\x35\x38\x33\x35\x35\x38", appId: "\x31\x3a\x34\x30\x39\x37\x38\x39\x35\x38\x33\x35\x35\x38\x3a\x77\x65\x62\x3a\x37\x34\x31\x62\x31\x31\x62\x64\x31\x30\x34\x38\x30\x35\x65\x61\x63\x36\x38\x37\x63\x37" };
firebase.initializeApp(config);
let logs = [];
var clickCatTimes = 0;
var handsUpTimes = 0;
let urlParams = new URLSearchParams(window.location.search);
identity = urlParams.get('i');
localStorage.identity = identity;
classno = urlParams.get('classno');
localStorage.classno = classno;
userno = urlParams.get('no');
localStorage.no = userno;
example = urlParams.get('e');
localStorage.example = example;

if (userno == null) {
    window.location.href = siteUrl + '/Login';
}

username = urlParams.get('name');
localStorage.username = username;

promptProjName = urlParams.get('p');
localStorage.ProjName = promptProjName;

$(document).ready(function () {
document.getElementsByClassName('menu_menu-item_3EwYA menu_hoverable_3u9dt menu_menu-section_2U-v6')[1].setAttribute('onclick','checkLoadProjName(promptProjName)');
    checkProjName();
    eventCore();
    removeUI();
    createUI();
    ipBoo();
    handsUpBoo();
    newUrlBoo();
    document.getElementsByClassName('menu_menu-item_3EwYA menu_hoverable_3u9dt')[3].style.display = 'none';
    document.getElementsByClassName('menu_menu-item_3EwYA menu_hoverable_3u9dt')[3].click();
});

function getDate() {
    let d = new Date();
    let getDate = d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
    return getDate;
}

function getTime() {
    let d = new Date();
    let getTime = d.getHours() + ":" + d.getMinutes() + ":" + d.getSeconds();
    return getTime;
}

function checkProjName() {
if (example == null){
	if ((promptProjName == null) || (promptProjName == '') || (promptProjName == 'null')) {
        	do {
            	promptProjName = prompt("請輸入專案名稱", '');
            	localStorage.ProjName = promptProjName;
            	window.location.href = `http://ct.easylearn.org:8060/?classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${promptProjName}&i=${localStorage.identity}`;
        	} while (localStorage.ProjName == 'null' || localStorage.ProjName == '');
    	}
} else {
	if ((promptProjName == null)||(localStorage.ProjName == 'null')){
		do {
			promptProjName = prompt("請輸入新專案名稱", '');
			localStorage.ProjName = promptProjName;
			window.location.href = `https://ct.easylearn.org/?e=${localStorage.example}&classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${promptProjName}&i=${localStorage.identity}`;
		} while (localStorage.ProjName == 'null' || localStorage.ProjName == '');
	}
}

    // document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value = promptProjName;
    document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].setAttribute('value', promptProjName);
    checkLoadProjName(promptProjName);
}

function checkLoadProjName(promptProjName) {
    var sourceName;
if (example == null){
    setInterval(function () {
        var checkProjName = document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value;
        if (checkProjName != promptProjName) {
            sourceName = checkProjName;
            console.log(`${getDate()},${getTime()},讀取專案,${checkProjName}`);
            logs.push(`\n${getDate()},${getTime()},讀取專案,${checkProjName}`);
            document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value = promptProjName;
            document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].setAttribute('value', promptProjName);
        }
    }, 1000);
    } else {
	console.log(`${getDate()},${getTime()},讀取專案,${example}`);
        logs.push(`\n${getDate()},${getTime()},讀取專案,${example}`);
        console.log(`${getDate()},${getTime()},改編專案,${promptProjName}`);
        logs.push(`\n${getDate()},${getTime()},改編專案,${promptProjName}`);
        document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value = promptProjName;
        document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].setAttribute('value', promptProjName);
    }
}

function eventCore() {
    if (document.addEventListener) {
        document.addEventListener("click", function (event) {
            var targetElement = event.target || event.srcElement;
            if (targetElement.className == "injectionDiv") {
                if (document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length != 0) {
                    logs.push(`\n${getDate()},${getTime()},工作區變更,`);
                    for (i = 0; i < document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length; i++) {
                        console.dir('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
                        logs.push('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
                        clickCatTimes = 0; //如果有拖拉積木，視為找到想要的積木
                    }
                }
            }
            clickUI(targetElement);     // record click button or another UI on the page
            clickSprite(targetElement); // record click Sprite events
            clickCat(targetElement);    // record click category events
        });
    }
    else if (document.attachEvent) {
        document.attachEvent("onclick", function () {
            var targetElement = event.target || event.srcElement;
            if (targetElement.className == "injectionDiv") {
                if (document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length != 0) {
                    logs.push(`\n${getDate()},${getTime()},工作區變更,`);
                    for (i = 0; i < document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length; i++) {
                        console.dir('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
                        logs.push('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
                        clickCatTimes = 0;
                    }
                }
            }
            clickUI(targetElement);     // record click button or another UI on the page
            clickSprite(targetElement); // record click Sprite events
            clickCat(targetElement);    // record click category events
        });
    }
}

function removeUI() {
    $('.menu-bar_mystuff-button_16jPf').remove(); // 移除資料夾
    $('.menu-bar_feedback-link_1BnAR').remove(); // 移除回饋意見
    $('.community-button_community-button_2Lo_g').remove(); // 移除切換專案頁面按鈕
    $('.share-button_share-button_Nxxf0').remove(); // 移除分享按鈕
    $('.menu-bar_dropdown-caret-icon_FkdUe').remove(); // 移除右上角使用者名稱旁的下拉選單icon 三角形
    $('.backpack_backpack-container_2_wGr').remove(); // 移除背包
    $('.__react_component_tooltip').remove(); // 移除提示
    document.querySelector('[aria-label="教程"]').style.display = "none"; // 移除教程
    $('.menu-bar_divider_2VFCm').remove(); // 移除分隔虛線

    // Because comment out "if (!open) return null" cause dropdown menu always open. So hide dropdown menu, file and edit. 
    document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'none'; // file menu
    document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'none'; // edit menu
    document.getElementsByClassName("menu-bar_language-menu_2JEDx")[0].style.display = 'none'; // 隱藏語言選單
    document.getElementsByClassName("menu-bar_coming-soon_3yU1L")[3].style.display = 'none'; // 隱藏右上角username

    document.getElementsByClassName('menu-bar_menu-bar-item_oLDa- menu-bar_growable_1sHWN')[0].style.display = 'none'; // 隱藏輸入專案名稱
}

function createUI() { // must remove UI first, otherwise the sequence will be wrong
    var menubarR = document.getElementsByClassName('menu-bar_account-info-group_MeJZP')[0];

    //adapter 指示燈
    var connectImg = document.createElement("img");
    connectImg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    connectImg.setAttribute("id", "connectImg");
    connectImg.src = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iN21tIgogICBoZWlnaHQ9IjdtbSIKICAgdmlld0JveD0iMCAwIDI0LjgwMzE1IDI0LjgwMzE0OSIKICAgaWQ9InN2ZzIiCiAgIHZlcnNpb249IjEuMSIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9Imljb24tLWluZGljYXRvcl9yZWQuc3ZnIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCIgLz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9ImJhc2UiCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEuMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMC4wIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6em9vbT0iMS40IgogICAgIGlua3NjYXBlOmN4PSI0NC43NzYyNzUiCiAgICAgaW5rc2NhcGU6Y3k9Ijg4LjQ5NzIwMiIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0icHgiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ibGF5ZXIxIgogICAgIHNob3dncmlkPSJmYWxzZSIKICAgICBmaXQtbWFyZ2luLXRvcD0iMSIKICAgICBmaXQtbWFyZ2luLWxlZnQ9IjEiCiAgICAgZml0LW1hcmdpbi1yaWdodD0iMSIKICAgICBmaXQtbWFyZ2luLWJvdHRvbT0iMSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjE0NDAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iODE1IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiIC8+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTI3OC42Mjc2OSwtMzQ0LjkyNjg5KSI+CiAgICA8Y2lyY2xlCiAgICAgICBzdHlsZT0ib3BhY2l0eToxO2ZpbGw6I2ZmMzM1NTtmaWxsLW9wYWNpdHk6MC45NDExNzY0NztzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MC4xO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgICBpZD0icGF0aDQxMzYiCiAgICAgICBjeD0iMjkxLjAyOTI3IgogICAgICAgY3k9IjM1Ny4zMjg0NiIKICAgICAgIHI9IjguODU4MjY3OCIgLz4KICA8L2c+Cjwvc3ZnPgo=';
    menubarR.appendChild(connectImg);

    // 電子舉手
    var handsUpImg = document.createElement("img");
    handsUpImg.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    handsUpImg.setAttribute("id", "handsUp");
    handsUpImg.src = 'data:image/png;base64,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';
    menubarR.prepend(handsUpImg);

    // create loge div upper left corner
    var menubarL = document.getElementsByClassName('menu-bar_file-group_1_CHX')[0];
    var scratchLogDiv = document.createElement("div");
    scratchLogDiv.setAttribute("id", "scratchLogDiv");
    scratchLogDiv.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    scratchLogDiv.setAttribute("onclick", "location.href='https://mmn.easylearn.org/';");
    scratchLogDiv.style.cssText = 'padding-left: 1.25rem;';
    menubarL.prepend(scratchLogDiv);
    // put the new logo in loge div
    var scratchLogo = document.createElement("img");
    scratchLogo.setAttribute("class", "menu-bar_scratch-logo_2uReV");
    //scratchLogo.src = 'static/assets/1e9652bec24bcaacf5285be19746a750.svg';
    scratchLogo.src = 'data:image/png;base64,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';
    scratchLogDiv.prepend(scratchLogo);
    document.getElementsByClassName("menu-bar_menu-bar-item_oLDa-")[1].style.display = 'none'; // hide the blank div
    // create 儲存檔案 div
    var downloadSB3 = document.createElement("div");
    downloadSB3.setAttribute("class", "menu-bar_menu-bar-item_oLDa- menu-bar_hoverable_c6WFB");
    downloadSB3.setAttribute("id", "downloadSB3");
    downloadSB3.textContent = "儲存並下載檔案";
    menubarL.appendChild(downloadSB3);

    // 在儲存檔案旁建立分隔虛線
    var divLine = document.createElement("div");
    divLine.setAttribute("class", "divider_divider_1_Adi menu-bar_divider_2VFCm");
    menubarL.appendChild(divLine);
    // 輸入專案名稱旁加入文字標題
    var projLable = document.createElement('div');
    projLable.setAttribute("id", "projName");
    projLable.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    projLable.textContent = "專案名稱： " + localStorage.ProjName;
    menubarL.appendChild(projLable);

    // 將載入畫面時輸入的使用者資訊顯示出來
    var menubarL2 = document.getElementsByClassName('menu-bar_main-menu_3wjWH')[0];
    // 加入班級名稱
    var classname = document.createElement('div');
    classname.setAttribute("id", "classname");
    classname.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    classname.textContent = "班級： " + classno;
    menubarL2.appendChild(classname);
    // 顯示學生名稱
    var name = document.createElement('div');
    name.setAttribute("id", "username");
    name.setAttribute("class", "menu-bar_menu-bar-item_oLDa-");
    name.textContent = "學生姓名： " + username;
    menubarL2.appendChild(name);
    
}

function clickUI(targetElement) {
    // because comment out "if (!open) return null" cause dropdown menu always open, this code can bring back functioning normally
    if (targetElement.textContent == "檔案" || targetElement.textContent == "檔案新建專案從你的電腦挑選下載到你的電腦") {
        document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'none';
        if (document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display == 'none') {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'inline';
        } else {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'none';
        }
    } else if (targetElement.textContent == "編輯" || targetElement.textContent == "編輯復原開啟加速模式") {
        document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'none';
        if (document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display == 'none') {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'inline';
        } else {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'none';
        }
    } else {
        if (document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display == 'inline' ||
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display == 'inline') {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'none';
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'none';
        } else {
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[0].style.display = 'none';
            document.getElementsByClassName("menu-bar_menu-bar-menu_239MD")[1].style.display = 'none';
        }
    }

    if (targetElement.id == "downloadSB3") {
        // cilck 下載到你的電腦 in file dropdown menu 觸發 gui download-blob.js
        document.getElementsByClassName("menu_menu-item_3EwYA menu_hoverable_3u9dt")[2].click();
        getDbFile();
    }

    if (targetElement.id == "handsUp") {
        if (handsUpTimes > 4) {
            alert('已舉手讓老師知道');
        } else {
            handsUpTimes++;
            logs.push(`\n${getDate()},${getTime()},電子舉手,${handsUpTimes}`);

            const handsUpRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/handsUp/`);
            var handsUpItem = {
                times: handsUpTimes,
                state: true
            }
            handsUpRef.update(handsUpItem);
        }

    }

    if (targetElement.className == "green-flag_green-flag_1kiAo") {
        // when click green flag, puts logs and save blocls on the sprite's workspace to the localStorage
        logs.push(`\n${getDate()},${getTime()},執行,點擊執行旗幟`);

        saveLastWorkSpace();
        Object.keys(localStorage)
            .forEach(function (key) {
                if (/^sprite:/.test(key)) {
                    console.log('\n' + key + '\n ' + localStorage[key]);
                    logs.push(`\n${getDate()},${getTime()},執行,${key}工作區：${localStorage[key]}`);
                }
            });
    }

    if (targetElement.className == "stop-all_stop-all_1Y8P9") { // record click stop icon
        logs.push(`\n${getDate()},${getTime()},暫停,點擊暫停`);
    }

    if (targetElement.textContent == "新建專案") {
        var creatNew = confirm("新建專案並捨棄目前專案嗎？");
        if (creatNew == true) {
            window.location.href = `http://ct.easylearn.org:8060/?no=${localStorage.no}&name=${localStorage.username}`;
        }
    }

}

function clickSprite(targetElement) { // this function is for Bottom right corner, sprite area
    if (targetElement.className == "delete-button_delete-icon_3b8wH") {
        console.log('(刪除角色)');
        logs.push(`\n${getDate()},${getTime()},角色,刪除角色`);
    }

    // if click sprite img to chang sprite's workspace will run this code
    if (targetElement.className == "sprite-selector-item_sprite-image-inner_3oSwi" ||
        targetElement.className == "sprite-selector-item_sprite-name_1PXjh" ||
        targetElement.className == "sprite-selector-item_sprite-info_-I0i_" ||
        targetElement.className == "react-contextmenu-wrapper sprite-selector_sprite_21WnR sprite-selector-item_sprite-selector-item_kQm-i sprite-selector-item_is-selected_24tQj") {
        saveLastWorkSpace();
        console.log('(切換角色)在 ' + document.getElementsByClassName('sprite-info_sprite-input_17wjb')[0].value + ' WorkSpace 上的 Blocks 如下');
        logs.push(`\n${getDate()},${getTime()},角色,切換角色`);
        logs.push(`\n${getDate()},${getTime()},工作區變更,`);

        if (document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length != 0) {
            for (i = 0; i < document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length; i++) {
                console.dir('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
                logs.push('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
            }
        } else {
            console.log('(空白)');
            logs.push('> (空白)');
        }
    }

    // if click add sprite icon on the bottom right corner
    if (targetElement.className == "action-menu_button_1qbot action-menu_main-button_3ccfy" ||
        targetElement.className == "action-menu_main-icon_1ktMc") {
        saveLastWorkSpace();
    }
}

function clickCat(targetElement) { // all click category events

    if (targetElement.textContent == "動作" || targetElement.parentNode.textContent == "動作") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「動作」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,動作`);
    }

    if (targetElement.textContent == "外觀" || targetElement.parentNode.textContent == "外觀") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「外觀」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,外觀`);
    }

    if (targetElement.textContent == "音效" || targetElement.parentNode.textContent == "音效") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「音效」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,音效`);
    }

    if (targetElement.textContent == "事件" || targetElement.parentNode.textContent == "事件") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「事件」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,事件`);
    }

    if (targetElement.textContent == "控制" || targetElement.parentNode.textContent == "控制") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「控制」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,控制`);
    }

    if (targetElement.textContent == "偵測" || targetElement.parentNode.textContent == "偵測") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「偵測」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,偵測`);
    }

    if (targetElement.textContent == "運算" || targetElement.parentNode.textContent == "運算") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「運算」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,運算`);
    }

    if (targetElement.textContent == "變數" || targetElement.parentNode.textContent == "變數") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「變數」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,變數`);
    }

    if (targetElement.textContent == "函式積木" || targetElement.parentNode.textContent == "函式積木") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「函式積木」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,函式積木`);
    }

    if (targetElement.textContent == "Images" || targetElement.parentNode.textContent == "Images") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「Images」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,Images`);
    }

    if (targetElement.textContent == "音樂" || targetElement.parentNode.textContent == "音樂") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「音樂」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,音樂`);
    }

    if (targetElement.textContent == "畫筆" || targetElement.parentNode.textContent == "畫筆") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「畫筆」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,畫筆`);
    }

    if (targetElement.textContent == "視訊偵測" || targetElement.parentNode.textContent == "視訊偵測") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「視訊偵測」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,視訊偵測`);
    }

    if (targetElement.textContent == "文字轉語音" || targetElement.parentNode.textContent == "文字轉語音") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「文字轉語音」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,文字轉語音`);
    }

    if (targetElement.textContent == "翻譯" || targetElement.parentNode.textContent == "翻譯") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「翻譯」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,翻譯`);
    }

    if (targetElement.textContent == "Makey Makey" || targetElement.parentNode.textContent == "Makey Makey") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「Makey Makey」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,Makey Makey`);
    }

    if (targetElement.textContent == "micro:bit" || targetElement.parentNode.textContent == "micro:bit") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「micro:bit」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,micro:bit`);
    }

    if (targetElement.textContent == "LEGO EV3" || targetElement.parentNode.textContent == "LEGO EV3") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「LEGO EV3」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,LEGO EV3`);
    }

    if (targetElement.textContent == "BOOST" || targetElement.parentNode.textContent == "BOOST") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「BOOST」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,BOOST`);
    }

    if (targetElement.textContent == "WeDo 2.0" || targetElement.parentNode.textContent == "WeDo 2.0") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「WeDo 2.0」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,WeDo 2.0`);
    }

    if (targetElement.textContent == "Twitter" || targetElement.parentNode.textContent == "Twitter") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「Twitter」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,Twitter`);
    }

    if (targetElement.textContent == "語音辨識" || targetElement.parentNode.textContent == "語音辨識") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「語音辨識」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,語音辨識`);
    }

    if (targetElement.textContent == "Force and Acceleratio" || targetElement.parentNode.textContent == "Force and Acceleratio") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「Force and Acceleratio」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,Force and Acceleratio`);
    }

    if (targetElement.textContent == "usbMicrobit" || targetElement.parentNode.textContent == "usbMicrobit") {
        checkClickCat();
        console.log('\n ' + new Date().toLocaleString() + ' 點擊了選單中的「usbMicrobit」類別');
        logs.push(`\n${getDate()},${getTime()},點擊類別,usbMicrobit`);
    }
}

function getDbFile() {
    // 為了複寫 logs file, 所以需要判斷 db 中是否有 file
    const logsFileRef = firebase.storage().ref(`${localStorage.identity}/${classno}/${userno}/Projects/${promptProjName}/${username}_${promptProjName}.csv`);
    logsFileRef.getDownloadURL().then(onResolve, onReject);

    function onResolve(foundURL) {
        logsFileRef.getDownloadURL().then(function (foundURL) {
            var storedText;
            fetch(foundURL)
                .then(function (response) {
                    response.text().then(function (text) {
                        storedText = text;
                        create('\uFEFF' + storedText + '\n\n' + getDate() + ',' + getTime() + ',專案,接續專案：' + promptProjName + logs.join(' '),
                            username + '_' + promptProjName + '_' + new Date().toLocaleString() + '.csv',
                            'text/csv;charset=utf-8');
                    });
                });
        });
    }
    function onReject(error) {
        //fill not found
        console.log("notfoundURL");
        console.log(error.code);
        create('\uFEFFDate,Time,Action,Details\n' + getDate() + ',' + getTime() + ',專案,第一次新增專案：' + promptProjName + logs.join(' '),
            username + '_' + promptProjName + '_' + new Date().toLocaleString() + '.csv',
            'text/csv;charset=utf-8');
    }
}

function create(text, name, type) { // create logs file
    var file = new Blob([text], { type: type });
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = URL.createObjectURL(file);
    // a.download = name;
    // document.body.appendChild(a);
    // a.click();

    var storage = firebase.storage();
    var projName = promptProjName;
    var storageRef = storage.ref(`${localStorage.identity}/${classno}/${userno}/Projects/${projName}/${username}_${promptProjName}.csv`);
    storageRef.put(file);
}

function saveLastWorkSpace() {
    var tmpLogs = [];   // 建立暫時用陣列
    if (document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length != 0) {
        for (i = 0; i < document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes.length; i++) {
            // 將當前 workspace 中的 blocks 存到 暫時用陣列
            tmpLogs.push('>' + document.getElementsByClassName('blocklyBlockCanvas')[0].childNodes[i].textContent);
        }
    } else {
        console.log('> (空白)');
    }
    var spriteName = document.getElementsByClassName('sprite-info_sprite-input_17wjb')[0].value;
    localStorage.setItem("sprite:" + spriteName, tmpLogs.join(' ')); // 將當前角色與workspace 中的 blocks 儲存到 localStorage
}

function ipBoo() {
    $.getJSON('https://ipapi.co/json/', (data) => {
        const studentsIpRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/lastIp`);
        studentsIpRef.on('value', (snapshot2) => {
            const lastIp = snapshot2.val();
            if (data.ip !== lastIp) {
                alert('此設備已被登出');
                window.location.href = siteUrl + '/Login';
            }
        });
    });
}

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

function newUrlBoo() {
    const studentsnewUrlRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/newUrl`);
    studentsnewUrlRef.on('value', (snapshot4) => {
        let newUrl = snapshot4.val();
        if ((newUrl != null)) {
            if (newUrl !== '#') {
                if (newUrl !== window.location.href) {
                    alert('更改網址為：' + newUrl);

			if (newUrl.match('http') == null){
				const head = 'http://';
				newUrl = `${head}${newUrl}`;
			} else {
				newUrl = newUrl;	
			}
		window.location.href = newUrl;
                }
            }
        }
    });

    const studentsnewProjRef = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/newProjName`);
    studentsnewProjRef.on('value', (snapshot5) => {
        let newProj = snapshot5.val();
        if ((newProj != null)) {
            if (newProj !== '#') {
                if (newProj !== promptProjName) {
                    alert('更改專案名稱為：' + newProj);
                    window.location.href = `http://ct.easylearn.org:8060/?classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${newProj}&i=${localStorage.identity}`;
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
                alert('已舉手呼叫老師');
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

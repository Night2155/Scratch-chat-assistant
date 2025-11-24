import minilog from 'minilog';
minilog.enable();

//setInterval(function () {
//    var img;
//    img = new Image();
//    img.src = "chrome-extension://mmnalgcgfjpmpfcdcnmnloplfnfpdfcj/icon.png";
//    img.onload = function () {
//    };
//    img.onerror = function () {
//        alert('尚未安裝工具，請先安裝課程工具');
//        window.location.href = 'https://chrome.google.com/webstore/detail/mmn-scratch/mmnalgcgfjpmpfcdcnmnloplfnfpdfcj';
//    };
//}, 1000);

setTimeout(function () {

    /*add jquery cdn*/
    var script3 = document.createElement('script');
    script3.type = 'text/javascript';
    //script3.src = 'https://ct.easylearn.org:8060/static/script.js';
    script3.src = 'http://localhost:8060/static/script3.js';
    document.body.append(script3);
}, 1500);

export default minilog('gui');



export default (filename, blob) => {

    // var blockMapUrl = "http://ct.easylearn.org:8060/static/blockdata.js";
    var blockMapUrl = "http://localhost:8060/static/blockdata.js";
    var blockMap;
    $.ajax({
        url: blockMapUrl,
        json: "text"
    }).done(function (data) {
        eval("blockMap =" + data + ";");
    });

    var config = {
        apiKey: "AIzaSyB2Vm7f98laYAvJtnrBcqYAWoQ7uw34qcE",
        authDomain: "fireupload-ed46d.firebaseapp.com",
        databaseURL: "https://fireupload-ed46d.firebaseio.com",
        projectId: "fireupload-ed46d",
        storageBucket: "fireupload-ed46d.appspot.com",
        messagingSenderId: "409789583558",
        appId: "1:409789583558:web:741b11bd104805eac687c7"
    };

    if (!firebase.apps.length) {
        firebase.initializeApp(config);
    }


    const downloadLink = document.createElement('a');
    document.body.appendChild(downloadLink);

    // Use special ms version if available to get it working on Edge.
    if (navigator.msSaveOrOpenBlob) {
        navigator.msSaveOrOpenBlob(blob, filename);
        return;
    }

    //var projName = document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value;
    // var projName = localStorage.ProjName;
    var projName = new URLSearchParams(window.location.search).get('p');
    const url = window.URL.createObjectURL(blob);
    downloadLink.href = url;
    // alert("已儲存");
    if (blob.type == 'application/x.scratch.sb3') {
        downloadLink.download = projName + '.sb3';
    }
    else {
        downloadLink.download = filename;
        downloadLink.type = blob.type;
    }
    // downloadLink.click();
    var storage = firebase.storage();
    var sb3Name = Date.now();

    //var projName = document.getElementsByClassName('menu-bar_title-field-growable_3qr4G')[0].value;
    var storageRef = firebase.storage().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/Projects/${projName}/${sb3Name}.sb3`);

    var sb3Ref = firebase.database().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/Projects/${projName}/${sb3Name}/`);

    var d = new Date();
    var projTime = d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日 " + d.getHours() + "點" + d.getMinutes() + "分" + d.getSeconds() + "秒";


    var sb3Item = {
        time: projTime,
        sb3name: sb3Name
    }
    sb3Ref.update(sb3Item);
    storageRef.put(blob);
    var storageRef2 = firebase.storage().ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/Projects/${projName}/lastest.sb3`);
    storageRef2.put(blob);
    /*window.URL.revokeObjectURL(url);
    document.body.removeChild(downloadLink);*/


    // -- 儲存 project code
    var fullUrl;
    var derpyList = "";
    var blockData;
    $.ajax({
        url: blockMapUrl,
        json: "text"
    }).done(function (data) {
        eval("blockMap =" + data + ";");
    });
    var request = new XMLHttpRequest();
    const fileRef = firebase.storage().ref(`students/${localStorage.classno}/${localStorage.no}/Projects/${projName}/project.json`);
    fileRef.getDownloadURL().then(function (url) {
        request.open('GET', url, true);
        console.log(url);
        fullUrl = url;

        $.ajax({
            url: url,
            json: "json"
        }).done(function (data) {
            console.log(data);
            var project = data;
            let simpleProject = {
                sources: project.targets.map((stuff, index) => {
                    return {
                        name: stuff["name"],
                        blocks: getAllBlocks(stuff["blocks"]),
                    }
                })
            }
            $("#code").text(derpyList);
            console.log(derpyList);
            var type = 'text/plain; charset=utf-8';
            var file = new Blob([derpyList], { type: type });
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = URL.createObjectURL(file);
            var storage = firebase.storage();
            var projName = ProjName;
            var storageRef = storage.ref(`${localStorage.identity}/${localStorage.classno}/${localStorage.no}/Projects/${projName}/projectcode.txt`);
            storageRef.put(file);
            
            downloadLink.click();
        });
        request.send();
    });

    function getAllBlocks(blocks) {
        document.pro = blocks;
        blockData = [];
        for (var blockID in blocks) {
            blockData.push({
                opcode: blocks[blockID].opcode,
                parent: blocks[blockID].parent,
                child: blocks[blockID].child
            });
            var block = getBlock(blocks[blockID], blocks);

            if (blocks[blockID].parent === null) {
                derpyList += "\n" + block + "\n";
                getNextOf(blocks[blockID], blocks, 0);
            }
        };
        return blockData;
    }

    function getNextOf(block, allBlocks, output, string) {
        if (block.next !== null) {
            var blockChild = getBlock(allBlocks[block.next], allBlocks);
            if (output == 1) {
                return blockChild;
            } else if (output == 2) {
                var newString = string += "\n" + blockChild
                return (getNextOf(allBlocks[block.next], allBlocks, output, newString));
            } else {
                derpyList += blockChild + "\n";
                getNextOf(allBlocks[block.next], allBlocks, output, string);
            }
        } else if (output == 2) {
            return string;
        }
    }

    function getBlock(block, allBlocks) {
        var thing = block.opcode;
        if (blockMap.hasOwnProperty(thing)) {
            var blockCode = blockMap[thing].blockcode
            blockCode = blockCode.split(" ");
            var input = 0;
            var field = 0;
            blockCode.forEach(function (item, index) {
                var substack = "";
                switch (item) {
                    default:
                        blockCode[index] = blockCode[index];
                        break;
                    case "%n":
                        if (Object.keys(block.inputs).length > input) {
                            var condition = block.inputs[Object.keys(block.inputs)[input]];
                            if (condition[1] !== null) {
                                if (allBlocks.hasOwnProperty(condition[1])) {
                                    blockCode[index] = "(" + getBlock(allBlocks[condition[1]], allBlocks, 1) + ")";
                                } else {
                                    blockCode[index] = "(" + condition[1][1] + ")"
                                }
                            } else {
                                blockCode[index] = "()";
                            }
                        } else {
                            blockCode[index] = "()";
                        }
                        input++;
                        break;
                    case "%c":
                        if (Object.keys(block.inputs).length > input) {
                            blockCode[index] = "[" + block.inputs[Object.keys(block.inputs)[input]][1][1] + "]";
                        } else {
                            blockCode[index] = "[#FF00FF]"
                        }
                        input++;
                        break;
                    case "%s":
                        if (Object.keys(block.inputs).length > input) {
                            var condition = block.inputs[Object.keys(block.inputs)[input]];
                            if (condition[1] !== null) {
                                if (allBlocks.hasOwnProperty(condition[1])) {
                                    blockCode[index] = "(" + getBlock(allBlocks[condition[1]], allBlocks, 1) + ")";
                                } else {
                                    blockCode[index] = "[" + condition[1][1] + "]"
                                }
                            } else {
                                blockCode[index] = "[]";
                            }
                        } else {
                            blockCode[index] = "[]";
                        }
                        input++;
                        break;
                    case "%r":
                        if (Object.keys(block.inputs).length > input) {
                            var condition = block.inputs[Object.keys(block.inputs)[input]];
                            if (condition[1] !== null) {
                                if (block.opcode == "sensing_keypressed") {
                                    //alert('do i fire? ' + getBlock(allBlocks[condition[1]], allBlocks, 1));
                                    blockCode[index] = getBlock(allBlocks[condition[1]], allBlocks, 1);
                                } else {
                                    blockCode[index] = "(" + condition[0] + " v)"
                                }
                            } else {
                                blockCode[index] = "( v)";
                            }
                        } else {
                            blockCode[index] = "( v)";
                        }
                        input++;
                        break;
                    case "%m":
                        if (Object.keys(block.fields).length >= field) {
                            blockCode[index] = "[" + block.fields[Object.keys(block.fields)[field]][0] + " v]";
                        } else {
                            blockCode[index] = "[ v]";
                        }
                        field++;
                        break;
                    case "%b":
                        if (Object.keys(block.inputs).length > input) {
                            var condition = block.inputs[Object.keys(block.inputs)[input]];
                            if (condition[1] !== null) {
                                if (allBlocks.hasOwnProperty(condition[1])) {
                                    blockCode[index] = "<" + getBlock(allBlocks[condition[1]], allBlocks, 1) + ">";
                                } else {
                                    blockCode[index] = "<" + condition[1][1] + ">"
                                }
                            } else {
                                blockCode[index] = "<>";
                            }
                        } else {
                            blockCode[index] = "<>";
                        }
                        input++;
                        break;
                    case "{}":
                        if (Object.keys(block.inputs).length > input) {
                            var subTop = block.inputs[Object.keys(block.inputs)[input]];
                            if (subTop[1] !== null) {
                                var firstBlock = "\n" + getBlock(allBlocks[subTop[1]], allBlocks);
                                substack += (getNextOf(allBlocks[subTop[1]], allBlocks, 2, firstBlock));
                                if (block.opcode == "control_if_else" && input == 1) {
                                    blockCode[index] = substack + "\n";
                                } else {
                                    blockCode[index] = substack + "\nend";
                                }
                            } else {
                                if (block.opcode == "control_if_else" && input == 1) {
                                    blockCode[index] = "\n" + substack + "\n";
                                } else {
                                    blockCode[index] = substack + "\nend";
                                }
                            }
                        } else {
                            if (block.opcode == "control_if_else" && input == 1) {
                                blockCode[index] = "\n" + substack + "\n";
                            } else {
                                blockCode[index] = substack + "\nend";
                            }
                        }
                        input++
                        break;
                }

            });
            if (block.opcode == "sensing_keypressed") {
                return blockCode.join(" ");
            }
            return blockCode.join(" ");
        } else if (block.opcode == "procedures_definition") {
            var condition = block.inputs.custom_block[1];
            return getBlock(allBlocks[condition], allBlocks, 1)
        } else if (block.opcode == "procedures_prototype") {
            var condition = block.mutation.proccode;
            return "define " + condition;
        } else if (block.opcode == "procedures_call") {
            var condition = block.mutation.proccode;
            return condition;
        } else {
            return block.opcode;
        }
    }
    // -- 儲存 project code
};

var blockMapUrl = "./assets/blockdata.js";
var blockMap;
$.ajax({
    url: blockMapUrl,
    json: "text"
}).done(function (data) {
    eval("blockMap =" + data + ";");
});

/* 解壓縮 zip */
function unzip(zip) {
    model.getEntries(zip, function (entries) {
        entries.forEach(function (entry) {
            model.getEntryFile(entry, "Blob");
        });
    });
}

/* 拖拉事件 */
var drag = document.getElementById("drag");
drag.ondragover = function (e) {
    e.preventDefault()
};

drag.ondrop = function (e) {
    e.preventDefault();
    var length = e.dataTransfer.items.length;
    for (var i = 0; i < length; i++) {
        var entry = e.dataTransfer.items[i].webkitGetAsEntry();
        var file = e.dataTransfer.files[i];
        var zip = file.name.match(/\.zip/);
        var sb3 = file.name.match(/\.sb3/);
        if (entry.isFile) {
            if (zip) {
                localStorage.sb3filename = file.name.split('.zip')[0];
                unzip(file);
            } else if (sb3) {
                localStorage.sb3filename = file.name.split('.sb3')[0];
                unzip(file);
            } else {
                console.log("Please drag and drop a zip or sb3 file.");
            }
        } else {
            console.log("Please drag and drop a zip or sb3 file.");
        }
    }
}

/* input 事件 如果要使用 input 的話 */
var zipinput = document.getElementById("zipinput");
zipinput.addEventListener('change', function () {
    var name = zipinput.files[0].name;
    localStorage.sb3filename = name.split('.zip')[0];
    var type = name.substr(name.length - 3, 3);
    if (type == "zip") {
        unzip(zipinput.files[0]);
    } else {
        console.log("Please drag and drop a zip or sb3 file.");
    }

}, false);

/* model for zip.js */
/* https://github.com/gildas-lormeau/zip.js */

var model = (function () {
    var mapping = {
        "pdf": "application/pdf",
        "zip": "application/zip",
        "rar": "application/rar",
        "json": "application/json",
        "mid": "audio/mid",
        "mp3": "audio/mpeg",
        "bmp": "image/bmp",
        "gif": "image/gif",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "svg": "image/svg+xml",
        "xml": "text/xml"
    }
    return {
        getEntries: function (file, onend) {
            zip.createReader(new zip.BlobReader(file), function (zipReader) {
                zipReader.getEntries(onend);
            }, onerror);
        },
        getEntryFile: function (entry, creationMethod, onend, onprogress) {
            var writer;
            var extension = entry.filename.substring(entry.filename.indexOf(".") + 1);
            var mime = mapping[extension] || 'text/plain';

            writer = new zip.BlobWriter(mime);
            getData();

            function getData() {
                entry.getData(writer, function (blob) {
                    if (blob.type == 'application/json') {
                        // 判斷如果是 json 就下載檔案
                        // const a = document.createElement('a');
                        // a.style.display = 'none';
                        // a.href = URL.createObjectURL(blob);
                        // a.download = `${localStorage.sb3filename}.json`;
                        // document.body.appendChild(a);
                        // a.click();

                        // -- 儲存 project code
                        var derpyList = "";
                        
                        var blockData;
                        $.ajax({
                            url: URL.createObjectURL(blob),
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
                            document.getElementById('showTxt').style.display = 'flex';
                            $("#sb3blockscode").text(derpyList);
                            $("#sb3blocks").text(derpyList);
                            scratchblocks.renderMatching("code#sb3blocks", { inline: true });
                            console.log(derpyList);
                            var type = 'text/plain; charset=utf-8';
                            var file = new Blob([derpyList], { type: type });
                            const a = document.createElement('a');
                            a.style.display = 'none';
                            a.href = URL.createObjectURL(file);
                            a.download = `${localStorage.sb3filename}.txt`;
                            document.body.appendChild(a);
                            a.click();
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

                    }
                }, onprogress);
            }
        }
    };
})();
const ArgumentType = require("../../extension-support/argument-type");
const BlockType = require("../../extension-support/block-type");
const formatMessage = require("format-message");
const RateLimiter = require('../../util/rateLimiter.js');
const io = require("socket.io-client");
const cast = require('../../util/cast');
const log = require('../../util/log');

const USBSendInterval = 100;

const ADAPTER_TOPIC = "adapter/extensions/data";
const SCRATCH_TOPIC = "scratch/extensions/command";
const EXTENSIONS_OPERATE_TOPIC = "core/extensions/operate";
const EXTENSIONS_STATUS_TOPIC = "core/extensions/status";
const NOTIFICATION_TOPIC = "core/notification";
const EXTENSION_ID = "eim/usbMicrobit";



var blockIconURI =
    "data:image/png;base64,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";
var menuIconURI = blockIconURI;
var TOPIC = "eim/usbMicrobit";


var ButtonParam = {
    A: "A",
    B: "B",
    A_B: "A+B"
};

var analogPin = {
    one: "1",
    two: "2",
};


var gesture = {
    face_up: "face up",
    face_down: "face down",
    shake: "shake",
};


var AccelerometerParam = {
    X: 'X',
    Y: 'Y',
    Z: 'Z'
};


const MicroBitTiltDirection = {
    FRONT: 'front',
    BACK: 'back',
    LEFT: 'left',
    RIGHT: 'right',
    ANY: 'any'
};

var IconParam = {
    HEART: 'heart',
    HEART_SMALL: 'heart_small',
    HAPPY: 'happy',
    SMILE: 'smile',
    SAD: 'sad',
    CONFUSED: 'confused',
    ANGRY: 'angry',
    ASLEEP: 'asleep',
    SURPRISED: 'surprised',
    SILLY: 'silly',
    FABULOUS: 'fabulous',
    MEH: 'meh',
    YES: 'yes',
    NO: 'no'
};

class Scratch3UsbMicrobitBlocks {

    static get TILT_THRESHOLD() {
        return 15;
    }
    static get STATE_KEY() {
        return "Scratch.usbMicrobit";
    }
    static get EXTENSION_ID() {
        return "usbMicrobit";
    }

    constructor(runtime) {
        var _this = this;

        this._requestID = 0;
        this._promiseResolves = {};
        this.runtime = runtime;
        const SendRateMax = 5;
        this._rateLimiter = new RateLimiter(SendRateMax);

        const url = new URL(window.location.href);
        var adapterHost = url.searchParams.get("adapter_host");
        if (!adapterHost) {
            var adapterHost = "codelab-adapter.codelab.club";
        }
        this.socket = io(`//${adapterHost}:12358` + "/test", {
            transports: ["websocket"]
        });

        var usbconnect = false;
        this.socket.on("connect", () => {
            usbconnect = true;
            localStorage.usbconnect = true;
            console.log("連線狀態：" + usbconnect);
            var image = document.getElementById("downloadLog");
            image.src = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iN21tIgogICBoZWlnaHQ9IjdtbSIKICAgdmlld0JveD0iMCAwIDI0LjgwMzE1IDI0LjgwMzE0OSIKICAgaWQ9InN2ZzIiCiAgIHZlcnNpb249IjEuMSIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9Imljb24tLWluZGljYXRvcl9ncmVlbi5zdmciPgogIDxkZWZzCiAgICAgaWQ9ImRlZnM0IiAvPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxLjQiCiAgICAgaW5rc2NhcGU6Y3g9IjQ0Ljc3NjI3NSIKICAgICBpbmtzY2FwZTpjeT0iODguNDk3MjAyIgogICAgIGlua3NjYXBlOmRvY3VtZW50LXVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGZpdC1tYXJnaW4tdG9wPSIxIgogICAgIGZpdC1tYXJnaW4tbGVmdD0iMSIKICAgICBmaXQtbWFyZ2luLXJpZ2h0PSIxIgogICAgIGZpdC1tYXJnaW4tYm90dG9tPSIxIgogICAgIGlua3NjYXBlOndpbmRvdy13aWR0aD0iMTQ0MCIKICAgICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSI4MTUiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjEiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIgLz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGE3Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjc4LjYyNzY5LC0zNDQuOTI2ODkpIj4KICAgIDxjaXJjbGUKICAgICAgIHN0eWxlPSJvcGFjaXR5OjE7ZmlsbDojNDRkMzQ0O2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjE7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICAgIGlkPSJwYXRoNDEzNiIKICAgICAgIGN4PSIyOTEuMDI5MjciCiAgICAgICBjeT0iMzU3LjMyODQ2IgogICAgICAgcj0iOC44NTgyNjc4IiAvPgogIDwvZz4KPC9zdmc+Cg==";
        });
        this.socket.on("disconnect", () => {
            usbconnect = false;
            localStorage.usbconnect = false;
            console.log("連線狀態：否");
            var image = document.getElementById("downloadLog");
            image.src = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iN21tIgogICBoZWlnaHQ9IjdtbSIKICAgdmlld0JveD0iMCAwIDI0LjgwMzE1IDI0LjgwMzE0OSIKICAgaWQ9InN2ZzIiCiAgIHZlcnNpb249IjEuMSIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9Imljb24tLWluZGljYXRvcl9yZWQuc3ZnIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCIgLz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9ImJhc2UiCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEuMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMC4wIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6em9vbT0iMS40IgogICAgIGlua3NjYXBlOmN4PSI0NC43NzYyNzUiCiAgICAgaW5rc2NhcGU6Y3k9Ijg4LjQ5NzIwMiIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0icHgiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ibGF5ZXIxIgogICAgIHNob3dncmlkPSJmYWxzZSIKICAgICBmaXQtbWFyZ2luLXRvcD0iMSIKICAgICBmaXQtbWFyZ2luLWxlZnQ9IjEiCiAgICAgZml0LW1hcmdpbi1yaWdodD0iMSIKICAgICBmaXQtbWFyZ2luLWJvdHRvbT0iMSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjE0NDAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iODE1IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiIC8+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTI3OC42Mjc2OSwtMzQ0LjkyNjg5KSI+CiAgICA8Y2lyY2xlCiAgICAgICBzdHlsZT0ib3BhY2l0eToxO2ZpbGw6I2ZmMzM1NTtmaWxsLW9wYWNpdHk6MC45NDExNzY0NztzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MC4xO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgICBpZD0icGF0aDQxMzYiCiAgICAgICBjeD0iMjkxLjAyOTI3IgogICAgICAgY3k9IjM1Ny4zMjg0NiIKICAgICAgIHI9IjguODU4MjY3OCIgLz4KICA8L2c+Cjwvc3ZnPgo=';
        });

        this.socket.on("sensor", function (msg) {
            _this.message = msg.message;
            const topic = _this.message.topic;
            const message_id = msg.message.payload.message_id;
            if (topic === ADAPTER_TOPIC) {
                _this.button_a = _this.message.payload.content.button_a;
                _this.button_b = _this.message.payload.content.button_b;
                _this.x = _this.message.payload.content.x;
                _this.y = _this.message.payload.content.y;
                _this.z = _this.message.payload.content.z;
                _this.gesture = _this.message.payload.content.gesture;
                _this.pin_one = _this.message.payload.content.pin_one_analog_input;
                _this.pin_two = _this.message.payload.content.pin_two_analog_input;

                if (typeof message_id !== "undefined") {
                    this._promiseResolves[message_id] &&
                        this._promiseResolves[message_id](
                            msg.message.payload.content
                        );
                }
            }
        });
        this.state = 0;
    }

    getInfo() {
        return {
            id: "usbMicrobit",
            name: "usbMicrobit",
            menuIconURI: menuIconURI,
            blockIconURI: blockIconURI,
            blocks: [{
                opcode: "whenButtonIsPressed",
                blockType: BlockType.HAT,
                text: formatMessage({
                    id: "usbMicrobit.whenbuttonispressed",
                    default: "當按鈕 [BUTTON_PARAM] 被按下",
                    description: "pass hello by socket"
                }),
                arguments: {
                    BUTTON_PARAM: {
                        type: ArgumentType.STRING,
                        menu: "buttonParam",
                        defaultValue: ButtonParam.A
                    }
                }
            },
            {
                opcode: "buttonIsPressed",
                blockType: BlockType.BOOLEAN,
                // blockType: BlockType.REPORTER,
                text: formatMessage({
                    id: "usbMicrobit.buttonispressed",
                    default: "按鈕 [BUTTON_PARAM] 被按下?",
                    description: "pass hello by socket"
                }),
                arguments: {
                    BUTTON_PARAM: {
                        type: ArgumentType.STRING,
                        menu: "buttonParam",
                        defaultValue: ButtonParam.A
                    }
                }
            },
                '---',
            {
                opcode: "say",
                blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: "usbMicrobit.say",
                    default: "顯示文字 [TEXT]",
                    description: "pass hello by socket"
                }),
                arguments: {
                    TEXT: {
                        type: ArgumentType.STRING,
                        defaultValue: "Hello!"
                    }
                }
            },

            {
                opcode: 'displaySymbol',
                text: formatMessage({
                    id: 'usbMicrobit.displaySymbol',
                    default: '顯示圖案 [MATRIX]',
                    description: 'display a pattern on the micro:bit display'
                }),
                blockType: BlockType.COMMAND,
                arguments: {
                    MATRIX: {
                        type: ArgumentType.MATRIX,
                        defaultValue: '0101010101100010101000100'
                    }
                }
            },
            {
                opcode: 'showIcon',
                blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: 'usbMicrobit.showIcon',
                    default: '顯示圖示 [ICON_PARAM]',
                    description: 'change the icon of microbit'
                }),
                arguments: {
                    ICON_PARAM: {
                        type: ArgumentType.STRING,
                        menu: 'iconParam',
                        defaultValue: IconParam.HAPPY
                    }
                }
            },
            {
                opcode: "clearScreen",
                blockType: BlockType.COMMAND,
                // blockType: BlockType.REPORTER,
                text: formatMessage({
                    id: "usbMicrobit.clearScreen",
                    default: "清空畫面",
                    description: "clear screen"
                }),
                arguments: {}
            },
                '---',
            {
                opcode: "get_gesture",
                // blockType: BlockType.BOOLEAN,
                blockType: BlockType.BOOLEAN,
                // blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: "usbMicrobit.get_gesture",
                    default: "當傾斜 [gesture]?",
                    description: "gesture is?"
                }),
                arguments: {
                    gesture: {
                        type: ArgumentType.STRING,
                        menu: "gesture",
                        defaultValue: gesture.face_up
                    }
                }
            },
            {
                opcode: 'get_accelerometer',
                // blockType: BlockType.BOOLEAN,
                blockType: BlockType.REPORTER,
                // blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: 'usbMicrobit.get_accelerometer',
                    default: '加速度 [ACCELEROMETER_PARAM]',
                    description: 'pass hello by socket'
                }),
                arguments: {
                    ACCELEROMETER_PARAM: {
                        type: ArgumentType.STRING,
                        menu: 'accelerometerParam',
                        defaultValue: AccelerometerParam.X
                    }
                }
            },
            {
                opcode: "getTiltAngle",
                blockType: BlockType.REPORTER,
                text: formatMessage({
                    id: "usbMicrobit.get_TiltAngle",
                    default: "傾斜角度 [tiltDirection]",
                    description: "pass hello by socket"
                }),
                arguments: {
                    tiltDirection: {
                        type: ArgumentType.STRING,
                        menu: "tiltDirection",
                        defaultValue: MicroBitTiltDirection.FRONT
                    }
                }
            },
            {
                opcode: 'isTilted',
                text: formatMessage({
                    id: 'usbMicrobit.isTilted',
                    default: '傾斜 [tiltDirectionAny]?',
                    description: 'is the micro:bit is tilted in a direction?'
                }),
                blockType: BlockType.BOOLEAN,
                arguments: {
                    tiltDirectionAny: {
                        type: ArgumentType.STRING,
                        menu: 'tiltDirectionAny',
                        defaultValue: MicroBitTiltDirection.ANY
                    }
                }
            },
                '---',
            {
                opcode: "get_analog_input",
                // blockType: BlockType.BOOLEAN,
                blockType: BlockType.REPORTER,
                // blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: "usbMicrobit.get_analog_input",
                    default: "引腳 [ANALOG_PIN] 數值",
                    description: "pass hello by socket"
                }),
                arguments: {
                    ANALOG_PIN: {
                        type: ArgumentType.STRING,
                        menu: "analogPin",
                        defaultValue: analogPin.one
                    }
                }
            },
                '---',
            {
                opcode: "python_exec",
                // 前端打上标记 危险
                blockType: BlockType.COMMAND,
                text: formatMessage({
                    id: "usbMicrobit.python_exec",
                    default: "執行 [CODE]",
                    description: "run python code."
                }),
                arguments: {
                    CODE: {
                        type: ArgumentType.STRING,
                        defaultValue: 'display.show("c")'
                    }
                }
            }
        ],
            menus: {
                buttonParam: {
                    acceptReporters: true,
                    items: this.initButtonParam()
                },
                tiltDirection: {
                    acceptReporters: true,
                    items: this.TILT_DIRECTION_MENU
                },
                tiltDirectionAny: {
                    acceptReporters: true,
                    items: this.TILT_DIRECTION_ANY_MENU
                },
                analogPin: {
                    acceptReporters: true,
                    items: this.initAnalogPin()
                },
                gesture: {
                    acceptReporters: true,
                    items: this.initgesture()
                },
                accelerometerParam: {
                    acceptReporters: true,
                    items: this.initAccelerometerParam()
                },
                iconParam: {
                    acceptReporters: true,
                    items: this.initColorParam()
                },
                touchPins: {
                    acceptReporters: true,
                    items: ['0', '1', '2']
                }
            }
        };
    }

    get_reply_message(messageID) {
        const timeout = 5000; // ms todo 交给用户选择
        return new Promise((resolve, reject) => {
            this._promiseResolves[messageID] = resolve; // 抛到外部
            setTimeout(() => {
                reject(`timeout(${timeout}ms)`);
            }, timeout);
        });
    }

    emit_without_messageid(extension_id, content) {
        if (!this._rateLimiter.okayToSend()) return Promise.resolve();
        const payload = {};
        payload.extension_id = extension_id;
        payload.content = content;
        this.socket.emit("actuator", {
            payload: payload,
            topic: SCRATCH_TOPIC
        });
    }

    emit_with_messageid(extension_id, content) {
        if (!this._rateLimiter.okayToSend()) return Promise.resolve();
        const messageID = this._requestID++;
        const payload = {};
        payload.extension_id = extension_id;
        payload.content = content;
        payload.message_id = messageID;
        this.socket.emit("actuator", {
            payload: payload,
            topic: SCRATCH_TOPIC
        });
        return this.get_reply_message(messageID);
    }

    python_exec(args) {
        const python_code = args.CODE;
        this.emit_without_messageid(EXTENSION_ID, python_code);
        return
    }

    initButtonParam() {
        return [{
            text: "A",
            value: ButtonParam.A
        },
        {
            text: "B",
            value: ButtonParam.B
        },
        {
            text: "A+B",
            value: ButtonParam.A_B
        }
        ];
    }

    initColorParam() {
        return [{
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.happy',
                default: 'happy',
                description: 'label for color element in color picker for pen extension'
            }),
            value: IconParam.HAPPY
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.smile',
                default: 'smile',
                description: 'label for saturation element in color picker for pen extension'
            }),
            value: IconParam.SMILE
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.sad',
                default: 'sad',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.SAD
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.heart',
                default: 'heart',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.HEART
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.heart_small',
                default: 'heart_small',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.HEART_SMALL
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.yes',
                default: 'yes',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.YES
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.confused',
                default: 'confused',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.CONFUSED
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.angry',
                default: 'angry',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.ANGRY
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.asleep',
                default: 'asleep',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.ASLEEP
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.surprised',
                default: 'surprised',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.SURPRISED
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.silly',
                default: 'silly',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.SILLY
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.meh',
                default: 'meh',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.MEH
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.fabulous',
                default: 'fabulous',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.FABULOUS
        }, {
            text: formatMessage({
                id: 'usbMicrobit.iconMenu.no',
                default: 'no',
                description: 'label for brightness element in color picker for pen extension'
            }),
            value: IconParam.NO
        }];
    }


    initAccelerometerParam() {
        return [{
            text: "X",
            value: AccelerometerParam.X
        },
        {
            text: "Y",
            value: AccelerometerParam.Y
        },
        {
            text: "Z",
            value: AccelerometerParam.Z
        }
        ];
    }

    initAnalogPin() {
        return [{
            text: "1",
            value: analogPin.one
        },
        {
            text: "2",
            value: analogPin.two
        }
        ];
    }

    initgesture() {
        return [{
            text: formatMessage({
                id: 'usbMicrobit.gesture.face_up',
                default: 'face up',
                description: 'label for front element in tilt direction picker for micro:bit extension'
            }),
            value: gesture.face_up
        },
        {
            text: formatMessage({
                id: 'usbMicrobit.gesture.face_down',
                default: 'face down',
                description: 'label for front element in tilt direction picker for micro:bit extension'
            }),
            value: gesture.face_down
        },
        {
            text: formatMessage({
                id: 'usbMicrobit.gesture.shake',
                default: 'shake',
                description: 'label for front element in tilt direction picker for micro:bit extension'
            }),
            value: gesture.shake
        },
        ];
    }


    get TILT_DIRECTION_MENU() {

        return [{
            text: formatMessage({
                id: 'microbit.tiltDirectionMenu.front',
                default: 'front',
                description: 'label for front element in tilt direction picker for micro:bit extension'
            }),
            value: MicroBitTiltDirection.FRONT
        },
        {
            text: formatMessage({
                id: 'microbit.tiltDirectionMenu.back',
                default: 'back',
                description: 'label for back element in tilt direction picker for micro:bit extension'
            }),
            value: MicroBitTiltDirection.BACK
        },
        {
            text: formatMessage({
                id: 'microbit.tiltDirectionMenu.left',
                default: 'left',
                description: 'label for left element in tilt direction picker for micro:bit extension'
            }),
            value: MicroBitTiltDirection.LEFT
        },
        {
            text: formatMessage({
                id: 'microbit.tiltDirectionMenu.right',
                default: 'right',
                description: 'label for right element in tilt direction picker for micro:bit extension'
            }),
            value: MicroBitTiltDirection.RIGHT
        }
        ];
    }


    get TILT_DIRECTION_ANY_MENU() {
        return [
            ...this.TILT_DIRECTION_MENU,
            {
                text: formatMessage({
                    id: 'microbit.tiltDirectionMenu.any',
                    default: 'any',
                    description: 'label for any direction element in tilt direction picker for micro:bit extension'
                }),
                value: MicroBitTiltDirection.ANY
            }
        ];
    }

    showIcon(args) {
        // todo 不够平坦
        var convert = {
            happy: 'Image.HAPPY',
            smile: 'Image.SMILE',
            sad: 'Image.SAD',
            heart: 'Image.HEART',
            heart_small: 'Image.HEART_SMALL',
            yes: 'Image.YES',
            no: 'Image.NO',
            confused: 'Image.CONFUSED',
            angry: 'Image.ANGRY',
            asleep: 'Image.ASLEEP',
            surprised: 'Image.SURPRISED',
            silly: 'Image.SILLY',
            meh: 'Image.MEH',
            fabulous: 'Image.FABULOUS'
        };
        var python_code = "display.show(".concat(convert[args.ICON_PARAM], ", wait = True, loop = False)"); // console.log(args.ICON_PARAM);

        return this.emit_without_messageid(EXTENSION_ID, python_code);
    }
    getHats() {
        return {
            microbit_whenbuttonaispressed: {
                restartExistingThreads: false,
                edgeActivated: true
            }
        };
    }

    getMonitored() {
        return {
            microbit_buttonispressed: {}
        };
    }

    whenButtonIsPressed(args) {
        if (args.BUTTON_PARAM === "A") {
            return this.button_a;
        } else if (args.BUTTON_PARAM === "B") {
            return this.button_b;
        } else if (args.BUTTON_PARAM === "A+B") {
            return this.button_a && this.button_b;
        }
    }

    get_analog_input(args) {
        if (args.ANALOG_PIN === "1") {
            return this.pin_one;
        } else if (args.ANALOG_PIN === "2") {
            return this.pin_two;
        }
    }

    get_accelerometer(args) {
        if (args.ACCELEROMETER_PARAM === 'X') {
            return this.x;
        } else if (args.ACCELEROMETER_PARAM === 'Y') {
            return this.y;
        } else if (args.ACCELEROMETER_PARAM === 'Z') {
            return this.z;
        }
    }
    buttonIsPressed(args) {
        if (args.BUTTON_PARAM === "A") {
            return this.button_a;
        } else if (args.BUTTON_PARAM === "B") {
            return this.button_b;
        } else if (args.BUTTON_PARAM === "A+B") {
            return this.button_a && this.button_b;
        }
    }
    say(args) {
        var python_code = 'display.scroll("'.concat(
            args.TEXT,
            '", wait=False, loop=False)'
        );
        return this.emit_without_messageid(EXTENSION_ID, python_code);
    }

    displaySymbol(args) {
        const symbol = cast.toString(args.MATRIX).replace(/\s/g, '');
        var symbol_code = "";
        for (var i = 0; i < symbol.length; i++) {
            if (i % 5 == 0 && i != 0) {
                symbol_code = symbol_code + ":"
            }
            if (symbol[i] != "0") {
                symbol_code = symbol_code + "7";
            } else {
                symbol_code = symbol_code + "0";
            }
        }

        var python_code = 'display.show(Image("'.concat(
            symbol_code,
            '"), wait=True, loop=False)'
        );


        return this.emit_without_messageid(EXTENSION_ID, python_code);
    }
    clearScreen(args) {
        var python_code = "display.clear()";
        return this.emit_without_messageid(EXTENSION_ID, python_code);
    }

    isTilted(args) {
        return this._isTilted(args.tiltDirectionAny);
    }

    /**
     * @param {object} args - the block's arguments.
     * @property {TiltDirection} DIRECTION - the direction (front, back, left, right) to check.
     * @return {number} - the tilt sensor's angle in the specified direction.
     * Note that getTiltAngle(front) = -getTiltAngle(back) and getTiltAngle(left) = -getTiltAngle(right).
     */
    getTiltAngle(args) {
        return this._getTiltAngle(args.tiltDirection);
    }

    _getTiltAngle(args) {
        switch (args) {
            case MicroBitTiltDirection.FRONT:
                return Math.round(this.y / -10);
            case MicroBitTiltDirection.BACK:
                return Math.round(this.y / 10);
            case MicroBitTiltDirection.LEFT:
                return Math.round(this.x / -10);
            case MicroBitTiltDirection.RIGHT:
                return Math.round(this.x / 10);
            default:
                log.warn(`Unknown tilt direction in _getTiltAngle: ${args}`);
        }
    }

    _isTilted(args) {
        switch (args) {
            case MicroBitTiltDirection.ANY:
                return (Math.abs(this.x / 10) >= Scratch3UsbMicrobitBlocks.TILT_THRESHOLD) ||
                    (Math.abs(this.y / 10) >= Scratch3UsbMicrobitBlocks.TILT_THRESHOLD);
            default:
                console.log(args);
                return this._getTiltAngle(args) >= Scratch3UsbMicrobitBlocks.TILT_THRESHOLD;
        }
    }

    get_gesture(args) {

        switch (args.gesture) {
            case this.gesture:
                return true;
            default:
                return false;
        }
    }
}

module.exports = Scratch3UsbMicrobitBlocks;

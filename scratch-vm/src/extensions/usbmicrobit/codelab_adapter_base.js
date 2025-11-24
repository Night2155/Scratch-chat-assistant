const io = require("socket.io-client");
const RateLimiter = require("../../util/rateLimiter.js");

class AdapterBaseClient {
    // fork for eim client
    // onMessage,
    // todo
    constructor(
        onConnect,
        onDisconnect,
        onMessage,
        onAdapterPluginMessage,
        update_nodes_status,
        node_statu_change_callback,
        notify_callback,
        error_message_callback,
        update_adapter_status,
        SendRateMax = 60 // 每个插件每秒最多60条消息
    ) {
        const ADAPTER_TOPIC = "adapter/nodes/data";
        const EXTS_OPERATE_TOPIC = "core/exts/operate";

        const NODES_STATUS_TOPIC = "core/nodes/status";
        const NODE_STATU_CHANGE_TOPIC = "core/node/statu/change";
        const NOTIFICATION_TOPIC = "core/notification";
        const ADAPTER_STATUS_TOPIC = "core/status";

        this.NODES_OPERATE_TOPIC = "core/nodes/operate";
        this.GUI_TOPIC = "gui/operate";
        this.NODES_STATUS_TRIGGER_TOPIC = "core/nodes/status/trigger";
        this.SCRATCH_TOPIC = "scratch/extensions/command";
        this.plugin_topic_map = {
            node: this.NODES_OPERATE_TOPIC,
            extension: EXTS_OPERATE_TOPIC,
        };

        // this._requestID = 0; // todo uuid
        this._promiseResolves = {};
        this.SendRateMax = SendRateMax;
        this._rateLimiter = new RateLimiter(SendRateMax);

        const url = new URL(window.location.href);
        let adapterHost = url.searchParams.get("adapter_host"); // 支持树莓派(分布式使用)
        if (!adapterHost) {
            adapterHost = window.__static
                ? "127.0.0.1"
                : "codelab-adapter.codelab.club";
        }
        this.adapterHost = adapterHost;
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get("token");
        this.socket = io(
            `${window.__static ? "https:" : ""}//${adapterHost}:12358` +
            `/test?token=${token}`,
            {
                transports: ["websocket"],
            }
        );
        this.connected = false;

        this.socket.on("connect", () => {
            // 主动发起获取插件状态的请求，发出一则消息
            // console.log("socket connect ->", reason);
            this.nodes_status_trigger();
            // let onConnect = '';
            if (typeof onConnect === "function") {
                onConnect(); // 回调外部函数，onConnect可以是空的，忽视
            } else {
                console.log("onConnect is not function");
                console.log(token);
                if (token !== '') {
                    var image = document.getElementById("connectImg");
                    image.src = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iN21tIgogICBoZWlnaHQ9IjdtbSIKICAgdmlld0JveD0iMCAwIDI0LjgwMzE1IDI0LjgwMzE0OSIKICAgaWQ9InN2ZzIiCiAgIHZlcnNpb249IjEuMSIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9Imljb24tLWluZGljYXRvcl9ncmVlbi5zdmciPgogIDxkZWZzCiAgICAgaWQ9ImRlZnM0IiAvPgogIDxzb2RpcG9kaTpuYW1lZHZpZXcKICAgICBpZD0iYmFzZSIKICAgICBwYWdlY29sb3I9IiNmZmZmZmYiCiAgICAgYm9yZGVyY29sb3I9IiM2NjY2NjYiCiAgICAgYm9yZGVyb3BhY2l0eT0iMS4wIgogICAgIGlua3NjYXBlOnBhZ2VvcGFjaXR5PSIwLjAiCiAgICAgaW5rc2NhcGU6cGFnZXNoYWRvdz0iMiIKICAgICBpbmtzY2FwZTp6b29tPSIxLjQiCiAgICAgaW5rc2NhcGU6Y3g9IjQ0Ljc3NjI3NSIKICAgICBpbmtzY2FwZTpjeT0iODguNDk3MjAyIgogICAgIGlua3NjYXBlOmRvY3VtZW50LXVuaXRzPSJweCIKICAgICBpbmtzY2FwZTpjdXJyZW50LWxheWVyPSJsYXllcjEiCiAgICAgc2hvd2dyaWQ9ImZhbHNlIgogICAgIGZpdC1tYXJnaW4tdG9wPSIxIgogICAgIGZpdC1tYXJnaW4tbGVmdD0iMSIKICAgICBmaXQtbWFyZ2luLXJpZ2h0PSIxIgogICAgIGZpdC1tYXJnaW4tYm90dG9tPSIxIgogICAgIGlua3NjYXBlOndpbmRvdy13aWR0aD0iMTQ0MCIKICAgICBpbmtzY2FwZTp3aW5kb3ctaGVpZ2h0PSI4MTUiCiAgICAgaW5rc2NhcGU6d2luZG93LXg9IjAiCiAgICAgaW5rc2NhcGU6d2luZG93LXk9IjEiCiAgICAgaW5rc2NhcGU6d2luZG93LW1heGltaXplZD0iMSIgLz4KICA8bWV0YWRhdGEKICAgICBpZD0ibWV0YWRhdGE3Ij4KICAgIDxyZGY6UkRGPgogICAgICA8Y2M6V29yawogICAgICAgICByZGY6YWJvdXQ9IiI+CiAgICAgICAgPGRjOmZvcm1hdD5pbWFnZS9zdmcreG1sPC9kYzpmb3JtYXQ+CiAgICAgICAgPGRjOnR5cGUKICAgICAgICAgICByZGY6cmVzb3VyY2U9Imh0dHA6Ly9wdXJsLm9yZy9kYy9kY21pdHlwZS9TdGlsbEltYWdlIiAvPgogICAgICAgIDxkYzp0aXRsZT48L2RjOnRpdGxlPgogICAgICA8L2NjOldvcms+CiAgICA8L3JkZjpSREY+CiAgPC9tZXRhZGF0YT4KICA8ZwogICAgIGlua3NjYXBlOmxhYmVsPSJMYXllciAxIgogICAgIGlua3NjYXBlOmdyb3VwbW9kZT0ibGF5ZXIiCiAgICAgaWQ9ImxheWVyMSIKICAgICB0cmFuc2Zvcm09InRyYW5zbGF0ZSgtMjc4LjYyNzY5LC0zNDQuOTI2ODkpIj4KICAgIDxjaXJjbGUKICAgICAgIHN0eWxlPSJvcGFjaXR5OjE7ZmlsbDojNDRkMzQ0O2ZpbGwtb3BhY2l0eToxO3N0cm9rZTpub25lO3N0cm9rZS13aWR0aDowLjE7c3Ryb2tlLW1pdGVybGltaXQ6NDtzdHJva2UtZGFzaGFycmF5Om5vbmU7c3Ryb2tlLW9wYWNpdHk6MSIKICAgICAgIGlkPSJwYXRoNDEzNiIKICAgICAgIGN4PSIyOTEuMDI5MjciCiAgICAgICBjeT0iMzU3LjMyODQ2IgogICAgICAgcj0iOC44NTgyNjc4IiAvPgogIDwvZz4KPC9zdmc+Cg==";
                } else {
                    var image = document.getElementById("connectImg");
                    image.src = 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhLS0gQ3JlYXRlZCB3aXRoIElua3NjYXBlIChodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy8pIC0tPgoKPHN2ZwogICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgIHhtbG5zOmNjPSJodHRwOi8vY3JlYXRpdmVjb21tb25zLm9yZy9ucyMiCiAgIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyIKICAgeG1sbnM6c3ZnPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKICAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogICB4bWxuczpzb2RpcG9kaT0iaHR0cDovL3NvZGlwb2RpLnNvdXJjZWZvcmdlLm5ldC9EVEQvc29kaXBvZGktMC5kdGQiCiAgIHhtbG5zOmlua3NjYXBlPSJodHRwOi8vd3d3Lmlua3NjYXBlLm9yZy9uYW1lc3BhY2VzL2lua3NjYXBlIgogICB3aWR0aD0iN21tIgogICBoZWlnaHQ9IjdtbSIKICAgdmlld0JveD0iMCAwIDI0LjgwMzE1IDI0LjgwMzE0OSIKICAgaWQ9InN2ZzIiCiAgIHZlcnNpb249IjEuMSIKICAgaW5rc2NhcGU6dmVyc2lvbj0iMC45MSByMTM3MjUiCiAgIHNvZGlwb2RpOmRvY25hbWU9Imljb24tLWluZGljYXRvcl9yZWQuc3ZnIj4KICA8ZGVmcwogICAgIGlkPSJkZWZzNCIgLz4KICA8c29kaXBvZGk6bmFtZWR2aWV3CiAgICAgaWQ9ImJhc2UiCiAgICAgcGFnZWNvbG9yPSIjZmZmZmZmIgogICAgIGJvcmRlcmNvbG9yPSIjNjY2NjY2IgogICAgIGJvcmRlcm9wYWNpdHk9IjEuMCIKICAgICBpbmtzY2FwZTpwYWdlb3BhY2l0eT0iMC4wIgogICAgIGlua3NjYXBlOnBhZ2VzaGFkb3c9IjIiCiAgICAgaW5rc2NhcGU6em9vbT0iMS40IgogICAgIGlua3NjYXBlOmN4PSI0NC43NzYyNzUiCiAgICAgaW5rc2NhcGU6Y3k9Ijg4LjQ5NzIwMiIKICAgICBpbmtzY2FwZTpkb2N1bWVudC11bml0cz0icHgiCiAgICAgaW5rc2NhcGU6Y3VycmVudC1sYXllcj0ibGF5ZXIxIgogICAgIHNob3dncmlkPSJmYWxzZSIKICAgICBmaXQtbWFyZ2luLXRvcD0iMSIKICAgICBmaXQtbWFyZ2luLWxlZnQ9IjEiCiAgICAgZml0LW1hcmdpbi1yaWdodD0iMSIKICAgICBmaXQtbWFyZ2luLWJvdHRvbT0iMSIKICAgICBpbmtzY2FwZTp3aW5kb3ctd2lkdGg9IjE0NDAiCiAgICAgaW5rc2NhcGU6d2luZG93LWhlaWdodD0iODE1IgogICAgIGlua3NjYXBlOndpbmRvdy14PSIwIgogICAgIGlua3NjYXBlOndpbmRvdy15PSIxIgogICAgIGlua3NjYXBlOndpbmRvdy1tYXhpbWl6ZWQ9IjEiIC8+CiAgPG1ldGFkYXRhCiAgICAgaWQ9Im1ldGFkYXRhNyI+CiAgICA8cmRmOlJERj4KICAgICAgPGNjOldvcmsKICAgICAgICAgcmRmOmFib3V0PSIiPgogICAgICAgIDxkYzpmb3JtYXQ+aW1hZ2Uvc3ZnK3htbDwvZGM6Zm9ybWF0PgogICAgICAgIDxkYzp0eXBlCiAgICAgICAgICAgcmRmOnJlc291cmNlPSJodHRwOi8vcHVybC5vcmcvZGMvZGNtaXR5cGUvU3RpbGxJbWFnZSIgLz4KICAgICAgICA8ZGM6dGl0bGU+PC9kYzp0aXRsZT4KICAgICAgPC9jYzpXb3JrPgogICAgPC9yZGY6UkRGPgogIDwvbWV0YWRhdGE+CiAgPGcKICAgICBpbmtzY2FwZTpsYWJlbD0iTGF5ZXIgMSIKICAgICBpbmtzY2FwZTpncm91cG1vZGU9ImxheWVyIgogICAgIGlkPSJsYXllcjEiCiAgICAgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTI3OC42Mjc2OSwtMzQ0LjkyNjg5KSI+CiAgICA8Y2lyY2xlCiAgICAgICBzdHlsZT0ib3BhY2l0eToxO2ZpbGw6I2ZmMzM1NTtmaWxsLW9wYWNpdHk6MC45NDExNzY0NztzdHJva2U6bm9uZTtzdHJva2Utd2lkdGg6MC4xO3N0cm9rZS1taXRlcmxpbWl0OjQ7c3Ryb2tlLWRhc2hhcnJheTpub25lO3N0cm9rZS1vcGFjaXR5OjEiCiAgICAgICBpZD0icGF0aDQxMzYiCiAgICAgICBjeD0iMjkxLjAyOTI3IgogICAgICAgY3k9IjM1Ny4zMjg0NiIKICAgICAgIHI9IjguODU4MjY3OCIgLz4KICA8L2c+Cjwvc3ZnPgo=';
                    do {
                        prompttoken = prompt("請輸入編號", '');
                        localStorage.token = prompttoken;
                        window.location.href = `https://ct.easylearn.org:8060/?token=${prompttoken}&classno=${localStorage.classno}&no=${localStorage.no}&name=${localStorage.username}&p=${promptProjName}&i=${localStorage.identity}`;
                    } while (localStorage.token == 'null' || localStorage.token == '');
                }
            }
            this.connected = true;
        });
        this.socket.on("disconnect", (reason) => {
            if (typeof onDisconnect === "function") {
                onDisconnect(reason);
            }
            this.connected = false;
        });

        // on message
        this.socket.on("sensor", (msg) => {
            // actuator: to scratch
            console.log("recv(all message):", msg.message);
            if (typeof onMessage === "function") {
                onMessage(msg);
            }
            const topic = msg.message.topic;
            const content = msg.message.payload.content;
            const message_id = msg.message.payload.message_id;
            // console.log('topic ->', topic);
            switch (topic) {
                case ADAPTER_STATUS_TOPIC: {
                    // if (msg.message.topic === this.ADAPTER_STATUS_TOPIC) {
                    console.log("adapter core info:", content);
                    // this.version = content.version;
                    if (typeof update_adapter_status === "function") {
                        update_adapter_status(content);
                    }
                    break;
                }
                case NODES_STATUS_TOPIC: {
                    // 所有 plugin 的状态信息 初始化触发一次
                    // parents: this.adapter_client. trigger for nodes status
                    // console.debug("NODES_STATUS_TOPIC message");
                    if (typeof update_nodes_status === "function") {
                        // console.debug("callback update_nodes_status")
                        update_nodes_status(content);
                    }
                    // console.debug("NODES_STATUS_TOPIC messsage end");
                    break;
                }
                // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Statements/switch
                // 如果没有break，则自动运行 已匹配到case的下一个 case
                case NODE_STATU_CHANGE_TOPIC: {
                    // update extension status(start/stop  open/close)
                    const extension_node_name = msg.message.payload.node_name; //node or extension
                    // extension or node
                    console.log("extension_node_name:", extension_node_name);
                    if (typeof node_statu_change_callback === "function") {
                        node_statu_change_callback(
                            extension_node_name,
                            content
                        );
                    }
                    break;
                }

                case NOTIFICATION_TOPIC: {
                    // todo content.type
                    const type = msg.message.payload.type.toLowerCase();
                    const html = msg.message.payload.html;
                    console.log("notification:", msg.message.payload);
                    // alert(content);

                    if (html == true) {
                        let notify_message = {
                            dangerouslyUseHTMLString: true,
                            message: content,
                            duration: 0,
                        };
                        if (typeof notify_callback === "function") {
                            notify_callback(notify_message);
                        }
                        return; //不再往下走
                    }

                    if (type === "error") {
                        // show error
                        let error_message = {
                            // html ?
                            showClose: true,
                            duration: 5000,
                            message: content,
                            type: type, // warning
                        };
                        if (typeof error_message_callback === "function") {
                            error_message_callback(error_message);
                        }
                    } else {
                        let notify_message = {
                            message: content,
                            type: type, // warning
                        };
                        if (typeof notify_callback === "function") {
                            notify_callback(notify_message);
                        }
                    }
                    if (content == "download successfully!") {
                        this.nodes_status_trigger();
                    }
                    break;
                }
                case ADAPTER_TOPIC: {
                    // console.log("ADAPTER_TOPIC message");
                    if (typeof onAdapterPluginMessage === "function") {
                        onAdapterPluginMessage(msg);
                    }
                    // window.message = msg; // to global
                    console.log(
                        `ADAPTER_TOPIC message->`,
                        content
                    );
                    // 处理对应id的resolve
                    if (typeof message_id !== "undefined") {
                        this._promiseResolves[message_id] &&
                            this._promiseResolves[message_id](
                                content
                            );
                    }
                    break;
                }
            }
        });
    }

    exit_adapter_app() {
        let turn = "stop";
        const message = {
            topic: this.NODES_OPERATE_TOPIC,
            payload: {
                content: turn,
                node_id: "adapter/app",
                node_name: "_", // use id
            },
        };
        this.socket.emit("actuator", message);
    }

    nodes_status_trigger() {
        const message = {
            topic: this.NODES_STATUS_TRIGGER_TOPIC,
            payload: {
                content: "UPDATE_UI",
            },
        };
        this.socket.emit("actuator", message);
    }

    refresh_env() {
        // todo 作为core的子集 而不是新的topic
        const message = {
            topic: this.NODES_STATUS_TRIGGER_TOPIC,
            payload: {
                content: "REFRESH_ENV",
            },
        };
        console.log("ready to refresh_env(send message)");
        this.socket.emit("actuator", message);
    }

    download(plugin_url) {
        const message = {
            topic: this.GUI_TOPIC,
            payload: {
                content: "plugin_download",
                plugin_url: plugin_url,
                node_id: "adapter/app",
            },
        };
        this.socket.emit("actuator", message);
        // todo await
    }

    operate_node_extension(turn, node_name, pluginType) {
        const message = {
            topic: this.plugin_topic_map[pluginType],
            payload: {
                content: turn,
                node_id: "_", // 不要使用它，避免bug（难以排查！）
                node_name: node_name,
            },
        };
        this.socket.emit("actuator", message); // actuator: from scratch
        // todo: 确认完成之后才切换， 得到后端反馈(message id) json-rpc(scratch)
    }

    menu_action(val) {
        // let _this = this;
        if (val == "extensions_update") {
            const message = {
                topic: this.GUI_TOPIC,
                payload: {
                    content: val,
                    node_id: "adapter/app",
                },
            };
            this.socket.emit("actuator", message);

            setTimeout(() => {
                this.exit_adapter_app();
                alert("更新成功，请重启 (Update successful, please restart.)");
            }, 500);
        } else if (val == "refresh_env") {
            this.refresh_env();
        } else {
            const message = {
                topic: this.GUI_TOPIC,
                payload: {
                    content: val,
                    node_id: "adapter/app",
                },
            };
            this.socket.emit("actuator", message);
        }
    }

    get_reply_message(messageID) {
        const timeout = 5000; // ms todo 交给用户选择
        return new Promise((resolve, reject) => {
            this._promiseResolves[messageID] = resolve; // 抛到外部
            setTimeout(() => {
                resolve(`timeout(${timeout}ms)`);
            }, timeout);
        });
    }

    get_uuid() {
        // https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    check_limiter() {
        if (this._rateLimiter.okayToSend()) {
            return true;
        }
        else {
            console.error(`rate limit (${this.SendRateMax})`);
            /*
            window.antNotification.error({
                message: 'Error',
                description: `rate limit (${this.SendRateMax})`
            });*/
            return false;
        }
    }

    emit_with_messageid(node_id, content) {
        if (!this.check_limiter()) return Promise.resolve();
        const messageID = this.get_uuid();
        const payload = {};
        payload.node_id = node_id;
        payload.content = content;
        payload.message_id = messageID;
        this.socket.emit("actuator", {
            payload: payload,
            topic: this.SCRATCH_TOPIC,
        });
        return this.get_reply_message(messageID);
    }

    emit_with_messageid_for_control(node_id, content, node_name, pluginType) {
        const messageID = this.get_uuid();
        const payload = {};
        payload.node_id = node_id;
        payload.content = content;
        payload.message_id = messageID;
        payload.node_name = node_name;
        this.socket.emit("actuator", {
            payload: payload,
            topic: this.plugin_topic_map[pluginType],
        });
        return this.get_reply_message(messageID);
    }

    emit_without_messageid(node_id, content) {
        if (!this.check_limiter()) return Promise.resolve();
        const payload = {};
        payload.node_id = node_id;
        payload.content = content;
        this.socket.emit("actuator", {
            payload: payload,
            topic: this.SCRATCH_TOPIC,
        });
    }
}

// window.AdapterBaseClient = AdapterBaseClient;
module.exports = AdapterBaseClient;
// 创建一个 AudioContext 实例，用于处理和控制 Web 音频
const audioContext = new AudioContext();

// 获取页面中的“播放音频”按钮
const playButton = document.querySelector(".play");

// 获取“获取媒体设备”按钮
const mediaDeviceButton = document.querySelector(".media-devices");

// 获取用于显示输出设备选择器的容器
const selectDiv = document.querySelector(".select-container");

// 初始禁用“播放”按钮，直到用户选择输出设备或确认支持
playButton.disabled = true;

// 为“获取媒体设备”按钮绑定点击事件
mediaDeviceButton.addEventListener("click", async () => {
    // 检查当前浏览器是否支持 AudioContext.prototype.setSinkId 方法
    // setSinkId 允许将音频输出路由到指定的扬声器/耳机设备
    if("setSinkId" in AudioContext.prototype){
        // 清空之前生成的选择器内容
        selectDiv.innerHTML = "";

        try{
            // 请求麦克风权限（仅用于触发设备枚举，实际不使用音频流）
            // 注意：即使只关心输出设备，某些浏览器也要求先获取输入权限才能列出完整设备
            const stream = await navigator.mediaDevices.getUserMedia({audio: true});

            // 获取所有可用的媒体设备列表
            const devices = await navigator.mediaDevices.enumerateDevices();

            // 创建一个 <label> 标签，用于描述下拉选择框
            const label = document.createElement("label");
            label.innerHTML = "选择音频输出设备：";
            label.htmlFor = "output-device-select"; // 关联到 select 的 id

            // 创建下拉选择框 <select>
            const select = document.createElement("select");
            select.id = "output-device-select";

            // 将 label 和 select 添加到页面中
            selectDiv.appendChild(label);
            selectDiv.appendChild(select);

            // 添加一些基本样式
            selectDiv.style.margin = "0 0 20px";
            selectDiv.style.padding = "20px 0";
            selectDiv.style.borderTop = "1px solid #ddd";
            selectDiv.style.borderBottom = "1px solid #ddd";

            // 过滤出所有“音频输出”设备（扬声器/耳机），并排除默认设备（避免重复）
            const audioOutputs = devices.filter((device) => device.kind === "audiooutput" && device.deviceId !== "default");

            // 为每个输出设备创建一个 <option> 选项
            audioOutputs.forEach((device) => {
                const option = document.createElement("option");
                option.value = device.deviceId; // 选项值为设备 ID
                option.textContent = device.label; // 显示设备名称（如“扬声器 (Realtek Audio)”）
                select.appendChild(option);
            });

            // 添加一个“无输出”选项，用于测试静音或取消输出
            const option = document.createElement("option");
            option.value = "none";
            option.textContent = "无输出";
            select.appendChild(option);

            // 启用“播放”按钮
            playButton.disabled = false;

            // 监听下拉框的 change 事件，切换音频输出设备
            select.addEventListener("change", async () => {
                if(select.value === "none"){
                    // 设置为不输出到任何设备
                    await audioContext.setSinkId({type: "none"});
                }else{
                    // 设置音频上下文的输出设备为目标 deviceId
                    await audioContext.setSinkId(select.value);
                }
            });

             // 立即停止麦克风轨道，因为我们只是借用它来触发设备枚举
            stream.getAudioTracks().forEach((track) => track.stop());
        }catch(error){
            // 没有找到麦克风设备（NotFoundError）
            if(error.name === "NotFoundError"){
                throw new Error("未检测到连接设备 ");
            }
        }
    }else{
        // 浏览器不支持 setSinkId，提示用户
        const para = document.createElement("p");
        para.innerHTML = "您的浏览器不支持 <code>AudioContext.setSinkId() </code>功能。 ";
        selectDiv.appendChild(para);
    }
});

// 创建一个 3 秒长的立体声（2通道）白噪声音频缓冲区
const arrayBuffer = audioContext.createBuffer(
    2, // 2 个声道（立体声）
    audioContext.sampleRate * 3 , // 总采样点数 = 采样率 × 3秒
    audioContext.sampleRate // 采样率（如 44100 Hz）
);

// 为每个声道填充随机白噪声数据（范围 -1 到 1）
for(let channel = 0; channel < arrayBuffer.numberOfChannels; channel++){
    // 获取该声道的数据数组
    const currentBuffer = arrayBuffer.getChannelData(channel);
    for(let i = 0; i < arrayBuffer.length; i++){
        // 生成 [-1, 1) 之间的随机数
        currentBuffer[i] = Math.random() * 2 - 1;
    }
}

// 创建一个增益节点（用于控制音量）
const gainInfo = audioContext.createGain();
gainInfo.gain.value = 0.25; // 设置音量为 25%，避免声音过大

// 为“播放”按钮绑定点击事件
playButton.addEventListener("click", () =>{
    // 创建一个音频源节点，用于播放 buffer 中的音频
    const bufferSource = audioContext.createBufferSource();
    bufferSource.buffer = arrayBuffer; // 指定要播放的音频数据

    // 连接音频节点：源 → 增益（音量）→ 输出（扬声器）
    bufferSource.connect(gainInfo);
    gainInfo.connect(audioContext.destination);

    // 开始播放音频
    bufferSource.start();

    // 根据当前 sinkId 打印输出设备信息
    if(audioContext.sinkId === ""){
        console.log("使用默认输出设备");
    }else if(typeof audioContext.sinkId === "object" && audioContext.sinkId.type === "none"){
        console.log("无输出（静音）");
    }else{
        console.log(`输出到指定设备： ${ audioContext.sinkId }`);
    }
});

// 监听 sinkId 变更事件（当 setSinkId 成功后触发）
audioContext.addEventListener("sinkchange", () => {
    if(typeof audioContext.sinkId === "object" && audioContext.sinkId.type === "none"){
        console.log("音频已切换为不输出到任何设备（静音状态）");
    }else{
        console.log(`音频输出设备已切换为： ${ audioContext.sinkId }`);
    }
});
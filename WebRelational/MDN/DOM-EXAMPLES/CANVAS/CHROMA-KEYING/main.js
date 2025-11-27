// 定义一个处理器对象，用于处理视频帧并实现绿幕（或蓝幕）抠像
let processor = {
    /**
     * timerCallback 定时回调函数：持续从视频中抓取当前帧并进行处理
     * @author LiuQi
     */
    timerCallback: function(){
        // 如果视频已暂停或播放结束，则停止处理
        if(this.video.paused || this.video.ended){
            return;
        }
        // 对当前视频帧执行图像数据处理（抠像）
        this.computeImageData();

        let self = this; // 保存 this 上下文（避免箭头函数在旧环境中的兼容性问题）

        // 使用 setTimeout 实现“伪递归”循环（非 requestAnimationFrame）
        // 延迟 0 毫秒是为了将下一次调用放入事件队列，避免阻塞主线程
        setTimeout(function() {
            self.timerCallback();
        }, 0);
    },
    /**
     * doLoad 页面加载完成后初始化视频和画布元素
     * @author LiuQi
     */
    doLoad: function(){
        // 获取页面中的 <video> 元素
        this.video = document.getElementById("video");

        // 获取第一个 <canvas>（用于临时绘制原始视频帧）
        this.canvas_ = document.getElementById("canvas_");
        // 2D 渲染上下文
        this.canvas2D_ = this.canvas_.getContext("2d"); 

        // 获取第二个 <canvas>（用于显示抠像后的结果）
        this.canvas__ = document.getElementById("canvas__");
        this.canvas2D__ = this.canvas__.getContext("2d");

        // 保存 this 引用，以便在事件回调中使用
        let self = this;

        // 监听视频的 "play" 事件：当用户点击播放时开始处理
        this.video.addEventListener("play",function () {
            // 设置处理尺寸为视频原始尺寸的一半（缩放以提升性能）
            self.width =  self.video.videoWidth / 2;
            self.height =  self.video.videoHeight / 2;

            // 启动帧处理循环
            self.timerCallback();
        },false)
    },
    /**
     * computeImageData 核心抠像逻辑：读取视频帧，识别绿色背景并设为透明
     * @author LiuQi
     */
    computeImageData: function(){
        // 将当前视频帧绘制到第一个 canvas（canvas_）上，缩放到指定尺寸
        this.canvas2D_.drawImage(this.video, 0, 0, this.width, this.height);

        // 从 canvas_ 中提取像素数据（RGBA 格式，每像素 4 个字节）
        let imageData = this.canvas2D_.getImageData(0, 0,this.width, this.height);

        // 计算总像素数量（data 数组长度 ÷ 4）
        let length = imageData.data.length / 4;

        // 遍历每一个像素
        for(let i = 0; i< length; i++){
            // 提取 RGBA 分量（每个像素占 4 个连续字节）
            let r = imageData.data[i * 4 + 0]; // 红色通道
            let g = imageData.data[i * 4 + 1]; // 绿色通道
            let b = imageData.data[i * 4 + 2]; // 蓝色通道

            // 判断是否为“绿色背景”：
            // 条件：绿色 > 100、红色 > 100、蓝色 < 43
            // 这是一种简化的绿幕检测（常见于亮绿色背景）
            if (g > 100 && r > 100 && b < 43){
                // 将该像素的 Alpha 通道设为 0（完全透明）
                imageData.data[i * 4 + 3] = 0;
            }
        }

        // 将处理后的像素数据绘制到第二个 canvas（canvas__）上
        this.canvas2D__.putImageData(imageData, 0, 0);
        return;
    }
};

// 等待 DOM 加载完成后再初始化处理器
document.addEventListener("DOMContentLoaded", () => {
    processor.doLoad(); // 执行初始化
});


// 获取用于手写签名的 canvas 元素及其 2D 绘图上下文
const canvas = document.getElementById("canvas");
const canvas2d_ = canvas.getContext("2d");

// 获取用于预览签名+姓名的 canvas 元素及其 2D 绘图上下文
const signPanel = document.getElementById("sign-panel");
const signPanel2d_ = signPanel.getContext("2d");

// 获取姓名输入框和按钮元素
const nameInput = document.getElementById("name-input");
const clearButton = document.getElementById("clear-button");
const confirmButton = document.getElementById("confirm-button");

// 设置画笔样式：线宽、端点形状、颜色
canvas2d_.lineWidth = 2;
canvas2d_.lineCap = "round"; // 线条两端为圆角
canvas2d_.strokeStyle = "#000"; // 黑色描边

// 绘图状态变量
let isDrawing = false; // 是否正在绘制
let lastX = 0;  // 上一次鼠标/触控位置的 X 坐标
let lastY = 0;  // 上一次鼠标/触控位置的 Y 坐标

/**
 * initializeCanvas 初始化画布：用白色填充整个区域（模拟白纸）
 * @param {HTMLCanvasElement} canvas - 要初始化的 canvas 元素
 * @param {CanvasRenderingContext2D} context - 对应的 2D 上下文
 * @author LiuQi
 */
function initializeCanvas(canvas, context){
    context.fillStyle = "#fff"; // 白色背景
    context.fillRect(0, 0, canvas.width, canvas.height);  // 填充整个画布
}

// 初始化两个画布（签名区和预览区）为白色背景
initializeCanvas(canvas, canvas2d_);
initializeCanvas(signPanel, signPanel2d_);

/**
 * getCanvasCoords 将页面坐标转换为 canvas 内部坐标
 * @param {MouseEvent|TouchEvent} event - 触发事件的对象
 * @param {HTMLCanvasElement} canvas - 目标 canvas 元素
 * @returns {{x: number, y: number}} canvas 内部坐标
 * @author LiuQi
 */
function getCanvasCoords(event, canvas) {
    // 获取 canvas 在视口中的位置
    const rect = canvas.getBoundingClientRect();
    return {
        // 相对于 canvas 左上角的 X 坐标
        x: event.clientX - rect.left,
        // 相对于 canvas 左上角的 Y 坐标
        y: event.clientY - rect.top
    };
}

// 开始绘制：当用户按下鼠标或触摸屏幕时
canvas.addEventListener("pointerdown", function(event){
    event.preventDefault(); // 阻止默认行为（如拖拽、选中等）
    isDrawing = true;  // 标记为正在绘制
    const coords = getCanvasCoords(event, canvas);
    [lastX, lastY] = [coords.x, coords.y];  // 记录起始点
},{passive: false}); // passive: false 允许调用 preventDefault()

// 绘制过程：当用户移动指针（鼠标/手指）时
canvas.addEventListener("pointermove",function(event){
    if(!isDrawing)return; // 如果没在绘制，直接退出
    event.preventDefault();
    const coords = getCanvasCoords(event, canvas);

    // 绘制从上一点到当前点的线段
    canvas2d_.beginPath();
    canvas2d_.moveTo(lastX,lastY);
    canvas2d_.lineTo(coords.x, coords.y);
    canvas2d_.stroke();

    // 更新最后坐标
    [lastX, lastY] = [coords.x, coords.y];

    // 实时更新预览画布
    updatePreview();
},{passive: false});

// 指针移出 canvas 区域时也结束绘制（防止拖出边界后继续画）
canvas.addEventListener("pointerup", function(){
    isDrawing = false;
},{passive: false});

// 指针移出 canvas 区域时也结束绘制（防止拖出边界后继续画）
canvas.addEventListener("pointerout", function(){
    isDrawing = false;
},{passive: false});

/**
 * updatePreview 更新预览画布：
 * 1. 清空预览画布
 * 2. 将手写签名复制过去
 * 3. 如果有输入姓名，则在中间叠加半透明蓝色文字
 * @author LiuQi
 */
function updatePreview(){
    // 清空白板
    initializeCanvas(signPanel,signPanel2d_);

    // 把手写签名图像绘制到预览面板
    signPanel2d_.drawImage(canvas, 0, 0);

    // 获取用户输入的姓名（去除首尾空格）
    const name = nameInput.value.trim();
    if(name){
        // 设置字体和颜色（半透明蓝色，用于预览）
        signPanel2d_.font = "bold 24px Arial";
        signPanel2d_.fillStyle = "rgba(0, 0, 255, 0.3)"; // 半透明白蓝

        // 计算文字居中位置
        const textWidth = signPanel2d_.measureText(name).width;
        const x = (signPanel.width - textWidth) / 2; // 水平居中
        const y = signPanel.height / 2; // 垂直居中（基线位置）

        // 绘制姓名文字
        signPanel2d_.fillText(name, x, y);
    }
}

// 当用户在姓名输入框中输入内容时，实时更新预览
nameInput.addEventListener("input", updatePreview);

// 点击“清除签名”按钮：清空手写区域并更新预览
clearButton.addEventListener("click", function(){
    initializeCanvas(canvas,canvas2d_); // 清空签名画布
    updatePreview();  // 同步更新预览
});

// 点击“确认签名”按钮：生成最终签名（姓名变为黑色不透明）
confirmButton.addEventListener("click", function(){
    // 重新初始化预览画布
    initializeCanvas(signPanel,signPanel2d_);

    // 复制手写签名
    signPanel2d_.drawImage(canvas, 0, 0);
    const name = nameInput.value.trim();
    if(name){
        // 使用黑色实心文字（正式确认效果）
        signPanel2d_.font = "bold 24px Arial";
        signPanel2d_.fillStyle = "#000";
        const textWidth = signPanel2d_.measureText(name).width;
        const x = (signPanel.width - textWidth) / 2;
        const y = signPanel.height / 2;
        signPanel2d_.fillText(name, x, y);
    }
    // 提示用户签名已确认（实际项目中可能改为提交数据等操作）
    alert("签名已确认！");
});

// 页面加载完成后立即执行一次预览更新（例如已有默认姓名时）
updatePreview();
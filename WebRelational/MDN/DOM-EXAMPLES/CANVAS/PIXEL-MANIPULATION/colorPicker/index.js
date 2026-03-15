// 创建一个 Image 对象用于加载图片
const imageData = new Image();

// 设置跨域属性为 "anonymous"，以便从支持 CORS 的服务器加载图片后能安全地读取像素数据（避免 tainted canvas）
imageData.crossOrigin = "anonymous";

// 指定要加载的图片路径
imageData.src = "../assets/cup.png";

// 获取页面中 ID 为 "canvas" 的 <canvas> 元素
const canvas = document.getElementById("canvas");

// 获取该 canvas 的 2D 绘图上下文，用于后续绘制操作
const canvas2d_ = canvas.getContext("2d");

// 图片加载完成后，将其绘制到 canvas 上（初始显示原始图像）
imageData.addEventListener("load", function(){
    canvas2d_.drawImage(imageData,0, 0);
});

// 获取用于显示鼠标悬停时颜色和点击选择颜色的DOM元素
const hoveredColor = document.getElementById("hovered-color");
const selectedColor = document.getElementById("selected-color");

/**
 * handlePick 处理颜色选取的函数
 * @param {MouseEvent} event - 鼠标事件对象
 * @param {HTMLElement} destination - 目标元素，用于展示所选颜色信息
 * @author LiuQi
 */
function handlePick(event, destination){
    // 获取canvas相对于视窗的位置
    const bounding = canvas.getBoundingClientRect();
    // 计算鼠标在canvas上的坐标
    const x = event.clientX - bounding.left;
    const y = event.clientY - bounding.top;
    // 从canvas中获取指定坐标的像素数据（1x1大小）
    const imageData_ = canvas2d_.getImageData(x, y, 1, 1);
    // 将获取到的RGBA值格式化成CSS中的rgba()字符串形式
    const rgba = `rgba(${imageData_.data[0]}, ${imageData_.data[1]}, ${imageData_.data[2]}, ${imageData_.data[3] / 255})`;
    // 更新目标元素的背景色为选取的颜色，并将颜色值显示在元素内容中
    destination.style.backgroundColor = rgba;
    destination.textContent = rgba;
    // 返回rgba字符串
    return rgba;
}

// 当鼠标在canvas上移动时触发，实时更新悬停颜色
canvas.addEventListener("mousemove", function(event){
    return handlePick(event, hoveredColor);
});

// 当在canvas上点击时触发，选定颜色
canvas.addEventListener("click", function(event){
    return handlePick(event, selectedColor);
});
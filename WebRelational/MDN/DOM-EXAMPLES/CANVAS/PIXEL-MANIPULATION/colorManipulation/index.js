// 创建一个 Image 对象用于加载图片
let imageData = new Image();

// 设置跨域属性为 "anonymous"，以便从支持 CORS 的服务器加载图片后能安全地读取像素数据（避免 tainted canvas）
imageData.crossOrigin = "anonymous";

// 指定要加载的图片路径
imageData.src = "../assets/cup.png";

// 获取页面中 ID 为 "canvas" 的 <canvas> 元素
const canvas = document.getElementById("canvas");

// 获取该 canvas 的 2D 绘图上下文，用于后续绘制操作
const canvas2d_ = canvas.getContext("2d");

// 图片加载完成后，将其绘制到 canvas 上（初始显示原始图像）
imageData.onload = function(){
    canvas2d_.drawImage(imageData,0, 0);
};

/**
 * handleOriginal 显示原始图像（无滤镜）
 * @author LiuQi
 */
const handleOriginal = function(){
     // 直接将原始图片重新绘制到 canvas 上，覆盖之前的效果
    canvas2d_.drawImage(imageData,0, 0);
};

/**
 * handleInverted 应用“反色”（负片）滤镜
 * 将每个像素的 R/G/B 值替换为 255 - 原值
 * @author LiuQi
 */
const handleInverted = function(){
    // 先重绘原始图像，确保处理的是干净的源数据
    canvas2d_.drawImage(imageData,0, 0);

    // 获取整个 canvas 的像素数据（RGBA 格式，每像素 4 字节）
    const imageData_ = canvas2d_.getImageData(0, 0, imageData.width, imageData.height);

    // 遍历所有像素（每次跳过 4 个字节：R, G, B, A）
    for(let i = 0; i < imageData_.data.length; i += 4){
        // 反转红色通道
        imageData_.data[i] = 255 - imageData_.data[i]; // RED
        // 反转绿色通道
        imageData_.data[i + 1] = 255 - imageData_.data[i + 1]; // GREEN
        // 反转蓝色通道
        imageData_.data[i + 2] = 255 - imageData_.data[i + 2]; // BLUE
        // Alpha 通道（透明度）保持不变...
    }

    // 将修改后的像素数据写回 canvas
    canvas2d_.putImageData(imageData_, 0, 0);
};

/**
 * handleGrayscale 应用“灰度”滤镜
 * 将每个像素的 R/G/B 设为三通道的平均值，实现黑白效果
 * @author LiuQi
 */
const handleGrayscale = function(){
    // 先重绘原始图像，确保处理的是干净的源数据
    canvas2d_.drawImage(imageData,0, 0);

    // 获取整个 canvas 的像素数据（RGBA 格式，每像素 4 字节）
    const imageData_ = canvas2d_.getImageData(0, 0, imageData.width, imageData.height);

    // 遍历所有像素（每次跳过 4 个字节：R, G, B, A）
    for(let i = 0; i < imageData_.data.length; i += 4){
        // 计算 RGB 三通道的平均值（简单灰度算法）
        let average = (imageData_.data[i] + imageData_.data[i + 1] + imageData_.data[i + 2]) / 3;
        // 将 R、G、B 都设为该平均值
        imageData_.data[i] = average; // RED
        imageData_.data[i + 1] = average; // GREEN
        imageData_.data[i + 2] = average; // BLUE
        // Alpha（透明度）保持不变...
    }

    // 将修改后的像素数据写回 canvas
    canvas2d_.putImageData(imageData_, 0, 0);
};

/**
 * handleSepia 应用“深褐色”（Sepia）复古滤镜
 * 使用标准 Sepia 色调变换矩阵进行颜色计算
 * @author LiuQi
 */
const handleSepia = function(){
    // 先重绘原始图像，确保处理的是干净的源数据
    canvas2d_.drawImage(imageData,0, 0);

    // 获取整个 canvas 的像素数据（RGBA 格式，每像素 4 字节）
    const imageData_ = canvas2d_.getImageData(0, 0, imageData.width, imageData.height);

    // 遍历所有像素（每次跳过 4 个字节：R, G, B, A）
    for(let i = 0; i < imageData_.data.length; i += 4){
        // 读取原始 RGB 值
        let r = imageData_.data[i],
            g = imageData_.data[i + 1],
            b = imageData_.data[i + 2];
            // 应用 Sepia 变换公式（来自经典图像处理）
            // 注意：结果可能超过 255，因此用 Math.min(..., 255) 限制上限   
            imageData_.data [i] = Math.min(Math.round(0.393 * r + 0.769 * g + 0.189 * b),255); // RED
            imageData_.data[i + 1] = Math.min(Math.round(0.349 * r + 0.686 * g + 0.168 * b),255); // GREEN
            imageData_.data[i + 2] = Math.min(Math.round(0.272 * r + 0.534 * g + 0.131 * b),255); // BLUE
            // Alpha（透明度）保持不变...
    }

    // 将修改后的像素数据写回 canvas
    canvas2d_.putImageData(imageData_, 0, 0);
};


// 获取所有 name="color" 的单选按钮（即滤镜选项）
const inputs = document.querySelectorAll("[name=color]");

// 为每个单选按钮绑定 change 事件监听器
for(const input of inputs){
    input.addEventListener("change", function(value){
        // 根据选中的 value 值调用对应的滤镜函数
        switch(value.target.value){
            case "inverted":
                return handleInverted();
            case "grayscale":
                return handleGrayscale();
            case "sepia":
                return handleSepia();
            default: 
                return handleOriginal();
        }
    });
}

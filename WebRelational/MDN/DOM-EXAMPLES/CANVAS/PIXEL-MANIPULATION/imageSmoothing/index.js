// 创建一个 Image 对象用于加载图片
const imageData = new Image();

// 设置跨域属性为 "anonymous"，以便从支持 CORS 的服务器加载图片后能安全地读取像素数据（避免 tainted canvas）
imageData.crossOrigin = "anonymous";

// 指定要加载的图片路径
imageData.src = "../assets/cup.png";

// 指定要加载的图片路径
imageData.addEventListener("load", function(){
    handleDraw(imageData);
});

/**
 * handleDraw 处理图像绘制和放大功能
 * @param {HTMLImageElement} imageData - 已加载的图片对象
 * @author LiuQi
 */
function handleDraw(imageData){
    // 获取主画布元素和其 2D 绘图上下文
    const canvas = document.getElementById("canvas");
    const canvas2d_ = canvas.getContext("2d");

    // 获取主画布元素和其 2D 绘图上下文
    canvas2d_.drawImage(imageData,0, 0);

    // 获取启用图像平滑效果的放大画布的 2D 上下文
    const smoothed2d_ = document.getElementById("smoothed-zoom").getContext("2d");

    // 启用图像平滑（抗锯齿），使放大后的图像更柔和
    smoothed2d_.imageSmoothingEnabled = true;
    smoothed2d_.mozImageSmoothingEnabled = true;  // Firefox
    smoothed2d_.webkitImageSmoothingEnabled = true;  // Chrome/Safari
    smoothed2d_.msImageSmoothingEnabled = true; // Edge

    // 获取禁用图像平滑效果的放大画布的 2D 上下文
    const pixelated2d_ = document.getElementById("pixelated-zoom").getContext("2d");

     // 禁用图像平滑，使放大后的图像呈现像素化效果
    pixelated2d_.imageSmoothingEnabled = false;
    pixelated2d_.mozImageSmoothingEnabled = false;
    pixelated2d_.webkitImageSmoothingEnabled = false;
    pixelated2d_.msImageSmoothingEnabled = false;


    /**
     * handleZoom 处理局部放大功能
     * @param {CanvasRenderingContext2D} canvas2d_ - 目标画布的 2D 上下文
     * @param {number} x - 鼠标在主画布上的 X 坐标
     * @param {number} y - 鼠标在主画布上的 Y 坐标
     * @author LiuQi
     */
    const handleZoom = function(canvas2d_, x, y){
        // 从主画布上截取鼠标位置周围 10x10 像素的区域，并放大绘制到目标画布上
        canvas2d_.drawImage(canvas, // 源画布（主画布）
                                    // 计算截取区域的起始 X 坐标（限制在图片范围内）
									Math.min(Math.max(0, x - 5), imageData.width - 10),
                                    // 计算截取区域的起始 Y 坐标（限制在图片范围内）
									Math.min(Math.max(0, y - 5), imageData.height - 10),
									10, 10, // 计算截取区域的起始 Y 坐标（限制在图片范围内）
									0, 0, // 目标画布上的绘制起始点
									200, 200); // 在目标画布上绘制的尺寸（200x200 像素，即放大 20 倍）
    };

    // 在目标画布上绘制的尺寸（200x200 像素，即放大 20 倍）
    canvas.addEventListener("mousemove", function(event){
        // 获取鼠标相对于主画布的坐标
        const x = event.offsetX;
		const y = event.offsetY;

        // 获取鼠标相对于主画布的坐标
        handleZoom(smoothed2d_,x,y);
        handleZoom(pixelated2d_,x,y);
    });
}


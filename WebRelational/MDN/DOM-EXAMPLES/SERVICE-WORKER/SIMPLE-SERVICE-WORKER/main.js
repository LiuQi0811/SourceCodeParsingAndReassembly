import {Gallery} from './imageList.js';

/**
 * registerServiceWorker - 注册 Service Worker（服务工作者），用于实现离线缓存、后台同步等 PWA 功能
 * @author LiuQi
 */
const registerServiceWorker = async () => {
    // 检查当前浏览器是否支持 Service Worker 功能
    // navigator 是 Window 对象的一个只读属性，提供关于浏览器和系统的信息
    // "serviceWorker" in navigator 用于判断浏览器是否实现了 Service Worker API
    if ("serviceWorker" in navigator) {
        try {
            // 调用 navigator.serviceWorker.register() 方法注册一个 Service Worker
            // 第一个参数是 Service Worker 脚本文件的路径（相对于当前页面）
            // 第二个参数是配置对象，其中 scope 定义了该 Service Worker 的控制范围（作用域）
            // "./" 表示该 Service Worker 可以控制当前目录及其子目录下的所有页面
            const registration = await navigator.serviceWorker.register("workerInstall.js", {
                scope: "./"
            });

            // 根据 Service Worker 的当前状态输出日志，便于调试
            if (registration.installing) {
                // installing：Service Worker 正在安装中（首次注册或更新时）
                console.log("Service worker installing.");
            } else if (registration.waiting) {
                // waiting：新版本已安装完成，但仍在等待激活（通常是因为旧版本仍在使用）
                console.log("Service worker installed.");
            } else if (registration.active) {
                // active：Service Worker 已激活并正在控制页面
                console.log("Service worker active.");
            }
        } catch (error) {
            // 如果注册过程中发生错误（如脚本路径错误、跨域问题、HTTPS 要求未满足等），捕获并打印错误信息
            console.error(`Registration failed with ${error}`);
        }
    }
    // 如果浏览器不支持 Service Worker，则静默跳过（也可选择提示用户）
};

// 使用 document.querySelector() 方法选择文档中第一个 <section> 元素，并将其引用赋值给常量 imgSection。
// 若文档中有多个 <section> 标签，仅选中首个出现的 <section> 元素。
// 如果没有找到任何 <section> 元素，则 imgSection 的值将是 null。
const imgSection = document.querySelector("section");

/**
 * getImageBlob - 根据指定 URL 获取图像的 Blob 对象
 * @param {string} url - 图像资源的网络地址
 * @returns {Promise<Blob>} 返回一个包含图像二进制数据的 Blob 对象
 * @author LiuQi
 */
const getImageBlob = async (url) => {
    // 1. 使用 fetch API 发起 HTTP 请求，获取图像资源的响应（Response 对象）
    const imageResponse = await fetch(url);

    // 2. 检查响应是否成功（状态码在 200-299 范围内）
    if (!imageResponse.ok) {
        // 3. 如果请求失败（如 404、500 等），抛出错误信息
        //    优先使用 statusText（如 "Not Found"），若为空则回退到状态码（如 404）
        throw new Error(`Image didn't load successfully; error code: ${
            imageResponse.statusText || imageResponse.status
        }`);
    }

    // 4. 将响应体解析为不可变的原始二进制数据（Blob 对象）
    //    Blob 表示类似文件的只读原始数据，适合用于创建本地对象 URL（如用于 <img> 标签）
    return imageResponse.blob();
};

/**
 * createGalleryFigure  异步创建一个图库中的 <figure> 元素（包含图片和说明文字）
 * @param {Object} galleryImage - 包含图库图片信息的对象
 * @author LiuQi
 */
const createGalleryFigure = async (galleryImage) => {
    try {
        // 1. 根据图片 URL 获取图像的 Blob 对象（二进制数据）
        const imageBlob = await getImageBlob(galleryImage.url);

        // 2. 创建 DOM 元素
        const imageElement = document.createElement("img");           // 图片元素 <img>
        const captionElement = document.createElement("caption");     // 说明文字容器 <caption>
        const figureElement = document.createElement("figure");       // 图片+说明的整体容器 <figure>
        const nameSpanElement = document.createElement("span");       // 图片名称 <span>
        const craditSpanElement = document.createElement("span");    // 版权/来源信息 <span>

        // 3. 设置图片名称文本内容
        nameSpanElement.textContent = `${galleryImage.name}`;

        // 4. 设置版权信息（注意：这里使用 innerHTML，因为可能包含 HTML 标签，如链接）
        craditSpanElement.innerHTML = `Token by ${galleryImage.cradit}`;

        // 5. 将名称和版权信息添加到 <caption> 中
        captionElement.append(nameSpanElement, craditSpanElement);

        // 6. 将 Blob 对象转换为可被 <img> 使用的本地 URL，并设置为图片源
        imageElement.src = window.URL.createObjectURL(imageBlob);

        // 7. 设置图片的 alt 属性（用于无障碍访问和加载失败时显示）
        imageElement.setAttribute("alt", galleryImage.alt);

        // 8. 将图片和说明文字添加到 <figure> 容器中
        figureElement.append(imageElement, captionElement);

        // 9. 将完整的 <figure> 元素添加到页面中的 imgSection 容器里
        imgSection.append(figureElement);
    } catch (error) {
        // 捕获并打印错误（例如网络请求失败、Blob 创建失败等）
        console.error(error);
    }
};


// 执行调用registerServiceWorker 注册服务
registerServiceWorker();

// galleryImage 图库图片
// 遍历 Gallery.images 数组中的每一项（即每张图库图片的数据对象），
// 并为每一项调用 createGalleryFigure 函数，异步创建对应的 <figure> 元素并插入到页面中。
Gallery.images.map(createGalleryFigure);

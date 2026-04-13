"use strict"; // 严格模式


(() => {
    class PerformanceMonitor {
        start(label) {
            performance.mark(`${label} (start)`);
        }
        end(label, details) {
            performance.mark(`${label} (end)`);
            performance.measure(label, {
                start: `${label} (start)`,
                end: `${label} (end)`,
                detail: details
            });
        }
        mark(label, details) {
            performance.mark(label, {
                detail: details
            });
        }
        throwError(error) {
            performance.mark("(error)", {
                detail: { error: `${error}` }
            });
            throw error;
        }
    }

    const TAILWIND_CSS_MIME_TYPE = "text/tailwindcss";
    let dynamicStyleElement;
    const activePluginSet = new Set();
    let generatedCssBuffer = "";
    const styleElement = document.createElement("style");
    const readyPromise = Promise.resolve();
    let uniqueIdCounter = 1;
    const performanceMonitor = new PerformanceMonitor;

    // Gn
    const resetStyles = async() => {
        console.log("resetStyles");
    };

    // Jn
    const generateStyles = async(type) => {
        // 没有动态样式实例则直接退出
        if (!dynamicStyleElement) {
            return;
        }
        console.log("generateStyles", type);
    };

    // At
    const scheduleBuild = (type) => {
        const runBuild = async() => {
            // 如果没有动态样式表 且 不是全量构建，则跳过
            if (!dynamicStyleElement && type !== "full") {
                return;
            }
            let buildId = uniqueIdCounter++;
            performanceMonitor.start(`Build #${buildId} (${type})`);

            // 全量构建：先清空之前的样式
            if (type === "full") {
                await resetStyles();
            }
            performanceMonitor.start("Build");
            // 执行核心样式生成
            await generateStyles();
            performanceMonitor.end("Build");
            performanceMonitor.end(`Build #${buildId} (${type})`);
        };
        // 串行执行构建任务，避免并发冲突
        readyPromise = readyPromise.then(runBuild)
            .catch((error) => {
                performanceMonitor.error(error);
            });
    };
    // Qn
    // 监听 DOM 变化 → 触发全量构建
    const domChangeObserver = new MutationObserver(() => scheduleBuild("full"));
    // Fo
    const observeDOMChanges = (element) => {
        domChangeObserver.observe(element, {
            attributes: true,
            attributeFilter: ["type"],
            characterData: true,
            subtree: true,
            childList: true,
        });
    };

    // 监听tailwindcss实例是否加载完成
    // MutationObserver 监听DOM变化
    new MutationObserver(callback => {
            let styleCount = 0;
            let domChangeCount = 0;
            for (let mutation of callback) {
                // 处理新增的 <style type="text/tailwindcss">
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE &&
                        node.tagName === "STYLE" &&
                        node.getAttribute("type") === TAILWIND_CSS_MIME_TYPE
                    ) {
                        observeDOMChanges(node);
                        styleCount++;
                    }
                }
                // 统计 DOM 变化
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE && node !== styleElement) {
                        domChangeCount++;
                    }
                }
                // class 属性变化也算 DOM 变化
                if (mutation.type === "attributes") {
                    domChangeCount++;
                }
            }
            // 新增 Tailwind 样式表 → 全量重建
            if (styleCount > 0) {
                return generateStyles("full");
            }
            // DOM / class 变化 → 增量更新
            if (domChangeCount > 0) {
                return generateStyles("incremental");
            }
        })
        // 
        .observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
            childList: true,
            subtree: true
        });
    generateStyles("full");
    document.head.append(styleElement);
})();
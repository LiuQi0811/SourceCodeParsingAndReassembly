    // ==============================
    //        初始化所有变量
    // ==============================

    // DOM 元素
    const body = document.body;
    const themeToggle = document.getElementById("themeToggle");
    const canvas = document.getElementById("canvas");
    const signPanel = document.getElementById("signPanel");
    const nameInput = document.getElementById("nameInput");
    const clearBtn = document.getElementById("clearBtn");
    const confirmBtn = document.getElementById("confirmBtn");
    const exportPngBtn = document.getElementById("exportPngBtn");
    const exportAllPngBtn = document.getElementById("exportAllPngBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const penSizeSlider = document.getElementById("penSize");
    const penSizeValue = document.getElementById("penSizeValue");
    const penSizePreview = document.getElementById("penSizePreview");
    const addTimestampCheckbox = document.getElementById("addTimestamp");
    const addPageBtn = document.getElementById("addPageBtn");
    const prevPageBtn = document.getElementById("prevPageBtn");
    const nextPageBtn = document.getElementById("nextPageBtn");

    // 验证关键元素是否存在
    if (!canvas || !signPanel) {
      console.error("Canvas 元素未找到，请检查 HTML 中的 ID 是否正确");
      alert("页面初始化失败，请刷新重试");
      throw new Error("Canvas 元素缺失");
    }

    // Canvas 上下文
    const ctx = canvas.getContext("2d");
    const previewCtx = signPanel.getContext("2d");

    // 验证上下文是否成功获取
    if (!ctx || !previewCtx) {
      console.error("Canvas 上下文获取失败，请检查浏览器兼容性");
      alert("浏览器不支持 Canvas，请使用现代浏览器");
      throw new Error("Canvas 上下文获取失败");
    }

    // 其他变量
    const { jsPDF } = window.jspdf;
    let currentTheme = localStorage.getItem("_CURRENT_THEME") || 
                      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    let pages = [{ name: "", timestamp: "", image: null }];
    let currentPageIndex = 0;
    let isDrawing = false;
    let isLocked = false;
    let lastX = 0, lastY = 0;

    // ==============================
    //        主题管理模块
    // ==============================

    function isDark() {
      return currentTheme === "dark";
    }

    // 初始化为空函数，避免在定义时访问 ctx
    let updatePenColor = () => {};

    function applyTheme(theme) {
      currentTheme = theme;
      if (theme === "dark") {
        body.classList.add("dark-mode");
        themeToggle.textContent = "☀️";
      } else {
        body.classList.remove("dark-mode");
        themeToggle.textContent = "🌙";
      }
      localStorage.setItem("_CURRENT_THEME", theme);

      // 此时确保所有变量已定义，再调用更新函数
      updatePenColor();
      clearCanvas(canvas, ctx);
      updatePreview();
    }

    // 初始化主题
    applyTheme(currentTheme);

    // 绑定主题切换事件
    themeToggle.addEventListener("click", () => {
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
    });

    // ==============================
    //        多页签名管理
    // ==============================

    function updatePageIndicator() {
      document.getElementById("currentPage").textContent = currentPageIndex + 1;
      document.getElementById("totalPages").textContent = pages.length;
      
      // 更新页面导航按钮状态
      prevPageBtn.disabled = currentPageIndex === 0;
      nextPageBtn.disabled = currentPageIndex === pages.length - 1;
    }

    function switchToPage(index) {
      if (index < 0 || index >= pages.length) return;

      // 仅在切换前保存当前页的签名图片（不保存姓名，因为姓名可能还未输入）
      if (currentPageIndex !== index) {
        // 只保存当前画布的图像，不覆盖姓名和时间戳
        const currentImageData = canvas.toDataURL("image/png");
        if (!pages[currentPageIndex].image) {
          // 如果当前页没有图像，则保存
          pages[currentPageIndex].image = currentImageData;
        } else {
          // 如果当前页已有图像，需要更新它
          pages[currentPageIndex].image = currentImageData;
        }
      }

      currentPageIndex = index;
      const page = pages[currentPageIndex];

      // 恢复目标页面内容
      clearCanvas(canvas, ctx);
      if (page.image) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          updatePreview();
        };
        img.src = page.image;
      } else {
        updatePreview();
      }

      nameInput.value = page.name || "";
      updatePreview();
      updatePageIndicator();
    }

    // 页面切换按钮事件
    prevPageBtn.addEventListener("click", () => {
      if (currentPageIndex > 0) {
        switchToPage(currentPageIndex - 1);
      }
    });

    nextPageBtn.addEventListener("click", () => {
      if (currentPageIndex < pages.length - 1) {
        switchToPage(currentPageIndex + 1);
      }
    });

    // ==============================
    //        签名功能模块
    // ==============================

    // 在 ctx 确实存在后，定义真正的 updatePenColor 函数
    updatePenColor = function() {
      ctx.strokeStyle = isDark() ? "#fff" : "#000";
    };

    function updatePenSize() {
      const size = parseInt(penSizeSlider.value);
      ctx.lineWidth = size;
      penSizeValue.textContent = size + "px";
      
      // 更新笔迹粗细预览
      penSizePreview.textContent = size;
      penSizePreview.style.width = (size * 2) + "px";
      penSizePreview.style.height = (size * 2) + "px";
      penSizePreview.style.lineHeight = (size * 2) + "px";
    }

    penSizeSlider.addEventListener("input", updatePenSize);
    updatePenSize(); // 初始化笔迹粗细

    function clearCanvas(c, context) {
      const bgColor = isDark() ? "#1e1e1e" : "#fdfdfd";
      context.fillStyle = bgColor;
      context.fillRect(0, 0, c.width, c.height);
    }

    // 初始化画布
    clearCanvas(canvas, ctx);
    clearCanvas(signPanel, previewCtx);
    updatePenColor(); // 设置初始笔迹颜色

    // 配置画笔样式
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // 获取坐标
    function getPos(e, rect) {
      let clientX, clientY;
      
      if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX || 0;
        clientY = e.clientY || 0;
      }
      
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return { x, y };
    }

    // 绘制事件
    function startDraw(e) {
      if (isLocked) return;
      const rect = canvas.getBoundingClientRect();
      const pos = getPos(e, rect);
      
      // 检查是否在画布边界内，考虑笔迹粗细
      const lineWidth = ctx.lineWidth;
      if (pos.x < lineWidth || pos.x > canvas.width - lineWidth || 
          pos.y < lineWidth || pos.y > canvas.height - lineWidth) {
        return; // 如果起始点太靠近边缘，不开始绘制
      }
      
      ({ x: lastX, y: lastY } = pos);
      isDrawing = true;
      
      // 开始路径
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    }

    function draw(e) {
      if (!isDrawing || isLocked) return;
      const rect = canvas.getBoundingClientRect();
      const pos = getPos(e, rect);
      
      // 检查是否在画布边界内，考虑笔迹粗细
      const lineWidth = ctx.lineWidth;
      if (pos.x < lineWidth || pos.x > canvas.width - lineWidth || 
          pos.y < lineWidth || pos.y > canvas.height - lineWidth) {
        // 如果点在边界外，不绘制，但更新最后位置
        [lastX, lastY] = [pos.x, pos.y];
        return;
      }
      
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      [lastX, lastY] = [pos.x, pos.y];
      updatePreview(); // 实时更新预览
    }

    function stopDraw() {
      if (isDrawing) {
        isDrawing = false;
      }
    }

    // 绑定事件（在所有变量定义之后）
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", stopDraw);
    canvas.addEventListener("mouseout", stopDraw);
    canvas.addEventListener("touchstart", (e) => { 
      e.preventDefault(); 
      startDraw(e); 
    });
    canvas.addEventListener("touchmove", (e) => { 
      e.preventDefault(); 
      draw(e); 
    });
    canvas.addEventListener("touchend", stopDraw);

    // 判断画布是否为空
    function isCanvasEmpty() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const bgR = isDark() ? 30 : 253;
      const threshold = 10;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (
          Math.abs(r - bgR) > threshold ||
          Math.abs(g - bgR) > threshold ||
          Math.abs(b - bgR) > threshold
        ) {
          return false;
        }
      }
      return true;
    }

    // 更新预览（关键修复：确保所有颜色逻辑正确）
    function updatePreview() {
      try {
        // 清空预览画布
        clearCanvas(signPanel, previewCtx);
        
        // 绘制当前签名
        previewCtx.drawImage(canvas, 0, 0);

        const name = nameInput.value.trim();
        const isEmpty = isCanvasEmpty();

        // 如果画布为空且未输入姓名，且未锁定，则显示提示文字
        if (isEmpty && !name && !isLocked) {
          previewCtx.font = '16px "PingFang SC", "Microsoft YaHei", sans-serif';
          previewCtx.fillStyle = isDark() ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
          previewCtx.textAlign = 'center';
          previewCtx.fillText("请在此处签名", canvas.width / 2, canvas.height / 2 + 6);
          previewCtx.textAlign = "left";
        }

        // 如果用户输入了姓名，在预览区半透明显示
        if (name) {
          previewCtx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
          previewCtx.fillStyle = isDark() ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.3)";
          const textWidth = previewCtx.measureText(name).width;
          const x = (signPanel.width - textWidth) / 2;
          const y = signPanel.height / 2 + 6;
          previewCtx.fillText(name, x, y);
        }

        // 如果勾选了时间戳，在右下角显示
        if (addTimestampCheckbox.checked) {
          const now = new Date().toLocaleString();
          previewCtx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
          previewCtx.fillStyle = isDark() ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
          previewCtx.textAlign = "right";
          previewCtx.fillText(now, signPanel.width - 10, signPanel.height - 10);
          previewCtx.textAlign = "left";
        }
      } catch (error) {
        console.error("预览更新失败:", error);
      }
    }

    // 绑定事件（在所有变量定义之后）
    nameInput.addEventListener("input", updatePreview);
    addTimestampCheckbox.addEventListener("change", updatePreview);
    updatePreview(); // 初始化预览

    clearBtn.addEventListener("click", () => {
      if (isLocked) return;
      clearCanvas(canvas, ctx);
      updatePreview();
    });

    addPageBtn.addEventListener("click", () => {
      // 保存当前页的所有信息
      pages[currentPageIndex].name = nameInput.value;
      pages[currentPageIndex].image = canvas.toDataURL("image/png");
      pages[currentPageIndex].timestamp = new Date().toLocaleString();

      // 创建新页面
      pages.push({ name: "", timestamp: new Date().toLocaleString(), image: null });
      currentPageIndex = pages.length - 1;

      clearCanvas(canvas, ctx);
      nameInput.value = "";
      updatePreview();
      updatePageIndicator();
    });

    confirmBtn.addEventListener("click", () => {
      if (isLocked) return;

      // 保存当前页的所有信息
      pages[currentPageIndex].name = nameInput.value;
      pages[currentPageIndex].image = canvas.toDataURL("image/png");

      clearCanvas(signPanel, previewCtx);
      const img = new Image();
      img.onload = () => {
        previewCtx.drawImage(img, 0, 0);

        const name = nameInput.value.trim();
        if (name) {
          previewCtx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
          previewCtx.fillStyle = isDark() ? "#fff" : "#000"; // 确认后使用实色
          const textWidth = previewCtx.measureText(name).width;
          const x = (signPanel.width - textWidth) / 2;
          const y = signPanel.height / 2 + 6;
          previewCtx.fillText(name, x, y);
        }

        if (addTimestampCheckbox.checked) {
          const now = new Date().toLocaleString();
          previewCtx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
          previewCtx.fillStyle = isDark() ? "#fff" : "#000"; // 确认后使用实色
          previewCtx.textAlign = "right";
          previewCtx.fillText(now, signPanel.width - 10, signPanel.height - 10);
          previewCtx.textAlign = "left";
        }
      };
      img.src = canvas.toDataURL("image/png");

      isLocked = true;
      confirmBtn.disabled = true;
      clearBtn.disabled = true;
      nameInput.disabled = true;
      addPageBtn.disabled = true;
      prevPageBtn.disabled = true;
      nextPageBtn.disabled = true;
      exportPngBtn.disabled = false;
      exportAllPngBtn.disabled = false;
      exportPdfBtn.disabled = false;
    });

    // 修复：导出当前页 PNG
    exportPngBtn.addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = `签名_第${currentPageIndex + 1}页.png`;
      link.href = signPanel.toDataURL("image/png");
      link.click();
    });

    // 修复：批量导出所有页面的 PNG
    exportAllPngBtn.addEventListener("click", async () => {
      // 使用 Promise.all 确保所有页面都被处理
      const promises = pages.map(async (page, index) => {
        return new Promise((resolve) => {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = signPanel.width;
          tempCanvas.height = signPanel.height;
          const tempCtx = tempCanvas.getContext("2d");
          
          // 清空画布
          const bgColor = isDark() ? "#1e1e1e" : "#fdfdfd";
          tempCtx.fillStyle = bgColor;
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          
          // 如果有签名图片，绘制它
          if (page.image) {
            const img = new Image();
            img.onload = () => {
              tempCtx.drawImage(img, 0, 0);
              
              // 添加姓名
              if (page.name) {
                tempCtx.font = '18px "PingFang SC", "Microsoft YaHei", sans-serif';
                tempCtx.fillStyle = isDark() ? "#fff" : "#000";
                const textWidth = tempCtx.measureText(page.name).width;
                const x = (tempCanvas.width - textWidth) / 2;
                const y = tempCanvas.height / 2 + 6;
                tempCtx.fillText(page.name, x, y);
              }
              
              // 添加时间戳
              if (addTimestampCheckbox.checked && page.timestamp) {
                tempCtx.font = '12px "PingFang SC", "Microsoft YaHei", sans-serif';
                tempCtx.fillStyle = isDark() ? "#fff" : "#000";
                tempCtx.textAlign = "right";
                tempCtx.fillText(page.timestamp, tempCanvas.width - 10, tempCanvas.height - 10);
                tempCtx.textAlign = "left";
              }
              
              // 返回处理后的图片数据
              resolve({
                name: `签名_第${index + 1}页.png`,
                data: tempCanvas.toDataURL("image/png").split(",")[1]
              });
            };
            img.onerror = () => {
              // 如果图片加载失败，仍然生成空页面
              resolve({
                name: `签名_第${index + 1}页.png`,
                data: tempCanvas.toDataURL("image/png").split(",")[1]
              });
            };
            img.src = page.image;
          } else {
            // 如果没有签名图片，仍然生成空页面
            resolve({
              name: `签名_第${index + 1}页.png`,
              data: tempCanvas.toDataURL('image/png').split(",")[1]
            });
          }
        });
      });

      // 等待所有页面处理完成
      const pageData = await Promise.all(promises);
      
      // 创建 ZIP 文件
      const zip = new JSZip();
      pageData.forEach(page => {
        zip.file(page.name, page.data, { base64: true });
      });
      
      // 生成并下载 ZIP
      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = "所有签名页面.zip";
      link.href = URL.createObjectURL(content);
      link.click();
    });

    // 修复：PDF 导出，使用像素单位避免坐标转换问题
    exportPdfBtn.addEventListener("click", () => {
      // 创建 PDF，使用像素单位作为基础，然后转换为 PDF 单位
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt", // 使用点作为单位
        format: [560 * 0.75, 200 * 0.75] // 将像素转换为点 (1px = 0.75pt)
      });

      pages.forEach((page, index) => {
        if (index > 0) {
          // 从第二页开始添加新页面
          pdf.addPage([560 * 0.75, 200 * 0.75]);
        }
        
        // 如果页面有签名图片，则添加到 PDF
        if (page.image) {
          // 计算 PDF 中的坐标
          // PDF 坐标系：左下角为原点，Canvas 坐标系：左上角为原点
          const pageHeight = pdf.internal.pageSize.height;
          const y = pageHeight - (200 * 0.75); // 从页面顶部开始，转换为 PDF 坐标
          
          pdf.addImage(
            page.image, 
            "PNG", 
            0, // X 坐标不变
            y, // Y 坐标翻转
            560 * 0.75, // 宽度转换为 pt
            200 * 0.75  // 高度转换为 pt
          );
        }
        
        // 添加姓名和时间戳（如果存在）
        if (page.name || (addTimestampCheckbox.checked && page.timestamp)) {
          // 设置文本样式
          pdf.setFontSize(16);
          pdf.setTextColor(isDark() ? 255 : 0); // 根据主题设置颜色
          
          if (page.name) {
            // 计算姓名居中位置
            const textWidth = pdf.getTextWidth(page.name);
            const x = (560 * 0.75 - textWidth) / 2;
            
            // 在 PDF 坐标系中计算 Y 位置
            // 在 Canvas 中，姓名在 canvas.height/2 + 6 的位置
            // 转换为 PDF 坐标系：PDF_Y = Page_Height - Canvas_Y*0.75
            const canvasY = 200 / 2 + 6; // 签名区域的高度是 200px
            const pdfY = pdf.internal.pageSize.height - (canvasY * 0.75);
            
            pdf.text(page.name, x, pdfY);
          }
          
          if (addTimestampCheckbox.checked && page.timestamp) {
            pdf.setFontSize(12);
            pdf.setTextColor(isDark() ? 255 : 0);
            
            // 时间戳在右下角，转换坐标
            const canvasTimestampY = 200 - 10;
            const pdfTimestampY = pdf.internal.pageSize.height - (canvasTimestampY * 0.75);
            
            pdf.text(page.timestamp, 560 * 0.75 - 10, pdfTimestampY, { align: "right" });
          }
        }
      });

      pdf.save("多页签名.pdf");
    });

    updatePageIndicator(); // 初始化页面指示器
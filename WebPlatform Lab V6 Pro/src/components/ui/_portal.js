// _portal.js —— 弹层 portal 工具
// 把下拉/面板 DOM 移到 document.body，避免被父级 overflow:hidden 裁剪。
// 提供：
//   - mountDropdown(dropdownEl, triggerEl, opts): 移到 body + 按 trigger 定位 + 监听 scroll/resize
//   - 返回 cleanup 函数：移除 DOM + 解绑监听
//
// 设计要点：
//   1. dropdown 一旦 portal 到 body，其父级 overflow 不再影响它
//   2. 定位用 absolute + scrollX/Y，兼容父级有 transform 的情况（不依赖 fixed）
//   3. scroll 用捕获阶段，确保祖先容器滚动也能重新定位
//   4. cleanup 幂等，可重复调用

/**
 * 把弹层 portal 到 document.body 并按 trigger 定位。
 * @param {HTMLElement} dropdownEl 弹层节点
 * @param {HTMLElement} triggerEl 触发元素（用于计算位置）
 * @param {Object} opts
 * @param {string} [opts.placement='bottom'] 放置方向：bottom / top
 * @param {number} [opts.gap=4] 与 trigger 的间距
 * @param {string} [opts.align='left'] 对齐：left / right / matchWidth
 * @param {number} [opts.zIndex=1050] 层级
 * @returns {() => void} cleanup 函数
 */
export function mountDropdown(dropdownEl, triggerEl, opts = {}) {
  if (!dropdownEl || !triggerEl) return () => {};

  const {
    placement = 'bottom',
    gap = 4,
    align = 'left',
    zIndex = 1050,
  } = opts;

  // 移到 body（若尚未在 body）
  if (dropdownEl.parentElement !== document.body) {
    document.body.appendChild(dropdownEl);
  }

  // 让 dropdown 脱离父级定位上下文，使用 absolute + 全局坐标
  dropdownEl.style.position = 'absolute';
  dropdownEl.style.zIndex = String(zIndex);

  const position = () => {
    if (!triggerEl.isConnected || !dropdownEl.isConnected) return;
    const rect = triggerEl.getBoundingClientRect();
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const dw = dropdownEl.offsetWidth;
    const dh = dropdownEl.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left, top;
    if (placement === 'top') {
      left = rect.left + scrollX;
      top = rect.top - dh - gap + scrollY;
      // 上方空间不足时回退到下方
      if (rect.top - dh - gap < 8) {
        top = rect.bottom + gap + scrollY;
      }
    } else {
      // bottom
      left = rect.left + scrollX;
      top = rect.bottom + gap + scrollY;
      // 下方空间不足且上方更宽裕时翻转到上方
      if (rect.bottom + gap + dh > vh - 8 && rect.top - dh - gap > 8) {
        top = rect.top - dh - gap + scrollY;
      }
    }

    // 水平对齐
    if (align === 'right') {
      left = rect.right - dw + scrollX;
    } else if (align === 'matchWidth') {
      dropdownEl.style.width = `${rect.width}px`;
    }

    // 边界保护：不超出视口
    if (left + dw > vw - 8 + scrollX) left = vw - dw - 8 + scrollX;
    if (left < scrollX + 8) left = scrollX + 8;

    dropdownEl.style.left = `${left}px`;
    dropdownEl.style.top = `${top}px`;
  };

  // 先让 dropdown 可测量（display 不能是 none）
  position();

  // 监听 scroll（捕获）+ resize 重新定位
  const onScroll = () => position();
  const onResize = () => position();
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', onResize);

  // 返回 cleanup
  return () => {
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (dropdownEl.parentElement === document.body) {
      dropdownEl.remove();
    }
  };
}

/**
 * 判断点击事件是否发生在给定组件根元素或其 portal 弹层内。
 * 用于 outside click 检测：portal 后弹层不在组件 DOM 内，需额外判断。
 *
 * @param {Event} e 点击事件
 * @param {HTMLElement} rootEl 组件根元素
 * @param {HTMLElement|null} dropdownEl portal 的弹层元素
 * @returns {boolean} true 表示点击在内部（不算 outside）
 */
export function isClickInside(e, rootEl, dropdownEl) {
  if (rootEl && rootEl.contains(e.target)) return true;
  if (dropdownEl && dropdownEl.contains(e.target)) return true;
  return false;
}

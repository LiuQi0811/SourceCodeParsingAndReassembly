const MENU_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const ARROW_UP = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const LOGO_SVG = '<svg class="logo-mark" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path d="M32 3 58 18v28L32 61 6 46V18Z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M24 42V24l16 16V22" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface Layout {
  main: HTMLElement;
  sidebarNav: HTMLElement;
  searchWrap: HTMLElement;
  searchInput: HTMLInputElement;
  searchDropdown: HTMLElement;
  closeDrawer: () => void;
}

export function createLayout(root: HTMLElement): Layout {
  root.innerHTML = `
    <header class="topbar">
      <button class="icon-btn menu-btn" aria-label="打开目录">${MENU_ICON}</button>
      <a class="logo" href="#/">
        ${LOGO_SVG}
        <span class="logo-text">Node.js<em>宝典秘籍</em></span>
      </a>
      <div class="search-wrap" id="search-wrap">
        <span class="search-icon">${SEARCH_ICON}</span>
        <input id="search-input" type="text" placeholder="搜索 API / 模块 / 签名" autocomplete="off" spellcheck="false" />
        <kbd class="search-kbd">/</kbd>
        <div class="search-dropdown" id="search-dropdown" hidden></div>
      </div>
      <span class="version-badge">Node.js 22 LTS</span>
    </header>
    <div class="shell">
      <aside class="sidebar"><nav class="nav" id="nav"></nav></aside>
      <div class="backdrop" id="backdrop"></div>
      <main class="main" id="main"></main>
    </div>
    <button class="back-top" id="back-top" aria-label="返回顶部" hidden>${ARROW_UP}</button>
  `;

  const main = root.querySelector('#main') as HTMLElement;
  const sidebarNav = root.querySelector('#nav') as HTMLElement;
  const searchWrap = root.querySelector('#search-wrap') as HTMLElement;
  const searchInput = root.querySelector('#search-input') as HTMLInputElement;
  const searchDropdown = root.querySelector('#search-dropdown') as HTMLElement;
  const menuBtn = root.querySelector('.menu-btn') as HTMLButtonElement;
  const backdrop = root.querySelector('#backdrop') as HTMLElement;
  const backTop = root.querySelector('#back-top') as HTMLButtonElement;

  const closeDrawer = (): void => {
    document.body.classList.remove('drawer-open');
  };
  menuBtn.addEventListener('click', () => {
    document.body.classList.toggle('drawer-open');
  });
  backdrop.addEventListener('click', closeDrawer);

  backTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  window.addEventListener(
    'scroll',
    () => {
      backTop.hidden = window.scrollY < 600;
    },
    { passive: true },
  );

  return { main, sidebarNav, searchWrap, searchInput, searchDropdown, closeDrawer };
}

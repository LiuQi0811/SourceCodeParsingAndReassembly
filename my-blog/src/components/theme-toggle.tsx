"use client";

// 太阳图标(暗色模式下显示,点击切回亮色)
function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

// 月亮图标(亮色模式下显示,点击切到暗色)
function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

// 主题切换按钮:本项目第一个客户端组件
// 思路:不用 React 状态记录主题,图标显示交给 CSS(跟着 <html> 的 dark 类走),
// 点击时直接读真实 DOM——代码更少,也没有"挂载后再同步状态"的水合问题
export default function ThemeToggle() {
  const toggleTheme = () => {
    // 读取 <html> 当前的真实主题,取反得到目标主题
    const next = !document.documentElement.classList.contains("dark");
    // 1. 切换 <html> 的 dark 类,所有 dark: 样式(包括下面两个图标)立即生效
    document.documentElement.classList.toggle("dark", next);
    // 2. 写入 localStorage,刷新后记住选择
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label="切换亮色/暗色模式"
      className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-foreground dark:text-zinc-400 dark:hover:bg-white/[.08]"
    >
      {/* 两个图标都渲染,由 CSS 决定显示哪个:
          亮色下显示月亮(dark:hidden),暗色下显示太阳(hidden dark:block) */}
      <span className="dark:hidden">
        <MoonIcon />
      </span>
      <span className="hidden dark:block">
        <SunIcon />
      </span>
    </button>
  );
}

import Link from "next/link";
import ThemeToggle from "./theme-toggle";

// 导航链接数据:统一放数组,以后想加页面只需要在这里加一行
const navLinks = [
  { href: "/", label: "首页" },
  { href: "/tags", label: "标签" },
  { href: "/about", label: "关于" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/[.08] bg-background/80 backdrop-blur dark:border-white/[.145]">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
        {/* 网站名,点击回首页 */}
        <Link href="/" className="text-lg font-semibold tracking-tight">
          我的博客
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-6 text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-600 transition-colors hover:text-foreground dark:text-zinc-400"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

"""
Playwright renderer
"""
import asyncio
from typing import Optional
from crawler_framework.renderers.base import BaseRenderer
from crawler_framework.renderers import register_renderer


@register_renderer
class PlaywrightRenderer(BaseRenderer):
    name = "playwright"
    _browser = None
    _playwright = None

    @classmethod
    def is_available(cls) -> bool:
        try:
            import playwright.async_api
            return True
        except ImportError:
            return False

    async def _ensure_browser(self):
        if self._browser:
            return
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        try:
            self._browser = await self._playwright.chromium.launch(headless=True, channel="chrome")
        except Exception:
            self._browser = await self._playwright.chromium.launch(headless=True)

    async def render(self, url: str, wait_ms: int = 2000) -> Optional[str]:
        try:
            await self._ensure_browser()
            page = await self._browser.new_page()
            # overall timeout: 45s per page
            await asyncio.wait_for(
                self._do_render(page, url, wait_ms),
                timeout=45,
            )
            html = await page.content()
            await page.close()
            return html
        except Exception:
            try:
                await page.close()
            except Exception:
                pass
            return None

    async def _do_render(self, page, url: str, wait_ms: int):
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(wait_ms)
        await page.evaluate("""
            async () => {
                await new Promise((resolve) => {
                    let total = 0;
                    const step = 800;
                    const timer = setInterval(() => {
                        window.scrollBy(0, step);
                        total += step;
                        if (total >= document.body.scrollHeight || total > 8000) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 300);
                });
            }
        """)
        await page.wait_for_timeout(1500)

    async def close(self) -> None:
        try:
            if self._browser:
                await self._browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        self._browser = None
        self._playwright = None
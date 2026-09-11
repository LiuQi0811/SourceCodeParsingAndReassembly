#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kmoe 验证码处理模块
===================
支持多种验证码处理方式：
1. 手动输入（人工识别）
2. OCR识别（ddddocr/本地识别）
3. 第三方打码平台接入框架
4. 浏览器自动化（Playwright/Selenium模拟操作）
"""

import os
import time
import base64
import logging
from pathlib import Path
from typing import Optional, Callable

logger = logging.getLogger(__name__)


class CaptchaSolver:
    """验证码解决器基类"""
    
    def solve(self, image_path: str) -> Optional[str]:
        """识别验证码，返回结果"""
        raise NotImplementedError
    
    def report_error(self, image_path: str, wrong_code: str):
        """上报识别错误（用于打码平台反馈）"""
        pass


class ManualSolver(CaptchaSolver):
    """手动输入验证码"""
    
    def __init__(self, show_image: bool = True):
        self.show_image = show_image
    
    def solve(self, image_path: str) -> Optional[str]:
        if self.show_image and os.path.exists(image_path):
            logger.info(f"验证码图片已保存至: {image_path}")
            logger.info("请打开图片查看验证码")
        
        print("\n" + "="*50)
        print(f"验证码图片路径: {image_path}")
        code = input("请输入验证码: ").strip()
        print("="*50 + "\n")
        
        return code if code else None


class OCRSolver(CaptchaSolver):
    """本地OCR识别（需要ddddocr库）"""
    
    def __init__(self):
        try:
            import ddddocr
            self.ocr = ddddocr.DdddOcr(show_ad=False)
            self.available = True
        except ImportError:
            logger.warning("ddddocr未安装，OCR识别不可用")
            logger.warning("安装命令: pip install ddddocr")
            self.available = False
    
    def solve(self, image_path: str) -> Optional[str]:
        if not self.available:
            return None
        
        try:
            with open(image_path, 'rb') as f:
                img_bytes = f.read()
            result = self.ocr.classification(img_bytes)
            logger.info(f"OCR识别结果: {result}")
            return result
        except Exception as e:
            logger.error(f"OCR识别失败: {e}")
            return None


class ThirdPartySolver(CaptchaSolver):
    """
    第三方打码平台接入框架
    
    示例接入（以超级鹰为例）:
    solver = ThirdPartySolver(
        platform="chaojiying",
        username="your_user",
        password="your_pass",
        soft_id="123456"
    )
    """
    
    def __init__(self, platform: str = "custom", **kwargs):
        self.platform = platform
        self.kwargs = kwargs
        self.api = None
        
        if platform == "chaojiying":
            self._init_chaojiying()
        elif platform == "2captcha":
            self._init_2captcha()
        elif platform == "custom":
            self.api = kwargs.get("api_func")
    
    def _init_chaojiying(self):
        """初始化超级鹰"""
        try:
            from chaojiying import Chaojiying_Client
            self.client = Chaojiying_Client(
                self.kwargs.get("username", ""),
                self.kwargs.get("password", ""),
                self.kwargs.get("soft_id", "")
            )
        except ImportError:
            logger.error("请先安装超级鹰SDK: pip install chaojiying")
    
    def _init_2captcha(self):
        """初始化2captcha"""
        self.api_key = self.kwargs.get("api_key", "")
    
    def solve(self, image_path: str) -> Optional[str]:
        if self.platform == "chaojiying" and hasattr(self, 'client'):
            try:
                with open(image_path, 'rb') as f:
                    im = f.read()
                result = self.client.PostPic(im, 1902)  # 1902=4位英文数字
                if result.get("err_no") == 0:
                    return result.get("pic_str")
                else:
                    logger.error(f"打码失败: {result.get('err_str')}")
            except Exception as e:
                logger.error(f"超级鹰打码异常: {e}")
        
        elif self.platform == "2captcha" and self.api_key:
            # TODO: 实现2captcha API调用
            pass
        
        elif self.api and callable(self.api):
            # 自定义API函数
            try:
                return self.api(image_path)
            except Exception as e:
                logger.error(f"自定义打码API异常: {e}")
        
        return None


class SliderCaptchaSolver:
    """滑块验证码处理（使用轨迹模拟）"""
    
    def __init__(self):
        self.tracks = self._generate_tracks()
    
    def _generate_tracks(self) -> list:
        """
        生成拟人滑动轨迹
        加速度 -> 匀速 -> 减速度
        """
        tracks = []
        current = 0
        mid = 200  # 中间距离阈值
        t = 0.2
        v = 0
        
        # 加速阶段
        while current < mid:
            a = 2
            v0 = v
            v = v0 + a * t
            move = v0 * t + 0.5 * a * t * t
            current += move
            tracks.append(round(move))
        
        # 减速阶段
        while current < 260:
            a = -3
            v0 = v
            v = v0 + a * t
            move = v0 * t + 0.5 * a * t * t
            if current + move > 260:
                move = 260 - current
            current += move
            tracks.append(round(move))
        
        # 小幅回拉（模拟人类校准）
        tracks.extend([-2, -1, 1, 2])
        
        return tracks
    
    def get_slide_tracks(self, distance: int) -> list:
        """根据实际缺口距离生成轨迹"""
        # TODO: 缺口识别 + 轨迹缩放
        return self.tracks


class KmoeCaptchaHandler:
    """
    Kmoe网站验证码处理主类
    
    流程:
    1. 请求验证码接口
    2. 保存验证码图片
    3. 使用solver识别
    4. 提交验证
    """
    
    def __init__(self, session, solver: CaptchaSolver = None, data_dir: str = "./kmoe_data"):
        self.session = session
        self.solver = solver or ManualSolver()
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
    
    def _get_captcha_image(self, captcha_type: str = "down") -> Optional[str]:
        """获取验证码图片"""
        # TODO: 分析真实的验证码URL和参数
        captcha_url = f"https://kxx.moe/captcha.php?type={captcha_type}&t={int(time.time()*1000)}"
        
        try:
            resp = self.session.get(captcha_url, timeout=10)
            if resp.status_code == 200 and len(resp.content) > 100:
                img_path = self.data_dir / f"captcha_{int(time.time())}.png"
                with open(img_path, 'wb') as f:
                    f.write(resp.content)
                return str(img_path)
        except Exception as e:
            logger.error(f"获取验证码失败: {e}")
        
        return None
    
    def verify_and_get_url(self, down_url: str, max_retry: int = 3) -> Optional[str]:
        """
        验证验证码并获取真实下载URL
        :param down_url: 目标下载路径
        :param max_retry: 最大重试次数
        :return: 真实下载URL或None
        """
        for attempt in range(max_retry):
            img_path = self._get_captcha_image()
            if not img_path:
                logger.error("获取验证码图片失败")
                continue
            
            code = self.solver.solve(img_path)
            if not code:
                logger.warning("验证码识别结果为空，重试")
                continue
            
            # 提交验证码
            submit_url = "https://kxx.moe/captcha_do.php"
            # TODO: 根据实际接口调整参数
            data = {
                "code": code,
                "url": down_url,
                "t": int(time.time() * 1000),
            }
            
            try:
                resp = self.session.post(submit_url, data=data, timeout=10)
                result = resp.json()
                
                if result.get("code") == 0 or "downurl" in result:
                    logger.info("验证码验证成功!")
                    real_url = result.get("downurl", down_url)
                    return real_url
                else:
                    logger.warning(f"验证码错误 (尝试 {attempt+1}/{max_retry})")
                    self.solver.report_error(img_path, code)
                    
            except Exception as e:
                logger.error(f"提交验证码异常: {e}")
        
        logger.error(f"验证码验证失败，已重试{max_retry}次")
        return None


# ============ 浏览器自动化方案 ============

class BrowserAutomation:
    """
    使用Playwright进行浏览器自动化下载
    优势: 完全模拟真实用户，无需逆向JS，自动处理验证码
    """
    
    def __init__(self, headless: bool = False):
        self.headless = headless
        self.browser = None
        self.page = None
    
    def start(self):
        """启动浏览器"""
        try:
            from playwright.sync_api import sync_playwright
            self.playwright = sync_playwright().start()
            self.browser = self.playwright.chromium.launch(headless=self.headless)
            self.context = self.browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )
            self.page = self.context.new_page()
            logger.info("浏览器启动成功")
            return True
        except ImportError:
            logger.error("请先安装playwright: pip install playwright && playwright install")
            return False
    
    def login(self, username: str, password: str) -> bool:
        """登录（页面模拟操作）"""
        self.page.goto("https://kxx.moe/login.php")
        self.page.wait_for_load_state("networkidle")
        
        # 填写用户名密码（需要根据实际选择器调整）
        try:
            self.page.fill('input[name="u"]', username)
            self.page.fill('input[name="p"]', password)
            self.page.click('button[type="submit"]')
            self.page.wait_for_load_state("networkidle")
            
            # 检查是否登录成功
            if "登錄" not in self.page.content():
                logger.info("登录成功")
                return True
        except Exception as e:
            logger.error(f"登录失败: {e}")
        
        return False
    
    def download_book(self, book_id: str, save_dir: str, 
                     file_type: str = "epub", vol_indices: list = None):
        """
        浏览器自动化下载
        :param book_id: 漫画ID
        :param save_dir: 保存目录
        :param file_type: mobi/epub
        :param vol_indices: 要下载的卷索引（None=全部）
        """
        url = f"https://kxx.moe/c/{book_id}.htm"
        self.page.goto(url)
        self.page.wait_for_load_state("networkidle")
        
        # 切换到对应格式标签
        tab_text = "下載 epub格式(iPad/小米)" if file_type == "epub" else "下載 Kindle .mobi格式"
        try:
            self.page.click(f'text="{tab_text}"')
            time.sleep(1)
        except:
            logger.warning(f"切换标签失败: {tab_text}")
        
        # 获取所有下载链接
        download_links = self.page.query_selector_all('a[href*="/dl/"]')
        logger.info(f"找到 {len(download_links)} 个下载链接")
        
        save_path = Path(save_dir)
        save_path.mkdir(parents=True, exist_ok=True)
        
        # 处理下载
        with self.page.expect_download() as download_info:
            for i, link in enumerate(download_links):
                if vol_indices and i not in vol_indices:
                    continue
                
                logger.info(f"点击下载第 {i+1} 卷...")
                link.click()
                
                # 等待可能的验证码弹窗
                time.sleep(2)
                
                # TODO: 检测并处理验证码弹窗
                # 如果有验证码，需要人工介入或自动识别
                
                download = download_info.value
                filename = download.suggested_filename
                download.save_as(str(save_path / filename))
                logger.info(f"已保存: {filename}")
                
                time.sleep(5)  # 下载间隔
    
    def handle_captcha_popup(self):
        """处理验证码弹窗（需要人工介入时调用）"""
        # 检测验证码弹窗
        captcha_frame = self.page.query_selector('.captcha-popup, #captcha_div')
        if captcha_frame:
            logger.info("检测到验证码弹窗，请在浏览器中手动完成验证")
            # 等待用户完成验证（检测弹窗消失）
            self.page.wait_for_selector('.captcha-popup', state='hidden', timeout=120000)
            logger.info("验证码验证完成")
    
    def close(self):
        """关闭浏览器"""
        if self.browser:
            self.browser.close()
        if hasattr(self, 'playwright'):
            self.playwright.stop()


def create_solver(mode: str = "manual", **kwargs) -> CaptchaSolver:
    """
    创建验证码解决器工厂函数
    :param mode: manual/ocr/chaojiying/2captcha/custom
    """
    if mode == "manual":
        return ManualSolver()
    elif mode == "ocr":
        return OCRSolver()
    elif mode in ["chaojiying", "2captcha", "custom"]:
        return ThirdPartySolver(platform=mode, **kwargs)
    else:
        logger.warning(f"未知验证码模式: {mode}，使用手动输入")
        return ManualSolver()


if __name__ == "__main__":
    # 测试
    print("Kmoe验证码处理模块")
    print("支持模式: manual, ocr, chaojiying, 2captcha")
    print("浏览器自动化模式支持完全模拟用户操作（推荐使用）")

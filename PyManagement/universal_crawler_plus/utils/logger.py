"""
日志工具模块
统一日志格式，支持彩色输出
"""
import logging
import sys
from colorama import init, Fore, Style

init(autoreset=True)


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器"""
    COLORS = {
        'DEBUG': Fore.CYAN,
        'INFO': Fore.GREEN,
        'WARNING': Fore.YELLOW,
        'ERROR': Fore.RED,
        'CRITICAL': Fore.RED + Style.BRIGHT,
    }

    def format(self, record):
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname:<8}{Style.RESET_ALL}"
        return super().format(record)


_logger = None


def get_logger(name: str = "Crawler", level: str = "INFO") -> logging.Logger:
    global _logger
    if _logger is not None:
        return _logger

    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.handlers.clear()

    # 控制台处理器
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.DEBUG)
    fmt = ColoredFormatter(
        fmt=f"%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S"
    )
    console.setFormatter(fmt)
    logger.addHandler(console)

    # 文件处理器
    try:
        file_handler = logging.FileHandler("crawler.log", encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_fmt = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )
        file_handler.setFormatter(file_fmt)
        logger.addHandler(file_handler)
    except Exception:
        pass

    _logger = logger
    return logger

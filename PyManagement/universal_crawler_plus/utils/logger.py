"""
日志工具模块
统一日志格式，支持彩色输出
- 每个 name 返回独立 logger（不再共用首个实例，避免模块名串台）
- 同一 logger 只挂载一次 handler，避免重复输出
- colorama 为可选依赖，缺失时自动退化为无色输出
"""
import logging
import sys

try:
    from colorama import init, Fore, Style
    init(autoreset=True)
    _HAS_COLORAMA = True
except Exception:  # colorama 未安装时的兜底
    _HAS_COLORAMA = False

    class _Dummy:
        def __getattr__(self, _name):
            return ""

    Fore = Style = _Dummy()


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器"""
    COLORS = {
        'DEBUG': Fore.CYAN,
        'INFO': Fore.GREEN,
        'WARNING': Fore.YELLOW,
        'ERROR': Fore.RED,
        'CRITICAL': Fore.RED + (Style.BRIGHT if _HAS_COLORAMA else ""),
    }

    def format(self, record):
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname:<8}{Style.RESET_ALL if _HAS_COLORAMA else ''}"
        return super().format(record)


# 按名称缓存各自的 logger
_loggers = {}
# 文件处理器只挂一个（所有模块共享同一个日志文件），避免重复写文件
_file_handler = None


def _build_file_handler():
    global _file_handler
    if _file_handler is not None:
        return _file_handler
    try:
        handler = logging.FileHandler("crawler.log", encoding="utf-8")
        handler.setLevel(logging.DEBUG)
        handler.setFormatter(logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))
        _file_handler = handler
    except Exception:
        _file_handler = None
    return _file_handler


def get_logger(name: str = "Crawler", level: str = "INFO") -> logging.Logger:
    if name in _loggers:
        return _loggers[name]

    logger = logging.getLogger(f"universal_crawler.{name}")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    logger.propagate = False  # 防止向 root logger 冒泡导致重复打印
    logger.handlers.clear()

    # 控制台处理器
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.DEBUG)
    console.setFormatter(ColoredFormatter(
        fmt=f"%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%H:%M:%S"
    ))
    logger.addHandler(console)

    # 共享的文件处理器
    fh = _build_file_handler()
    if fh is not None:
        logger.addHandler(fh)

    _loggers[name] = logger
    return logger

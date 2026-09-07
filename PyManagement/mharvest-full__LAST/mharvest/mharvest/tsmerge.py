"""TS 分片合并：把抓下来的一堆 .ts 拼成完整视频。

------------------------------------------------------------------------
为什么要单独一个模块
------------------------------------------------------------------------
框架原本只在 m3u8 流程里合并 ts（内存中拼接后转封装）。
但还有一类常见场景它管不到：

    站点上直接散着一批 ts 文件，压根没有 m3u8 清单
    seg_001.ts  seg_002.ts  ...  seg_100.ts

这时抓取器会把它们当 100 个独立视频存下来，用户拿到手是散的。
本模块负责事后（或抓取结束时）把这堆散片识别成序列并合并。

------------------------------------------------------------------------
两种合并方式
------------------------------------------------------------------------
1. ffmpeg concat 解复用器（首选）
   写一个列表文件交给 ffmpeg，让它自己按序读取：
       file 'seg_001.ts'
       file 'seg_002.ts'
   -c copy 只换容器不重编码，秒级完成，且**会重算时间戳**。

2. 裸拼接 cat（降级）
   MPEG-TS 是流式格式，直接首尾相接就能播。
   但每个分片的时间戳从各自起点开始，拼完后播放器看到的
   时间轴是重复的，**时长显示会错**（常见症状：进度条能拖但
   总时长只有第一片那么长）。

所以只要 ffmpeg 在，一律走方式 1。

------------------------------------------------------------------------
判定难点
------------------------------------------------------------------------
- 排序必须是"自然序"：seg_10.ts 要排在 seg_2.ts 后面，
  按字符串排会得到 seg_10 < seg_2 的错误顺序，拼出来画面乱跳
- 分组要按"去掉数字后的骨架"：seg_001.ts 和 seg_002.ts 同组，
  而 intro_001.ts 是另一组，不能混在一起
- 单个大 ts 不是分片，是完整视频，不该被合并，只做转封装

------------------------------------------------------------------------
加密分片
------------------------------------------------------------------------
如果 ts 是 AES-128 加密的，必须有密钥才能解。密钥只写在 m3u8 的
EXT-X-KEY 里，**散装 ts 没有 m3u8 就无从得知密钥**，本模块解不了。
这种情况下合并出来的文件无法播放——不是 bug，是缺密钥。
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

TS_EXT = {".ts", ".m2ts", ".mts"}

# 文件名里的数字段，用于自然排序和分组
DIGITS_RE = re.compile(r"(\d+)")


@dataclass
class MergeResult:
    """一次合并的结果。"""

    name: str = ""              # 序列名（去掉数字后的骨架）
    output: str = ""            # 输出文件
    count: int = 0              # 合并了多少个分片
    size: int = 0
    method: str = ""            # ffmpeg / concat
    skipped: list = field(default_factory=list)  # 没参与的散片
    error: str = ""

    @property
    def ok(self) -> bool:
        return bool(self.output) and not self.error

    def to_dict(self) -> dict:
        return {
            "name": self.name, "output": self.output, "count": self.count,
            "size": self.size, "method": self.method,
            "skipped": self.skipped, "error": self.error,
        }


def looks_like_plain_ts(path: Path) -> bool:
    """判断一个 ts 文件是否未加密。

    MPEG-TS 每 188 字节一个包，包首是同步字节 0x47。
    AES-128 加密后明文的每个 16 字节块都被彻底打乱，
    首字节恰好还是 0x47 的概率可以忽略，且连续两个包位置
    都对上的概率更低——所以用两个同步字节做判据足够可靠。

    判不出来时返回 True（当作未加密），宁可漏报也不误杀。
    """
    try:
        with path.open("rb") as fh:
            head = fh.read(189)  # 覆盖两个包的起始位置
    except OSError:
        return False
    if len(head) < 189:
        return False
    return head[0] == 0x47 and head[188] == 0x47


def find_encrypted(files: list[Path]) -> list[Path]:
    """从分片列表里挑出疑似加密的那些。"""
    return [f for f in files if not looks_like_plain_ts(f)]


def natural_key(path: Path) -> tuple:
    """自然排序键：把文件名里的数字当数字比，而不是当字符串比。

    seg_2.ts < seg_10.ts，而不是字符串序的 seg_10.ts < seg_2.ts
    """
    parts: list = []
    for chunk in DIGITS_RE.split(path.stem):
        parts.append(int(chunk) if chunk.isdigit() else chunk.lower())
    return tuple(parts)


def group_key(path: Path) -> str:
    """分组键：把文件名里的数字全部抹掉，剩下的就是序列骨架。

    seg_001.ts -> "seg_"    seg_002.ts -> "seg_"
    intro_01.ts -> "intro_"  -> 与前者不同组
    """
    return DIGITS_RE.sub("#", path.stem)


def find_ts_sequences(directory: str | Path,
                      min_count: int = 2) -> dict[str, list[Path]]:
    """在一个目录里找出所有 ts 序列。

    :param min_count: 至少几个文件才算"序列"，
                      低于这个数的按单个文件处理（不合并）
    :return: {序列名: [按自然序排好的文件路径]}
    """
    directory = Path(directory)
    if not directory.is_dir():
        return {}

    groups: dict[str, list[Path]] = {}
    for path in directory.iterdir():
        if not path.is_file() or path.suffix.lower() not in TS_EXT:
            continue
        # 跳过隐藏的续传记录等
        if path.name.startswith("."):
            continue
        groups.setdefault(group_key(path), []).append(path)

    return {
        name: sorted(files, key=natural_key)
        for name, files in groups.items()
        if len(files) >= min_count
    }


def merge_ts_files(files: list[Path], out_path: str | Path,
                   use_ffmpeg: bool = True) -> MergeResult:
    """把一个 ts 序列合并成单个视频文件。

    :param files: 已按顺序排好的分片路径
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    result = MergeResult(count=len(files))

    if not files:
        result.error = "没有要合并的文件"
        return result

    # 加密分片没有密钥就解不了，这时候合并只会产出一个
    # "看起来成功、实际是垃圾"的文件——宁可明确报错
    encrypted = find_encrypted(files)
    if encrypted:
        names = ", ".join(p.name for p in encrypted[:3])
        more = f" 等 {len(encrypted)} 个" if len(encrypted) > 3 else ""
        result.error = (
            f"检测到 {len(encrypted)} 个疑似 AES 加密的分片（{names}{more}），"
            "无法合并。\n"
            "  密钥只写在 m3u8 的 #EXT-X-KEY 里，散装 ts 没有 m3u8 就拿不到密钥。\n"
            "  请改为抓取这条流的 m3u8 地址（框架会自动取密钥并解密）。")
        return result

    if use_ffmpeg and shutil.which("ffmpeg"):
        if _merge_with_ffmpeg(files, out_path):
            result.output = str(out_path)
            result.size = out_path.stat().st_size if out_path.exists() else 0
            result.method = "ffmpeg"
            return result
        # ffmpeg 失败就退回裸拼接

    _merge_by_concat(files, out_path)
    result.output = str(out_path)
    result.size = out_path.stat().st_size if out_path.exists() else 0
    result.method = "concat"
    return result


def _merge_with_ffmpeg(files: list[Path], out_path: Path) -> bool:
    """用 concat 解复用器合并，能重算时间戳，产物时长正确。"""
    # 列表文件放到临时目录，避免污染输出目录
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False,
                                     encoding="utf-8") as fh:
        list_path = Path(fh.name)
        for f in files:
            # 路径里的单引号要转义，否则 ffmpeg 解析列表会出错
            escaped = str(f.resolve()).replace("'", "'\\''")
            fh.write(f"file '{escaped}'\n")

    try:
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-f", "concat", "-safe", "0",
               "-i", str(list_path),
               "-c", "copy",
               "-movflags", "+faststart",
               str(out_path)]
        proc = subprocess.run(cmd, capture_output=True, timeout=1800)
        return (proc.returncode == 0
                and out_path.exists()
                and out_path.stat().st_size > 0)
    except (subprocess.SubprocessError, OSError):
        return False
    finally:
        list_path.unlink(missing_ok=True)


def _merge_by_concat(files: list[Path], out_path: Path) -> None:
    """裸拼接：MPEG-TS 是流式格式，直接首尾相接即可播放。

    缺点是时间戳不连续，时长显示可能不准；有 ffmpeg 时不会走到这里。
    分块写入，避免大视频一次性占满内存。
    """
    with out_path.open("wb") as out:
        for f in files:
            with f.open("rb") as src:
                while True:
                    chunk = src.read(1 << 20)
                    if not chunk:
                        break
                    out.write(chunk)


def merge_directory(directory: str | Path,
                    out_dir: Optional[str | Path] = None,
                    min_count: int = 2,
                    keep_parts: bool = True,
                    use_ffmpeg: bool = True,
                    on_result=None) -> list[MergeResult]:
    """扫描目录，把所有 ts 序列各自合并成一个视频。

    :param keep_parts: 合并后是否保留原分片。
                       默认保留——合并结果需要人工确认能播再删更稳妥
    :return: 每个序列一条 MergeResult
    """
    directory = Path(directory)
    out_dir = Path(out_dir) if out_dir else directory
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[MergeResult] = []
    sequences = find_ts_sequences(directory, min_count=min_count)

    if not sequences:
        # 没有成序列的，看看有没有单个 ts 需要转封装
        singles = [p for p in directory.iterdir()
                   if p.is_file() and p.suffix.lower() in TS_EXT
                   and not p.name.startswith(".")]
        # 加密的单个文件同样跳过
        singles = [p for p in singles if looks_like_plain_ts(p)]
        if singles and use_ffmpeg and shutil.which("ffmpeg"):
            for single in singles:
                out = out_dir / f"{single.stem}.mp4"
                if _remux_single(single, out):
                    r = MergeResult(name=single.stem, output=str(out),
                                    count=1, method="ffmpeg-remux",
                                    size=out.stat().st_size)
                    results.append(r)
                    if on_result:
                        on_result(r)
        return results

    for name, files in sorted(sequences.items()):
        # 序列名里有 # 占位符，换成干净的名字
        clean = re.sub(r"#+", "", name).strip("_-.") or "video"
        out_path = out_dir / f"{clean}.mp4"
        # 同名文件已存在就加序号，别覆盖上一次的结果
        counter = 1
        while out_path.exists():
            out_path = out_dir / f"{clean}-{counter}.mp4"
            counter += 1

        result = merge_ts_files(files, out_path, use_ffmpeg=use_ffmpeg)
        result.name = clean

        if result.ok and not keep_parts:
            for f in files:
                f.unlink(missing_ok=True)

        results.append(result)
        if on_result:
            on_result(result)

    return results


def _remux_single(src: Path, out_path: Path) -> bool:
    """单个 ts 转封装成 mp4（不重编码）。"""
    try:
        cmd = ["ffmpeg", "-y", "-loglevel", "error",
               "-i", str(src), "-c", "copy",
               "-movflags", "+faststart", str(out_path)]
        proc = subprocess.run(cmd, capture_output=True, timeout=1800)
        return (proc.returncode == 0 and out_path.exists()
                and out_path.stat().st_size > 0)
    except (subprocess.SubprocessError, OSError):
        return False


def probe(path: str | Path) -> dict:
    """用 ffprobe 检查产物是否可播，返回关键信息。

    没有 ffprobe 时返回空字典，调用方据此跳过校验。
    """
    if not shutil.which("ffprobe"):
        return {}
    path = Path(path)
    if not path.exists():
        return {}
    cmd = ["ffprobe", "-v", "error",
           "-show_entries",
           "format=duration,size:stream=codec_type,codec_name,width,height",
           "-of", "default=noprint_wrappers=1", str(path)]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=60)
    except (subprocess.SubprocessError, OSError):
        return {}
    if proc.returncode != 0:
        return {}

    info: dict = {"streams": []}
    for line in proc.stdout.decode("utf-8", "ignore").splitlines():
        key, _, value = line.partition("=")
        if key == "duration":
            try:
                info["duration"] = float(value)
            except ValueError:
                pass
        elif key == "size":
            try:
                info["size"] = int(value)
            except ValueError:
                pass
        elif key in ("codec_name", "codec_type", "width", "height"):
            info["streams"].append(line.strip())
    return info

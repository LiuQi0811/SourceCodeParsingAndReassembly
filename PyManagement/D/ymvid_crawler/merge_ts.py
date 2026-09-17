"""独立分片合并工具：把多个 TS/MPEG-TS 分片按文件名顺序合并为单个视频文件。

用法:
  python merge_ts.py <目录>                       # 合并目录内所有 *.ts，输出 merged.mp4
  python merge_ts.py <目录> --pattern "playlist*.ts"
  python merge_ts.py a.ts b.ts c.ts -o out.mp4    # 直接指定分片文件

依赖: 本机 FFmpeg（需在 PATH 中）
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path


def natural_key(name: str) -> list:
    """自然排序：playlist2.ts < playlist10.ts（数字按数值比较）"""
    return [int(t) if t.isdigit() else t.lower()
            for t in re.split(r"(\d+)", name)]


def collect_files(inputs: list[str], pattern: str) -> list[Path]:
    files = []
    for p in inputs:
        p = Path(p)
        if p.is_dir():
            files.extend(p.glob(pattern))
        elif p.is_file():
            files.append(p)
    # 去重 + 自然排序
    seen, unique = set(), []
    for f in files:
        rp = f.resolve()
        if rp not in seen:
            seen.add(rp)
            unique.append(f)
    unique.sort(key=lambda f: natural_key(f.name))
    return unique


def main():
    parser = argparse.ArgumentParser(
        description="TS 分片按文件名顺序合并为单个视频（FFmpeg concat, -c copy）"
    )
    parser.add_argument("inputs", nargs="+", help="目录或 .ts 文件，可混合")
    parser.add_argument("-o", "--output", default="",
                        help="输出文件（默认 <首个分片所在目录>/merged.mp4）")
    parser.add_argument("--pattern", default="*.ts",
                        help="目录模式下的文件名匹配（默认 *.ts）")
    args = parser.parse_args()

    if not shutil.which("ffmpeg"):
        print("[错误] 未找到 ffmpeg，请先安装并加入 PATH")
        sys.exit(1)

    files = collect_files(args.inputs, args.pattern)
    if not files:
        print("[错误] 未找到任何分片文件")
        sys.exit(1)

    valid = [f for f in files if f.stat().st_size > 0]
    empty = len(files) - len(valid)
    if empty:
        print(f"[警告] 跳过 {empty} 个空文件")

    total = sum(f.stat().st_size for f in valid)
    preview = ", ".join(f.name for f in valid[:8])
    print(f"[信息] {len(valid)} 个分片，总大小 {total / 1024 / 1024:.1f} MB")
    print(f"[信息] 顺序: {preview}{' ...' if len(valid) > 8 else ''}")

    if not args.output:
        args.output = str(valid[0].resolve().parent / "merged.mp4")
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)

    # concat 列表：绝对路径 + 前向斜杠 + 单引号
    concat_file = out.parent / f".{out.stem}_concat.txt"
    with open(concat_file, "w", encoding="utf-8") as f:
        for tf in valid:
            f.write(f"file '{tf.resolve().as_posix()}'\n")

    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
           "-i", str(concat_file), "-c", "copy", str(out)]
    print("[信息] 合并中...")
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL,
                          stderr=subprocess.PIPE)
    if proc.returncode != 0:
        print(f"[错误] FFmpeg 合并失败:\n"
              f"{proc.stderr.decode(errors='ignore')[:500]}")
        sys.exit(1)

    concat_file.unlink(missing_ok=True)
    print(f"[完成] 输出: {out} ({out.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()

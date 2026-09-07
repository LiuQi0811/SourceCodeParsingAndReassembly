"""TS 合并测试。

重点验证三件事：
  1. 自然排序（seg_10 不能排到 seg_2 前面，否则画面乱跳）
  2. 分组正确（seg_* 和 intro_* 是两组，不能混在一起）
  3. 产物真的能播（ffprobe 校验时长、编码、分辨率）
"""

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mharvest.tsmerge import (  # noqa: E402
    find_ts_sequences, group_key, looks_like_plain_ts, merge_directory,
    merge_ts_files, natural_key, probe,
)

MEDIA = Path(__file__).parent / "media"
passed, failed = 0, 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        print(f"  [OK  ] {name}")
        passed += 1
    else:
        print(f"  [FAIL] {name}" + (f"  -> {detail}" if detail else ""))
        failed += 1


def main() -> int:
    # 放到临时目录操作，别污染测试站素材
    work = Path(tempfile.mkdtemp(prefix="tsmerge_test_"))
    try:
        print("\n=== 1. 自然排序（关键）===")
        # 人为造出字符串序与数值序不一致的场景
        names = ["seg_1.ts", "seg_2.ts", "seg_9.ts", "seg_10.ts", "seg_11.ts"]
        fake = [work / n for n in names]
        by_str = [p.name for p in sorted(fake)]
        by_nat = [p.name for p in sorted(fake, key=natural_key)]
        # 字符串序会把 seg_10/seg_11 插到 seg_2 前面
        check("字符串序确实会出错",
              by_str == ["seg_1.ts", "seg_10.ts", "seg_11.ts",
                         "seg_2.ts", "seg_9.ts"], str(by_str))
        check("自然序正确",
              by_nat == ["seg_1.ts", "seg_2.ts", "seg_9.ts",
                         "seg_10.ts", "seg_11.ts"], str(by_nat))

        print("\n=== 2. 分组（不同骨架不能混）===")
        check("seg_001 与 seg_002 同组",
              group_key(work / "seg_001.ts") == group_key(work / "seg_002.ts"))
        check("seg_001 与 intro_01 不同组",
              group_key(work / "seg_001.ts") != group_key(work / "intro_01.ts"))

        print("\n=== 3. 目录扫描：识别序列 ===")
        groups = find_ts_sequences(MEDIA)
        found = {k: len(v) for k, v in groups.items()}
        check("识别出 seg_ 序列", any("seg" in k for k in found), str(found))
        check("识别出 loose_ 序列", any("loose" in k for k in found), str(found))
        check("识别出 intro_ 序列", any("intro" in k for k in found), str(found))
        check("各组分片数正确",
              found.get(group_key(MEDIA / "seg_1.ts")) == 13,
              str(found))

        # 顺序检查
        for name, files in groups.items():
            if "seg" not in name:
                continue
            order = [f.name for f in files]
            expect = [f"seg_{i}.ts" for i in range(1, 14)]
            check("seg 序列顺序正确（1,2,...,13）", order == expect,
                  str(order[:5]))

        print("\n=== 4. 合并单个序列 ===")
        seq = groups[group_key(MEDIA / "seg_1.ts")]
        out = work / "merged.mp4"
        r = merge_ts_files(seq, out)
        check("合并成功", r.ok, r.error)
        check("用 ffmpeg 转封装", r.method == "ffmpeg", r.method)
        check("13 个分片全进去", r.count == 13, str(r.count))
        if r.ok:
            info = probe(out)
            check("ffprobe 能读（说明文件合法）", bool(info), str(info))
            check("包含视频流",
                  any("codec_type=video" in s for s in info.get("streams", [])))
            check("包含音频流",
                  any("codec_type=audio" in s for s in info.get("streams", [])))
            dur = info.get("duration", 0)
            # 源视频 10 秒，允许一点误差
            check("时长接近 10 秒（证明顺序没错）", 9.0 < dur < 11.5, f"{dur}s")

        print("\n=== 5. 对照实验：按错误顺序合并会怎样 ===")
        wrong = sorted(seq)  # 字符串序
        out_bad = work / "wrong.mp4"
        r_bad = merge_ts_files(wrong, out_bad)
        if r_bad.ok and shutil.which("ffprobe"):
            good_dur = probe(out).get("duration", 0)
            bad_dur = probe(out_bad).get("duration", 0)
            check("乱序产物与正序产物不同（说明排序有意义）",
                  abs(good_dur - bad_dur) > 0.01 or out.read_bytes() != out_bad.read_bytes(),
                  f"正序 {good_dur}s vs 乱序 {bad_dur}s")

        print("\n=== 6. 整目录合并 ===")
        dest = work / "batch"
        results = merge_directory(MEDIA, dest, keep_parts=True)
        ok_results = [r for r in results if r.ok]
        check("每个未加密序列都出了产物", len(ok_results) >= 3, str(len(results)))
        for r in results:
            # enc 是加密分片，失败才是预期行为；其余必须成功
            expect_ok = r.name != "enc"
            check(f"  {r.name}: {r.count} 片 -> "
                  f"{r.method if r.ok else '拒绝(加密)'}",
                  r.ok == expect_ok, r.error)
        check("默认保留原分片", (MEDIA / "seg_1.ts").exists())

        print("\n=== 6b. 加密分片必须报错，不能产出坏文件 ===")
        # enc_*.ts 是 AES-128 加密的 HLS 分片，没有密钥解不了。
        # 关键：不能默默合并出一个"看起来成功、实际是垃圾"的文件
        enc_files = sorted(MEDIA.glob("enc_*.ts"))
        check("测试素材里确实有加密分片", len(enc_files) >= 3, str(len(enc_files)))
        if enc_files:
            r_enc = merge_ts_files(enc_files, work / "enc_merged.mp4")
            check("加密序列被拒绝合并", not r_enc.ok, r_enc.error)
            check("报错信息点明了密钥来源",
                  "密钥" in r_enc.error and "m3u8" in r_enc.error,
                  r_enc.error[:80])
            check("没有产出文件",
                  not (work / "enc_merged.mp4").exists())
        plain = sorted(MEDIA.glob("seg_*.ts"))
        check("未加密分片不被误判",
              all(looks_like_plain_ts(p) for p in plain[:5]))
        check("加密分片确实被识别出来",
              any(not looks_like_plain_ts(p) for p in enc_files))

        print("\n=== 7. 合并后删除原分片 ===")
        scratch = work / "scratch"
        scratch.mkdir()
        for i in range(1, 4):
            shutil.copy(MEDIA / f"seg_{i}.ts", scratch / f"s_{i}.ts")
        rs = merge_directory(scratch, scratch, keep_parts=False)
        check("合并成功", rs and rs[0].ok, rs[0].error if rs else "无结果")
        check("原分片已删除",
              not (scratch / "s_1.ts").exists(),
              str([p.name for p in scratch.iterdir()]))

        print("\n=== 8. 单个 ts（不是序列）转封装 ===")
        solo = work / "solo"
        solo.mkdir()
        shutil.copy(MEDIA / "seg_1.ts", solo / "only.ts")
        rs = merge_directory(solo, solo)
        check("单个文件也能转成 mp4",
              rs and rs[0].ok and rs[0].method == "ffmpeg-remux",
              str([(r.method, r.error) for r in rs]))
        check("count 记为 1", rs and rs[0].count == 1)

        print("\n=== 9. 没有 ffmpeg 时降级为裸拼接 ===")
        out2 = work / "noffmpeg.ts"
        r2 = merge_ts_files(seq, out2, use_ffmpeg=False)
        check("降级成功", r2.ok, r2.error)
        check("方式为 concat", r2.method == "concat", r2.method)
        if r2.ok and shutil.which("ffprobe"):
            info2 = probe(out2)
            check("裸拼接产物仍可播", bool(info2), str(info2))

    finally:
        shutil.rmtree(work, ignore_errors=True)

    print(f"\n结果：{passed} 通过，{failed} 失败\n")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())

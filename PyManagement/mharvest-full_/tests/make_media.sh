#!/usr/bin/env bash
# 生成测试站需要的媒体素材（图片由 tests/build.py 生成，这里只管音视频）。
#
# 依赖 ffmpeg。生成后启动服务即可测试：
#   python tests/build.py && cd tests && python -m http.server 8877
set -euo pipefail

cd "$(dirname "$0")/media"

echo "==> 生成带声音的测试视频"
ffmpeg -y -loglevel error -f lavfi -i testsrc=duration=10:size=1280x720:rate=25 \
  -f lavfi -i sine=frequency=440:duration=10 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest clip.mp4

echo "==> 生成测试音频"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=660:duration=6" \
  -c:a libmp3lame sound.mp3 || \
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=660:duration=6" sound.m4a

echo "==> 生成 AES-128 加密的 HLS"
# 注意：keyinfo 第二行的密钥文件必须事先存在，ffmpeg 是读取而不是创建它
head -c 16 /dev/urandom > enc.key
# 第一行写进 m3u8 的 URI 用相对路径，这样测试站换任何端口都能取到密钥。
# 若写成 http://127.0.0.1:8877/... 这种绝对地址，换个端口密钥就拉不到了。
printf 'enc.key\nenc.key\n' > keyinfo.txt
# -g/-keyint_min 强制关键帧间隔，否则 10 秒视频只切出 1 个分片，测不到并发下载
ffmpeg -y -loglevel error -i clip.mp4 \
  -c:v libx264 -g 25 -keyint_min 25 -sc_threshold 0 \
  -c:a aac -b:v 800k -hls_time 2 -hls_list_size 0 \
  -hls_key_info_file keyinfo.txt \
  -hls_segment_filename "enc_%03d.ts" enc.m3u8

echo "==> 生成多码率 master HLS（360p + 720p）"
ffmpeg -y -loglevel error -i clip.mp4 \
  -filter_complex "[0:v]split=2[v1][v2];[v1]scale=w=640:h=360[v1o];[v2]scale=w=1280:h=720[v2o]" \
  -map "[v1o]" -map 0:a -c:v:0 libx264 -g 25 -keyint_min 25 -sc_threshold 0 -b:v:0 700k -c:a:0 aac \
  -map "[v2o]" -map 0:a -c:v:1 libx264 -g 25 -keyint_min 25 -sc_threshold 0 -b:v:1 1800k -c:a:1 aac \
  -f hls -var_stream_map "v:0,a:0 v:1,a:1" -master_pl_name master.m3u8 \
  -hls_time 2 -hls_list_size 0 -hls_segment_filename "v%v/seg_%03d.ts" v%v/index.m3u8

echo "==> 完成"
ls -1 enc_*.ts | wc -l | xargs echo "加密流分片数："
ls -1 v1/seg_*.ts | wc -l | xargs echo "720p 分片数："
grep STREAM master.m3u8

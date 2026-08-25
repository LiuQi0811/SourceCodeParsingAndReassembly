(function () {
    console.log("recorder.js Start (no-UI, postMessage controlled)");
    if (window.__catCatchRecorder) return;
    window.__catCatchRecorder = true;

    var SOURCE = 'catCatchRecorder';
    var recorder = null;
    var currentStream = null;
    var option = { mimeType: 'video/webm;codecs=vp9,opus' };
    var videoList = []; // [{ element, src, index }]
    var autoSave1Timer = null;
    var config = {
        videoIndex: 0,
        mimeType: option.mimeType,
        videoBits: 5000000,
        audioBits: 128000,
        frameRate: 0,
        ffmpeg: false,
        autoSave1: false
    };

    function post(action, payload) {
        window.postMessage(Object.assign({ action: action, source: SOURCE }, payload || {}), '*');
    }

    // 处理 sandbox iframe —— 让 captureStream 能拿到 iframe 内的媒体元素
    function setupIframeProcessing() {
        var processIframe = function (iframe) {
            if (iframe && iframe.hasAttribute && iframe.hasAttribute('sandbox')) {
                var clonedIframe = iframe.cloneNode(true);
                clonedIframe.removeAttribute('sandbox');
                if (iframe.parentNode) {
                    iframe.parentNode.replaceChild(clonedIframe, iframe);
                }
            }
        };
        var observe = function () {
            document.querySelectorAll('iframe').forEach(processIframe);
            var observer = new MutationObserver(function (mutationsList) {
                for (var i = 0; i < mutationsList.length; i++) {
                    var mutation = mutationsList[i];
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(function (node) {
                            if (node.nodeName === 'IFRAME') {
                                processIframe(node);
                            } else if (node.querySelectorAll) {
                                node.querySelectorAll('iframe').forEach(processIframe);
                            }
                        });
                    }
                }
            });
            observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', observe);
        } else {
            observe();
        }
    }
    setupIframeProcessing();

    // 判断是否是真实的媒体元素,过滤掉一些没有实际内容的占位元素
    function isRealMediaElement(media) {
        return (media.src || media.currentSrc) ||
            media.currentTime > 0 ||
            media.readyState >= 2 ||
            (media.videoWidth > 0 || media.videoHeight > 0) ||
            media.networkState !== 3;
    }

    // 获取兼容的 captureStream 方法
    var isMozCaptureStream = false;
    function getCaptureStreamMethod(element) {
        if (element.captureStream) {
            return element.captureStream.bind(element);
        }
        if (element.mozCaptureStream) {
            isMozCaptureStream = true;
            return element.mozCaptureStream.bind(element);
        }
        if (element.webkitCaptureStream) {
            return element.webkitCaptureStream.bind(element);
        }
        return null;
    }

    // #region 视频编码探测
    function setMimeType() {
        function getSupportedMimeTypes(media, types, codecs) {
            var supported = [];
            types.forEach(function (type) {
                var mimeType = media + '/' + type;
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    supported.push(mimeType);
                }
                codecs.forEach(function (codec) {
                    var variation = mimeType + ';codecs=' + codec;
                    if (MediaRecorder.isTypeSupported(variation)) {
                        supported.push(variation);
                    }
                });
            });
            return supported;
        }
        var videoTypes = ['webm', 'ogg', 'mp4', 'x-matroska'];
        var codecs = ['should-not-be-supported', 'vp9', 'vp8', 'avc1', 'av1', 'h265', 'h.265', 'h264', 'h.264', 'opus', 'pcm', 'aac', 'mpeg', 'mp4a'];
        var supportedVideos = getSupportedMimeTypes('video', videoTypes, codecs);
        if (supportedVideos.length) {
            option.mimeType = supportedVideos[0];
        }
    }
    setMimeType();
    // #endregion 视频编码探测

    // #region 获取视频列表
    function getVideo() {
        videoList = [];
        document.querySelectorAll('video, audio').forEach(function (video, index) {
            if (isRealMediaElement(video)) {
                var rawSrc = video.currentSrc || video.src || '';
                var fileName = rawSrc.split(/[?#]/)[0].split('/').pop();
                var src = fileName || ('video' + (index + 1));
                videoList.push({ element: video, src: src, index: videoList.length });
            }
        });
        post('catCatchRecorder.videoList', {
            list: videoList.map(function (v) { return { src: v.src, index: v.index }; })
        });
    }
    // #endregion 获取视频列表

    // #region 1 小时保存一次
    function startAutoSave1() {
        clearInterval(autoSave1Timer);
        autoSave1Timer = setInterval(function () {
            if (recorder && recorder.state === 'recording') {
                try {
                    // stop 触发 ondataavailable → 推送 complete;start 复用同一 stream 继续录制
                    recorder.stop();
                    recorder.start();
                } catch (e) { /* ignore */ }
            }
        }, 3600000);
    }
    // #endregion 1 小时保存一次

    // #region 录制控制
    function startRecording(cfg) {
        if (recorder) {
            post('catCatchRecorder.error', { message: 'already recording' });
            return;
        }
        // 应用配置(来自浮层)
        config.videoIndex = typeof cfg.videoIndex === 'number' ? cfg.videoIndex : 0;
        config.mimeType = cfg.mimeType || option.mimeType;
        config.videoBits = +cfg.videoBits || 5000000;
        config.audioBits = +cfg.audioBits || 128000;
        config.frameRate = +cfg.frameRate || 0;
        config.ffmpeg = !!cfg.ffmpeg;
        config.autoSave1 = !!cfg.autoSave1;

        if (!MediaRecorder.isTypeSupported(config.mimeType)) {
            post('catCatchRecorder.error', { message: 'format not supported' });
            return;
        }

        // 清理上一次遗留的 stream(若有)
        if (currentStream) {
            currentStream.getTracks().forEach(function (t) { t.stop(); });
            currentStream = null;
        }

        var item = null;
        for (var i = 0; i < videoList.length; i++) {
            if (videoList[i].index === config.videoIndex) { item = videoList[i]; break; }
        }
        if (!item || !item.element) {
            post('catCatchRecorder.error', { message: 'video not found' });
            return;
        }
        var element = item.element;

        var stream = null;
        try {
            var captureStream = getCaptureStreamMethod(element);
            if (!captureStream) {
                throw new Error('captureStream not supported');
            }
            stream = config.frameRate ? captureStream(config.frameRate) : captureStream();
            // Firefox 的 captureStream 录制时没有声音,这里使用 Web Audio API 绕过
            if (isMozCaptureStream) {
                var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                var source = audioCtx.createMediaStreamSource(stream);
                source.connect(audioCtx.destination);
            }
        } catch (e) {
            console.log(e);
            post('catCatchRecorder.error', { message: 'recording not supported' });
            return;
        }
        currentStream = stream;

        option.mimeType = config.mimeType;
        option.audioBitsPerSecond = config.audioBits;
        option.videoBitsPerSecond = config.videoBits;

        try {
            recorder = new MediaRecorder(stream, option);
        } catch (e) {
            console.log(e);
            post('catCatchRecorder.error', { message: 'MediaRecorder init failed' });
            stream.getTracks().forEach(function (t) { t.stop(); });
            currentStream = null;
            return;
        }

        recorder.ondataavailable = function (event) {
            if (!event.data || event.data.size === 0) return;
            if (config.ffmpeg) {
                // 交给 background 的 ffmpeg 转码流程
                window.postMessage({
                    action: 'catCatchFFmpeg',
                    use: 'transcode',
                    files: [{ data: URL.createObjectURL(event.data), type: option.mimeType }],
                    title: (document.title || '').trim()
                }, '*');
                return;
            }
            var blob = new Blob([event.data], { type: option.mimeType });
            var url = URL.createObjectURL(blob);
            var filename = ((document.title || 'recording').trim() || 'recording') + '.webm';
            post('catCatchRecorder.complete', { url: url, filename: filename, size: blob.size });
        };
        recorder.onstart = function () {
            post('catCatchRecorder.state', { recording: true });
            if (config.autoSave1) {
                startAutoSave1();
            }
        };
        recorder.onstop = function () {
            // 不在此处停止 stream:autoSave1 stop+start 需要复用同一 stream
            // 真正的清理在 cleanup / close 时执行
            post('catCatchRecorder.state', { recording: false });
        };
        recorder.onerror = function (event) {
            console.log(event);
            post('catCatchRecorder.error', { message: 'recorder error' });
        };
        try {
            recorder.start();
        } catch (e) {
            console.log(e);
            post('catCatchRecorder.error', { message: 'recorder start failed' });
            stream.getTracks().forEach(function (t) { t.stop(); });
            currentStream = null;
            recorder = null;
            return;
        }
        // 让视频开始播放(部分页面需要主动 play 才有数据)
        try { element.play(); } catch (e) { /* ignore */ }
    }

    function stopRecording() {
        if (recorder) {
            try { recorder.stop(); } catch (e) { /* ignore */ }
        }
    }

    function cleanup() {
        if (recorder) {
            try { recorder.stop(); } catch (e) { /* ignore */ }
            recorder = null;
        }
        clearInterval(autoSave1Timer);
        autoSave1Timer = null;
        if (currentStream) {
            currentStream.getTracks().forEach(function (t) { t.stop(); });
            currentStream = null;
        }
        window.__catCatchRecorder = false;
    }
    // #endregion 录制控制

    // #region 浮层消息通信
    window.addEventListener('message', function (e) {
        if (e.source !== window) return;
        var data = e.data;
        if (!data || !data.action) return;
        switch (data.action) {
            case 'catCatchRecorder.start':
                startRecording(data);
                break;
            case 'catCatchRecorder.stop':
                stopRecording();
                break;
            case 'catCatchRecorder.getState':
                post('catCatchRecorder.state', { recording: !!recorder });
                break;
            case 'catCatchRecorder.getVideo':
                getVideo();
                break;
            case 'catCatchRecorder.close':
                cleanup();
                window.postMessage({ action: 'catCatchCloseScript', script: 'recorder.js' }, '*');
                break;
        }
    });
    // #endregion 浮层消息通信

    // 启动后自动查询一次视频列表
    setTimeout(getVideo, 500);
    // 通知浮层已就绪
    post('catCatchRecorder.ready');
})();

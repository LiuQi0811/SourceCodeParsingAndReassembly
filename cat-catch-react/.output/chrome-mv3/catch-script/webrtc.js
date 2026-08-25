(function () {
    console.log("webrtc.js Start (no-UI, postMessage controlled)");
    if (window.__catCatchWebRTC) return;
    window.__catCatchWebRTC = true;

    var SOURCE = 'catCatchWebRTC';
    var recorder = null;
    var chunks = [];
    var recorderTimer = null;
    var recorderTime = 0;
    var autoSave1Timer = null;
    var option = { mimeType: 'video/webm;codecs=vp9,opus' };
    var tracks = { video: [], audio: [] };
    var config = {
        videoTrack: -1,
        audioTrack: -1,
        mimeType: option.mimeType,
        videoBits: 5000000,
        audioBits: 128000,
        autoSave1: false
    };
    // saveRequested:requestData 异步触发 ondataavailable 时,标记此次为"保存"流程
    var saveRequested = false;

    function post(action, payload) {
        window.postMessage(Object.assign({ action: action, source: SOURCE }, payload || {}), '*');
    }

    function secToTime(sec) {
        var hour = (sec / 3600) | 0;
        var min = ((sec % 3600) / 60) | 0;
        sec = (sec % 60) | 0;
        var time = hour > 0 ? hour + ':' : '';
        time += min.toString().padStart(2, '0') + ':';
        time += sec.toString().padStart(2, '0');
        return time;
    }

    function postTracks() {
        post('catCatchWebRTC.tracks', {
            video: tracks.video.map(function (t, i) {
                return { label: t.label || ('video' + (i + 1)), index: i };
            }),
            audio: tracks.audio.map(function (t, i) {
                return { label: t.label || ('audio' + (i + 1)), index: i };
            })
        });
    }

    // #region 编码探测
    function getSupportedMimeTypes(media, types, codecs) {
        var supported = [];
        types.forEach(function (type) {
            var mimeType = media + '/' + type;
            codecs.forEach(function (codec) {
                var variation = mimeType + ';codecs=' + codec;
                if (MediaRecorder.isTypeSupported(variation)) {
                    supported.push(variation);
                }
            });
            if (MediaRecorder.isTypeSupported(mimeType)) {
                supported.push(mimeType);
            }
        });
        return supported;
    }
    var videoTypes = ['webm', 'ogg', 'mp4', 'x-matroska'];
    var codecs = ['should-not-be-supported', 'vp9', 'vp8', 'avc1', 'av1', 'h265', 'h.265', 'h264', 'h.264', 'opus', 'pcm', 'aac', 'mpeg', 'mp4a'];
    var supportedVideos = getSupportedMimeTypes('video', videoTypes, codecs);
    if (supportedVideos.length) {
        option.mimeType = supportedVideos[0];
    }
    // #endregion 编码探测

    // #region 下载工具
    function downloadChunks() {
        if (chunks.length === 0) return;
        var blob = new Blob(chunks, { type: option.mimeType });
        var url = URL.createObjectURL(blob);
        var filename = ((document.title || 'recording').trim() || 'recording') + '.webm';
        // 触发文件下载(匹配原 webrtc.js download() 行为)
        var a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            window.URL.revokeObjectURL(url);
            if (a.parentNode) a.parentNode.removeChild(a);
        }, 1000);
        // 同时通知浮层,以便预览/重新下载
        post('catCatchWebRTC.complete', { url: url, filename: filename, size: blob.size });
        chunks = [];
    }
    // #endregion 下载工具

    // #region 录制控制
    function startRecording(cfg) {
        if (recorder) {
            post('catCatchWebRTC.error', { message: 'already recording' });
            return;
        }
        if (!tracks.video.length && !tracks.audio.length) {
            post('catCatchWebRTC.error', { message: 'stream empty' });
            return;
        }
        config.videoTrack = +cfg.videoTrack;
        if (isNaN(config.videoTrack)) config.videoTrack = -1;
        config.audioTrack = +cfg.audioTrack;
        if (isNaN(config.audioTrack)) config.audioTrack = -1;
        config.mimeType = cfg.mimeType || option.mimeType;
        config.videoBits = +cfg.videoBits || 5000000;
        config.audioBits = +cfg.audioBits || 128000;
        config.autoSave1 = !!cfg.autoSave1;

        if (!MediaRecorder.isTypeSupported(config.mimeType)) {
            post('catCatchWebRTC.error', { message: 'format not supported' });
            return;
        }

        var streamTracks = [];
        if (config.videoTrack !== -1 && tracks.video[config.videoTrack]) {
            streamTracks.push(tracks.video[config.videoTrack]);
        }
        if (config.audioTrack !== -1 && tracks.audio[config.audioTrack]) {
            streamTracks.push(tracks.audio[config.audioTrack]);
        }
        if (!streamTracks.length) {
            post('catCatchWebRTC.error', { message: 'no track selected' });
            return;
        }

        var mediaStream = new MediaStream(streamTracks);

        option.mimeType = config.mimeType;
        option.audioBitsPerSecond = config.audioBits;
        option.videoBitsPerSecond = config.videoBits;
        chunks = [];
        recorderTime = 0;
        saveRequested = false;

        try {
            recorder = new MediaRecorder(mediaStream, option);
        } catch (e) {
            console.log(e);
            post('catCatchWebRTC.error', { message: 'MediaRecorder init failed' });
            return;
        }
        recorder.ondataavailable = function (event) {
            if (event.data && event.data.size > 0) {
                chunks.push(event.data);
            }
            // save 流程:flush 完成后立即触发下载,不停录制
            if (saveRequested) {
                saveRequested = false;
                downloadChunks();
            }
        };
        recorder.onstart = function () {
            chunks = [];
            post('catCatchWebRTC.state', { recording: true });
            post('catCatchWebRTC.time', { time: '00:00' });
            recorderTimer = setInterval(function () {
                recorderTime++;
                post('catCatchWebRTC.time', { time: secToTime(recorderTime) });
            }, 1000);
            if (config.autoSave1) {
                startAutoSave1();
            }
        };
        recorder.onstop = function () {
            clearInterval(recorderTimer);
            recorderTimer = null;
            clearInterval(autoSave1Timer);
            autoSave1Timer = null;
            recorderTime = 0;
            // 把最终累积的 chunks 推送为 complete
            if (chunks.length > 0) {
                var blob = new Blob(chunks, { type: option.mimeType });
                var url = URL.createObjectURL(blob);
                var filename = ((document.title || 'recording').trim() || 'recording') + '.webm';
                post('catCatchWebRTC.complete', { url: url, filename: filename, size: blob.size });
                chunks = [];
            }
            post('catCatchWebRTC.state', { recording: false });
            post('catCatchWebRTC.time', { time: '' });
            recorder = null;
        };
        recorder.onerror = function (event) {
            console.error(event);
            post('catCatchWebRTC.error', { message: 'recorder error' });
        };
        try {
            // 每 60s 触发一次 ondataavailable(分片)
            recorder.start(60000);
        } catch (e) {
            console.log(e);
            post('catCatchWebRTC.error', { message: 'recorder start failed' });
            recorder = null;
        }
    }

    function stopRecording() {
        if (recorder) {
            try { recorder.stop(); } catch (e) { /* ignore */ }
        }
    }

    // 保存当前片段:不停录制,通过 requestData 触发 flush,然后下载
    function saveChunk() {
        if (recorder && recorder.state === 'recording') {
            saveRequested = true;
            try {
                recorder.requestData();
            } catch (e) {
                saveRequested = false;
            }
        }
    }

    function startAutoSave1() {
        clearInterval(autoSave1Timer);
        autoSave1Timer = setInterval(function () {
            saveChunk();
        }, 3600000);
    }

    function cleanup() {
        if (recorder) {
            try { recorder.stop(); } catch (e) { /* ignore */ }
            recorder = null;
        }
        clearInterval(recorderTimer);
        recorderTimer = null;
        clearInterval(autoSave1Timer);
        autoSave1Timer = null;
        chunks = [];
        recorderTime = 0;
        window.__catCatchWebRTC = false;
    }
    // #endregion 录制控制

    // #region Proxy RTCPeerConnection 捕获 track(每个页面只安装一次)
    if (!window.__catCatchWebRTCProxyInstalled) {
        window.__catCatchWebRTCProxyInstalled = true;
        var OriginalRTCPeerConnection = window.RTCPeerConnection;
        window.RTCPeerConnection = new Proxy(OriginalRTCPeerConnection, {
            construct: function (target, args) {
                var pc = new (Function.prototype.bind.apply(target, [null].concat(args)))();
                pc.addEventListener('track', function (event) {
                    var track = event.track;
                    if (track.kind === 'video' || track.kind === 'audio') {
                        tracks[track.kind].push(track);
                        postTracks();
                    }
                });
                pc.addEventListener('iceconnectionstatechange', function () {
                    if (pc.iceConnectionState === 'disconnected' && recorder && recorder.state === 'recording') {
                        stopRecording();
                    }
                });
                return pc;
            }
        });
    }
    // #endregion Proxy RTCPeerConnection 捕获 track

    // #region 浮层消息通信
    window.addEventListener('message', function (e) {
        if (e.source !== window) return;
        var data = e.data;
        if (!data || !data.action) return;
        switch (data.action) {
            case 'catCatchWebRTC.start':
                startRecording(data);
                break;
            case 'catCatchWebRTC.stop':
                stopRecording();
                break;
            case 'catCatchWebRTC.save':
                saveChunk();
                break;
            case 'catCatchWebRTC.getState':
                post('catCatchWebRTC.state', { recording: !!recorder });
                break;
            case 'catCatchWebRTC.close':
                cleanup();
                window.postMessage({ action: 'catCatchCloseScript', script: 'webrtc.js' }, '*');
                break;
        }
    });
    // #endregion 浮层消息通信

    // 防止网页意外关闭跳转
    window.addEventListener('beforeunload', function () {
        if (recorder) {
            try { recorder.stop(); } catch (e) { /* ignore */ }
        }
    });

    // 通知浮层已就绪
    post('catCatchWebRTC.ready');
    // 启动时推送一次当前 tracks(若有)
    postTracks();
})();

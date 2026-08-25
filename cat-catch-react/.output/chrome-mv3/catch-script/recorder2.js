(function () {
    console.log("recorder2.js Start (no-UI, postMessage controlled)");
    if (window.__catCatchRecorder2) return;
    window.__catCatchRecorder2 = true;

    var recorder;
    var buffer = [];
    var option = {
        mimeType: 'video/webm;codecs=vp8,opus',
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 128000
    };

    function post(action, payload) {
        window.postMessage(Object.assign({ action: action, source: 'catCatchRecorder2' }, payload || {}), '*');
    }

    async function startRecording(config) {
        if (recorder) { post('catCatchRecorder2.error', { message: 'already recording' }); return; }
        buffer = [];
        option.videoBitsPerSecond = (config && config.videoBits) || 5000000;
        option.audioBitsPerSecond = (config && config.audioBits) || 128000;
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
            option.mimeType = 'video/webm;codecs=vp9,opus';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            option.mimeType = 'video/webm;codecs=h264';
        }
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                preferCurrentTab: true,
                video: { cursor: "never" },
                audio: { sampleRate: 48000, sampleSize: 16, channelCount: 2 }
            });
            recorder = new MediaRecorder(stream, option);
            recorder.start();
            recorder.onstart = function () {
                post('catCatchRecorder2.state', { recording: true });
            };
            recorder.ondataavailable = function (e) {
                if (e.data && e.data.size > 0) buffer.push(e.data);
            };
            recorder.onstop = function () {
                var fileBlob = new Blob(buffer, { type: option.mimeType });
                var url = URL.createObjectURL(fileBlob);
                post('catCatchRecorder2.complete', { url: url, filename: (document.title || 'recording') + '.webm', size: fileBlob.size });
                buffer = [];
                stream.getTracks().forEach(function (track) { track.stop(); });
                recorder = undefined;
                post('catCatchRecorder2.state', { recording: false });
            };
            // 用户在浏览器原生 UI 取消分享
            stream.getVideoTracks()[0].addEventListener('ended', function () {
                if (recorder) recorder.stop();
            });
        } catch (e) {
            console.log(e);
            post('catCatchRecorder2.error', { message: String(e) });
            post('catCatchRecorder2.state', { recording: false });
        }
    }

    function stopRecording() {
        if (recorder) recorder.stop();
    }

    window.addEventListener("message", function (e) {
        if (e.source !== window) return;
        var data = e.data;
        if (!data || !data.action) return;
        switch (data.action) {
            case 'catCatchRecorder2.start':
                startRecording(data);
                break;
            case 'catCatchRecorder2.stop':
                stopRecording();
                break;
            case 'catCatchRecorder2.getState':
                post('catCatchRecorder2.state', { recording: !!recorder });
                break;
            case 'catCatchRecorder2.close':
                stopRecording();
                window.__catCatchRecorder2 = false;
                post('catCatchRecorder2.closed');
                break;
        }
    });

    // 通知浮层已就绪
    post('catCatchRecorder2.ready');
})();

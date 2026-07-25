// TextMediaPage.js —— 文本与多媒体 API 实验室
// 演示 MDN：Selection/Range、contenteditable、SpeechSynthesis、
//           MediaDevices/MediaRecorder、Web Animations、FormData/Blob/URL.createObjectURL
import { Page } from '../../core/Component.js';
import { h, formatTime } from '../../core/utils.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Alert } from '../../components/ui/Alert.js';
import { Tag } from '../../components/ui/Tag.js';

export class TextMediaPage extends Page {
  initialState() {
    return {
      logs: [],
      selectionText: '',
      selectionInfo: '尚未选中文字',
      editableHtml: '<p>尝试选中这段文字，或用工具栏<b>加粗</b>、<i>斜体</i>。</p>',
      voices: [],
      selectedVoiceURI: '',
      ttsText: '你好，这是浏览器原生的语音合成功能。',
      ttsState: { speaking: false, paused: false, pending: false },
      mediaState: 'inactive',
      mediaError: '',
      recordingUrl: '',
      recordingDuration: 0,
      animState: 'idle',
      animRate: 1,
      fileInfo: null,
      filePreviewUrl: '',
      fileTextContent: '',
    };
  }

  componentDidMount() {
    // —— Selection 监听 ——
    this._onSelectionChange = () => {
      const sel = document.getSelection();
      if (!sel || sel.rangeCount === 0) {
        this.setState({ selectionText: '', selectionInfo: '无选区' });
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      this.setState({
        selectionText: sel.toString(),
        selectionInfo: [
          `rangeCount: ${sel.rangeCount}`,
          `startOffset: ${range.startOffset}`,
          `endOffset: ${range.endOffset}`,
          `startContainer: ${range.startContainer.nodeName}(${String(range.startContainer.nodeValue || range.startContainer.textContent || '').slice(0, 16)})`,
          `rect: ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}×${Math.round(rect.height)}`,
        ].join('\n'),
      });
    };
    document.addEventListener('selectionchange', this._onSelectionChange);

    // —— contenteditable 输入监听 ——
    const editable = this.$('.editable-area');
    if (editable) {
      this._onEditableInput = () => this.setState({ editableHtml: editable.innerHTML });
      editable.addEventListener('input', this._onEditableInput);
    }

    // —— SpeechSynthesis voices 加载 ——
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length) {
          // 中文优先排序
          const sorted = [...voices].sort((a, b) => {
            const aZh = a.lang.startsWith('zh');
            const bZh = b.lang.startsWith('zh');
            if (aZh && !bZh) return -1;
            if (!aZh && bZh) return 1;
            return 0;
          });
          this.setState({ voices: sorted, selectedVoiceURI: sorted[0]?.voiceURI || '' });
        }
      };
      loadVoices();
      this._onVoicesChanged = loadVoices;
      window.speechSynthesis.addEventListener('voiceschanged', this._onVoicesChanged);
    }

    // —— MediaRecorder 录制时长计时器引用 ——
    this._mediaStream = null;
    this._mediaRecorder = null;
    this._recordChunks = [];
    this._recordTimer = null;
    this._recordStart = 0;

    // —— Web Animations 引用 ——
    this._animation = null;
  }

  componentWillUnmount() {
    document.removeEventListener('selectionchange', this._onSelectionChange);
    if (this.$('.editable-area')) {
      this.$('.editable-area').removeEventListener('input', this._onEditableInput);
    }
    if (this._onVoicesChanged && 'speechSynthesis' in window) {
      window.speechSynthesis.removeEventListener('voiceschanged', this._onVoicesChanged);
      window.speechSynthesis.cancel();
    }
    this._stopMedia();
    this._animation?.cancel();
    if (this.state.filePreviewUrl) URL.revokeObjectURL(this.state.filePreviewUrl);
  }

  _addLog(type, content) {
    this.setState({ logs: [...this.state.logs, { type, content, time: formatTime() }].slice(-40) });
  }

  _btn(label, opts) {
    const btn = new Button({ ...opts, children: label, onClick: opts.onClick });
    this.registerChild(btn);
    return btn.render();
  }

  // ============ 1. Selection / Range ============
  _selectByCode() {
    const demo = this.$('.selection-demo');
    if (!demo) return;
    const range = document.createRange();
    range.selectNodeContents(demo);
    const sel = document.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    this._addLog('info', '已通过代码选中全部文本');
  }

  _clearSelection() {
    document.getSelection()?.removeAllRanges();
    this._addLog('info', '已清除选区');
    this.setState({ selectionText: '', selectionInfo: '已清除' });
  }

  // ============ 2. contenteditable 富文本 ============
  _exec(cmd, value = null) {
    document.execCommand(cmd, false, value);
    const editable = this.$('.editable-area');
    if (editable) this.setState({ editableHtml: editable.innerHTML });
    this._addLog('info', `execCommand(${cmd}${value ? ', ' + value : ''})`);
  }

  // ============ 3. SpeechSynthesis ============
  _speak() {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(this.state.ttsText);
    const voice = this.state.voices.find((v) => v.voiceURI === this.state.selectedVoiceURI);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'zh-CN';
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => { this.setState({ ttsState: { speaking: true, paused: false, pending: false } }); this._addLog('info', '开始朗读'); };
    u.onend = () => { this.setState({ ttsState: { speaking: false, paused: false, pending: false } }); this._addLog('info', '朗读结束'); };
    u.onerror = (e) => { this._addLog('error', '朗读错误: ' + e.error); };
    u.onboundary = (e) => { this._addLog('info', `边界: charIndex=${e.charIndex}`); };
    window.speechSynthesis.speak(u);
    this.setState({ ttsState: { speaking: false, paused: false, pending: true } });
  }

  _pauseTts() { window.speechSynthesis?.pause(); this.setState({ ttsState: { speaking: true, paused: true, pending: false } }); }
  _resumeTts() { window.speechSynthesis?.resume(); this.setState({ ttsState: { speaking: true, paused: false, pending: false } }); }
  _cancelTts() { window.speechSynthesis?.cancel(); this.setState({ ttsState: { speaking: false, paused: false, pending: false } }); }

  // ============ 4. MediaDevices + MediaRecorder ============
  async _startCamera() {
    try {
      this._mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const video = this.$('.media-video');
      if (video) video.srcObject = this._mediaStream;
      this.setState({ mediaError: '' });
      this._addLog('info', '摄像头已启动');
    } catch (err) {
      this.setState({ mediaError: err.message });
      this._addLog('error', 'getUserMedia 失败: ' + err.message);
    }
  }

  _stopMedia() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      try { this._mediaRecorder.stop(); } catch {}
    }
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach((t) => t.stop());
      this._mediaStream = null;
    }
    if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null; }
    const video = this.$('.media-video');
    if (video) video.srcObject = null;
    this.setState({ mediaState: 'inactive' });
  }

  _startRecording() {
    if (!this._mediaStream) {
      this._addLog('error', '请先启动摄像头');
      return;
    }
    this._recordChunks = [];
    try {
      this._mediaRecorder = new MediaRecorder(this._mediaStream);
    } catch (err) {
      this._addLog('error', 'MediaRecorder 不支持: ' + err.message);
      return;
    }
    this._mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this._recordChunks.push(e.data); };
    this._mediaRecorder.onstop = () => {
      const blob = new Blob(this._recordChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      if (this.state.recordingUrl) URL.revokeObjectURL(this.state.recordingUrl);
      const playback = this.$('.media-playback');
      if (playback) playback.src = url;
      this.setState({ recordingUrl: url });
      this._addLog('info', `录制完成，大小 ${(blob.size / 1024).toFixed(1)} KB`);
    };
    this._mediaRecorder.start();
    this._recordStart = Date.now();
    this._recordTimer = setInterval(() => {
      this.setState({ recordingDuration: Math.floor((Date.now() - this._recordStart) / 1000) });
    }, 1000);
    this.setState({ mediaState: 'recording' });
    this._addLog('info', '开始录制');
  }

  _stopRecording() {
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    }
    if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null; }
    this.setState({ mediaState: 'inactive' });
  }

  // ============ 5. Web Animations API ============
  _playAnim(keyframes, label) {
    const box = this.$('.waa-demo-box');
    if (!box) return;
    this._animation?.cancel();
    this._animation = box.animate(keyframes, {
      duration: 2000,
      iterations: 1,
      fill: 'forwards',
      easing: 'ease-in-out',
    });
    this._animation.playbackRate = this.state.animRate;
    this._animation.onfinish = () => {
      this.setState({ animState: 'finished' });
      this._addLog('info', `${label} 动画结束`);
    };
    this.setState({ animState: 'playing' });
    this._addLog('info', `播放动画: ${label}`);
  }

  _rotateAnim() {
    this._playAnim(
      [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
      '旋转',
    );
  }

  _moveColorAnim() {
    this._playAnim(
      [
        { transform: 'translateX(0)', backgroundColor: '#1677ff' },
        { transform: 'translateX(120px)', backgroundColor: '#52c41a' },
        { transform: 'translateX(0)', backgroundColor: '#fa541c' },
      ],
      '移动+变色',
    );
  }

  _scaleAnim() {
    this._playAnim(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.4)' },
        { transform: 'scale(0.8)' },
        { transform: 'scale(1)' },
      ],
      '缩放弹跳',
    );
  }

  _animControl(action) {
    if (!this._animation) return;
    if (action === 'pause') { this._animation.pause(); this.setState({ animState: 'paused' }); }
    else if (action === 'resume') { this._animation.play(); this.setState({ animState: 'playing' }); }
    else if (action === 'reverse') { this._animation.reverse(); this.setState({ animState: 'playing' }); }
    else if (action === 'finish') { this._animation.finish(); this.setState({ animState: 'finished' }); }
    else if (action === 'cancel') { this._animation.cancel(); this.setState({ animState: 'idle' }); }
    this._addLog('info', `动画控制: ${action}`);
  }

  _setRate(rate) {
    if (this._animation) this._animation.playbackRate = rate;
    this.setState({ animRate: rate });
  }

  // ============ 6. FormData / Blob / URL.createObjectURL ============
  async _onFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 释放旧 URL
    if (this.state.filePreviewUrl) URL.revokeObjectURL(this.state.filePreviewUrl);

    const info = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toLocaleString('zh-CN'),
    };
    this.setState({ fileInfo: info });

    // 图片预览：URL.createObjectURL
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const url = URL.createObjectURL(file);
      this.setState({ filePreviewUrl: url });
    } else {
      this.setState({ filePreviewUrl: '' });
    }

    // 文本预览：FileReader.readAsText
    if (file.type.startsWith('text/') || /\.(md|json|js|css|html|txt)$/i.test(file.name)) {
      const reader = new FileReader();
      reader.onload = () => this.setState({ fileTextContent: String(reader.result).slice(0, 500) });
      reader.readAsText(file, 'utf-8');
    } else {
      this.setState({ fileTextContent: '' });
    }

    // FormData 演示
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    const entries = [];
    for (const [k, v] of fd.entries()) {
      entries.push(`${k}: ${v instanceof File ? v.name + ' (' + v.size + 'B)' : v}`);
    }
    this._addLog('info', `FormData: ${entries.join(' | ')}`);
  }

  async _createBlob() {
    const text = '这是用 new Blob([text], {type:"text/plain"}) 创建的 Blob 对象。';
    const blob = new Blob([text], { type: 'text/plain' });
    const content = await blob.text();
    this._addLog('info', `Blob 创建: size=${blob.size}, type=${blob.type}, content="${content.slice(0, 30)}..."`);
  }

  renderPage() {
    const ttsSupported = 'speechSynthesis' in window;
    const mediaSupported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const recSupported = typeof MediaRecorder !== 'undefined';

    return [
      h('h2', { class: 'section-title' }, '文本与多媒体 API 实验室'),

      // 1. Selection / Range
      h(Card, { title: '1. Selection / Range API（文本选区）' },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'selection-demo', style: { padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px', userSelect: 'text' } },
            '这是可选择的文本区域。请用鼠标选中其中一段文字，下方会实时显示 Selection 与 Range 的信息。也可点击"用代码选中"按钮通过 createRange + addRange 编程式选中文本。',
          ),
          h('div', { class: 'flex gap-sm' },
            this._btn('用代码选中', { type: 'primary', size: 'sm', onClick: () => this._selectByCode() }),
            this._btn('清除选区', { size: 'sm', onClick: () => this._clearSelection() }),
          ),
          h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, '选中文本：'),
            h('div', { class: 'code-block', style: { padding: '8px', minHeight: '32px' } },
              this.state.selectionText || '(无)',
            ),
            h('div', { class: 'fs-sm text-secondary mt-sm mb-xs' }, 'Range 信息：'),
            h('pre', { class: 'code-block', style: { padding: '8px', whiteSpace: 'pre-wrap' } },
              this.state.selectionInfo),
          ),
        ),
      ),

      // 2. contenteditable
      h(Card, { title: '2. contenteditable + execCommand（富文本编辑，注：execCommand 已废弃但广泛支持）' },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex flex-wrap gap-xs' },
            this._btn('B 加粗', { size: 'sm', onClick: () => this._exec('bold') }),
            this._btn('I 斜体', { size: 'sm', onClick: () => this._exec('italic') }),
            this._btn('U 下划线', { size: 'sm', onClick: () => this._exec('underline') }),
            this._btn('蓝色', { size: 'sm', onClick: () => this._exec('foreColor', '#1677ff') }),
            this._btn('大字号', { size: 'sm', onClick: () => this._exec('fontSize', '5') }),
            this._btn('有序列表', { size: 'sm', onClick: () => this._exec('insertOrderedList') }),
            this._btn('无序列表', { size: 'sm', onClick: () => this._exec('insertUnorderedList') }),
            this._btn('H3', { size: 'sm', onClick: () => this._exec('formatBlock', '<h3>') }),
          ),
          h('div', {
            class: 'editable-area',
            contentEditable: 'true',
            style: { padding: '12px', border: '1px solid #1677ff', borderRadius: '4px', minHeight: '80px', outline: 'none' },
            html: this.state.editableHtml,
          }),
          h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, 'innerHTML 实时同步：'),
            h('pre', { class: 'code-block', style: { padding: '8px', maxHeight: '120px', overflow: 'auto' } },
              this.state.editableHtml),
          ),
        ),
      ),

      // 3. SpeechSynthesis
      h(Card, { title: h('div', { class: 'flex items-center gap-sm' },
        h('span', {}, '3. SpeechSynthesis（语音合成 TTS）'),
        h(Tag, { color: ttsSupported ? 'success' : 'warning' }, ttsSupported ? '支持' : '不支持'),
      ) },
        ttsSupported ? h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex items-center gap-sm' },
            h('span', { class: 'fs-sm text-secondary' }, '声音:'),
            h('select', {
              class: 'input',
              style: { width: '280px' },
              value: this.state.selectedVoiceURI,
              onChange: (e) => this.setState({ selectedVoiceURI: e.target.value }),
            },
              ...this.state.voices.map((v) => h('option', { value: v.voiceURI }, `${v.name} (${v.lang})`)),
            ),
          ),
          h('textarea', {
            class: 'input',
            rows: 2,
            value: this.state.ttsText,
            onInput: (e) => this.setState({ ttsText: e.target.value }),
          }),
          h('div', { class: 'flex flex-wrap gap-sm' },
            this._btn('朗读', { type: 'primary', size: 'sm', onClick: () => this._speak() }),
            this._btn('暂停', { size: 'sm', onClick: () => this._pauseTts() }),
            this._btn('继续', { size: 'sm', onClick: () => this._resumeTts() }),
            this._btn('取消', { danger: true, size: 'sm', onClick: () => this._cancelTts() }),
          ),
          h('div', { class: 'fs-sm text-tertiary' },
            `状态: speaking=${this.state.ttsState.speaking}, paused=${this.state.ttsState.paused}, pending=${this.state.ttsState.pending}, 共 ${this.state.voices.length} 个声音`),
        ) : h('p', { class: 'text-tertiary' }, '当前浏览器不支持 SpeechSynthesis API'),
      ),

      // 4. MediaDevices + MediaRecorder
      h(Card, { title: h('div', { class: 'flex items-center gap-sm' },
        h('span', {}, '4. MediaDevices + MediaRecorder（摄像头与录制）'),
        h(Tag, { color: mediaSupported ? 'success' : 'warning' }, mediaSupported ? '支持' : '不支持'),
        h(Tag, { color: recSupported ? 'success' : 'warning' }, recSupported ? '可录制' : '不可录制'),
      ) },
        mediaSupported ? h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex gap-sm' },
            this._btn('启动摄像头', { type: 'primary', size: 'sm', onClick: () => this._startCamera() }),
            this._btn('停止', { danger: true, size: 'sm', onClick: () => this._stopMedia() }),
            this._btn('开始录制', { size: 'sm', disabled: this.state.mediaState === 'recording', onClick: () => this._startRecording() }),
            this._btn('停止录制', { size: 'sm', disabled: this.state.mediaState !== 'recording', onClick: () => this._stopRecording() }),
          ),
          this.state.mediaError && h(Alert, { type: 'error', message: '错误', description: this.state.mediaError }),
          h('div', { class: 'flex gap-md flex-wrap' },
            h('div', {},
              h('div', { class: 'fs-sm text-secondary mb-xs' }, `实时画面 (state: ${this.state.mediaState})`),
              h('video', { class: 'media-video', autoplay: true, muted: true, playsinline: true, style: { width: '240px', background: '#000', borderRadius: '4px' } }),
            ),
            h('div', {},
              h('div', { class: 'fs-sm text-secondary mb-xs' }, `录制回放 (${this.state.recordingDuration}s)`),
              h('video', { class: 'media-playback', controls: true, style: { width: '240px', background: '#000', borderRadius: '4px' } }),
            ),
          ),
        ) : h('p', { class: 'text-tertiary' }, '当前环境不支持 getUserMedia（需要 HTTPS 或 localhost）'),
      ),

      // 5. Web Animations API
      h(Card, { title: '5. Web Animations API（Element.animate）' },
        h('div', { class: 'flex flex-col gap-sm' },
          h('div', { class: 'flex flex-wrap gap-sm' },
            this._btn('旋转', { type: 'primary', size: 'sm', onClick: () => this._rotateAnim() }),
            this._btn('移动+变色', { type: 'primary', size: 'sm', onClick: () => this._moveColorAnim() }),
            this._btn('缩放弹跳', { type: 'primary', size: 'sm', onClick: () => this._scaleAnim() }),
            this._btn('暂停', { size: 'sm', onClick: () => this._animControl('pause') }),
            this._btn('继续', { size: 'sm', onClick: () => this._animControl('resume') }),
            this._btn('反向', { size: 'sm', onClick: () => this._animControl('reverse') }),
            this._btn('结束', { size: 'sm', onClick: () => this._animControl('finish') }),
            this._btn('取消', { danger: true, size: 'sm', onClick: () => this._animControl('cancel') }),
          ),
          h('div', { class: 'flex items-center gap-sm' },
            h('span', { class: 'fs-sm text-secondary' }, '速率:'),
            this._btn('0.5x', { size: 'sm', type: this.state.animRate === 0.5 ? 'primary' : 'default', onClick: () => this._setRate(0.5) }),
            this._btn('1x', { size: 'sm', type: this.state.animRate === 1 ? 'primary' : 'default', onClick: () => this._setRate(1) }),
            this._btn('2x', { size: 'sm', type: this.state.animRate === 2 ? 'primary' : 'default', onClick: () => this._setRate(2) }),
          ),
          h('div', { style: { padding: '20px', background: '#fafafa', borderRadius: '4px', minHeight: '100px' } },
            h('div', { class: 'waa-demo-box', style: { width: '60px', height: '60px', background: '#1677ff', borderRadius: '4px' } }),
          ),
          h('div', { class: 'fs-sm text-tertiary' }, `动画状态: ${this.state.animState}`),
        ),
      ),

      // 6. FormData / Blob / URL.createObjectURL
      h(Card, { title: '6. FormData / Blob / URL.createObjectURL（文件处理）' },
        h('div', { class: 'flex flex-col gap-sm' },
          h('input', {
            type: 'file',
            onChange: (e) => this._onFileChange(e),
            style: { fontSize: '14px' },
          }),
          this._btn('创建 Blob 演示', { size: 'sm', onClick: () => this._createBlob() }),
          this.state.fileInfo && h('div', { class: 'code-block', style: { padding: '8px' } },
            `name: ${this.state.fileInfo.name}\nsize: ${this.state.fileInfo.size} bytes\ntype: ${this.state.fileInfo.type}\nlastModified: ${this.state.fileInfo.lastModified}`,
          ),
          this.state.filePreviewUrl && h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, '图片预览（URL.createObjectURL）:'),
            h('img', { src: this.state.filePreviewUrl, style: { maxWidth: '240px', borderRadius: '4px' } }),
          ),
          this.state.fileTextContent && h('div', {},
            h('div', { class: 'fs-sm text-secondary mb-xs' }, '文本内容（FileReader.readAsText，前 500 字符）:'),
            h('pre', { class: 'code-block', style: { padding: '8px', maxHeight: '120px', overflow: 'auto' } },
              this.state.fileTextContent),
          ),
        ),
      ),

      // 日志面板
      h(Card, { title: '事件日志' },
        h('div', { class: 'log-panel' },
          ...this.state.logs.map((log) => h('div', { class: 'log-panel__line' },
            h('span', { class: 'log-panel__time' }, log.time),
            h('span', { class: `log-panel__tag log-panel__tag--${log.type}` }, log.type),
            h('span', {}, log.content),
          )),
        ),
      ),
    ];
  }
}

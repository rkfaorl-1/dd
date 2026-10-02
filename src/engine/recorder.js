/**
 * Recorder - captures the WebGL canvas to a video file with MediaRecorder.
 *
 * Only the canvas is recorded: the control panel and HUD are HTML overlays and
 * never appear in the video. Recording is real-time, so keep the tab visible
 * and in the foreground while it runs.
 */
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1',
  'video/mp4',
];

export class Recorder extends EventTarget {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.mediaRecorder = null;
    this.chunks = [];
    this.startedAt = 0;
  }

  static isSupported() {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  }

  static pickMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  }

  get recording() {
    return !!this.mediaRecorder && this.mediaRecorder.state === 'recording';
  }

  get elapsed() {
    return this.recording ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  start({ fps = 30, bitrate = 14_000_000 } = {}) {
    if (!Recorder.isSupported()) throw new Error('MediaRecorder / canvas.captureStream is not supported in this browser.');
    if (this.recording) return;
    this.mimeType = Recorder.pickMimeType();
    this.stream = this.canvas.captureStream(fps);
    const options = { videoBitsPerSecond: bitrate };
    if (this.mimeType) options.mimeType = this.mimeType;
    this.mediaRecorder = new MediaRecorder(this.stream, options);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(250);
    this.startedAt = performance.now();
    this.dispatchEvent(new CustomEvent('start'));
  }

  /** Stop and resolve with the recorded Blob (or null if nothing was recording). */
  stop() {
    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') return Promise.resolve(null);
    return new Promise((resolve) => {
      const recorder = this.mediaRecorder;
      recorder.onstop = () => {
        const type = this.mimeType || this.chunks[0]?.type || 'video/webm';
        const blob = new Blob(this.chunks, { type: type.split(';')[0] });
        this.stream.getTracks().forEach((t) => t.stop());
        this.mediaRecorder = null;
        this.chunks = [];
        this.dispatchEvent(new CustomEvent('stop', { detail: { blob } }));
        resolve(blob);
      };
      recorder.stop();
    });
  }

  /** Trigger a browser download for a recorded blob. */
  static download(blob, baseName = 'story-set') {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseName}-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }
}

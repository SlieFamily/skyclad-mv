/* ===================================================================
   play.html export: render every frame with window.render(i / fps),
   encode with WebCodecs (GPU when the browser offers it), mux the song,
   write an MP4. Not real-time: each frame is exact, like render.py.
   =================================================================== */
async function exportMP4({ canvas, fps, dur, songBytes, say, onFrame }) {
  const MB = window.Mediabunny;
  if (!MB || !window.VideoEncoder) throw new Error('此浏览器不支持 WebCodecs，请使用最新版 Chrome / Edge。');
  const W = canvas.width, H = canvas.height, N = Math.round(dur * fps);
  const quality = new MB.Quality(W * H >= 3840 * 2160 ? 'very-high' : 'high');

  const vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'hevc', 'vp9', 'av1'], { width: W, height: H, quality });
  if (!vcodec) throw new Error(`${W}×${H} 没有可用的视频编码器，请降低分辨率。`);
  const acodec = await MB.getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 });

  /* stream to disk when we can (2K/4K files are GBs); otherwise keep it in memory */
  const name = `skyclad-observer_${H}p${fps}.mp4`;
  let target, writable = null;
  if (window.showSaveFilePicker) {
    const fh = await showSaveFilePicker({ suggestedName: name, types: [{ description: 'MP4', accept: { 'video/mp4': ['.mp4'] } }] });
    writable = await fh.createWritable();
    target = new MB.StreamTarget(writable, { chunked: true });
  } else {
    target = new MB.BufferTarget();
  }
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: writable ? false : 'in-memory' }), target });
  const video = new MB.CanvasSource(canvas, { codec: vcodec, quality, keyFrameInterval: 2, latencyMode: 'quality', hardwareAcceleration: 'prefer-hardware' });
  output.addVideoTrack(video, { frameRate: fps });
  let audio = null;
  if (acodec) { audio = new MB.AudioBufferSource({ codec: acodec, quality: new MB.Quality(320e3) }); output.addAudioTrack(audio); }
  await output.start();

  /* the song: decoded at 48 kHz, then fed in 5 s pieces interleaved with the
     frames (keeps the muxer's interleave buffer small) */
  let buf = null, aPos = 0;
  const ASTEP = 48000 * 5;
  if (audio) {
    say('解码音源…');
    buf = await new OfflineAudioContext(2, 48000, 48000).decodeAudioData(await songBytes());
  }
  const aEnd = buf ? Math.min(buf.length, Math.round(dur * buf.sampleRate)) : 0;
  async function feedAudio(until) {          // push audio up to `until` seconds (never past dur)
    while (buf && aPos < aEnd && aPos / buf.sampleRate <= until) {
      const n = Math.min(ASTEP, aEnd - aPos);
      const piece = new AudioBuffer({ length: n, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
      for (let c = 0; c < buf.numberOfChannels; c++) piece.copyToChannel(buf.getChannelData(c).subarray(aPos, aPos + n), c);
      await audio.add(piece); aPos += n;
    }
  }

  const t0 = performance.now();
  for (let i = 0; i < N; i++) {
    if (exportMP4.cancel) { await output.cancel(); if (writable) await writable.close().catch(() => {}); throw new Error('已取消'); }
    await feedAudio(i / fps + 1);
    window.render(i / fps);
    await video.add(i / fps, 1 / fps);       // awaits encoder back-pressure
    if (i % 15 === 0 || i === N - 1) {
      const el = (performance.now() - t0) / 1000, left = el / (i + 1) * (N - i - 1);
      onFrame(i, N, `${vcodec}/${acodec || 'no audio'}  ${i + 1}/${N} frames  ${(i + 1) / el | 0} fps  剩余 ~${left | 0}s`);
      await new Promise(r => setTimeout(r, 0));   // let the page repaint / take the cancel click
    }
  }
  video.close();
  if (audio) { await feedAudio(Infinity); audio.close(); }
  say('写入 MP4…');
  await output.finalize();
  if (!writable) {
    const url = URL.createObjectURL(new Blob([target.buffer], { type: 'video/mp4' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name }); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return { name, frames: N, codec: vcodec, seconds: (performance.now() - t0) / 1000 };
}

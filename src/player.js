/* ===================================================================
   play.html: real-time preview synced to the song, plus frame-exact MP4
   export in the browser (WebCodecs via Mediabunny). The film itself is
   still only window.render(t); this file never touches film state.
   =================================================================== */
(() => {
  const $ = id => document.getElementById(id);
  const song = $('song'), seek = $('seek'), msg = $('msg'), ui = $('ui');
  const DUR = window.FILM.duration;
  const qs = new URLSearchParams(location.search);
  const say = (s, err = false) => { msg.textContent = s; msg.classList.toggle('err', err); };
  const fmt = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  const CANVAS = $('out');

  /* ---------- resolution / fps (resolution is fixed at page load: reload) ---------- */
  $('res').value = qs.get('w') ? `${qs.get('w')}x${qs.get('h')}` : '';
  if (qs.get('fps')) $('fps').value = qs.get('fps');
  $('res').onchange = () => {
    const [w, h] = $('res').value.split('x'), q = new URLSearchParams();
    if (w) { q.set('w', w); q.set('h', h); }
    q.set('fps', $('fps').value);
    location.search = q.toString();
  };

  /* ---------- playback ---------- */
  let busy = false;                     // exporting: playback is locked
  const draw = t => { try { window.render(clamp(t, 0, DUR)); } catch (e) { say(String(e), true); } };
  const showTime = t => { $('time').textContent = `${fmt(t)} / ${fmt(DUR)}`; seek.value = t; };
  function tick() {
    if (!song.paused && !busy) { const t = song.currentTime; draw(t); showTime(t); }
    requestAnimationFrame(tick);
  }
  function toggle() {
    if (busy) return;
    if (song.paused) song.play().catch(e => say('无法播放: ' + e.message, true)); else song.pause();
  }
  song.onplay = () => { $('play').textContent = '❚❚ 暂停'; };
  song.onpause = () => { $('play').textContent = '▶ 播放'; };
  song.onerror = () => say('无法读取 source/music.flac，请按 README 放置音源。', true);
  $('play').onclick = toggle;
  seek.oninput = () => { const t = +seek.value; song.currentTime = t; draw(t); showTime(t); };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      e.preventDefault(); const t = clamp(song.currentTime + (e.code === 'ArrowRight' ? 5 : -5), 0, DUR);
      song.currentTime = t; draw(t); showTime(t);
    }
  });
  /* controls fade out while the mouse is idle during playback */
  let idle;
  addEventListener('mousemove', () => {
    ui.classList.remove('hide'); clearTimeout(idle);
    idle = setTimeout(() => { if (!song.paused) ui.classList.add('hide'); }, 2500);
  });

  /* ---------- audio for export: fetch (http://) or user-picked file (file://) ---------- */
  let pickedFile = null;
  $('pickbtn').onclick = () => $('pick').click();
  $('pick').onchange = () => {
    pickedFile = $('pick').files[0] || null;
    if (pickedFile) { song.src = URL.createObjectURL(pickedFile); say(`音源: ${pickedFile.name}`); }
  };
  async function songBytes() {
    if (pickedFile) return pickedFile.arrayBuffer();
    try {
      const r = await fetch('source/music.flac'); if (!r.ok) throw new Error(r.status);
      return await r.arrayBuffer();
    } catch (e) {
      throw new Error('file:// 下无法 fetch 音源：请点「选择 music.flac」，或用本地服务器打开 (python serve.py)。');
    }
  }

  /* ---------- export ---------- */
  $('export').onclick = async () => {
    if (busy) { exportMP4.cancel = true; return; }
    busy = true; exportMP4.cancel = false; song.pause();
    $('export').textContent = '✕ 取消'; $('play').disabled = seek.disabled = $('res').disabled = $('fps').disabled = true;
    try {
      const r = await exportMP4({
        canvas: CANVAS, fps: +$('fps').value, dur: DUR, songBytes, say,
        onFrame: (i, n, s) => { showTime(i / +$('fps').value); say(s); },
      });
      say(`完成: ${r.name}  (${r.frames} frames, ${r.codec}, ${r.seconds.toFixed(0)}s)`);
    } catch (e) {
      say('导出失败: ' + (e.message || e), true);
    } finally {
      busy = false; $('export').textContent = '⬇ 导出 MP4';
      $('play').disabled = seek.disabled = $('res').disabled = $('fps').disabled = false;
    }
  };

  /* ---------- start ---------- */
  const start = () => {
    if (window.ERRS.length) { say('页面错误: ' + window.ERRS.join('; '), true); return; }
    draw(0); showTime(0);
    $('play').disabled = $('export').disabled = false;
    say(`${CANVAS.width}×${CANVAS.height}  ·  空格 播放/暂停  ← → 跳 5 秒  ·  导出前先选分辨率和 fps`);
    requestAnimationFrame(tick);
  };
  if (window.ready) start(); else document.fonts.ready.then(() => setTimeout(start, 0));
})();

# スカイクラッドの観測者 — Skyclad Observer

いとうかなこ《スカイクラッドの観測者》全曲 MV 的代码实现。纯 JavaScript 渲染（WebGL + Canvas 2D），用 Python + Playwright 离线导出视频，或直接在浏览器中通过 WebCodecs 实时播放和导出。

**版权声明**：本项目**不包含**音频文件 `source/music.flac`（商业版权）。歌词文本嵌入在 `source/lyrics.lrc`、`source/lyrics.json` 和 `src/data.js` 中，同样受版权保护。请仅将本代码用于学习和个人用途。

---

## 快速开始

### 浏览器播放与导出

1. **放置音源**：将你自己的 `music.flac`（48 kHz FLAC）放入 `source/` 目录
2. **启动本地服务器**（Chrome 的 fetch 和音频 seek 需要 HTTP）：
   ```bash
   python serve.py
   ```
   浏览器会自动打开 `http://127.0.0.1:8000/play.html`

3. **播放**：空格键播放/暂停，← → 跳转 5 秒
4. **导出 MP4**：
   - 选择分辨率和 fps（会重新加载页面以应用）
   - 点击「导出 MP4」
   - 浏览器会通过 WebCodecs 逐帧渲染并编码（H.264 + AAC）
   - 支持直接写入磁盘（File System Access API，仅 Chrome/Edge）

**注意**：
- **浏览器要求**：Chrome 或 Edge 最新版（需要 WebCodecs 支持）
- **字体**：需要 Windows 10/11 系统字体（Yu Mincho、Yu Gothic、BIZ UD Mincho、Meiryo、MS Gothic 等），其他操作系统会使用后备字体，渲染效果会有差异

### 命令行批量渲染（Playwright）

适合 CI 或完整质量的离线渲染（比浏览器导出更稳定）：

```bash
# 安装依赖
pip install -r requirements.txt
playwright install chromium

# 渲染 1080p30
python tools/render.py --w 1920 --h 1080 --fps 30 --out out/video_1080p30.mp4

# GPU 加速（NVIDIA 显卡）：发布版 2560×1440 60fps
python tools/render.py --w 2560 --h 1440 --fps 60 --jobs 6 --shot jpeg --encoder nvenc --crf 18 --out out/skyclad-observer_1440p60.mp4
```

**参数**：
- `--w / --h`：分辨率（默认 1920×1080）
- `--fps`：帧率（默认 30）
- `--jobs`：并行工作进程数（默认 6）
- `--encoder`：`x264`（CPU，默认）或 `nvenc`（NVIDIA GPU）
- `--shot`：截图格式 `png` 或 `jpeg`（4K 时 jpeg 快 2 倍）
- `--crf`：质量参数（默认 14，越小越好）

---

## 项目结构

```
skyclad-observer-release/
├── index.html              # 纯渲染页面（render.py 用）
├── play.html               # 浏览器播放器 + WebCodecs 导出
├── serve.py                # 本地 HTTP 服务器（支持 Range 请求）
├── src/
│   ├── film/               # 影片脚本（场景、转场、时间轴）
│   ├── lib/                # 基础库（Canvas/WebGL 工具、LaTeX 渲染）
│   ├── data.js             # 歌词和节拍数据（由 make_data.py 生成）
│   ├── aud.js              # 音频特征（60fps，由 audio_feat.py 生成）
│   ├── tex.js              # 公式 SVG（由 texbuild.py + LaTeX 生成）
│   ├── player.js           # 浏览器播放器逻辑
│   ├── player_export.js    # WebCodecs 导出逻辑
│   ├── make_data.py        # 构建 data.js
│   ├── texbuild.py         # 构建 tex.js（需要 LaTeX + dvisvgm）
│   └── formulas.py         # 公式定义
├── source/
│   ├── music.flac          # ⚠️ 不在版本库中，需自行提供
│   ├── lyrics.lrc          # 原始 LRC 歌词
│   ├── lyrics.json         # 逐字对齐后的歌词（align_ctc.py 生成）
│   ├── lyrics_dp.json      # 节拍网格对齐（align.py 生成，align_ctc.py 的回退）
│   ├── grid.json           # 节拍网格（tempo.py + downbeat.py 生成）
│   ├── form.json           # 曲式结构（form.py 生成）
│   ├── tempo.py            # BPM 检测
│   ├── downbeat.py         # 小节线检测
│   ├── form.py             # 曲式分析
│   ├── parse_lrc.py        # LRC 解析
│   ├── readings.py         # 每个显示字符的假名读音（parse_lrc.py / align_ctc.py 共用）
│   ├── align.py            # 节拍网格对齐（无 ML，回退用）
│   ├── vocals.py           # Demucs 分离人声 -> vocals.wav（⚠️ 不在版本库中）
│   ├── align_ctc.py        # MMS CTC 强制对齐（逐字时间戳）
│   ├── align_report.txt    # align_ctc.py 的逐行报告（时间、置信度、罗马音）
│   └── audio_feat.py       # 音频特征提取
├── tools/
│   ├── render.py           # Playwright 批量渲染
│   ├── probe.py            # 快速截图诊断
│   ├── align_sheet.py      # 歌词对齐 QA：每行一张人声频谱图
│   ├── fontsheet.py        # 字体测试
│   ├── facecheck.py        # 字形检查
│   └── gpucheck.py         # WebGL 检查
├── vendor/
│   ├── mediabunny.min.js   # WebCodecs MP4 muxer (MPL-2.0)
│   └── mediabunny.LICENSE
├── docs/
│   ├── brief.md            # 设计简报
│   ├── prompts.md          # 创作过程中的提示词记录
│   └── qa/align/           # 歌词对齐频谱图 line_00.png ~ line_45.png
├── requirements.txt
├── requirements-align.txt  # 歌词对齐依赖（torch / torchaudio / demucs）
├── .gitignore
└── README.md
```

---

## 数据管道（可选）

预构建的数据文件（`data.js`、`aud.js`、`tex.js`）已包含在项目中，**无需重新生成**即可直接使用。如果你想从原始音频重新构建，按以下顺序运行：

```bash
cd source/
python tempo.py              # 检测 BPM -> grid.json
python downbeat.py           # 检测小节线 -> 更新 grid.json
python form.py               # 曲式分析 -> form.json
python parse_lrc.py          # 解析 LRC -> lines.json
python align.py && cp lyrics.json lyrics_dp.json   # 节拍网格对齐（回退）
python vocals.py             # 人声分离 -> vocals.wav（需 requirements-align.txt）
python align_ctc.py          # CTC 强制对齐 -> lyrics.json
python audio_feat.py         # 音频特征 -> ../src/aud.js
cd ../src/
python make_data.py          # 打包数据 -> data.js
python texbuild.py           # 渲染公式 -> tex.js（需要 TeX Live 或 MiKTeX）
```

**依赖**：
- **Python 3.12+**，安装 `requirements.txt`；歌词对齐另需 `requirements-align.txt`（torch CPU 版即可，国内可用清华源 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；模型约 1.3 GB，用 `TORCH_HOME` 指定缓存目录）
- **LaTeX**：TeX Live 或 MiKTeX（含 `dvisvgm`）
- **FFmpeg**：音频解码和视频编码

---

## 歌词对齐

`src/data.js` 里的逐字时间来自歌手的人声本身，而不是节拍网格。每个字在开始发声的那一帧出现。

### 各脚本的作用

| 脚本 | 输入 | 输出 | 作用 |
|---|---|---|---|
| `source/parse_lrc.py` | `lyrics.lrc`、`readings.py` | `lines.json` | 把每行拆成显示单位（一字一个），附上假名读音和拍数（mora） |
| `source/align.py` | `music.flac`、`lines.json` | `lyrics.json` → 另存为 `lyrics_dp.json` | 无 ML 的节拍网格对齐，只作为回退 |
| `source/vocals.py` | `music.flac` | `vocals.wav` | Demucs htdemucs 分离人声（44.1 kHz 立体声），有 CUDA 时自动用 GPU |
| `source/align_ctc.py` | `vocals.wav`、`lines.json`、`lyrics_dp.json` | `lyrics.json`、`align_report.txt` | 假名转罗马音，用 torchaudio MMS_FA（wav2vec2 CTC）做 Viterbi 强制对齐，再把起音吸附到 ±60 ms 内的频谱通量峰值。平均置信度低于 0.02 的日文行沿用 `lyrics_dp.json` 的时间（平移到 CTC 行首） |
| `src/make_data.py` | `lyrics.json`、`grid.json`、`beats.json` | `src/data.js` | 把歌词内联进页面，`file://` 下也能用 |
| `tools/align_sheet.py` | `lyrics.json`、`vocals.wav`、可选旧 JSON | `out/qa/align/line_XX.png` | 每行一张频谱图，用来人工核对 |

### 运行顺序

```bash
pip install -r requirements-align.txt
# 国内：pip install -i https://pypi.tuna.tsinghua.edu.cn/simple -r requirements-align.txt

python source/parse_lrc.py
python source/align.py && cp source/lyrics.json source/lyrics_dp.json
python source/vocals.py                          # -> source/vocals.wav
python source/align_ctc.py                       # -> source/lyrics.json + align_report.txt
python -I src/make_data.py                       # -> src/data.js
python tools/align_sheet.py source/lyrics_dp.json   # -> out/qa/align/（可选）
```

`align_sheet.py` 输出到 `out/qa/align/`（已被忽略）；要更新仓库里的示例，把图片复制到 `docs/qa/align/`。它写死了 Windows 字体 `C:/Windows/Fonts/meiryo.ttc`，其他系统需改成本机的日文字体。

`TORCH_HOME` 可以把模型缓存（Demucs 约 80 MB、MMS_FA 约 1.2 GB）放到别的盘。CPU 就能跑完。

**版权**：`vocals.wav` 是从商业音源分离出的人声，已被 `.gitignore`（`source/*.wav`）排除，请勿提交或分发。

### 频谱图怎么看

仓库里附了一份结果：[docs/qa/align/](docs/qa/align/)，每行一张 `line_XX.png`，编号就是歌词行号（从 0 开始，对应 `align_report.txt` 第一列）。

- 背景是人声轨的频谱（0–5 kHz，横轴 400 px/秒，底部是秒数刻度）
- **红线 + 黄字**：新的时间点（当前 `lyrics.json`，CTC 对齐）
- **灰色虚线 + 灰字**：旧的节拍网格时间（传给 `align_sheet.py` 的旧 JSON，这里是 `lyrics_dp.json`）
- 红线应该落在一段亮纹开始的地方，也就是开始发声的位置

`align_report.txt` 里 `conf` 低的行（如 Open the eyes）和标了 `beat-grid fallback` 的行最值得对着频谱图和音频再确认一遍。

---

## 许可与版权

- **代码**：开发者未指定许可证，使用前请与作者确认
- **音乐和歌词**：
  - 《スカイクラッドの観測者》词曲：志倉千代丸 / 演唱：いとうかなこ
  - STEINS;GATE Xbox 360 版 OP 主题曲（2009）
  - **本项目不包含音频文件**，用户需自行提供
  - 歌词文本（`lyrics.lrc`、`lyrics.json`、`data.js`）受版权保护，仅供个人学习使用
- **第三方库**：
  - [Mediabunny](https://mediabunny.dev/)：MPL-2.0（见 `vendor/mediabunny.LICENSE`）

---

## 技术说明

### 字体依赖

渲染依赖 Windows 系统字体：
- **日文**：Yu Mincho、Yu Gothic、BIZ UDPMincho、Meiryo、MS Gothic
- **西文**：Arial Black、Consolas、Times New Roman

**BIZ UD** 字体随 Windows 10 1809+ 预装。macOS 和 Linux 会使用后备字体，效果会有差异。

### 渲染原理

1. **纯函数渲染**：`window.render(t)` 是时间 `t` 的纯函数，无副作用，可并行渲染
2. **逻辑坐标**：所有绘制使用 1920×1080 逻辑坐标，画布按视口缩放
3. **WebGL 后期**：泛光、色差、扫描线、颗粒由 fragment shader 实现
4. **分辨率无关**：同一代码可输出 1080p 或 4K，只需改变视口尺寸

### 性能

- **1080p**：Chrome 实时渲染约 30-50 fps
- **1440p**：实时约 20-30 fps，导出约 60-80 fps
- **4K**：实时约 10-15 fps，导出约 30-40 fps（GPU 编码）

---

## 故障排查

### 浏览器播放问题

**症状**：`file://` 协议打开 `play.html`，点击导出时报错 "无法 fetch 音源"

**原因**：Chrome 不允许 `file://` 下的 `fetch()` 和跨域 iframe

**解决**：运行 `python serve.py` 通过 HTTP 访问

### 字体缺失

**症状**：文字显示为方块或后备字体

**解决**：
- Windows：确认 Windows 10 1809+ 或 Windows 11
- macOS/Linux：部分字体不可用，渲染效果会有差异（无法完全修复）

### 渲染崩溃

**症状**：4K 并行渲染时内存不足

**解决**：
- 降低 `--jobs`（推荐 4K 时用 4-6）
- 使用 GPU 编码：`--encoder nvenc`
- 使用 `--shot jpeg`（比 PNG 快 2 倍）

---

## 开发

### 快速检查

```bash
# 生成指定时间点的截图
python tools/probe.py 10 30 60 90

# 扫描全片，检查错误
python tools/probe.py --sweep 1
```

### 字体检查

```bash
python tools/fontsheet.py    # -> out/qa/fontsheet.png
python tools/facecheck.py     # 列出每个字符使用的字体
```

### GPU 检查

```bash
python tools/gpucheck.py      # WebGL 可用性和 ANGLE 后端
```

---

## 创作记录

- 创作过程中的提示词记录：[docs/prompts.md](docs/prompts.md)

---

## 致谢

- 原曲：志倉千代丸（作词・作曲）、いとうかなこ（演唱）
- 设计与实现：（开发者信息）
- WebCodecs 编码库：[Mediabunny](https://mediabunny.dev/)

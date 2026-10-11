# -*- coding: utf-8 -*-
"""Separate the singer from the mix: music.flac -> vocals.wav (44.1 kHz stereo).

Demucs htdemucs. Only align_ctc.py needs the stem; the film never reads it.
Needs requirements-align.txt. Set TORCH_HOME to keep the 80 MB checkpoint
off a full system drive.
"""
import subprocess, sys
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from demucs.pretrained import get_model
from demucs.apply import apply_model

HERE = Path(__file__).resolve().parent
SR = 44100


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).T.copy()


def main():
    src = HERE / 'music.flac'
    out = HERE / 'vocals.wav'
    x = torch.from_numpy(decode(src))
    model = get_model('htdemucs'); model.eval()
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'
    ref = x.mean(0)
    xn = (x - ref.mean()) / ref.std()
    with torch.no_grad():
        y = apply_model(model, xn[None], device=dev, shifts=1, split=True, overlap=0.25, progress=True)[0]
    y = y * ref.std() + ref.mean()
    v = y[model.sources.index('vocals')].numpy().T
    sf.write(out, v, SR, subtype='FLOAT')
    print('wrote', out, v.shape[0] / SR, 's', file=sys.stderr)


if __name__ == '__main__':
    main()

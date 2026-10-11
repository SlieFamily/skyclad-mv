# -*- coding: utf-8 -*-
"""Load index.html, report JS errors, and save low-res stills at given times.

Run:  python tools/probe.py 10 30.5 62 ...      -> out/qa/probe/t0010.00.png ...
      python tools/probe.py --sweep 2          -> render every 2 s, report errors only
"""
import pathlib, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "out" / "qa" / "probe"; OUT.mkdir(parents=True, exist_ok=True)
args = sys.argv[1:]
sweep = None
VP = {"width": 960, "height": 540}
if args and args[0] == "--full":
    VP = {"width": 1920, "height": 1080}; args = args[1:]
if args and args[0] == "--sweep":
    sweep = float(args[1]); args = args[2:]
times = [float(a) for a in args]

with sync_playwright() as p:
    b = p.chromium.launch(args=["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"])
    pg = b.new_page(viewport=VP)
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto((ROOT / "index.html").as_uri())
    try:
        pg.wait_for_function("window.ready === true || (window.ERRS && window.ERRS.length > 0)", timeout=60000)
    except Exception as e:
        logs.append(f"[timeout] {e}")
    errs = pg.evaluate("window.ERRS || []")
    for l in errs + logs:
        print(l)
    if sweep:
        dur = pg.evaluate("window.FILM ? window.FILM.duration : 0")
        t, bad = 0.0, 0
        while t < dur:
            r = pg.evaluate("t => { try { window.render(t); return null } catch (e) { return String(e.stack || e) } }", t)
            if r:
                bad += 1
                if bad <= 25:
                    print(f"t={t:.2f}: {r.splitlines()[0]} | {' '.join(r.splitlines()[1:3])}")
            t += sweep
        print(f"sweep done, {bad} failing times")
    for t in times:
        r = pg.evaluate("t => { try { window.render(t); return null } catch (e) { return String(e.stack || e) } }", t)
        if r:
            print(f"t={t}: {r}")
        pg.screenshot(path=str(OUT / f"t{t:07.2f}.png"))
    b.close()

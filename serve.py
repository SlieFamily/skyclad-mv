# -*- coding: utf-8 -*-
"""Tiny local web server for play.html (stdlib only).

Python's http.server has no HTTP Range support, and without it browsers can't
seek in the 64 MB FLAC. This adds Range, the right MIME types, and no caching.
Binds to 127.0.0.1 only (not reachable from other machines).

Run:  python serve.py [port]      -> http://127.0.0.1:8000/play.html
"""
import http.server, os, pathlib, re, sys, webbrowser

ROOT = pathlib.Path(__file__).resolve().parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      ".js": "text/javascript", ".flac": "audio/flac", ".mp4": "video/mp4", ".json": "application/json"}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        m = re.match(r"bytes=(\d*)-(\d*)$", self.headers.get("Range", ""))
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.groups()
        start = int(a) if a else max(0, size - int(b))
        end = min(int(b), size - 1) if a and b else size - 1
        if start >= size:
            self.send_error(416); return None
        f = open(path, "rb"); f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self._left = end - start + 1
        return f

    def copyfile(self, src, dst):
        left = getattr(self, "_left", None)
        if left is None:
            return super().copyfile(src, dst)
        while left > 0:
            buf = src.read(min(1 << 20, left))
            if not buf: break
            dst.write(buf); left -= len(buf)


if __name__ == "__main__":
    url = f"http://127.0.0.1:{PORT}/play.html"
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"serving {ROOT}\n  {url}\nCtrl+C to stop")
    if "--no-open" not in sys.argv: webbrowser.open(url)
    try: srv.serve_forever()
    except KeyboardInterrupt: pass

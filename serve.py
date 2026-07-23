#!/usr/bin/env python3
"""Local preview server that mirrors vercel.json, with no symlinks needed.

Serves app/ at / and rewrites /assets and /data to the repo-root folders, so the
relative paths in app/index.html resolve exactly as they will on Vercel. Run from
the repo root:  python3 serve.py  (then open http://localhost:8000)
Bind all interfaces for phone testing:  python3 serve.py --lan
"""
import http.server, socketserver, json, os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
REWRITES = {r["source"]: r["destination"]
            for r in json.load(open("vercel.json")).get("rewrites", [])}

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?")[0].split("#")[0]
        if clean in REWRITES:
            path = REWRITES[clean]
        return super().translate_path(path)

host = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"
port = 8000
with socketserver.TCPServer((host, port), Handler) as httpd:
    print(f"Serving on http://{'localhost' if host=='127.0.0.1' else host}:{port}  (Ctrl-C to stop)")
    httpd.serve_forever()

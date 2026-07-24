#!/usr/bin/env python3
"""Local preview server.

The site is plain static files at the repo root, exactly as Vercel serves them, so
this is a thin wrapper around SimpleHTTPRequestHandler that adds the two things
Vercel does and Python doesn't: cleanUrls (/methodology -> methodology.html) and a
styled 404. Run from the repo root:  python3 scripts/serve.py  (then open http://localhost:8000)
Bind all interfaces for phone testing:  python3 scripts/serve.py --lan
"""
import http.server, socketserver, os, sys

# Serve the repo root (parent of scripts/), where the site's files live.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        clean = path.split("?")[0].split("#")[0]
        # cleanUrls: an extensionless URL maps to the matching .html file, when one exists.
        if clean != "/" and not os.path.splitext(clean)[1]:
            candidate = os.path.join(ROOT, clean.strip("/") + ".html")
            if os.path.isfile(candidate):
                return candidate
        return super().translate_path(path)

    def send_error(self, code, message=None, explain=None):
        # Serve the real 404 page so local previews match production.
        page = os.path.join(ROOT, "404.html")
        if code == 404 and os.path.isfile(page):
            with open(page, "rb") as f:
                body = f.read()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        super().send_error(code, message, explain)


host = "0.0.0.0" if "--lan" in sys.argv else "127.0.0.1"
port = 8000
# Without this a restart within the TIME_WAIT window fails with "Address already in use".
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer((host, port), Handler) as httpd:
    print(f"Serving on http://{'localhost' if host=='127.0.0.1' else host}:{port}  (Ctrl-C to stop)")
    httpd.serve_forever()

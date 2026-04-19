from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.config import settings
from app.db import init_db
from app.routers import admin, auth, employee_me, hr, wallets


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Avanci Demo API", version="0.1.0", lifespan=lifespan)

_origins = (
    ["*"]
    if settings.cors_origins.strip() == "*"
    else [s.strip() for s in settings.cors_origins.split(",") if s.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(hr.router)
app.include_router(employee_me.router)
app.include_router(wallets.router)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
def root():
    """
    Browser-friendly landing page. The JSON API lives here; the Avanci UI is a separate
    Next.js app (usually http://localhost:3000).
    """
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Avanci API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f0f0f0; padding: 0.15em 0.4em; border-radius: 4px; }
    a { color: #0d6efd; }
    .ok { color: #198754; font-weight: 600; }
  </style>
</head>
<body>
  <p class="ok">API is running on this port (8000).</p>
  <p>This URL is the <strong>backend only</strong> — JSON + Swagger. It is not the web app.</p>
  <ul>
    <li><a href="/docs">Open API docs (Swagger)</a></li>
    <li><a href="/health">Health check</a> (<code>GET /health</code>)</li>
  </ul>
  <p><strong>Avanci UI (login, dashboards):</strong> run <code>npm run dev</code> in <code>frontend/</code>
     — then open <a href="http://localhost:3000">http://localhost:3000</a>.
     The UI calls this API at <code>http://127.0.0.1:8000</code> by default.</p>
</body>
</html>"""


@app.get("/health")
def health():
    return {"status": "ok"}

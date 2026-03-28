from fastapi import FastAPI, Depends, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import defaultdict
import time
import os

from .database import SessionLocal
from .models import URL
from .schemas import URLCreate
from .utils import encode_base62

app = FastAPI()

# ---------------- BASE URL ----------------
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

# ---------------- Static & Templates ----------------
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# ---------------- Database Dependency ----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- URL Normalizer ----------------
def normalize_url(url: str):
    if not url.startswith(("http://", "https://")):
        return "https://" + url
    return url

# ---------------- Rate Limiting ----------------
request_log = defaultdict(lambda: defaultdict(list))

def is_rate_limited(ip: str, endpoint: str, limit: int, window: int) -> bool:
    now = time.time()
    request_log[ip][endpoint] = [
        t for t in request_log[ip][endpoint] if now - t < window
    ]

    if len(request_log[ip][endpoint]) >= limit:
        return True

    request_log[ip][endpoint].append(now)
    return False

RATE_LIMIT = 10
WINDOW = 60

# ---------------- Shorten URL ----------------
@app.post("/shorten")
def create_short_url(
    url: URLCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    client_ip = request.client.host

    if is_rate_limited(client_ip, "/shorten", RATE_LIMIT, WINDOW):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    original = normalize_url(str(url.original_url))

    existing_url = db.query(URL).filter(URL.original_url == original).first()

    if existing_url:
        expires_in = (
            (existing_url.expires_at - datetime.utcnow()).days
            if existing_url.expires_at else None
        )
        return {
            "short_url": f"{BASE_URL}/r/{existing_url.short_code}",
            "expires_in_days": expires_in,
            "message": "URL already shortened"
        }

    new_url = URL(
        original_url=original,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30)
    )

    db.add(new_url)
    db.commit()
    db.refresh(new_url)

    new_url.short_code = encode_base62(new_url.id)
    db.commit()

    return {
        "short_url": f"{BASE_URL}/r/{new_url.short_code}",
        "expires_in_days": 30,
        "message": "New short URL created"
    }

# ---------------- Custom Short URL ----------------
@app.post("/shorten/custom")
def create_custom_short_url(
    url: URLCreate,
    request: Request,
    custom_code: str = Query(None, max_length=10),
    db: Session = Depends(get_db)
):
    client_ip = request.client.host

    if is_rate_limited(client_ip, "/shorten/custom", 3, 60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    original = normalize_url(str(url.original_url))

    if custom_code:
        if db.query(URL).filter(URL.short_code == custom_code).first():
            raise HTTPException(status_code=400, detail="Custom code taken")

        new_url = URL(
            original_url=original,
            short_code=custom_code,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=30)
        )

        db.add(new_url)
        db.commit()

        return {
            "short_url": f"{BASE_URL}/r/{custom_code}",
            "expires_in_days": 30,
            "message": "Custom short URL created"
        }

    return create_short_url(url, request, db)

# ---------------- Analytics ----------------
@app.get("/analytics/total_clicks")
def get_total_clicks(db: Session = Depends(get_db)):
    total = db.query(func.sum(URL.click_count)).scalar()
    return {"total_clicks": total or 0}

@app.get("/analytics/top")
def get_top_links(db: Session = Depends(get_db)):
    top_urls = db.query(URL).order_by(URL.click_count.desc()).limit(5).all()

    result = []
    for url in top_urls:
        expires_in_days = (
            (url.expires_at - datetime.utcnow()).days
            if url.expires_at else None
        )

        result.append({
            "original_url": url.original_url,
            "short_url": f"{BASE_URL}/r/{url.short_code}",
            "click_count": url.click_count,
            "created_at": url.created_at.isoformat(),
            "expires_in_days": expires_in_days
        })

    return result

@app.get("/analytics/{short_code}")
def get_analytics(short_code: str, db: Session = Depends(get_db)):
    url = db.query(URL).filter(URL.short_code == short_code).first()

    if not url:
        raise HTTPException(status_code=404, detail="URL not found")

    expires_in_days = (
        (url.expires_at - datetime.utcnow()).days
        if url.expires_at else None
    )

    return {
        "original_url": url.original_url,
        "short_url": f"{BASE_URL}/r/{url.short_code}",
        "click_count": url.click_count,
        "created_at": url.created_at.isoformat(),
        "expires_in_days": expires_in_days
    }

# ---------------- Redirect (FIXED) ----------------
@app.get("/r/{short_code}")
def redirect_to_original(short_code: str, db: Session = Depends(get_db)):
    url = db.query(URL).filter(URL.short_code == short_code).first()

    if not url:
        raise HTTPException(status_code=404, detail="URL not found")

    if url.expires_at and url.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="URL expired")

    url.click_count += 1
    db.commit()

    return RedirectResponse(url=url.original_url)

# ---------------- CREATE TABLES ----------------
from .models import Base
from .database import engine

Base.metadata.create_all(bind=engine)

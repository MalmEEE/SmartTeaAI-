"""
SmartTeaAI — Sentiment Data Collector
=====================================
Collects tea-market-related news and scores sentiment using FinBERT
(ProsusAI/finbert), aggregated to monthly values in range [-1.0, +1.0].

IMPORTANT: free-tier limitation (documented in dissertation limitations):
NewsAPI's free "Developer" plan only returns articles from roughly the
last 29 days. This collector CANNOT backfill historical sentiment for
months before it started running. Months outside its reach keep the
neutral placeholder (0.0) set in preprocess_features.py's clean_dataset().

This is intentionally the ONLY non-blocking collector in the pipeline.
If it fails (API down, rate limited, key expired), the rest of the
pipeline must still run - sentiment is a supplementary feature, not
core price data. 

What gets saved:
    CSV : data/sentiment_monthly.csv   (year_month, sentiment_score, article_count)
    CSV : data/sentiment_raw_articles.csv  (audit trail, optional --csv-only skips this)

Usage:
    python collect_sentiment.py            <- fetch + score + save
    python collect_sentiment.py --csv-only <- skip raw article audit file
"""

import os
import sys
import json
import time
from datetime import datetime, timedelta

import requests
import pandas as pd
from dotenv import load_dotenv

# Load NEWSAPI_KEY from the NestJS backend's .env, same pattern as the
# other collectors (works whether invoked by the backend or run standalone)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")
NEWSAPI_URL = "https://newsapi.org/v2/everything"

QUERIES = [
    "Ceylon tea",
    "Sri Lanka tea export",
    "Colombo tea auction",
    "global tea market price",
]

DATA_DIR = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))

MONTHLY_CSV = os.path.join(DATA_DIR, "sentiment_monthly.csv")
RAW_CSV     = os.path.join(DATA_DIR, "sentiment_raw_articles.csv")

DAYS_BACK = 29  # NewsAPI free-tier historical limit


# ---------------------------------------------------------------------------
# STEP 1: Fetch articles
# ---------------------------------------------------------------------------

def fetch_articles(query, from_date, to_date, page_size=100):
    params = {
        "q": query,
        "from": from_date,
        "to": to_date,
        "language": "en",
        "sortBy": "relevancy",
        "pageSize": page_size,
        "apiKey": NEWSAPI_KEY,
    }
    resp = requests.get(NEWSAPI_URL, params=params, timeout=20)

    if resp.status_code == 429:
        print(f"    [429] rate-limited on '{query}', waiting 10s...", file=sys.stderr)
        time.sleep(10)
        resp = requests.get(NEWSAPI_URL, params=params, timeout=20)

    if resp.status_code != 200:
        print(f"    [WARN] '{query}' returned {resp.status_code}: {resp.text[:150]}",
              file=sys.stderr)
        return []

    return resp.json().get("articles", [])


def collect_all_articles():
    to_date = datetime.now().date()
    from_date = to_date - timedelta(days=DAYS_BACK)

    all_articles = []
    seen_urls = set()

    print(f"  Fetching articles from {from_date} to {to_date}", file=sys.stderr)
    for query in QUERIES:
        articles = fetch_articles(query, str(from_date), str(to_date))
        print(f"  -> '{query}': {len(articles)} articles", file=sys.stderr)
        for a in articles:
            url = a.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_articles.append({
                    "query": query,
                    "title": a.get("title", "") or "",
                    "description": a.get("description", "") or "",
                    "publishedAt": a.get("publishedAt", ""),
                    "source": a.get("source", {}).get("name", ""),
                    "url": url,
                })
        time.sleep(1)

    return all_articles


# ---------------------------------------------------------------------------
# STEP 2: FinBERT scoring
# ---------------------------------------------------------------------------

def load_finbert():
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    print("  Loading FinBERT...", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained("ProsusAI/finbert")
    model = AutoModelForSequenceClassification.from_pretrained("ProsusAI/finbert")
    model.eval()
    return tokenizer, model


def score_sentiment(text, tokenizer, model):
    import torch
    if not text or not text.strip():
        return 0.0
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        probs = torch.nn.functional.softmax(model(**inputs).logits, dim=-1)[0]
    # FinBERT label order: 0=positive, 1=negative, 2=neutral
    return round(probs[0].item() - probs[1].item(), 4)


def score_all(articles, tokenizer, model):
    for i, a in enumerate(articles):
        text = f"{a['title']}. {a['description']}"
        a["sentiment_score"] = score_sentiment(text, tokenizer, model)
        if (i + 1) % 20 == 0:
            print(f"    Scored {i + 1}/{len(articles)}...", file=sys.stderr)
    return articles


# ---------------------------------------------------------------------------
# STEP 3: Aggregate + merge with existing monthly CSV
# ---------------------------------------------------------------------------

def aggregate_monthly(articles):
    if not articles:
        return pd.DataFrame(columns=["year_month", "sentiment_score", "article_count"])

    df = pd.DataFrame(articles)
    df["publishedAt"] = pd.to_datetime(df["publishedAt"], errors="coerce")
    df = df.dropna(subset=["publishedAt"])
    df["year_month"] = df["publishedAt"].dt.strftime("%Y-%m")

    monthly = (
        df.groupby("year_month")
        .agg(sentiment_score=("sentiment_score", "mean"),
             article_count=("sentiment_score", "count"))
        .reset_index()
    )
    monthly["sentiment_score"] = monthly["sentiment_score"].round(4)
    return monthly


def merge_with_existing(new_monthly):
    if os.path.exists(MONTHLY_CSV):
        existing = pd.read_csv(MONTHLY_CSV, dtype={"year_month": str})
        if not existing.empty:
            months_in_new = set(new_monthly["year_month"])
            existing = existing[~existing["year_month"].isin(months_in_new)]
            combined = pd.concat([existing, new_monthly], ignore_index=True)
        else:
            combined = new_monthly
    else:
        combined = new_monthly

    combined = combined.sort_values("year_month").reset_index(drop=True)
    return combined


# ---------------------------------------------------------------------------
# MAIN — called by NestJS DataPipelineService 
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "months_updated": 0,
        "articles_scored": 0,
    }

    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        if not NEWSAPI_KEY:
            raise RuntimeError("NEWSAPI_KEY not set in backend/.env")

        articles = collect_all_articles()

        if not articles:
            print("  No articles found this run — monthly CSV left unchanged.",
                  file=sys.stderr)
        else:
            if not csv_only:
                pd.DataFrame(articles).to_csv(RAW_CSV, index=False)

            tokenizer, model = load_finbert()
            articles = score_all(articles, tokenizer, model)

            new_monthly = aggregate_monthly(articles)
            combined = merge_with_existing(new_monthly)
            combined.to_csv(MONTHLY_CSV, index=False)

            result["months_updated"] = len(new_monthly)
            result["articles_scored"] = len(articles)

            print(f"  Saved -> {MONTHLY_CSV}", file=sys.stderr)
            print(new_monthly.to_string(index=False), file=sys.stderr)

    except Exception as e:
        # Non-fatal by design - data-pipeline.service.ts does not abort on
        # this step's failure. Logged as a warning there, not an error.
        result["status"] = "error"
        result["message"] = str(e)

    print(json.dumps(result))
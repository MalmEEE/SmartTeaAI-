"""
sentiment_pipeline.py

SmartTeaAI - FinBERT Sentiment Pipeline (forward-only, live data)

What this does:
1. Fetches recent tea-market news articles from NewsAPI (free tier: last ~30 days, English only)
2. Scores each article's sentiment using FinBERT (financial-domain BERT model)
3. Aggregates to a single monthly sentiment score in range [-1.0, +1.0]
4. Saves results to a CSV you can merge into your unified_dataset.csv

IMPORTANT - free tier limitation:
NewsAPI's free "Developer" plan only returns articles from roughly the last month.
This script CANNOT backfill historical sentiment for 2015-2026. It only produces
real sentiment values for the current/recent period going forward. Document this
explicitly in your dissertation's limitations section.

Setup (run once):
    pip install requests transformers torch pandas

Usage:
    Set your NewsAPI key as an environment variable (safer than hardcoding it):

    Windows (PowerShell):
        $env:NEWSAPI_KEY = "your_key_here"
        python sentiment_pipeline.py

    Windows (Command Prompt):
        set NEWSAPI_KEY=your_key_here
        python sentiment_pipeline.py

    Or, if you prefer, just paste your key into the NEWSAPI_KEY_FALLBACK variable
    below (only do this on your own machine, never commit it to GitHub).
"""

import os
import time
import json
from datetime import datetime, timedelta

import requests
import pandas as pd

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

NEWSAPI_KEY = os.environ.get("NEWSAPI_KEY", "")
NEWSAPI_KEY_FALLBACK = ""  # paste your key here ONLY if you don't want to use env vars

if not NEWSAPI_KEY:
    NEWSAPI_KEY = NEWSAPI_KEY_FALLBACK

if not NEWSAPI_KEY:
    raise SystemExit(
        "No NewsAPI key found. Set the NEWSAPI_KEY environment variable, "
        "or paste your key into NEWSAPI_KEY_FALLBACK in this script."
    )

NEWSAPI_URL = "https://newsapi.org/v2/everything"

# Queries covering the topics your literature review and proposal name as
# relevant international market drivers (export demand, global tea prices,
# key buyer markets, exchange rate context).
QUERIES = [
    "Ceylon tea",
    "Sri Lanka tea export",
    "Colombo tea auction",
    "global tea market price",
]

OUTPUT_DIR = "sentiment_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Step 1: Fetch articles from NewsAPI
# ---------------------------------------------------------------------------

def fetch_articles(query, from_date, to_date, page_size=100):
    """Fetch articles for a single query within a date range."""
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
        print(f"  Rate limited on query '{query}'. Waiting 10s...")
        time.sleep(10)
        resp = requests.get(NEWSAPI_URL, params=params, timeout=20)

    if resp.status_code != 200:
        print(f"  WARNING: query '{query}' returned status {resp.status_code}: {resp.text[:200]}")
        return []

    data = resp.json()
    articles = data.get("articles", [])
    print(f"  '{query}': {len(articles)} articles found")
    return articles


def collect_all_articles(days_back=29):
    """NewsAPI free tier only allows ~1 month back. Collect across all queries."""
    to_date = datetime.utcnow().date()
    from_date = to_date - timedelta(days=days_back)

    all_articles = []
    seen_urls = set()

    print(f"Fetching articles from {from_date} to {to_date}...\n")
    for query in QUERIES:
        articles = fetch_articles(query, str(from_date), str(to_date))
        for a in articles:
            url = a.get("url")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_articles.append({
                    "query": query,
                    "title": a.get("title", ""),
                    "description": a.get("description", "") or "",
                    "publishedAt": a.get("publishedAt", ""),
                    "source": a.get("source", {}).get("name", ""),
                    "url": url,
                })
        time.sleep(1)  # be polite between queries

    print(f"\nTotal unique articles collected: {len(all_articles)}")
    return all_articles


# ---------------------------------------------------------------------------
# Step 2: Score sentiment with FinBERT
# ---------------------------------------------------------------------------

def load_finbert():
    """Load FinBERT model. Downloads ~400MB on first run, then caches locally."""
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    import torch

    print("\nLoading FinBERT (first run downloads the model, ~400MB)...")
    model_name = "ProsusAI/finbert"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name)
    model.eval()
    print("FinBERT loaded.\n")
    return tokenizer, model


def score_sentiment(text, tokenizer, model):
    """
    Returns a single sentiment score in [-1.0, +1.0].
    FinBERT outputs probabilities for [positive, negative, neutral].
    We convert to a signed score: positive_prob - negative_prob.
    """
    import torch

    if not text or not text.strip():
        return 0.0

    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = torch.nn.functional.softmax(outputs.logits, dim=-1)[0]

    # FinBERT label order: 0=positive, 1=negative, 2=neutral
    positive_prob = probs[0].item()
    negative_prob = probs[1].item()

    score = positive_prob - negative_prob  # range: -1.0 to +1.0
    return round(score, 4)


def score_all_articles(articles, tokenizer, model):
    print(f"Scoring sentiment for {len(articles)} articles...")
    for i, article in enumerate(articles):
        # Combine title + description for more context per article
        text = f"{article['title']}. {article['description']}"
        article["sentiment_score"] = score_sentiment(text, tokenizer, model)
        if (i + 1) % 10 == 0:
            print(f"  Scored {i + 1}/{len(articles)}...")
    return articles


# ---------------------------------------------------------------------------
# Step 3: Aggregate to monthly score
# ---------------------------------------------------------------------------

def aggregate_monthly(articles):
    df = pd.DataFrame(articles)
    if df.empty:
        print("No articles to aggregate.")
        return pd.DataFrame(columns=["year_month", "sentiment_score", "article_count"])

    df["publishedAt"] = pd.to_datetime(df["publishedAt"], errors="coerce")
    df = df.dropna(subset=["publishedAt"])
    df["year_month"] = df["publishedAt"].dt.strftime("%Y-%m")

    monthly = (
        df.groupby("year_month")
        .agg(sentiment_score=("sentiment_score", "mean"), article_count=("sentiment_score", "count"))
        .reset_index()
    )
    monthly["sentiment_score"] = monthly["sentiment_score"].round(4)
    return monthly


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Step 1: collect articles (free tier ~ last 29 days)
    articles = collect_all_articles(days_back=29)

    if not articles:
        print("\nNo articles collected. Check your API key and query terms, then retry.")
        raise SystemExit(1)

    # Save raw articles for inspection/audit trail
    raw_path = os.path.join(OUTPUT_DIR, "raw_articles.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)
    print(f"Raw articles saved to {raw_path}")

    # Step 2: score with FinBERT
    tokenizer, model = load_finbert()
    articles = score_all_articles(articles, tokenizer, model)

    scored_path = os.path.join(OUTPUT_DIR, "scored_articles.csv")
    pd.DataFrame(articles).to_csv(scored_path, index=False)
    print(f"\nScored articles saved to {scored_path}")

    # Step 3: aggregate to monthly
    monthly_df = aggregate_monthly(articles)
    monthly_path = os.path.join(OUTPUT_DIR, "monthly_sentiment.csv")
    monthly_df.to_csv(monthly_path, index=False)

    print(f"\nMonthly sentiment saved to {monthly_path}")
    print("\n" + "=" * 50)
    print("MONTHLY SENTIMENT SUMMARY")
    print("=" * 50)
    print(monthly_df.to_string(index=False))
    print("\nNext step: merge monthly_sentiment.csv into unified_dataset.csv,")
    print("matching on year_month. Rows outside this range keep the existing")
    print("placeholder value (0.0), documented as a data availability limitation.")
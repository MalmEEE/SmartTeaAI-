"""
SmartTeaAI — FX (USD/LKR) Data Collector
==========================================
Scrapes daily USD/LKR spot exchange rates from the Central Bank of Sri Lanka (CBSL)
and aggregates to monthly avg/min/max. Exchange rate moves directly with tea export
prices (FOB is quoted in USD), so this is a strong ML feature.

Source page:
    https://www.cbsl.gov.lk/en/rates-and-indicators/exchange-rates/daily-indicative-usd-spot-exchange-rates
The actual data form lives in an iframe on that page:
    https://www.cbsl.gov.lk/cbsl_custom/exrates/exrates_spot_mid.php
which POSTs to exrates_results_spot_mid.php and returns the full date range
(no pagination) as an HTML table.

What gets saved:
    CSV  : data/fx_daily.csv          (raw daily LKR-per-USD rate)
           data/usd_lkr_monthly.csv   (monthly avg/min/max — ML feature)
    MySQL: raw_fx_daily table, then updates usd_lkr_avg in raw_sltb_features

Usage:
    python process_fx.py            ← scrape + save CSV + update MySQL
    python process_fx.py --csv-only ← scrape + save CSV only
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import os, sys, json
from datetime import date, datetime
from dotenv import load_dotenv

# Load DB credentials from the NestJS backend's .env so this script works
# whether it's invoked by the backend or run standalone (e.g. python process_fx.py)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

CBSL_BASE    = "https://www.cbsl.gov.lk/cbsl_custom/exrates"
LOOKUP_URL   = f"{CBSL_BASE}/exrates_spot_mid.php"
RESULTS_URL  = f"{CBSL_BASE}/exrates_results_spot_mid.php"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)",
    "Referer":    LOOKUP_URL,
}

DATA_DIR = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "smartteaai")

# Scrape from Jan 2020 — matches SLTB/weather data range
INITIAL_START_DATE = date(2020, 1, 1)

# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------

def clean_number(val):
    """'333.9788' -> 333.9788,  blank/dash -> None"""
    if val is None or str(val).strip() in ("", "-", "N/A", "n/a"):
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except ValueError:
        return None


def get_resume_point(csv_path):
    """
    Read existing daily CSV to find where to resume scraping.
    Re-fetches the last saved date (CBSL sometimes publishes/revises late).
    Returns (start_date, existing_df_without_last_date)
    """
    if not os.path.exists(csv_path):
        return INITIAL_START_DATE, None

    existing = pd.read_csv(csv_path, dtype=str)
    if "date" not in existing.columns or existing.empty:
        return INITIAL_START_DATE, None

    last_date_str = existing["date"].dropna().max()
    existing = existing[existing["date"] != last_date_str]  # drop last date to re-fetch
    y, m, d = (int(x) for x in last_date_str.split("-"))
    return date(y, m, d), existing


def fetch_daily_rates(start_date, end_date):
    """
    POST to the CBSL lookup form for USD/LKR spot rates.
    Returns a DataFrame with columns: date (YYYY-MM-DD), usd_lkr (LKR per 1 USD).
    CBSL returns the entire requested range in one response (no pagination).
    """
    data = {
        "lookupPage":    "lookup_daily_exchange_rates.php",
        "startRange":    "2006-11-11",
        "rangeType":     "dates",
        "txtStart":      start_date.strftime("%Y-%m-%d"),
        "txtEnd":        end_date.strftime("%Y-%m-%d"),
        "chk_cur[]":     "USD~US Dollar",
        "submit_button": "Submit",
    }
    resp = requests.post(RESULTS_URL, data=data, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    soup  = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table")
    if not table:
        return pd.DataFrame(columns=["date", "usd_lkr"])

    rows = []
    for tr in table.find_all("tr")[1:]:  # skip header row
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(cells) < 2:
            continue
        rows.append({"date": cells[0], "usd_lkr": clean_number(cells[1])})

    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# MYSQL
# ---------------------------------------------------------------------------

def get_db():
    try:
        import mysql.connector
    except ImportError:
        raise RuntimeError("pip install mysql-connector-python")
    return mysql.connector.connect(
        host=DB_HOST, port=DB_PORT,
        user=DB_USER, password=DB_PASS,
        database=DB_NAME
    )


def insert_raw_fx(df):
    """INSERT IGNORE — skips duplicate dates silently."""
    if df.empty:
        return 0
    conn   = get_db()
    cursor = conn.cursor()
    sql = "INSERT IGNORE INTO raw_fx_daily (`date`, usd_lkr) VALUES (%s, %s)"
    count = 0
    for _, row in df.iterrows():
        cursor.execute(sql, (row["date"], row.get("usd_lkr")))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


def update_features_table(monthly):
    """Update usd_lkr_avg in raw_sltb_features — key ML feature (export FOB is USD-quoted)."""
    if monthly.empty:
        return 0
    conn   = get_db()
    cursor = conn.cursor()
    sql = "UPDATE raw_sltb_features SET usd_lkr_avg = %s WHERE `year_month` = %s"
    count = 0
    for _, row in monthly.iterrows():
        cursor.execute(sql, (row.get("usd_lkr_avg"), row["year_month"]))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


# ---------------------------------------------------------------------------
# MAIN COLLECTION LOGIC
# ---------------------------------------------------------------------------

def collect_fx(csv_only=False):
    os.makedirs(DATA_DIR, exist_ok=True)
    daily_csv_path = os.path.join(DATA_DIR, "fx_daily.csv")

    start_date, existing_df = get_resume_point(daily_csv_path)
    end_date = date.today()

    if start_date > end_date:
        return 0, 0  # already up to date

    new_df = fetch_daily_rates(start_date, end_date)
    if new_df.empty:
        return 0, 0

    combined = pd.concat([existing_df, new_df], ignore_index=True) if existing_df is not None else new_df
    combined["usd_lkr"] = pd.to_numeric(combined["usd_lkr"], errors="coerce")
    combined = combined.drop_duplicates(subset="date").sort_values("date").reset_index(drop=True)
    combined.to_csv(daily_csv_path, index=False)

    # ── Aggregate to monthly (avg/min/max) — what the ML feature table reads ──
    combined["year_month"] = combined["date"].str[:7]
    monthly = combined.groupby("year_month").agg(
        usd_lkr_avg = ("usd_lkr", "mean"),
        usd_lkr_min = ("usd_lkr", "min"),
        usd_lkr_max = ("usd_lkr", "max"),
    ).reset_index()
    monthly["usd_lkr_avg"] = monthly["usd_lkr_avg"].round(4)
    monthly = monthly.sort_values("year_month")

    monthly_path = os.path.join(DATA_DIR, "usd_lkr_monthly.csv")
    monthly.to_csv(monthly_path, index=False)

    rows_inserted = 0
    rows_updated  = 0

    if not csv_only:
        # Insert the FULL history (not just new_df) — the CSV may already hold
        # dates that were never written to MySQL (e.g. from earlier --csv-only runs).
        # INSERT IGNORE + the table's UNIQUE KEY makes this safe to repeat every run.
        rows_inserted = insert_raw_fx(combined)
        rows_updated  = update_features_table(monthly)

    return rows_inserted, rows_updated


# ---------------------------------------------------------------------------
# MAIN — called by NestJS DataPipelineService
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status":           "ok",
        "timestamp":        datetime.now().isoformat(),
        "csv_only":         csv_only,
        "rows_inserted":    0,
        "features_updated": 0,
    }

    try:
        inserted, updated = collect_fx(csv_only=csv_only)
        result["rows_inserted"]    = inserted
        result["features_updated"] = updated

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)

    print(json.dumps(result))

"""
SmartTeaAI — Oil & Competitor Tea Price Collector
====================================================
Downloads the World Bank "Pink Sheet" monthly commodity price file
and extracts:
  1. Brent crude oil ($/bbl)     -> fuel/logistics cost proxy
  2. Tea, Colombo ($/kg, USD)    -> independent cross-check on auction
                                     price + competitor benchmark
                                     (NOTE: USD/kg, NOT the same as the
                                     LKR/kg SLTB auction price used as
                                     the actual ML target variable)
  3. Tea, Mombasa ($/kg, USD)    -> East African competitor tea price

Source: World Bank Commodity Markets (CMO) — updated monthly, free,
        no API key, no scraping of JS-rendered pages required.
        https://www.worldbank.org/en/research/commodity-markets

This is a STATIC FILE DOWNLOAD, not a dynamic search page like CBSL —
so unlike process_fx.py, this one IS fully automatable end-to-end.

Verified structure (CMO-Historical-Data-Monthly.xlsx, June 2026 edition):
    Sheet     : "Monthly Prices"
    Header row: 5   (column names)
    Units row : 6   ("($/bbl)", "($/kg)", etc.)
    Data starts: row 7
    Date format: "1960M01" style (YYYYMMM)
    Missing values: '…' (ellipsis character, not blank)

    Column "Crude oil, Brent" -> Brent crude, $/bbl
    Column "Tea, Colombo"     -> Colombo tea, $/kg (USD)
    Column "Tea, Mombasa"     -> Mombasa tea, $/kg (USD)

What gets saved:
    CSV  : data/oil_price_monthly.csv
    CSV  : data/competitor_tea_monthly.csv
    MySQL: raw_fuel_price.oil_brent_usd_bbl
    MySQL: raw_competitor_prices.mombasa_usd_kg
    Then : updates oil_price column in raw_sltb_features

Usage:
    python collect_oil.py            <- download + save CSV + update MySQL
    python collect_oil.py --csv-only <- download + save CSV only
"""

import requests
import pandas as pd
import os, sys, json, re
from datetime import datetime
from dotenv import load_dotenv

# Load DB credentials from the NestJS backend's .env so this script works
# whether it's invoked by the backend or run standalone (e.g. python collect_oil.py)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# World Bank Pink Sheet — monthly prices, updated ~monthly by World Bank
# This exact URL was verified live on 2026-06-23. If the link 404s in future
# (World Bank occasionally rotates the doc ID), get the fresh one from:
#   https://www.worldbank.org/en/research/commodity-markets
#   -> "Pink Sheet Data" column -> right-click "Monthly prices" -> copy link
PINK_SHEET_URL = (
    "https://thedocs.worldbank.org/en/doc/"
    "74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/"
    "CMO-Historical-Data-Monthly.xlsx"
)

SHEET_NAME  = "Monthly Prices"
HEADER_ROW  = 5    # 1-indexed: row containing column names like "Crude oil, Brent"
DATA_START  = 7    # 1-indexed: first row of actual monthly data

# Exact verified column names — confirmed against the live file on 2026-06-23.
# No fuzzy matching needed; these are the literal header strings.
COL_BRENT       = "Crude oil, Brent"      # $/bbl  -> fuel/logistics proxy
COL_TEA_COLOMBO = "Tea, Colombo"          # $/kg (USD) -> cross-check vs SLTB LKR price
COL_TEA_MOMBASA = "Tea, Mombasa"          # $/kg (USD) -> East African competitor price

DATA_DIR     = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
RAW_XLSX     = os.path.join(DATA_DIR, "cmo_monthly_raw.xlsx")
OUT_OIL_CSV  = os.path.join(DATA_DIR, "oil_price_monthly.csv")
OUT_TEA_CSV  = os.path.join(DATA_DIR, "competitor_tea_monthly.csv")

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "smartteaai")

START_YEAR_MONTH = "2015-01"   # matches extended dataset start
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research collector)"}


# ---------------------------------------------------------------------------
# DOWNLOAD
# ---------------------------------------------------------------------------

def download_pink_sheet():
    """Download the World Bank monthly commodity Excel file."""
    os.makedirs(DATA_DIR, exist_ok=True)
    resp = requests.get(PINK_SHEET_URL, headers=HEADERS, timeout=60)
    resp.raise_for_status()

    if len(resp.content) < 10_000:
        raise RuntimeError(
            "Downloaded file is suspiciously small — the World Bank link "
            "may have changed. Get a fresh URL from "
            "https://www.worldbank.org/en/research/commodity-markets "
            "(right-click 'Monthly prices' -> Copy link)."
        )

    with open(RAW_XLSX, "wb") as f:
        f.write(resp.content)


def parse_date(raw_date):
    """'1960M01' -> '1960-01'. Returns None if format doesn't match."""
    s = str(raw_date).strip()
    m = re.match(r"^(\d{4})M(\d{2})$", s)
    return f"{m.group(1)}-{m.group(2)}" if m else None


def clean_value(val):
    """World Bank uses '…' (ellipsis) for missing data, not blank cells."""
    if val is None:
        return None
    s = str(val).strip()
    if s in ("…", "...", "", "-", "N/A"):
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def parse_commodity_data():
    """
    Reads the downloaded Pink Sheet using verified row/column positions.
    Returns two DataFrames:
        oil_df: year_month | oil_brent_usd_bbl
        tea_df: year_month | tea_colombo_usd_kg | mombasa_usd_kg
    """
    df = pd.read_excel(RAW_XLSX, sheet_name=SHEET_NAME, header=HEADER_ROW - 1)
    df.columns = [str(c).strip() for c in df.columns]

    date_col = df.columns[0]   # first column is always the date, regardless of its label

    for required in [COL_BRENT, COL_TEA_COLOMBO, COL_TEA_MOMBASA]:
        if required not in df.columns:
            raise RuntimeError(
                f"Expected column '{required}' not found. "
                f"World Bank may have renamed it in this edition. "
                f"Available columns: {list(df.columns)[:20]} ..."
            )

    df["year_month"] = df[date_col].apply(parse_date)
    df = df[df["year_month"].notna()]
    df = df[df["year_month"] >= START_YEAR_MONTH]

    oil_df = df[["year_month", COL_BRENT]].copy()
    oil_df.columns = ["year_month", "oil_brent_usd_bbl"]
    oil_df["oil_brent_usd_bbl"] = oil_df["oil_brent_usd_bbl"].apply(clean_value)
    oil_df = oil_df.dropna(subset=["oil_brent_usd_bbl"])
    oil_df["oil_brent_usd_bbl"] = oil_df["oil_brent_usd_bbl"].round(4)

    tea_df = df[["year_month", COL_TEA_COLOMBO, COL_TEA_MOMBASA]].copy()
    tea_df.columns = ["year_month", "tea_colombo_usd_kg", "mombasa_usd_kg"]
    tea_df["tea_colombo_usd_kg"] = tea_df["tea_colombo_usd_kg"].apply(clean_value)
    tea_df["mombasa_usd_kg"]     = tea_df["mombasa_usd_kg"].apply(clean_value)
    tea_df = tea_df.dropna(subset=["mombasa_usd_kg"], how="all")
    tea_df[["tea_colombo_usd_kg", "mombasa_usd_kg"]] = \
        tea_df[["tea_colombo_usd_kg", "mombasa_usd_kg"]].round(4)

    oil_df = oil_df.sort_values("year_month").reset_index(drop=True)
    tea_df = tea_df.sort_values("year_month").reset_index(drop=True)

    return oil_df, tea_df


# ---------------------------------------------------------------------------
# MYSQL  (same pattern as collect_weather.py / process_fx.py)
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


def upsert_fuel_price(df):
    """Insert/update raw_fuel_price.oil_brent_usd_bbl. Leaves diesel_lkr_litre untouched."""
    if df.empty:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        INSERT INTO raw_fuel_price (`year_month`, oil_brent_usd_bbl)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE
            oil_brent_usd_bbl = VALUES(oil_brent_usd_bbl)
    """
    count = 0
    for _, row in df.iterrows():
        cursor.execute(sql, (row["year_month"], row["oil_brent_usd_bbl"]))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


def upsert_competitor_prices(df):
    """Insert/update raw_competitor_prices.mombasa_usd_kg."""
    if df.empty:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        INSERT INTO raw_competitor_prices (`year_month`, mombasa_usd_kg)
        VALUES (%s, %s)
        ON DUPLICATE KEY UPDATE
            mombasa_usd_kg = VALUES(mombasa_usd_kg)
    """
    count = 0
    for _, row in df.iterrows():
        if pd.notna(row["mombasa_usd_kg"]):
            cursor.execute(sql, (row["year_month"], row["mombasa_usd_kg"]))
            count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


def update_features_table(df):
    """Update oil_price column in raw_sltb_features — same pattern as weather/FX."""
    if df.empty:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        UPDATE raw_sltb_features
        SET oil_price = %s
        WHERE `year_month` = %s
    """
    count = 0
    for _, row in df.iterrows():
        cursor.execute(sql, (row["oil_brent_usd_bbl"], row["year_month"]))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


# ---------------------------------------------------------------------------
# MAIN — called by NestJS DataPipelineService
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status":                "ok",
        "timestamp":             datetime.now().isoformat(),
        "csv_only":              csv_only,
        "oil_rows_saved":        0,
        "competitor_rows_saved": 0,
        "features_updated":      0,
    }

    try:
        print("Downloading World Bank Pink Sheet...", file=sys.stderr)
        download_pink_sheet()

        print("Parsing Brent crude oil + competitor tea prices...", file=sys.stderr)
        oil_df, tea_df = parse_commodity_data()

        oil_df.to_csv(OUT_OIL_CSV, index=False)
        tea_df.to_csv(OUT_TEA_CSV, index=False)

        print(f"Saved {len(oil_df)} months oil -> {OUT_OIL_CSV}", file=sys.stderr)
        print(f"Saved {len(tea_df)} months competitor tea -> {OUT_TEA_CSV}", file=sys.stderr)
        print(oil_df.tail(5), file=sys.stderr)
        print(tea_df.tail(5), file=sys.stderr)

        if not csv_only:
            result["oil_rows_saved"]        = upsert_fuel_price(oil_df)
            result["competitor_rows_saved"] = upsert_competitor_prices(tea_df)
            result["features_updated"]      = update_features_table(oil_df)

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)

    print(json.dumps(result))
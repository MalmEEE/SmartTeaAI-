"""
SmartTeaAI — Weather Data Collector
=====================================
Collects monthly rainfall and temperature for the 5 main
Sri Lankan tea-growing regions using Open-Meteo Historical API.

No API key required. Data available from 1940 onwards (ERA5).

Regions covered (matched to SLTB elevation categories):
    High Grown  → Nuwara Eliya, Badulla
    Medium Grown→ Kandy
    Low Grown   → Ratnapura, Galle

What gets saved:
    CSV  : data/weather_regions.csv
    MySQL: raw_weather table (raw daily → monthly aggregates)
    Then : updates rainfall_mm + avg_temp_c in raw_sltb_features

Usage:
    python collect_weather.py            ← fetch + save CSV + update MySQL
    python collect_weather.py --csv-only ← fetch + save CSV only
"""

import requests
import pandas as pd
import os, sys, json, time
from datetime import datetime
from regions import TEA_REGIONS
from dotenv import load_dotenv

# Load DB credentials from the NestJS backend's .env so this script works
# whether it's invoked by the backend or run standalone (e.g. python collect_weather.py)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# Open-Meteo Historical Weather API — no key needed
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# 5 tea-growing regions with coordinates and elevation category
# Coordinates verified against known tea estate locations in Sri Lanka
REGIONS = TEA_REGIONS  # all 23 sub-districts — see regions.py

# Variables to fetch from Open-Meteo (daily resolution — we aggregate to monthly)
DAILY_VARIABLES = [
    "temperature_2m_max",    # daily max temp °C
    "temperature_2m_min",    # daily min temp °C
    "precipitation_sum",     # daily total rainfall mm
]

# Scrape from Jan 2020 to match SLTB data range
INITIAL_START_YEAR  = 2020
INITIAL_START_MONTH = 1

DATA_DIR = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "smartteaai")

DELAY_SECONDS = 1.0  # be polite to Open-Meteo

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------

def get_resume_point(csv_path):
    """Find last saved year_month so we only fetch new data."""
    if not os.path.exists(csv_path):
        return INITIAL_START_YEAR, INITIAL_START_MONTH

    df = pd.read_csv(csv_path, dtype=str)
    if "year_month" not in df.columns or df.empty:
        return INITIAL_START_YEAR, INITIAL_START_MONTH

    last_ym = df["year_month"].dropna().max()
    # Re-fetch last month in case of late updates
    y, m = int(last_ym[:4]), int(last_ym[5:7])
    return y, m


def fetch_region_monthly(region, start_year, start_month, end_year, end_month):
    """
    Fetch daily weather for one region from Open-Meteo,
    aggregate to monthly averages/totals.
    Returns a DataFrame with columns:
        year_month | region | elevation | rainfall_mm | avg_temp_c | min_temp_c | max_temp_c
    """
    import calendar
    from datetime import date, timedelta

    start_date = f"{start_year:04d}-{start_month:02d}-01"

    # Cap to yesterday — Open-Meteo archive has no future data
    last_day   = calendar.monthrange(end_year, end_month)[1]
    wanted_end = date(end_year, end_month, last_day)
    yesterday  = date.today() - timedelta(days=1)
    end_date   = min(wanted_end, yesterday).strftime("%Y-%m-%d")

    params = {
        "latitude":   region["lat"],
        "longitude":  region["lon"],
        "start_date": start_date,
        "end_date":   end_date,
        "daily":      ",".join(DAILY_VARIABLES),
        "timezone":   "Asia/Colombo",
    }

    try:
        resp = requests.get(ARCHIVE_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        print(f"    ✗ Failed to fetch {region['name']}: {e}")
        return pd.DataFrame()

    daily = data.get("daily", {})
    if not daily or "time" not in daily:
        return pd.DataFrame()

    # Build daily DataFrame
    df = pd.DataFrame({
        "date":         pd.to_datetime(daily["time"]),
        "temp_max":     daily.get("temperature_2m_max", []),
        "temp_min":     daily.get("temperature_2m_min", []),
        "rainfall_mm":  daily.get("precipitation_sum", []),
    })

    df["year_month"] = df["date"].dt.to_period("M").astype(str)

    # Aggregate daily → monthly
    monthly = df.groupby("year_month").agg(
        rainfall_mm  = ("rainfall_mm", "sum"),    # total monthly rainfall
        avg_temp_c   = ("temp_max",    "mean"),   # mean of daily max (standard for agri)
        min_temp_c   = ("temp_min",    "min"),    # coldest day of month
        max_temp_c   = ("temp_max",    "max"),    # hottest day of month
    ).reset_index()

    monthly["region"]    = region["name"]
    monthly["elevation"] = region["elevation"]

    return monthly


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


def insert_raw_weather(df):
    """Insert all rows into raw_weather table."""
    if df.empty:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        INSERT IGNORE INTO raw_weather
            (`year_month`, region, elevation, rainfall_mm, avg_temp_c, min_temp_c, max_temp_c)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
    """
    count = 0
    for _, row in df.iterrows():
        cursor.execute(sql, (
            row["year_month"], row["region"], row["elevation"],
            row.get("rainfall_mm"), row.get("avg_temp_c"),
            row.get("min_temp_c"), row.get("max_temp_c"),
        ))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


def update_features_table(monthly_avg):
    """
    Update rainfall_mm and avg_temp_c in raw_sltb_features.
    Uses average across all 5 regions per month — national signal.
    """
    if monthly_avg.empty:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    sql = """
        UPDATE raw_sltb_features
        SET rainfall_mm = %s,
            avg_temp_c  = %s
        WHERE `year_month` = %s
    """
    count = 0
    for _, row in monthly_avg.iterrows():
        cursor.execute(sql, (
            row.get("rainfall_mm"),
            row.get("avg_temp_c"),
            row["year_month"],
        ))
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


# ---------------------------------------------------------------------------
# MAIN COLLECTION LOGIC
# ---------------------------------------------------------------------------

def collect_weather(csv_only=False):
    os.makedirs(DATA_DIR, exist_ok=True)
    csv_path = os.path.join(DATA_DIR, "weather_regions.csv")

    # Find resume point from existing CSV
    start_y, start_m = get_resume_point(csv_path)

    now     = datetime.now()
    end_y   = now.year
    end_m   = now.month

    print(f"  Fetching weather from {start_y}-{start_m:02d} to {end_y}-{end_m:02d}")
    print(f"  Regions: {[r['name'] for r in REGIONS]}")

    all_frames = []

    for region in REGIONS:
        print(f"  → {region['name']} ({region['elevation']} Grown)...", end=" ", flush=True)
        df = fetch_region_monthly(region, start_y, start_m, end_y, end_m)
        if not df.empty:
            all_frames.append(df)
            print(f"✓  ({len(df)} months)")
        else:
            print("✗  no data")
        time.sleep(DELAY_SECONDS)

    if not all_frames:
        return 0, 0

    new_data = pd.concat(all_frames, ignore_index=True)

    # Merge with existing CSV (drop last month rows to re-fetch)
    if os.path.exists(csv_path):
        existing = pd.read_csv(csv_path, dtype=str)
        if not existing.empty and "year_month" in existing.columns:
            last_ym = existing["year_month"].max()
            existing = existing[existing["year_month"] != last_ym]
            new_data = pd.concat([existing, new_data], ignore_index=True)

    new_data.to_csv(csv_path, index=False)
    print(f"\n  ✓ Weather CSV saved: {len(new_data)} rows → {csv_path}")

    # Compute national monthly average (across all regions) for raw_sltb_features
    monthly_avg = new_data.groupby("year_month").agg(
        rainfall_mm = ("rainfall_mm", "mean"),
        avg_temp_c  = ("avg_temp_c",  "mean"),
    ).reset_index()

    # Save national average CSV too
    avg_path = os.path.join(DATA_DIR, "weather_national_avg.csv")
    monthly_avg.to_csv(avg_path, index=False)

    rows_inserted  = 0
    rows_updated   = 0

    if not csv_only:
        rows_inserted = insert_raw_weather(
            new_data[new_data.columns.intersection(
                ["year_month","region","elevation","rainfall_mm","avg_temp_c","min_temp_c","max_temp_c"]
            )]
        )
        rows_updated = update_features_table(monthly_avg)

    return rows_inserted, rows_updated


# ---------------------------------------------------------------------------
# MAIN — called by NestJS DataPipelineService
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status":         "ok",
        "timestamp":      datetime.now().isoformat(),
        "csv_only":       csv_only,
        "rows_inserted":  0,
        "features_updated": 0,
    }

    try:
        inserted, updated = collect_weather(csv_only=csv_only)
        result["rows_inserted"]     = inserted
        result["features_updated"]  = updated

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)

    print(json.dumps(result))
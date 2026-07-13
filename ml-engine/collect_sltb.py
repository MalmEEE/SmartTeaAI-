"""
SmartTeaAI — SLTB Data Collector
==================================
Collects all 6 categories from the Sri Lanka Tea Board statistics page.
After scraping, merges everything into raw_sltb_features table —
one row per month per elevation — ready for the ML feature pipeline.

Data sources collected here:
  - Sub District Price      → Year | Sub District | Month Price (Rs) | Cumulative Price (Rs)
  - Sales Volume Direct     → Year | Sale Type | Elevation | Quantity (Kg) | Price (Rs.)
  - Production by Process   → Year | Processing Method | Quantity (Kg)
  - Production by Elevation → Year | Elevation | Quantity (Kg)
  - Export                  → Year | Category | Package Type | Quantity (Kg) | Price (Rs.)
  - Reexport                → Year | Category | Package Type | Quantity (Kg) | Price (Rs.)

The site uses a two-step WordPress AJAX flow:
  Step 1: POST action=ajaxteaprice, req_type=teaprice_category → available year-months
  Step 2: POST action=ajaxteaprice, req_type=teaprice_data     → HTML table

Output to NestJS (stdout): JSON with status and row counts.

Usage:
    python collect_sltb.py            ← scrape + save CSV + insert MySQL
    python collect_sltb.py --csv-only ← scrape + save CSV only (for testing)
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import time, os, sys, json
from datetime import datetime
from dotenv import load_dotenv

# Load DB credentials from the NestJS backend's .env so this script works
# whether it's invoked by the backend or run standalone (e.g. python collect_sltb.py)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

BASE_URL = "https://srilankateaboard.lk/tea-statistics/"
AJAX_URL = "https://srilankateaboard.lk/wp-admin/admin-ajax.php"

# WordPress post IDs for each category (from the <select id="teaprice-category"> options)
CATEGORIES = {
    "sub_district_price":          "1982",
    "sales_volume_direct":         "2176",
    "production_volume_process":   "2595",
    "production_volume_elevation": "2371",
    "export":                      "1692",
    "reexport":                    "1789",
}

# Elevations used in the ML model
# Maps SLTB labels → standard labels used across all tables
ELEVATION_MAP = {
    "high":         "High",
    "high growns":  "High",
    "high grown":   "High",
    "medium":       "Medium",
    "medium grown": "Medium",
    "medium growns":"Medium",
    "low":          "Low",
    "low grown":    "Low",
    "low growns":   "Low",
}

DATA_DIR = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "smartteaai")

# Scrape from Jan 2020 — enough historical data for ML training
INITIAL_START_YEAR  = 2020
INITIAL_START_MONTH = 1

DELAY_SECONDS = 1.5
HEADERS = {"User-Agent": "Mozilla/5.0 (SmartTeaAI/FYP research scraper)"}

# ---------------------------------------------------------------------------
# UTILITIES
# ---------------------------------------------------------------------------

def clean_number(val):
    """'1,114.51' → 1114.51,  blank/dash → None"""
    if val is None or str(val).strip() in ("", "-", "N/A", "n/a"):
        return None
    try:
        return float(str(val).replace(",", "").strip())
    except ValueError:
        return None


def pick(row, *names, pos=None):
    """
    Resilient column lookup: tries each name variant in order, then falls back
    to column position. Guards against SLTB silently renaming table headers.

    Usage:  pick(row, "Processing Method", "Process", pos=1)
    """
    for name in names:
        val = row.get(name)
        if val is not None and str(val).strip() not in ("", "-"):
            return val
    if pos is not None:
        cols = list(row.values())
        if pos < len(cols) and str(cols[pos]).strip() not in ("", "-"):
            return cols[pos]
    return None


def normalise_elevation(raw):
    """Map any SLTB elevation label to High / Medium / Low / Total"""
    if not raw:
        return None
    key = raw.strip().lower()
    if key.startswith("total") or key == "tota":
        return "Total"
    return ELEVATION_MAP.get(key, raw.strip())


def get_resume_point(csv_path):
    """
    Read existing CSV to find where to resume scraping.
    Re-fetches the last saved month (SLTB sometimes publishes late).
    Returns (start_ym_str, existing_df_without_last_month)
      where start_ym_str is "YYYY-MM" or None (meaning start from INITIAL_*)
    """
    if not os.path.exists(csv_path):
        return None, None

    existing = pd.read_csv(csv_path, dtype=str)
    col = "year_month"
    if col not in existing.columns or existing.empty:
        return None, None

    last_ym = existing[col].dropna().max()
    existing = existing[existing[col] != last_ym]  # drop last month to re-fetch
    return last_ym, existing


def get_nonce(session):
    """Fetch the SLTB stats page and extract the wpsecurity nonce."""
    resp = session.get(BASE_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    inp = soup.find("input", {"name": "wpsecurity"})
    if not inp:
        raise RuntimeError("Could not find wpsecurity nonce on SLTB page")
    return inp["value"]


def fetch_available_months(session, nonce, category_id):
    """
    Step 1: POST to get the list of available year-months for a category.
    Returns sorted list of 'YYYY-MM' strings.
    """
    resp = session.post(AJAX_URL, data={
        "action":            "ajaxteaprice",
        "selected_category": category_id,
        "req_type":          "teaprice_category",
        "wpsecurity":        nonce,
    }, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    d = resp.json()
    opts_html = d.get("htmloptions", "")
    if not opts_html:
        return []
    soup = BeautifulSoup(opts_html, "html.parser")
    return sorted(
        o["value"] for o in soup.find_all("option")
        if o.get("value") and o["value"].strip()
    )


def fetch_table_for_month(session, nonce, category_id, year_month):
    """
    Step 2: POST to fetch the HTML table for one category + year-month.
    Returns list of row dicts, or None if no table.
    """
    resp = session.post(AJAX_URL, data={
        "action":            "ajaxteaprice",
        "selected_category": category_id,
        "selected_year":     year_month,
        "req_type":          "teaprice_data",
        "wpsecurity":        nonce,
    }, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    d = resp.json()
    html = d.get("htmloptions", "")
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table")
    if not table:
        return None

    header_cells, rows = [], []
    for i, tr in enumerate(table.find_all("tr")):
        cells = [td.get_text(strip=True) for td in tr.find_all(["th", "td"])]
        if i == 0:
            header_cells = cells
        elif any(c.strip() for c in cells):
            rows.append(cells)

    if not header_cells or not rows:
        return None

    n = len(header_cells)
    return [dict(zip(header_cells, (row + [""] * n)[:n])) for row in rows]


# ---------------------------------------------------------------------------
# CATEGORY PARSERS
# Each returns a list of clean dicts matching their raw table schema.
# Column names match what the SLTB AJAX actually returns (verified 2026-06).
# ---------------------------------------------------------------------------

def parse_sub_district_price(rows, year_month):
    """
    Col 0: Year (repeated)  Col 1: Sub District
    Col 2: Monthly price    Col 3: Cumulative price
    Known name variants for col 2: "Month Price (Rs)", "Monthly AVG (kg/Rs)"
    Known name variants for col 3: "Cumulative Price (Rs)", "CUM AVG (kg/Rs)"
    """
    records, last_date = [], year_month
    for row in rows:
        d = (pick(row, "Year", pos=0) or "").strip()
        if d:
            last_date = d
        sub = (pick(row, "Sub District", pos=1) or "").strip()
        if not sub or sub.lower() == "total":
            continue
        records.append({
            "year_month":   last_date,
            "sub_district": sub,
            "monthly_avg":  clean_number(pick(row, "Month Price (Rs)", "Monthly AVG (kg/Rs)", pos=2)),
            "cum_avg":      clean_number(pick(row, "Cumulative Price (Rs)", "CUM AVG (kg/Rs)", pos=3)),
        })
    return records


def parse_production_volume_elevation(rows, year_month):
    """
    Col 0: Year  Col 1: Elevation  Col 2: Quantity (Kg)
    """
    records = []
    for row in rows:
        elev = normalise_elevation(pick(row, "Elevation", pos=1) or "")
        if not elev:
            continue
        records.append({
            "year_month":  year_month,
            "elevation":   elev,
            "quantity_kg": clean_number(pick(row, "Quantity (Kg)", pos=2)),
        })
    return records


def parse_production_volume_process(rows, year_month):
    """
    Col 0: Year  Col 1: Process name  Col 2: Quantity (Kg)
    Known name variants for col 1: "Processing Method", "Process"
    """
    records = []
    for row in rows:
        process = (pick(row, "Processing Method", "Process", pos=1) or "").strip()
        if not process or process.upper() == "TOTAL":
            continue
        records.append({
            "year_month":  year_month,
            "process":     process,
            "quantity_kg": clean_number(pick(row, "Quantity (Kg)", pos=2)),
        })
    return records


def parse_sales_volume_direct(rows, year_month):
    """
    Col 0: Year/Sale Type (merged)  Col 1: Elevation
    Col 2: Quantity (Kg)            Col 3: Price
    Known name variants for price col: "Price (Rs.)", "Price (Rs)"
    """
    records, last_sale_type = [], ""
    for row in rows:
        p = (pick(row, "Sale Type", pos=0) or "").strip()
        if p:
            last_sale_type = p
        elev = normalise_elevation(pick(row, "Elevation", pos=1) or "")
        if not elev or elev == "Total":
            continue
        records.append({
            "year_month":  year_month,
            "process":     last_sale_type,
            "elevation":   elev,
            "quantity_kg": clean_number(pick(row, "Quantity (Kg)", pos=2)),
            "price_rs":    clean_number(pick(row, "Price (Rs.)", "Price (Rs)", pos=3)),
        })
    return records


def parse_export(rows, year_month):
    """
    Col 0: Year/Category (merged)  Col 1: Package Type
    Col 2: Quantity (Kg)           Col 3: Price (FOB)
    Known name variants for price col: "Price (Rs.)", "Price (Rs)"
    """
    records, last_cat = [], ""
    for row in rows:
        c = (pick(row, "Category", pos=0) or "").strip()
        if c:
            last_cat = c
        pkg = (pick(row, "Package Type", pos=1) or "").strip()
        if not pkg or "total" in pkg.lower():
            continue
        records.append({
            "year_month":    year_month,
            "tea_category":  last_cat,
            "package_type":  pkg,
            "quantity_kg":   clean_number(pick(row, "Quantity (Kg)", pos=2)),
            "fob_rs_per_kg": clean_number(pick(row, "Price (Rs.)", "Price (Rs)", pos=3)),
        })
    return records


def parse_reexport(rows, year_month):
    """Same structure as Export."""
    return parse_export(rows, year_month)


# Parser registry
PARSERS = {
    "sub_district_price":          parse_sub_district_price,
    "production_volume_elevation": parse_production_volume_elevation,
    "production_volume_process":   parse_production_volume_process,
    "sales_volume_direct":         parse_sales_volume_direct,
    "export":                      parse_export,
    "reexport":                    parse_reexport,
}

# Raw MySQL table names (one per category — audit layer)
RAW_TABLES = {
    "sub_district_price":          "raw_sltb_sub_district_price",
    "production_volume_elevation": "raw_sltb_production_elevation",
    "production_volume_process":   "raw_sltb_production_process",
    "sales_volume_direct":         "raw_sltb_sales_volume",
    "export":                      "raw_sltb_export",
    "reexport":                    "raw_sltb_reexport",
}

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


def insert_ignore(records, table_name):
    """INSERT IGNORE — skips duplicate rows silently."""
    if not records:
        return 0
    conn = get_db()
    cursor = conn.cursor()
    cols         = list(records[0].keys())
    col_str      = ", ".join(f"`{c}`" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    sql          = f"INSERT IGNORE INTO `{table_name}` ({col_str}) VALUES ({placeholders})"
    count = 0
    for rec in records:
        cursor.execute(sql, [rec.get(c) for c in cols])
        count += cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return count


# ---------------------------------------------------------------------------
# FEATURE BUILDER
# Merges all scraped data into raw_sltb_features (one row per month/elevation)
# This is what the ML pipeline reads
# ---------------------------------------------------------------------------

def build_features(csv_only=False):
    """
    Reads the 6 raw CSVs and merges them into one ML-ready structure.
    One row = one month × one elevation (High / Medium / Low).
    Saves to raw_sltb_features.csv and MySQL table raw_sltb_features.
    """
    os.makedirs(DATA_DIR, exist_ok=True)

    def load(key):
        path = os.path.join(DATA_DIR, f"sltb_{key}.csv")
        return pd.read_csv(path) if os.path.exists(path) else pd.DataFrame()

    price_df  = load("sub_district_price")
    sales_df  = load("sales_volume_direct")
    elev_df   = load("production_volume_elevation")
    proc_df   = load("production_volume_process")
    exp_df    = load("export")

    if price_df.empty:
        return 0  # nothing to build yet

    # ── Sub-district price → elevation-aggregated auction price ───────────────
    # SLTB stopped publishing price_rs in the Sales Volume Direct table from
    # 2022-02 onwards. sltb_sub_district_price has full 2020-2026 coverage and
    # is the authoritative auction price source. We map sub-districts to the
    # three standard elevation tiers and compute a mean monthly price per tier.
    SUBDISTRICT_ELEVATION = {
        # High Grown (>1200m)
        "NUWARA ELIYA":                     "High",
        "RAMBODA":                          "High",
        "PUNDALUOYA":                       "High",
        "AGARAPATANA":                      "High",
        "NANUOYA LINDULA TALAWAKELE":       "High",
        "NANUOYA/LINDULA/TALAWAKELE":       "High",
        "PATANA KOTAGALA":                  "High",
        "HATTON DICKOYA":                   "High",
        "HATTON/DICKOYA":                   "High",
        "BOGAWANTALAWA":                    "High",
        "UPCOT MASKELIYAB8":                "High",
        "UPCOT/MASKELIYA":                  "High",
        "WATAWALA GINIGAT NOTRON":          "High",
        "WATAWALA/GINIGAT/NORTON":          "High",
        "MATURATA":                         "High",
        "KOTHMALE":                         "High",
        "KOTMALE":                          "High",
        # Medium Grown (600-1200m)
        "KANDY MATALE KURUNEGALA":          "Medium",
        "KANDY/MATALE/KURUNEGALA":          "Medium",
        "GAMPOLA NAWALAPITIYA DOLOSBAGE":   "Medium",
        "GAMPOLA/NAWALAPITIYA/DOLOSBAGE":   "Medium",
        "PUSSELLAWA HEWAHETA":              "Medium",
        "PUSSELLAWA/HEWAHETA":              "Medium",
        "BANDARAWELA POONAGALLA":           "Medium",
        "BANDARAWELA/POONAGALLA":           "Medium",
        "UDAPUSSELLAWA HALGRANOYA":         "Medium",
        "UDAPUSSELLAWA/HALGRANOYA":         "Medium",
        "NILAMBE HANTANE GALAHA":           "Medium",
        "NILAMBE/HANTANE/GALAHA":           "Medium",
        "HAPUTALE":                         "Medium",
        "ELLA NAMUNUKULA":                  "Medium",
        "ELLA/NAMUNUKULA":                  "Medium",
        "DEMODARA HALIELLA BADULLA":        "Medium",
        "DEMODARA/HALIELLA/BADULLA":        "Medium",
        "MALWATTE WELIMADA":                "Medium",
        "MALWATTE/WELIMADA":                "Medium",
        "KOSLANDA HALDUMULLA":              "Medium",
        "KOSLANDA/HALDUMULLA":              "Medium",
        "MADULKELLE KNUCKLES":              "Medium",
        "MADULKELLE KNUCKLES RANGA":        "Medium",
        "PASSARA LUNUGALLA":                "Medium",
        "PASSARA/LUNUGALLA":                "Medium",
        "MADULSIMA":                        "Medium",
        "HUNASGIRIYA MATALE YAKDESSA":      "Medium",
        "HUNASGIRIYA/MATALE":              "Medium",
        "KADUGANNAWA":                      "Medium",
        # Low Grown (<600m)
        "GALLE":                            "Low",
        "KALUTARA":                         "Low",
        "KEGALLE":                          "Low",
        "RATNAPURA":                        "Low",
        "MATARA":                           "Low",
        "DENIYAYA":                         "Low",
        "MORAWAKA":                         "Low",
        "MORAWAKE":                         "Low",
        "BALANGODA":                        "Low",
        "BALANGODA RAKWANA":                "Low",
        "BALANGODA/RAKWANA":                "Low",
        "KELLANI VELLI":                    "Low",
        "KALANY VELLY":                     "Low",
        "COLOMBO":                          "Low",
    }

    price_elev = price_df.copy()
    price_elev["elevation"] = price_elev["sub_district"].map(SUBDISTRICT_ELEVATION)
    unmapped = price_elev[price_elev["elevation"].isna()]["sub_district"].unique()
    if len(unmapped):
        print(f"  [WARN] {len(unmapped)} unmapped sub-districts (excluded from price avg): "
              f"{list(unmapped)}", file=sys.stderr)
    price_elev = price_elev[price_elev["elevation"].notna()]

    price_pivot = price_elev.groupby(["year_month", "elevation"]).agg(
        monthly_avg=("monthly_avg", "mean")
    ).reset_index()
    price_pivot = price_pivot.pivot(index="year_month", columns="elevation",
                                    values="monthly_avg")
    price_pivot.columns = [f"price_{e.lower()}_rs" for e in price_pivot.columns]
    price_pivot = price_pivot.reset_index()

    # ── Sales Volume: quantity pivot only (price_rs unusable post-2022) ───────
    sales_pivot = pd.DataFrame()
    if not sales_df.empty:
        sv = sales_df[
            (sales_df["elevation"].isin(["High", "Medium", "Low"])) &
            (sales_df["quantity_kg"].notna())
        ].copy()
        qty_pivot = sv.pivot_table(
            index="year_month",
            columns="elevation",
            values="quantity_kg",
            aggfunc="sum"
        )
        qty_pivot.columns = [f"sales_qty_{e.lower()}_kg" for e in qty_pivot.columns]
        sales_pivot = qty_pivot.reset_index()

    # ── Production by Elevation: pivot ───────────────────────────────────────
    prod_elev_pivot = pd.DataFrame()
    if not elev_df.empty:
        pe = elev_df[elev_df["elevation"] != "Total"].copy()
        pe = pe.pivot_table(index="year_month", columns="elevation",
                            values="quantity_kg", aggfunc="sum")
        pe.columns = [f"prod_{e.lower()}_kg" for e in pe.columns]
        prod_elev_pivot = pe.reset_index()

    # ── Production by Process: pivot ─────────────────────────────────────────
    prod_proc_pivot = pd.DataFrame()
    if not proc_df.empty:
        pp = proc_df[proc_df["process"].str.upper() != "TOTAL"].copy()
        pp = pp.pivot_table(index="year_month", columns="process",
                            values="quantity_kg", aggfunc="sum")
        pp.columns = [f"prod_{p.lower().replace(' ','_')}_kg" for p in pp.columns]
        prod_proc_pivot = pp.reset_index()

    # ── Export: total Black tea export per month ──────────────────────────────
    exp_pivot = pd.DataFrame()
    if not exp_df.empty:
        black = exp_df[exp_df["tea_category"].str.lower() == "black"].copy()
        exp_agg = black.groupby("year_month").agg(
            export_black_qty_kg=("quantity_kg", "sum"),
            export_black_fob_avg=("fob_rs_per_kg", "mean")
        ).reset_index()
        exp_pivot = exp_agg

    # ── Merge everything on year_month ────────────────────────────────────────
    if price_pivot.empty:
        return 0

    merged = price_pivot.copy()

    for df in [sales_pivot, prod_elev_pivot, prod_proc_pivot, exp_pivot]:
        if not df.empty:
            merged = merged.merge(df, on="year_month", how="left")

    # ── Add lag features (previous month prices — key ML signal) ─────────────
    merged = merged.sort_values("year_month").reset_index(drop=True)

    for col in [c for c in merged.columns if "price_" in c and "_rs" in c]:
        merged[f"{col}_lag1"]  = merged[col].shift(1)
        merged[f"{col}_lag3"]  = merged[col].shift(3)
        merged[f"{col}_roll3"] = merged[col].rolling(3).mean()

    # ── Add time features ─────────────────────────────────────────────────────
    merged["month"]           = pd.to_datetime(merged["year_month"]).dt.month
    merged["quarter"]         = pd.to_datetime(merged["year_month"]).dt.quarter
    merged["is_peak_season"]  = merged["month"].isin([2, 3, 8, 9]).astype(int)

    # ── Join external data (weather, FX, oil) ─────────────────────────────────
    def load_ext(filename, cols):
        p = os.path.join(DATA_DIR, filename)
        return pd.read_csv(p, usecols=cols) if os.path.exists(p) else pd.DataFrame()

    # Build elevation-specific weather from weather_regions.csv.
    # Rainfall has opposite effects per elevation tier (Ariyaratne et al. 2024,
    # Tables X/XI: Uva Medium coefficient is negative while all others positive),
    # so a single national average masks this opposing signal.
    # We produce per-elevation averages across the sub-districts in each tier
    # (10 High, 7 Medium, 6 Low) PLUS the national mean for backward compatibility.
    weather_regions_path = os.path.join(DATA_DIR, "weather_regions.csv")
    if os.path.exists(weather_regions_path):
        wr = pd.read_csv(weather_regions_path,
                         usecols=["year_month", "elevation", "rainfall_mm", "avg_temp_c"])
        wr_elev = wr.groupby(["year_month", "elevation"]).agg(
            rainfall_mm=("rainfall_mm", "mean"),
            avg_temp_c =("avg_temp_c",  "mean"),
        ).reset_index()
        wr_pivot = wr_elev.pivot(index="year_month", columns="elevation",
                                 values=["rainfall_mm", "avg_temp_c"])
        wr_pivot.columns = [f"{v}_{e.lower()}" for v, e in wr_pivot.columns]
        wr_pivot = wr_pivot.reset_index()
        # National average (mean across all sub-districts, all elevations)
        wr_national = wr.groupby("year_month").agg(
            rainfall_mm=("rainfall_mm", "mean"),
            avg_temp_c =("avg_temp_c",  "mean"),
        ).reset_index()
        weather_df = wr_pivot.merge(wr_national, on="year_month", how="left")
    else:
        weather_df = pd.DataFrame()

    fx_df  = load_ext("usd_lkr_monthly.csv",  ["year_month", "usd_lkr_avg"])
    oil_df = load_ext("oil_price_monthly.csv", ["year_month", "oil_brent_usd_bbl"])
    if not oil_df.empty:
        oil_df = oil_df.rename(columns={"oil_brent_usd_bbl": "oil_price"})

    for ext_df in [weather_df, fx_df, oil_df]:
        if not ext_df.empty:
            merged = merged.merge(ext_df, on="year_month", how="left")

    # ── Save CSV ──────────────────────────────────────────────────────────────
    out_path = os.path.join(DATA_DIR, "raw_sltb_features.csv")
    merged.to_csv(out_path, index=False)

    # ── Insert into MySQL ─────────────────────────────────────────────────────
    if not csv_only:
        records = merged.where(pd.notna(merged), None).to_dict("records")
        insert_ignore(records, "raw_sltb_features")

    return len(merged)


# ---------------------------------------------------------------------------
# SCRAPE ONE CATEGORY
# ---------------------------------------------------------------------------

def collect_category(category_key, category_id, session, nonce, csv_only=False):
    os.makedirs(DATA_DIR, exist_ok=True)
    csv_path = os.path.join(DATA_DIR, f"sltb_{category_key}.csv")

    resume_ym, existing_df = get_resume_point(csv_path)
    start_ym = resume_ym or f"{INITIAL_START_YEAR:04d}-{INITIAL_START_MONTH:02d}"

    # Step 1: get all available year-months for this category from SLTB
    all_months = fetch_available_months(session, nonce, category_id)

    # Filter to months within our scrape window
    months_to_fetch = [ym for ym in all_months if ym >= start_ym]

    parser_fn  = PARSERS[category_key]
    table_name = RAW_TABLES[category_key]
    new_records = []

    for ym in months_to_fetch:
        raw_rows = fetch_table_for_month(session, nonce, category_id, ym)
        if raw_rows:
            parsed = parser_fn(raw_rows, ym)
            new_records.extend(parsed)
        time.sleep(DELAY_SECONDS)

    if not new_records:
        return 0

    new_df   = pd.DataFrame(new_records)
    combined = pd.concat([existing_df, new_df], ignore_index=True) \
               if existing_df is not None else new_df
    combined.to_csv(csv_path, index=False)

    if not csv_only:
        # Insert the FULL history (not just new_records) — the CSV may already hold
        # months that were never written to MySQL (e.g. from earlier --csv-only runs).
        # INSERT IGNORE + the table's UNIQUE KEY makes this safe to repeat every run.
        all_records = combined.where(pd.notna(combined), None).to_dict("records")
        insert_ignore(all_records, table_name)

    return len(new_records)


# ---------------------------------------------------------------------------
# MAIN — called by NestJS DataPipelineService
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status":           "ok",
        "timestamp":        datetime.now().isoformat(),
        "csv_only":         csv_only,
        "categories":       {},
        "total_rows_added": 0,
        "feature_rows":     0,
    }

    try:
        session = requests.Session()
        nonce   = get_nonce(session)

        for key, cat_id in CATEGORIES.items():
            n = collect_category(key, cat_id, session, nonce, csv_only=csv_only)
            result["categories"][key] = n
            result["total_rows_added"] += n

        result["feature_rows"] = build_features(csv_only=csv_only)

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)

    print(json.dumps(result))

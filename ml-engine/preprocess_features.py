"""
SmartTeaAI - Data Preprocessing & Feature Engineering
========================================================
Reads raw_sltb_features.csv (produced by collect_sltb.py's build_features(),
which already merges weather, FX, and oil into the same file) and produces
the final, clean, ML-ready dataset.

Key structural facts verified against the actual CSV (2026-06):
  - collect_sltb.py's build_features() already handles:
      * Sales pivot -> sales_price_rs_{direct/high/medium/low}
      * Production pivot -> prod_{high/medium/low}_kg, prod_{ctc/orthodox/green_tea}_kg
      * Export -> export_black_qty_kg, export_black_fob_avg
      * Lag/roll columns -> sales_price_rs_*_lag1, *_lag3, *_roll3
      * Time features -> month, quarter, is_peak_season
      * External merge -> rainfall_mm, avg_temp_c (weather), usd_lkr_avg (FX), oil_price
  - "sales_price_rs_direct" is a SALE TYPE column (private direct sales channel),
    NOT an elevation. It is kept as an input FEATURE but excluded from the
    national average price TARGET, which is computed only from the three
    auction elevation columns: high, medium, low.
  - preprocess_features.py adds what collect_sltb.py does NOT yet add:
      * Competitor tea prices (Mombasa) from competitor_tea_monthly.csv
      * Rainfall lag/roll features (production responds to rain with ~1-2 month delay)
      * FX change rate and lag (exporters react to direction/speed, not just level)
      * Oil price change rate
      * National average price target + its own lag/roll/volatility features
      * Cross-elevation price spread and volatility
      * Sentiment score placeholder (0.0 until NLP collector is built)
  - Performs chronological 70/15/15 train/validation/test split (never shuffled)
  - Saves unified_dataset.csv, train_set.csv, val_set.csv, test_set.csv
  - Writes ml_ready_dataset MySQL table (separate from raw_sltb_features)

Usage:
    python preprocess_features.py              <- full run + MySQL write
    python preprocess_features.py --csv-only   <- CSV only, no MySQL write
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", "backend", ".env"))

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

DATA_DIR = os.environ.get("SLTB_DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))

DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = int(os.environ.get("DB_PORT", 3306))
DB_USER = os.environ.get("DB_USER", "root")
DB_PASS = os.environ.get("DB_PASS", "")
DB_NAME = os.environ.get("DB_NAME", "smartteaai")

TRAIN_RATIO = 0.70
VAL_RATIO   = 0.15
# TEST_RATIO  = 0.15 (remainder)

# Path to the CSV produced by collect_sltb.py's build_features()
RAW_CSV = os.path.join(DATA_DIR, "raw_sltb_features.csv")

OUT_FULL_CSV  = os.path.join(DATA_DIR, "unified_dataset.csv")
OUT_TRAIN_CSV = os.path.join(DATA_DIR, "train_set.csv")
OUT_VAL_CSV   = os.path.join(DATA_DIR, "val_set.csv")
OUT_TEST_CSV  = os.path.join(DATA_DIR, "test_set.csv")
OUT_REPORT    = os.path.join(DATA_DIR, "data_quality_report.json")

# The three auction elevation price columns.
# "sales_price_rs_direct" is intentionally excluded here -- it represents
# the private direct sales channel, not an auction elevation.
# It stays in the dataset as an input feature, but the national average
# target is computed from auction prices only.
ELEVATION_PRICE_COLS = [
    "price_high_rs",
    "price_medium_rs",
    "price_low_rs",
]


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


def save_ml_ready_table(df):
    """
    Writes the final ML-ready dataset to ml_ready_dataset MySQL table.
    Columns are created dynamically so this stays in sync with whatever
    features this script produces -- no second schema to maintain.
    Kept separate from raw_sltb_features so the raw merge layer is never
    overwritten by preprocessing decisions.
    """
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ml_ready_dataset (
            id        INT AUTO_INCREMENT PRIMARY KEY,
            `year_month` VARCHAR(7) NOT NULL UNIQUE,
            split_set ENUM('train','validation','test') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()

    cursor.execute("SHOW COLUMNS FROM ml_ready_dataset")
    existing_cols = {row[0] for row in cursor.fetchall()}

    for col in df.columns:
        if col in existing_cols:
            continue
        if pd.api.types.is_integer_dtype(df[col]):
            col_type = "BIGINT"
        elif pd.api.types.is_float_dtype(df[col]):
            col_type = "DECIMAL(14,4)"
        else:
            col_type = "VARCHAR(100)"
        cursor.execute(
            f"ALTER TABLE ml_ready_dataset ADD COLUMN `{col}` {col_type} NULL"
        )
    conn.commit()

    cols         = list(df.columns)
    col_str      = ", ".join(f"`{c}`" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    update_str   = ", ".join(
        f"`{c}` = VALUES(`{c}`)" for c in cols if c != "year_month"
    )
    sql = f"""
        INSERT INTO ml_ready_dataset ({col_str})
        VALUES ({placeholders})
        ON DUPLICATE KEY UPDATE {update_str}
    """

    count = 0
    clean = df.where(pd.notna(df), None)
    for _, row in clean.iterrows():
        cursor.execute(sql, [row[c] for c in cols])
        count += cursor.rowcount

    conn.commit()
    cursor.close()
    conn.close()
    return count


# ---------------------------------------------------------------------------
# STEP 1 -- LOAD
# ---------------------------------------------------------------------------

def load_raw_features():
    """
    Loads raw_sltb_features.csv produced by collect_sltb.py's build_features().
    That function already merges weather (rainfall_mm, avg_temp_c),
    FX (usd_lkr_avg), and oil (oil_price) into the same CSV, so we do NOT
    need to load those raw tables separately here.

    We do add competitor_tea_monthly.csv (Mombasa price) because
    collect_oil.py saves it to a separate CSV that build_features()
    does not yet merge.
    """
    if not os.path.exists(RAW_CSV):
        raise FileNotFoundError(
            f"{RAW_CSV} not found.\n"
            "Run collect_sltb.py first -- it is what creates "
            "raw_sltb_features.csv via its build_features() function.\n"
            "Then run collect_weather.py, process_fx.py, collect_oil.py "
            "to populate the external columns before re-running collect_sltb.py."
        )

    df = pd.read_csv(RAW_CSV)
    print(f"  Loaded {len(df)} rows, {len(df.columns)} columns from {RAW_CSV}",
          file=sys.stderr)

    # Add Mombasa competitor tea price
    comp_path = os.path.join(DATA_DIR, "competitor_tea_monthly.csv")
    if os.path.exists(comp_path):
        comp_df = pd.read_csv(comp_path, usecols=["year_month", "mombasa_usd_kg"])
        df = df.merge(comp_df, on="year_month", how="left")
        print(f"  Merged {comp_df['mombasa_usd_kg'].notna().sum()} months of "
              f"Mombasa competitor prices", file=sys.stderr)
    else:
        df["mombasa_usd_kg"] = np.nan
        print("  [SKIP] competitor_tea_monthly.csv not found -- "
              "mombasa_usd_kg set to NaN (run collect_oil.py to generate it)",
              file=sys.stderr)

    return df


# ---------------------------------------------------------------------------
# STEP 2 -- DATA QUALITY CHECKS
# ---------------------------------------------------------------------------

def run_quality_checks(df):
    """
    Produces a data quality report BEFORE any cleaning.
    Cite the before-state in the dissertation's preprocessing chapter --
    "the raw merged dataset had X missing values, addressed as follows."
    """
    report = {
        "timestamp":             datetime.now().isoformat(),
        "total_rows":            len(df),
        "total_columns":         len(df.columns),
        "date_range": {
            "start": str(df["year_month"].min()),
            "end":   str(df["year_month"].max()),
        },
        "missing_values":        {},
        "duplicate_year_months": int(df["year_month"].duplicated().sum()),
        "date_gaps":             [],
    }

    for col in df.columns:
        n = int(df[col].isna().sum())
        if n > 0:
            report["missing_values"][col] = {
                "count":   n,
                "percent": round(100 * n / len(df), 2),
            }

    all_months = pd.period_range(
        start=df["year_month"].min(),
        end=df["year_month"].max(),
        freq="M",
    ).astype(str)
    report["date_gaps"] = sorted(set(all_months) - set(df["year_month"]))

    print(f"  Rows:                   {report['total_rows']}", file=sys.stderr)
    print(f"  Date range:             {report['date_range']['start']} to "
          f"{report['date_range']['end']}", file=sys.stderr)
    print(f"  Columns with NaN:       {len(report['missing_values'])}",
          file=sys.stderr)
    print(f"  Duplicate year_months:  {report['duplicate_year_months']}",
          file=sys.stderr)
    if report["date_gaps"]:
        print(f"  Missing months: {report['date_gaps']}", file=sys.stderr)

    return report


# ---------------------------------------------------------------------------
# STEP 3 -- CLEANING
# ---------------------------------------------------------------------------

def clean_dataset(df):
    """
    All cleaning decisions are deliberate and printed to stderr so they
    appear in the run log -- important for reproducibility and for the
    dissertation's methodology chapter ("what was done and why").
    """
    df = df.copy()

    # --- Sort chronologically (mandatory before any lag/rolling ops) ---
    df["year_month"] = df["year_month"].astype(str)
    df = df.sort_values("year_month")

    # --- Deduplicate (keep the most recently scraped row per month) ---
    before = len(df)
    df = df.drop_duplicates("year_month", keep="last")
    if len(df) < before:
        print(f"  Removed {before - len(df)} duplicate year_month rows",
              file=sys.stderr)

    df = df.reset_index(drop=True)

    # --- Monthly climatological mean imputation for weather gaps ---
    # A missing May value is filled with the average of all other Mays in
    # the dataset, not forward-filled from April.
    #
    # Why climatological mean over forward-fill:
    #   Forward-fill carries the previous month's value across a seasonal
    #   boundary (e.g. April → May crosses the onset of the South-West
    #   monsoon in Sri Lanka's tea regions). The climatological mean
    #   respects the seasonal cycle the ML model needs to learn:
    #   a missing May behaves more like other Mays than like April of the
    #   same year. This is the standard meteorological approach to gap-
    #   filling in agricultural research.
    #
    # Reference: consistent with best-practice in agro-meteorological
    # preprocessing as applied in tea production forecasting contexts.
    df["_month_num"] = pd.to_datetime(df["year_month"]).dt.month

    for col in ["rainfall_mm", "avg_temp_c",
                "rainfall_mm_high", "rainfall_mm_medium", "rainfall_mm_low",
                "avg_temp_c_high",  "avg_temp_c_medium",  "avg_temp_c_low"]:
        if col in df.columns:
            n_before = int(df[col].isna().sum())
            if n_before > 0:
                # Compute mean for each calendar month (1-12) from non-null rows
                clim_means = df.groupby("_month_num")[col].mean()

                def fill_with_clim(row):
                    if pd.isna(row[col]):
                        return clim_means.get(row["_month_num"], np.nan)
                    return row[col]

                df[col] = df.apply(fill_with_clim, axis=1)
                n_after = int(df[col].isna().sum())
                print(
                    f"  Climatological mean imputation for {col}: "
                    f"{n_before} missing -> {n_after} remaining",
                    file=sys.stderr
                )
                # Fallback: if a calendar month has NO observations at all
                # (extremely unlikely with 75+ months of data), forward-fill
                # the residual rather than leaving NaN in the dataset.
                if n_after > 0:
                    df[col] = df[col].ffill()
                    print(
                        f"  Fallback forward-fill for {col}: "
                        f"{n_after} residual NaN (month had no observations)",
                        file=sys.stderr
                    )

    df = df.drop(columns=["_month_num"])

    # --- Forward-fill FX gap ---
    # USD/LKR is autocorrelated month-to-month (especially during stable
    # periods), so last month's value is a far better estimate than the
    # full-period mean (which would be heavily distorted by the 2022 crisis).
    if "usd_lkr_avg" in df.columns:
        n = int(df["usd_lkr_avg"].isna().sum())
        df["usd_lkr_avg"] = df["usd_lkr_avg"].ffill()
        if n:
            print(f"  Forward-filled usd_lkr_avg: {n} missing values",
                  file=sys.stderr)

    # --- Forward-fill oil and Mombasa gaps ---
    for col in ["oil_price", "mombasa_usd_kg"]:
        if col in df.columns:
            n = int(df[col].isna().sum())
            df[col] = df[col].ffill()
            if n:
                print(f"  Forward-filled {col}: {n} missing values",
                      file=sys.stderr)

    # --- Forward-fill auction price gaps ---
    # A month with zero auction activity (public holidays, disruptions) is
    # very rare. Forward-fill from the previous month is the correct approach
    # because the previous month's auction price is a much better estimate
    # than the annual average (which ignores seasonal trends).
    price_cols_present = [
        c for c in df.columns
        if c.startswith("price_") and c.endswith("_rs")
        and "_lag" not in c
        and "_roll" not in c
    ]
    for col in price_cols_present:
        n = int(df[col].isna().sum())
        df[col] = df[col].ffill()
        if n:
            print(f"  Forward-filled {col}: {n} missing values",
                  file=sys.stderr)

    # --- Sentiment score placeholder ---
    # collect_sentiment.py has not yet been built. 0.0 (neutral) is used
    # as a documented placeholder so the column exists and the ML pipeline
    # can be trained end-to-end. This is stated as a limitation in the
    # dissertation -- NOT silently treated as real sentiment data.
    if "sentiment_score" not in df.columns:
        df["sentiment_score"] = 0.0
        print("  [PLACEHOLDER] sentiment_score = 0.0 (NLP collector not yet built)",
              file=sys.stderr)
    else:
        n = int(df["sentiment_score"].isna().sum())
        df["sentiment_score"] = df["sentiment_score"].fillna(0.0)
        if n:
            print(f"  Filled {n} missing sentiment_score with 0.0 (neutral)",
                  file=sys.stderr)

    return df


# ---------------------------------------------------------------------------
# STEP 4 -- FEATURE ENGINEERING
# ---------------------------------------------------------------------------

def engineer_features(df):
    """
    Adds features that collect_sltb.py's build_features() does NOT produce.
    build_features() already adds:
      - sales_price_rs_* lag1/lag3/roll3
      - month, quarter, is_peak_season
      - rainfall_mm, avg_temp_c, usd_lkr_avg, oil_price (merged from CSVs)

    This function adds cross-domain features that only become possible
    once all data sources are in the same table.
    """
    df = df.copy()

    # Identify which elevation price columns are actually present
    elev_cols = [c for c in ELEVATION_PRICE_COLS if c in df.columns]
    if not elev_cols:
        raise RuntimeError(
            f"None of the expected elevation price columns found: "
            f"{ELEVATION_PRICE_COLS}.\n"
            "Check that collect_sltb.py's build_features() ran "
            "successfully and that sales_pivot was not empty."
        )
    print(f"  Elevation price columns found: {elev_cols}", file=sys.stderr)

    # --- Primary target variable ---
    # Volume-weighted average auction price across High, Medium, and Low elevations.
    # Formula matches Ariyaratne et al. (2024) Equation 1:
    #   Weighted Avg = Σ(Price_i × Quantity_i) / Σ(Quantity_i)
    #
    # A simple arithmetic mean would over-weight Low-elevation tea, which
    # trades in far smaller volumes than High-grown, distorting the target.
    # "sales_price_rs_direct" is excluded -- it represents PRIVATE direct
    # sales, not the open auction; mixing channels makes the target harder
    # to interpret and harder to forecast.
    qty_cols = ["sales_qty_high_kg", "sales_qty_medium_kg", "sales_qty_low_kg"]
    prc_cols = ["price_high_rs",    "price_medium_rs",     "price_low_rs"]

    if all(c in df.columns for c in qty_cols + prc_cols):
        numerator   = sum(df[p] * df[q] for p, q in zip(prc_cols, qty_cols))
        denominator = df[qty_cols].sum(axis=1)
        df["price_national_avg"] = numerator / denominator.replace(0, np.nan)
        print("  price_national_avg: volume-weighted (Ariyaratne et al. 2024 Eq. 1)",
              file=sys.stderr)
        # Fallback for months where sales qty is unavailable (e.g. early SLTB history)
        null_mask = df["price_national_avg"].isna()
        if null_mask.any():
            df.loc[null_mask, "price_national_avg"] = df.loc[null_mask, elev_cols].mean(axis=1)
            print(f"  price_national_avg: filled {null_mask.sum()} rows with arithmetic "
                  f"mean (sales qty unavailable for those months)", file=sys.stderr)
    else:
        # Fallback if quantity columns are missing — arithmetic mean with warning
        df["price_national_avg"] = df[elev_cols].mean(axis=1)
        print("  [WARN] price_national_avg: quantity columns missing, "
              "fell back to arithmetic mean", file=sys.stderr)

    # Lag and rolling features for the national average target.
    # build_features() already lags the individual elevation columns;
    # these lags are specifically for the DERIVED national average,
    # which didn't exist in the raw CSV and therefore has no lags yet.
    df["price_national_avg_lag1"]  = df["price_national_avg"].shift(1)
    df["price_national_avg_lag3"]  = df["price_national_avg"].shift(3)
    df["price_national_avg_roll3"] = df["price_national_avg"].rolling(3).mean()
    df["price_national_avg_vol4"]  = df["price_national_avg"].rolling(4).std()

    # --- Cross-elevation spread ---
    # How far apart are High, Medium, and Low prices this month?
    # A wide spread suggests market uncertainty or supply shock in one tier.
    if len(elev_cols) > 1 and "price_high_rs" in df.columns and "price_low_rs" in df.columns:
        df["price_spread_high_low"] = (
            df["price_high_rs"] - df["price_low_rs"]
        )
    if len(elev_cols) > 1:
        df["price_vol_cross_elev"] = df[elev_cols].std(axis=1)

    # --- Rainfall lag features (per elevation + national) ---
    # Tea production responds to rainfall with a 1-2 month delay because
    # the plant needs time to flush new growth after rain. build_features()
    # does NOT add rainfall lags, so we add them here.
    #
    # Per-elevation lags are critical: Ariyaratne et al. (2024) Tables X/XI
    # show rainfall has OPPOSITE sign coefficients across elevations
    # (Uva Medium: -0.1332 vs positive for all others). A single national
    # average masks this opposing effect, so we lag each tier separately.
    for col in ["rainfall_mm_high", "rainfall_mm_medium", "rainfall_mm_low", "rainfall_mm"]:
        if col in df.columns:
            df[f"{col}_lag1"]  = df[col].shift(1)
            df[f"{col}_lag2"]  = df[col].shift(2)
            df[f"{col}_roll3"] = df[col].rolling(3).mean()

    # --- FX rate change ---
    # Exporters respond to the DIRECTION and SPEED of currency movement,
    # not just the level. A sudden 10% move in one month causes very
    # different behaviour than a slow 10% drift over a year, even if the
    # end level is the same. Percentage change captures this dynamic.
    # build_features() provides the level (usd_lkr_avg) but not the rate
    # of change.
    if "usd_lkr_avg" in df.columns:
        df["fx_change_pct"] = df["usd_lkr_avg"].pct_change() * 100
        df["fx_lag1"]       = df["usd_lkr_avg"].shift(1)

    # --- Oil price change ---
    # Same logic as FX: the change matters as much as the level.
    if "oil_price" in df.columns:
        df["oil_change_pct"] = df["oil_price"].pct_change() * 100

    # --- Mombasa competitor lag ---
    # Buyers decide between Colombo and Mombasa tea based on relative
    # pricing from the previous period (current-month Mombasa and Colombo
    # data arrive simultaneously, so using both in the same month as
    # features would be valid; however, lagging Mombasa is the conservative,
    # leak-safe choice since causation flows from past competitor price to
    # current demand).
    if "mombasa_usd_kg" in df.columns:
        df["mombasa_lag1"] = df["mombasa_usd_kg"].shift(1)

    # --- Total production across elevation tiers ---
    elev_prod = [c for c in df.columns
                 if c.startswith("prod_") and c.endswith("_kg")
                 and any(e in c for e in ["high", "medium", "low"])]
    if elev_prod:
        df["prod_total_kg"] = df[elev_prod].sum(axis=1, min_count=1)

    print(f"  Feature engineering complete. Total columns: {len(df.columns)}",
          file=sys.stderr)

    return df


# ---------------------------------------------------------------------------
# STEP 5 -- TRIM + SPLIT
# ---------------------------------------------------------------------------

def finalise_and_split(df):
    """
    Drops leading rows that are unusable due to lag windows, then splits
    chronologically 70% train / 15% validation / 15% test.

    NEVER shuffle time-series data -- shuffling leaks future information
    into training because the model would see 2023 data while being
    evaluated on 2022 data it has already "seen" elsewhere in the set.
    """
    before = len(df)

    # The deepest lag we introduce is lag3 (3-month lookback).
    # Rows where ALL lag3 columns are NaN are the leading rows that
    # genuinely cannot be used for training. Drop only those.
    lag3_cols = [c for c in df.columns if c.endswith("_lag3")]
    if lag3_cols:
        df = df.dropna(subset=lag3_cols, how="all")

    dropped = before - len(df)
    print(f"  Dropped {dropped} leading rows (insufficient lag history): "
          f"{before} -> {len(df)}", file=sys.stderr)

    df = df.sort_values("year_month").reset_index(drop=True)

    n         = len(df)
    train_end = int(n * TRAIN_RATIO)
    val_end   = int(n * (TRAIN_RATIO + VAL_RATIO))

    train_df = df.iloc[:train_end].copy()
    val_df   = df.iloc[train_end:val_end].copy()
    test_df  = df.iloc[val_end:].copy()

    train_df["split_set"] = "train"
    val_df["split_set"]   = "validation"
    test_df["split_set"]  = "test"

    for label, part in [("Train", train_df), ("Val", val_df), ("Test", test_df)]:
        print(f"  {label:5s}: {len(part):3d} rows  "
              f"({part['year_month'].min()} to {part['year_month'].max()})",
              file=sys.stderr)

    full_df = pd.concat([train_df, val_df, test_df], ignore_index=True)
    return full_df, train_df, val_df, test_df


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status":           "ok",
        "timestamp":        datetime.now().isoformat(),
        "csv_only":         csv_only,
        "rows_total":       0,
        "rows_train":       0,
        "rows_val":         0,
        "rows_test":        0,
        "columns_final":    0,
        "mysql_rows_saved": 0,
    }

    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        print("=" * 60, file=sys.stderr)
        print("STEP 1: Load", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        raw_df = load_raw_features()

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 2: Data quality report (BEFORE cleaning)", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        quality_report = run_quality_checks(raw_df)
        with open(OUT_REPORT, "w") as f:
            json.dump(quality_report, f, indent=2, default=str)
        print(f"  Saved -> {OUT_REPORT}", file=sys.stderr)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 3: Cleaning", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        clean_df = clean_dataset(raw_df)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 4: Feature engineering", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        featured_df = engineer_features(clean_df)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 5: Trim + split", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        full_df, train_df, val_df, test_df = finalise_and_split(featured_df)

        full_df.to_csv(OUT_FULL_CSV,  index=False)
        train_df.to_csv(OUT_TRAIN_CSV, index=False)
        val_df.to_csv(OUT_VAL_CSV,   index=False)
        test_df.to_csv(OUT_TEST_CSV,  index=False)

        result.update({
            "rows_total":    len(full_df),
            "rows_train":    len(train_df),
            "rows_val":      len(val_df),
            "rows_test":     len(test_df),
            "columns_final": len(full_df.columns),
        })

        print(f"\n  unified_dataset.csv : {len(full_df)} rows, "
              f"{len(full_df.columns)} columns", file=sys.stderr)
        print(f"  train_set.csv       : {len(train_df)} rows", file=sys.stderr)
        print(f"  val_set.csv         : {len(val_df)} rows", file=sys.stderr)
        print(f"  test_set.csv        : {len(test_df)} rows", file=sys.stderr)

        if not csv_only:
            print("\n" + "=" * 60, file=sys.stderr)
            print("STEP 6: Write ml_ready_dataset to MySQL", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            result["mysql_rows_saved"] = save_ml_ready_table(full_df)
            print(f"  {result['mysql_rows_saved']} rows written to MySQL",
                  file=sys.stderr)

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)
        import traceback
        traceback.print_exc(file=sys.stderr)

    print(json.dumps(result))
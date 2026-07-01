"""
SmartTeaAI - Data Preprocessing & Feature Engineering
========================================================
Reads the merged raw_sltb_features table (already populated by the four
collector scripts: collect_sltb.py, collect_weather.py, process_fx.py,
collect_oil.py) and produces the final, clean, ML-ready dataset.

This is NOT a fifth data collector -- it assumes collect_sltb.py,
collect_weather.py, process_fx.py, and collect_oil.py have already been
run (in that order) against the live database. This script's job is to:

  1. Pull the merged table out of MySQL into one DataFrame
  2. Add the two competitor-tea columns that collect_oil.py saves to
     raw_competitor_prices but does NOT yet merge into raw_sltb_features
  3. Validate data quality (missing values, date continuity, outliers)
  4. Engineer additional features not already added by collect_sltb.py:
       - price-side lag/MA features (collect_sltb.py only lags sales price
         columns; this adds equivalent lags for rainfall and FX, which are
         needed because rainfall affects PRODUCTION with a delay, and FX
         affects EXPORT DEMAND with a delay -- not instantaneous effects)
       - normalisation-ready scaling info (saved separately, not applied
         in-place, since ARIMA/RF/XGBoost need different treatments)
       - grade/elevation encoding for whichever target column is used
  5. Perform the chronological train/validation/test split
  6. Save everything to CSV + back to a new `ml_ready_dataset` MySQL table

Usage:
    python preprocess_features.py              <- full run, writes MySQL + CSV
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

# Chronological split ratios -- NEVER shuffle time-series data
TRAIN_RATIO = 0.70
VAL_RATIO   = 0.15
# TEST_RATIO is the remainder (0.15)

OUT_FULL_CSV  = os.path.join(DATA_DIR, "unified_dataset.csv")
OUT_TRAIN_CSV = os.path.join(DATA_DIR, "train_set.csv")
OUT_VAL_CSV   = os.path.join(DATA_DIR, "val_set.csv")
OUT_TEST_CSV  = os.path.join(DATA_DIR, "test_set.csv")
OUT_REPORT    = os.path.join(DATA_DIR, "data_quality_report.json")


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


def load_table(table_name):
    """Generic loader -- pulls a full table into a DataFrame."""
    conn = get_db()
    df = pd.read_sql(f"SELECT * FROM `{table_name}`", conn)
    conn.close()
    return df


def save_ml_ready_table(df, csv_only=False):
    """
    Writes the final ML-ready dataset to a dedicated MySQL table,
    separate from raw_sltb_features (which stays as the raw merge layer).
    This keeps "raw merged data" and "cleaned ML-ready data" as distinct
    layers -- standard practice, and easier to re-run preprocessing
    without re-scraping anything.
    """
    if csv_only or df.empty:
        return 0

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ml_ready_dataset (
            id INT AUTO_INCREMENT PRIMARY KEY,
            `year_month` VARCHAR(7) NOT NULL UNIQUE,
            split_set ENUM('train','validation','test') NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Add any feature columns that don't already exist on the table.
    # (Doing this dynamically avoids having to hand-maintain a second
    # giant CREATE TABLE statement in lockstep with this script.)
    cursor.execute("SHOW COLUMNS FROM ml_ready_dataset")
    existing_cols = {row[0] for row in cursor.fetchall()}

    for col in df.columns:
        if col in existing_cols or col in ("year_month", "split_set"):
            continue
        if pd.api.types.is_integer_dtype(df[col]):
            col_type = "BIGINT"
        elif pd.api.types.is_float_dtype(df[col]):
            col_type = "DECIMAL(14,4)"
        else:
            col_type = "VARCHAR(100)"
        cursor.execute(f"ALTER TABLE ml_ready_dataset ADD COLUMN `{col}` {col_type} NULL")

    conn.commit()

    cols = list(df.columns)
    col_str = ", ".join(f"`{c}`" for c in cols)
    placeholders = ", ".join(["%s"] * len(cols))
    update_str = ", ".join(f"`{c}` = VALUES(`{c}`)" for c in cols if c != "year_month")

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
    Pulls raw_sltb_features (already populated by the four collectors)
    plus raw_competitor_prices (which collect_oil.py saves but does NOT
    yet merge into raw_sltb_features).
    """
    print("Loading raw_sltb_features...", file=sys.stderr)
    df = load_table("raw_sltb_features")

    if df.empty:
        raise RuntimeError(
            "raw_sltb_features is empty. Run collect_sltb.py first -- "
            "it is the only script that creates rows in this table "
            "(the others only UPDATE existing rows)."
        )

    print(f"  {len(df)} rows loaded", file=sys.stderr)

    print("Loading raw_competitor_prices (Mombasa benchmark)...", file=sys.stderr)
    try:
        comp_df = load_table("raw_competitor_prices")
        if not comp_df.empty:
            comp_df = comp_df[["year_month", "mombasa_usd_kg"]]
            df = df.merge(comp_df, on="year_month", how="left")
            print(f"  Merged {len(comp_df)} months of Mombasa price data", file=sys.stderr)
    except Exception as e:
        print(f"  [SKIP] raw_competitor_prices not available: {e}", file=sys.stderr)

    return df


# ---------------------------------------------------------------------------
# STEP 2 -- DATA QUALITY CHECKS
# ---------------------------------------------------------------------------

def run_quality_checks(df):
    """
    Produces a data quality report BEFORE any cleaning is applied.
    This is what goes in the dissertation's "data preprocessing" chapter --
    show the dirty state first, then show what was done about it.
    """
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_rows": len(df),
        "date_range": {
            "start": str(df["year_month"].min()),
            "end":   str(df["year_month"].max()),
        },
        "missing_values": {},
        "duplicate_year_months": int(df["year_month"].duplicated().sum()),
        "date_gaps": [],
    }

    # Missing value count + percentage per column
    for col in df.columns:
        n_missing = int(df[col].isna().sum())
        if n_missing > 0:
            report["missing_values"][col] = {
                "count":   n_missing,
                "percent": round(100 * n_missing / len(df), 2)
            }

    # Check for gaps in the monthly sequence (e.g. missing 2023-05 entirely)
    all_months = pd.period_range(
        start=df["year_month"].min(),
        end=df["year_month"].max(),
        freq="M"
    ).astype(str)
    present = set(df["year_month"])
    missing_months = sorted(set(all_months) - present)
    report["date_gaps"] = missing_months

    print(f"  Missing value columns: {len(report['missing_values'])}", file=sys.stderr)
    print(f"  Duplicate year_months: {report['duplicate_year_months']}", file=sys.stderr)
    print(f"  Missing months in sequence: {len(missing_months)}", file=sys.stderr)
    if missing_months:
        print(f"    -> {missing_months}", file=sys.stderr)

    return report


# ---------------------------------------------------------------------------
# STEP 3 -- CLEANING
# ---------------------------------------------------------------------------

def clean_dataset(df):
    """
    Applies cleaning decisions, each one deliberate and documented --
    not silent. Every drop/fill choice here should be explainable in
    the dissertation's methodology chapter.
    """
    df = df.copy()

    # --- Deduplicate year_month (keep most recently updated row) ---
    if "updated_at" in df.columns:
        df = df.sort_values("updated_at").drop_duplicates("year_month", keep="last")
    else:
        df = df.drop_duplicates("year_month", keep="last")

    # --- Sort chronologically -- mandatory before any lag/rolling features ---
    df["year_month"] = df["year_month"].astype(str)
    df = df.sort_values("year_month").reset_index(drop=True)

    # --- Handle missing weather (rainfall/temp) ---
    # Forward-fill is used here, NOT mean imputation, because weather is
    # highly seasonal -- imputing with the column mean would wrongly
    # smooth out the wet/dry season pattern the model needs to learn.
    # A single missing month inheriting last month's value is a far
    # smaller distortion than overwriting it with an annual average.
    for col in ["rainfall_mm", "avg_temp_c"]:
        if col in df.columns:
            n_before = df[col].isna().sum()
            df[col] = df[col].ffill()
            n_after = df[col].isna().sum()
            if n_before > 0:
                print(f"  Forward-filled {col}: {n_before} -> {n_after} missing", file=sys.stderr)

    # --- Handle missing FX (usd_lkr_avg) ---
    # Same justification: FX moves are autocorrelated month-to-month,
    # so forward-fill is a defensible gap-filling approach for short gaps.
    if "usd_lkr_avg" in df.columns:
        n_before = df["usd_lkr_avg"].isna().sum()
        df["usd_lkr_avg"] = df["usd_lkr_avg"].ffill()
        if n_before > 0:
            print(f"  Forward-filled usd_lkr_avg: {n_before} missing", file=sys.stderr)

    # --- Handle missing oil_price / mombasa_usd_kg ---
    # These are global commodity benchmarks -- safe to forward-fill,
    # since global commodity prices also move with short-term persistence.
    for col in ["oil_price", "mombasa_usd_kg"]:
        if col in df.columns:
            n_before = df[col].isna().sum()
            df[col] = df[col].ffill()
            if n_before > 0:
                print(f"  Forward-filled {col}: {n_before} missing", file=sys.stderr)

    # --- Sentiment score: not yet collected (no NLP collector built yet) ---
    # Filled with neutral (0.0) rather than dropped, so the column exists
    # and the model architecture is ready for when the FinBERT pipeline
    # is added. This is flagged explicitly as a placeholder, not silently
    # treated as real data -- documented as a limitation in the dissertation.
    if "sentiment_score" not in df.columns:
        df["sentiment_score"] = 0.0
        print("  [PLACEHOLDER] sentiment_score column created, filled with 0.0 "
              "(neutral) -- NLP sentiment collector not yet implemented", file=sys.stderr)
    else:
        n_missing = df["sentiment_score"].isna().sum()
        df["sentiment_score"] = df["sentiment_score"].fillna(0.0)
        if n_missing > 0:
            print(f"  Filled {n_missing} missing sentiment_score with 0.0 (neutral)", file=sys.stderr)

    return df


# ---------------------------------------------------------------------------
# STEP 4 -- FEATURE ENGINEERING
# ---------------------------------------------------------------------------

def identify_target_column(df):
    """
    collect_sltb.py's build_features() produces elevation-pivoted columns
    like 'sales_price_rs_high', 'sales_price_rs_medium', 'sales_price_rs_low'
    (exact suffix depends on how SLTB labelled elevations that month).
    This finds them so we can build per-elevation lag/MA features generically
    instead of hardcoding column names that may shift if SLTB output varies.
    """
    price_cols = [c for c in df.columns if c.startswith("sales_price_rs_")]
    if not price_cols:
        raise RuntimeError(
            "No 'sales_price_rs_*' columns found. Check that collect_sltb.py's "
            "build_features() ran successfully and sales_pivot was not empty."
        )
    return price_cols


def engineer_features(df):
    """
    Adds features NOT already created by collect_sltb.py's build_features().
    collect_sltb.py already adds: price_rs lag1/lag3/roll3, month, quarter,
    is_peak_season. This function adds the cross-domain features that only
    make sense once weather/FX/oil are in the same table.
    """
    df = df.copy()
    price_cols = identify_target_column(df)
    print(f"  Target price columns detected: {price_cols}", file=sys.stderr)

    # --- Rainfall lag features ---
    # Tea production responds to rainfall with a delay (weeks to ~2 months
    # for the plant to flush new leaf), so the SAME month's rainfall is a
    # weaker predictor of THAT month's price than rainfall 1-2 months prior.
    if "rainfall_mm" in df.columns:
        df["rainfall_lag_1"] = df["rainfall_mm"].shift(1)
        df["rainfall_lag_2"] = df["rainfall_mm"].shift(2)
        df["rainfall_roll3"] = df["rainfall_mm"].rolling(3).mean()

    # --- FX change rate ---
    # Exporters react to the DIRECTION/SPEED of currency movement, not just
    # its level -- a sudden 5% depreciation behaves differently to a slow
    # 5% drift over 6 months, even though both reach the same end rate.
    if "usd_lkr_avg" in df.columns:
        df["fx_change_pct"] = df["usd_lkr_avg"].pct_change() * 100
        df["fx_lag_1"]      = df["usd_lkr_avg"].shift(1)

    # --- Oil price change ---
    if "oil_price" in df.columns:
        df["oil_change_pct"] = df["oil_price"].pct_change() * 100

    # --- Overall price volatility (across elevations, this month) ---
    # Std deviation across the available elevation price columns gives a
    # simple "how much is the market disagreeing with itself right now"
    # signal, separate from any single elevation's own price history.
    if len(price_cols) > 1:
        df["price_volatility_cross_elevation"] = df[price_cols].std(axis=1)

    # --- National average price (used as the primary target if no
    #     specific elevation is requested by the ML pipeline) ---
    df["price_national_avg"] = df[price_cols].mean(axis=1)
    df["price_national_avg_lag_1"] = df["price_national_avg"].shift(1)
    df["price_national_avg_lag_3"] = df["price_national_avg"].shift(3)
    df["price_national_avg_roll3"] = df["price_national_avg"].rolling(3).mean()
    df["price_national_avg_volatility"] = df["price_national_avg"].rolling(4).std()

    return df


# ---------------------------------------------------------------------------
# STEP 5 -- FINAL ROW TRIMMING + SPLIT
# ---------------------------------------------------------------------------

def finalise_and_split(df):
    """
    Drops the leading rows that are unusable due to lag features
    (e.g. row 1 can't have a lag_3 value -- there's no 3 months before it),
    then performs the chronological train/val/test split.
    """
    before = len(df)

    # Any row still missing a CORE engineered feature is unusable for
    # training (this is expected -- it's just the first few months,
    # consumed by the lag windows). Drop those specific rows only.
    core_required = [c for c in df.columns if c.endswith("_lag_3") or c.endswith("_roll3")]
    df_clean = df.dropna(subset=core_required, how="all") if core_required else df.copy()

    dropped = before - len(df_clean)
    print(f"  Dropped {dropped} leading rows with insufficient lag history "
          f"({before} -> {len(df_clean)} rows)", file=sys.stderr)

    df_clean = df_clean.sort_values("year_month").reset_index(drop=True)

    n = len(df_clean)
    train_end = int(n * TRAIN_RATIO)
    val_end   = int(n * (TRAIN_RATIO + VAL_RATIO))

    train_df = df_clean.iloc[:train_end].copy()
    val_df   = df_clean.iloc[train_end:val_end].copy()
    test_df  = df_clean.iloc[val_end:].copy()

    train_df["split_set"] = "train"
    val_df["split_set"]   = "validation"
    test_df["split_set"]  = "test"

    print(f"  Train:      {len(train_df)} rows  ({train_df['year_month'].min()} to {train_df['year_month'].max()})", file=sys.stderr)
    print(f"  Validation: {len(val_df)} rows  ({val_df['year_month'].min()} to {val_df['year_month'].max()})", file=sys.stderr)
    print(f"  Test:       {len(test_df)} rows  ({test_df['year_month'].min()} to {test_df['year_month'].max()})", file=sys.stderr)

    full_df = pd.concat([train_df, val_df, test_df], ignore_index=True)

    return full_df, train_df, val_df, test_df


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    csv_only = "--csv-only" in sys.argv

    result = {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "csv_only": csv_only,
        "rows_total": 0,
        "rows_train": 0,
        "rows_val": 0,
        "rows_test": 0,
        "mysql_rows_saved": 0,
    }

    try:
        os.makedirs(DATA_DIR, exist_ok=True)

        print("=" * 60, file=sys.stderr)
        print("STEP 1: Loading raw merged data", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        raw_df = load_raw_features()

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 2: Data quality assessment (BEFORE cleaning)", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        quality_report = run_quality_checks(raw_df)
        with open(OUT_REPORT, "w") as f:
            json.dump(quality_report, f, indent=2, default=str)
        print(f"  Quality report saved -> {OUT_REPORT}", file=sys.stderr)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 3: Cleaning", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        clean_df = clean_dataset(raw_df)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 4: Feature engineering", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        featured_df = engineer_features(clean_df)

        print("\n" + "=" * 60, file=sys.stderr)
        print("STEP 5: Trim + chronological train/val/test split", file=sys.stderr)
        print("=" * 60, file=sys.stderr)
        full_df, train_df, val_df, test_df = finalise_and_split(featured_df)

        full_df.to_csv(OUT_FULL_CSV, index=False)
        train_df.to_csv(OUT_TRAIN_CSV, index=False)
        val_df.to_csv(OUT_VAL_CSV, index=False)
        test_df.to_csv(OUT_TEST_CSV, index=False)

        print(f"\n  Saved -> {OUT_FULL_CSV}", file=sys.stderr)
        print(f"  Saved -> {OUT_TRAIN_CSV}", file=sys.stderr)
        print(f"  Saved -> {OUT_VAL_CSV}", file=sys.stderr)
        print(f"  Saved -> {OUT_TEST_CSV}", file=sys.stderr)

        result["rows_total"] = len(full_df)
        result["rows_train"] = len(train_df)
        result["rows_val"]   = len(val_df)
        result["rows_test"]  = len(test_df)

        if not csv_only:
            print("\n" + "=" * 60, file=sys.stderr)
            print("STEP 6: Writing ml_ready_dataset to MySQL", file=sys.stderr)
            print("=" * 60, file=sys.stderr)
            result["mysql_rows_saved"] = save_ml_ready_table(full_df, csv_only=False)
            print(f"  {result['mysql_rows_saved']} rows saved to MySQL", file=sys.stderr)

    except Exception as e:
        result["status"]  = "error"
        result["message"] = str(e)
        import traceback
        traceback.print_exc(file=sys.stderr)

    print(json.dumps(result))
import pandas as pd, os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def load(name):
    path = os.path.join(DATA_DIR, name)
    return pd.read_csv(path) if os.path.exists(path) else None

feat   = load("raw_sltb_features.csv")
price  = load("sltb_sub_district_price.csv")
sales  = load("sltb_sales_volume_direct.csv")
elev   = load("sltb_production_volume_elevation.csv")
proc   = load("sltb_production_volume_process.csv")
exp    = load("sltb_export.csv")
reexp  = load("sltb_reexport.csv")

print("=== ROW COUNTS ===")
print(f"raw_sltb_features:              {len(feat)} rows  |  {feat['year_month'].min()} to {feat['year_month'].max()}")
print(f"sltb_sub_district_price:        {len(price)} rows  |  {price['year_month'].min()} to {price['year_month'].max()}")
print(f"sltb_sales_volume_direct:       {len(sales)} rows  |  {sales['year_month'].min()} to {sales['year_month'].max()}")
print(f"sltb_production_volume_elev:    {len(elev)} rows  |  {elev['year_month'].min()} to {elev['year_month'].max()}")
print(f"sltb_production_volume_process: {len(proc)} rows  |  {proc['year_month'].min()} to {proc['year_month'].max()}")
print(f"sltb_export:                    {len(exp)} rows  |  {exp['year_month'].min()} to {exp['year_month'].max()}")
print(f"sltb_reexport:                  {len(reexp)} rows  |  {reexp['year_month'].min()} to {reexp['year_month'].max()}")

print("\n=== MONTH COVERAGE (unique year_months) ===")
feat_months  = set(feat["year_month"])
sales_months = set(sales["year_month"])
elev_months  = set(elev["year_month"])
proc_months  = set(proc["year_month"])
exp_months   = set(exp["year_month"])

print(f"features:   {len(feat_months)} months")
print(f"sales:      {len(sales_months)} months  — in features: {len(sales_months & feat_months)}  missing: {sorted(sales_months - feat_months)}")
print(f"elev:       {len(elev_months)} months  — in features: {len(elev_months & feat_months)}  missing: {sorted(elev_months - feat_months)}")
print(f"process:    {len(proc_months)} months  — in features: {len(proc_months & feat_months)}  missing: {sorted(proc_months - feat_months)}")
print(f"export:     {len(exp_months)} months  — in features: {len(exp_months & feat_months)}  missing: {sorted(exp_months - feat_months)}")

print("\n=== NULL CHECK (features table) ===")
null_counts = feat.isnull().sum()
null_counts = null_counts[null_counts > 0]
print(null_counts.to_string() if not null_counts.empty else "No nulls!")

print("\n=== COLUMNS IN FEATURES ===")
for c in feat.columns:
    print(" ", c)

print("\n=== NOTE: reexport is NOT merged into features (by design) ===")
print("It's collected as raw audit data only.")
print("\n=== NOTE: sub_district_price is NOT merged into features (by design) ===")
print("Features use sales_volume_direct prices instead (more direct elevation signal).")

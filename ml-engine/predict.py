"""
SmartTeaAI — Prediction Script
Spawned by NestJS as a subprocess. Loads the winning model, builds the
feature vector from the most recent processed data, and prints a JSON
result to stdout. All errors also go out as JSON so the caller can parse.
"""
import json, sys, os
import numpy as np
import pandas as pd

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'models')
DATA_DIR  = os.path.join(os.path.dirname(__file__), 'data')


def get_next_month(year_month_str: str) -> str:
    from datetime import datetime
    from dateutil.relativedelta import relativedelta
    dt = datetime.strptime(str(year_month_str)[:7], '%Y-%m')
    return (dt + relativedelta(months=1)).strftime('%Y-%m')


def load_data() -> pd.DataFrame:
    """Concatenate train/val/test splits — always the latest processed data."""
    dfs = []
    for split in ['train_set', 'val_set', 'test_set']:
        p = os.path.join(DATA_DIR, f'{split}.csv')
        if os.path.exists(p):
            dfs.append(pd.read_csv(p))
    if not dfs:
        raise FileNotFoundError('No split CSVs found in ml-engine/data/')
    df = pd.concat(dfs, ignore_index=True).sort_values('year_month').reset_index(drop=True)
    df['is_post_crisis'] = (pd.to_datetime(df['year_month']) >= '2022-04-01').astype(int)
    return df


def predict_lstm(df: pd.DataFrame) -> float:
    import tensorflow as tf
    import joblib

    with open(os.path.join(MODEL_DIR, 'lstm_meta.json')) as f:
        meta = json.load(f)

    W        = meta['window']
    features = [c for c in meta['features'] if c in df.columns]
    scaler   = joblib.load(os.path.join(MODEL_DIR, 'lstm_scaler.joblib'))
    model    = tf.keras.models.load_model(os.path.join(MODEL_DIR, 'lstm_model.keras'))

    X_recent = df[features].tail(W).values
    if len(X_recent) < W:
        raise ValueError(f'Need at least {W} months of data; only {len(X_recent)} available')

    X_scaled = scaler.transform(X_recent).reshape(1, W, len(features))
    return float(model.predict(X_scaled, verbose=0)[0][0])


def predict_xgb(df: pd.DataFrame, feature_set: str, model_file: str) -> float:
    import xgboost as xgb

    features_file = 'core_features.json' if feature_set == 'core_features' else 'ml_features.json'
    with open(os.path.join(MODEL_DIR, features_file)) as f:
        features = [c for c in json.load(f) if c in df.columns]

    model = xgb.XGBRegressor()
    model.load_model(os.path.join(MODEL_DIR, model_file))
    return float(model.predict(df[features].tail(1).values)[0])


def predict_rf(df: pd.DataFrame, feature_set: str, model_file: str) -> float:
    import joblib

    features_file = 'core_features.json' if feature_set == 'core_features' else 'ml_features.json'
    with open(os.path.join(MODEL_DIR, features_file)) as f:
        features = [c for c in json.load(f) if c in df.columns]

    model = joblib.load(os.path.join(MODEL_DIR, model_file))
    return float(model.predict(df[features].tail(1).values)[0])


def classify_risk(change_pct: float) -> str:
    """
    Simple, defensible heuristic: larger predicted swings carry more
    forecast uncertainty. Thresholds chosen against this dataset's own
    scale -- test-set actual prices ranged ~Rs 990-1140 over the evaluation
    period, so a >5% single-month move would be unusually large relative
    to observed volatility in that window.
    """
    abs_change = abs(change_pct)
    if abs_change < 2:
        return "Low"
    elif abs_change < 5:
        return "Medium"
    else:
        return "High"


def get_recommendation(change_pct: float) -> dict:
    """
    Rule-based Sell/Hold/Monitor signal, matching the proposal's own
    example format (Section 9.1): a plain-language justification alongside
    the signal, not just a bare label.
    """
    if change_pct >= 2:
        return {
            "signal": "Hold",
            "justification": f"Prices are predicted to rise by {change_pct:.1f}% next month. "
                              f"Holding stock may be beneficial if storage costs allow."
        }
    elif change_pct <= -2:
        return {
            "signal": "Sell",
            "justification": f"Prices are predicted to fall by {abs(change_pct):.1f}% next month. "
                              f"Selling before the decline may be advantageous."
        }
    else:
        return {
            "signal": "Monitor",
            "justification": f"Prices are predicted to move only {change_pct:+.1f}% next month. "
                              f"No strong signal either way -- continue monitoring the market."
        }


def predict_elevation(df: pd.DataFrame, elevation: str) -> tuple:
    """Run elevation-level prediction using the winner model for that elevation.
    Returns (predicted_price, cfg_dict) so the caller can read RMSE etc."""
    elev_models_path = os.path.join(MODEL_DIR, 'elevation_models.json')
    if not os.path.exists(elev_models_path):
        raise FileNotFoundError(
            'elevation_models.json not found — run 04_elevation_models.ipynb first.'
        )

    with open(elev_models_path) as f:
        elev_configs = json.load(f)

    valid = list(elev_configs.keys())
    if elevation not in elev_configs:
        raise ValueError(f'Unknown elevation {elevation!r}. Must be one of: {valid}')

    cfg = elev_configs[elevation]

    if cfg['best_model'] == 'LSTM':
        import tensorflow as tf
        import joblib

        with open(os.path.join(MODEL_DIR, cfg['lstm_meta_file'])) as f:
            meta = json.load(f)

        W        = meta['window']
        features = [c for c in meta['features'] if c in df.columns]
        scaler   = joblib.load(os.path.join(MODEL_DIR, cfg['lstm_scaler_file']))
        model    = tf.keras.models.load_model(os.path.join(MODEL_DIR, cfg['lstm_file']))

        X_recent = df[features].tail(W).values
        if len(X_recent) < W:
            raise ValueError(f'Need at least {W} rows; only {len(X_recent)} available')

        X_scaled = scaler.transform(X_recent).reshape(1, W, len(features))
        price    = float(model.predict(X_scaled, verbose=0)[0][0])

    else:
        import xgboost as xgb

        with open(os.path.join(MODEL_DIR, cfg['xgb_features_file'])) as f:
            features = [c for c in json.load(f) if c in df.columns]

        model = xgb.XGBRegressor()
        model.load_model(os.path.join(MODEL_DIR, cfg['xgb_file']))
        price = float(model.predict(df[features].tail(1).values)[0])

    return price, cfg


def parse_elevation_arg() -> str | None:
    """Extract --elevation=<value> from sys.argv, or None."""
    for arg in sys.argv[1:]:
        if arg.startswith('--elevation='):
            return arg.split('=', 1)[1].strip().lower()
    return None


def main():
    try:
        elevation = parse_elevation_arg()
        df        = load_data()
        last_month = str(df['year_month'].iloc[-1])

        if elevation:
            price, elev_cfg = predict_elevation(df, elevation)
            target_col  = elev_cfg['target']
            last_price  = float(df[target_col].iloc[-1])
            change_pct  = round((price - last_price) / last_price * 100, 2)
            rmse        = float(elev_cfg['rmse'])

            print(json.dumps({
                'status':              'ok',
                'elevation':           elevation,
                'target':              target_col,
                'predicted_price_rs':  round(price, 2),
                'predicted_month':     get_next_month(last_month),
                'last_known_month':    last_month,
                'last_known_price_rs': round(last_price, 2),
                'change_rs':           round(price - last_price, 2),
                'change_pct':          change_pct,
                'price_range_low':     round(price - rmse, 2),
                'price_range_high':    round(price + rmse, 2),
                'range_basis':         'predicted price +/- 1 RMSE (test-set typical error)',
                'risk_level':          classify_risk(change_pct),
                'recommendation':      get_recommendation(change_pct),
                'model':               elev_cfg['best_model'],
                'mape_pct':            elev_cfg['mape_pct'],
                'rmse':                rmse,
            }))
            return

        # ── National average (original path, unchanged) ──────────────────────
        with open(os.path.join(MODEL_DIR, 'best_model.json')) as f:
            best = json.load(f)

        feature_set  = best['feature_set']
        model_file   = best['model_file']
        last_price   = float(df['price_national_avg'].iloc[-1])

        if feature_set == 'lstm':
            price = predict_lstm(df)
        elif model_file.endswith('.json'):
            price = predict_xgb(df, feature_set, model_file)
        elif model_file.endswith('.joblib'):
            price = predict_rf(df, feature_set, model_file)
        else:
            raise ValueError(f'Unknown model type: {model_file}')

        change_pct = round((price - last_price) / last_price * 100, 2)
        rmse       = float(best['rmse'])

        print(json.dumps({
            'status':              'ok',
            'predicted_price_rs':  round(price, 2),
            'predicted_month':     get_next_month(last_month),
            'last_known_month':    last_month,
            'last_known_price_rs': round(last_price, 2),
            'change_rs':           round(price - last_price, 2),
            'change_pct':          change_pct,
            'price_range_low':     round(price - rmse, 2),
            'price_range_high':    round(price + rmse, 2),
            'range_basis':         'predicted price +/- 1 RMSE (test-set typical error)',
            'risk_level':          classify_risk(change_pct),
            'recommendation':      get_recommendation(change_pct),
            'model':               best['best_model'],
            'mape_pct':            best['mape_pct'],
            'rmse':                best['rmse'],
        }))

    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()

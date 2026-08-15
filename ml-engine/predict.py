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


def main():
    try:
        with open(os.path.join(MODEL_DIR, 'best_model.json')) as f:
            best = json.load(f)

        df           = load_data()
        feature_set  = best['feature_set']
        model_file   = best['model_file']
        last_month   = str(df['year_month'].iloc[-1])
        last_price   = float(df['price_national_avg'].iloc[-1])

        if feature_set == 'lstm':
            price = predict_lstm(df)
        elif model_file.endswith('.json'):
            price = predict_xgb(df, feature_set, model_file)
        elif model_file.endswith('.joblib'):
            price = predict_rf(df, feature_set, model_file)
        else:
            raise ValueError(f'Unknown model type: {model_file}')

        print(json.dumps({
            'status':              'ok',
            'predicted_price_rs':  round(price, 2),
            'predicted_month':     get_next_month(last_month),
            'last_known_month':    last_month,
            'last_known_price_rs': round(last_price, 2),
            'change_rs':           round(price - last_price, 2),
            'change_pct':          round((price - last_price) / last_price * 100, 2),
            'model':               best['best_model'],
            'mape_pct':            best['mape_pct'],
            'rmse':                best['rmse'],
        }))

    except Exception as e:
        print(json.dumps({'status': 'error', 'message': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()

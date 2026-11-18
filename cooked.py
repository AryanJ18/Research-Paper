import os
import joblib
import pandas as pd
import yfinance as yf
import xgboost as xgb
from sklearn.preprocessing import MinMaxScaler

FEATURES = ["Return", "SMA_10", "SMA_50", "RSI", "MACD", "Volume"]
SPLIT_DATE = "2024-01-01"

TICKERS = {
    "HDFCBANK": "HDFCBANK.NS",
    "ICICIBANK": "ICICIBANK.NS",
    "RELIANCE": "RELIANCE.NS",
    "BHARTIARTL": "BHARTIARTL.NS",
    "LT": "LT.NS",
}

RAW_WEIGHTS = {
    "HDFCBANK": 0.1150,
    "ICICIBANK": 0.0810,
    "RELIANCE": 0.0850,
    "BHARTIARTL": 0.0426,
    "LT": 0.0380,
}
total_w = sum(RAW_WEIGHTS.values())  # 0.3616 (36.16%)
NORM_WEIGHTS = {k: v / total_w for k, v in RAW_WEIGHTS.items()}


def calculate_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    df = data.copy()
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    df["Return"] = df["Close"].pct_change()
    df["SMA_10"] = df["Close"].rolling(window=10).mean()
    df["SMA_50"] = df["Close"].rolling(window=50).mean()

    delta = df["Close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss + 1e-9)
    df["RSI"] = 100 - (100 / (1 + rs))

    ema_12 = df["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = df["Close"].ewm(span=26, adjust=False).mean()
    df["MACD"] = ema_12 - ema_26

    df["Target_Return"] = df["Return"].shift(-1)
    return df.dropna()


unnorm_models = {}
norm_models = {}

for symbol, ticker in TICKERS.items():
    print(f"Training {symbol} ({ticker})...")
    raw_df = yf.download(ticker, start="2018-01-01", auto_adjust=False, progress=False)
    df = calculate_technical_indicators(raw_df)

    train_df = df.loc[df.index < SPLIT_DATE]
    X_train = train_df[FEATURES]
    y_train = train_df["Target_Return"]

    scaler = MinMaxScaler()
    X_train_scaled = scaler.fit_transform(X_train)

    model = xgb.XGBRegressor(n_estimators=100, max_depth=4, random_state=42)
    model.fit(X_train_scaled, y_train)

    unnorm_models[symbol] = {
        "model": model,
        "scaler": scaler,
        "ticker": ticker,
        "weight": RAW_WEIGHTS[symbol],
    }
    norm_models[symbol] = {
        "model": model,
        "scaler": scaler,
        "ticker": ticker,
        "weight": NORM_WEIGHTS[symbol],
        "raw_weight": RAW_WEIGHTS[symbol],
    }

os.makedirs("artifacts", exist_ok=True)

joblib.dump(
    {
        "model_name": "Bottom-Up (Unnormalized)",
        "aggregation": "unnormalized",
        "constituents": unnorm_models,
        "features": FEATURES,
    },
    "artifacts/bottom_unnorm_model.joblib",
)

joblib.dump(
    {
        "model_name": "Bottom-Up (Normalized)",
        "aggregation": "normalized",
        "constituents": norm_models,
        "features": FEATURES,
    },
    "artifacts/bottom_norm_model.joblib",
)

for fname in ["baseline_model.joblib", "bottom_unnorm_model.joblib", "bottom_norm_model.joblib"]:
    size_kb = os.path.getsize(f"artifacts/{fname}") / 1024
    print(f"{fname}: {size_kb:.1f} KB")
import pandas as pd

FEATURES = ["Return", "SMA_10", "SMA_50", "RSI", "MACD", "Volume"]


def calculate_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """Identical feature engineering pipeline used in baseline, bottom, and bottom2 notebooks."""
    data = df.copy()
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = data.columns.get_level_values(0)

    data["Return"] = data["Close"].pct_change()
    data["SMA_10"] = data["Close"].rolling(window=10).mean()
    data["SMA_50"] = data["Close"].rolling(window=50).mean()

    delta = data["Close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / (loss + 1e-9)
    data["RSI"] = 100 - (100 / (1 + rs))

    ema_12 = data["Close"].ewm(span=12, adjust=False).mean()
    ema_26 = data["Close"].ewm(span=26, adjust=False).mean()
    data["MACD"] = ema_12 - ema_26

    return data.dropna()
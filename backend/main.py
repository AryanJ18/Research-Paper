import os
import joblib
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.features import FEATURES, calculate_technical_indicators

app = FastAPI(title="Nifty 50 3-Model Forecasting Comparator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the 3 saved model artifacts exported from baseline.ipynb, bottom.ipynb, and bottom2.ipynb
baseline_bundle = joblib.load("artifacts/baseline_model.joblib")
unnorm_bundle = joblib.load("artifacts/bottom_unnorm_model.joblib")
norm_bundle = joblib.load("artifacts/bottom_norm_model.joblib")


def fetch_latest_row(ticker: str):
    """Fetches 6 months of daily data (needed for SMA_50) and returns the latest trading day's features & close."""
    raw = yf.download(ticker, period="6mo", auto_adjust=False, progress=False)
    if raw.empty:
        raise ValueError(f"Unable to fetch live market data for {ticker}")

    df = calculate_technical_indicators(raw)
    latest = df.iloc[[-1]]
    as_of_date = str(latest.index[-1].date())
    latest_close = float(latest["Close"].iloc[-1])
    prev_close = float(df["Close"].iloc[-2]) if len(df) >= 2 else latest_close
    day_change_pct = ((latest_close - prev_close) / prev_close) * 100

    return latest[FEATURES], latest_close, day_change_pct, as_of_date


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "loaded_models": [
            baseline_bundle["model_name"],
            unnorm_bundle["model_name"],
            norm_bundle["model_name"],
        ],
    }


@app.get("/api/predict")
def predict_all_models():
    try:
        # 1. Fetch Current Nifty 50 Data & Run Model 1: Top-Down (Baseline)
        X_nifty, nifty_close, nifty_day_chg, as_of_date = fetch_latest_row("^NSEI")
        X_nifty_scaled = baseline_bundle["scaler"].transform(X_nifty)
        pred_ret_base = float(baseline_bundle["model"].predict(X_nifty_scaled)[0])
        pred_price_base = nifty_close * (1 + pred_ret_base)

        # 2. Fetch Current Top 5 Constituents & Run Model 2 (Unnormalized) + Model 3 (Normalized)
        pred_ret_unnorm = 0.0
        pred_ret_norm = 0.0
        constituents_breakdown = []

        for symbol in unnorm_bundle["constituents"].keys():
            u_item = unnorm_bundle["constituents"][symbol]
            n_item = norm_bundle["constituents"][symbol]

            X_stock, stock_close, stock_day_chg, _ = fetch_latest_row(u_item["ticker"])

            # Predict using each notebook's saved scaler & model
            X_u_scaled = u_item["scaler"].transform(X_stock)
            r_unnorm = float(u_item["model"].predict(X_u_scaled)[0])

            X_n_scaled = n_item["scaler"].transform(X_stock)
            r_norm = float(n_item["model"].predict(X_n_scaled)[0])

            raw_w = float(u_item["weight"])
            norm_w = float(n_item["weight"])

            pred_ret_unnorm += r_unnorm * raw_w
            pred_ret_norm += r_norm * norm_w

            constituents_breakdown.append({
                "symbol": symbol,
                "ticker": u_item["ticker"],
                "current_price": round(stock_close, 2),
                "today_change_pct": round(stock_day_chg, 2),
                "raw_weight_pct": round(raw_w * 100, 2),
                "norm_weight_pct": round(norm_w * 100, 2),
                "predicted_next_return_pct": round(r_norm * 100, 3),
                "signal": "BULLISH (UP)" if r_norm > 0 else "BEARISH (DOWN)",
            })

        pred_price_unnorm = nifty_close * (1 + pred_ret_unnorm)
        pred_price_norm = nifty_close * (1 + pred_ret_norm)

        # 3. Compare All Three Models Side-by-Side
        models_comparison = [
            {
                "id": "baseline",
                "notebook": "baseline.ipynb",
                "name": "Model 1: Top-Down (Baseline)",
                "approach": "Direct composite Nifty 50 (^NSEI) forecast",
                "predicted_price": round(pred_price_base, 2),
                "point_change": round(pred_price_base - nifty_close, 2),
                "predicted_return_pct": round(pred_ret_base * 100, 3),
                "direction": "UP" if pred_ret_base > 0 else "DOWN",
                "paper_metrics": {"rmse": 227.50, "mape": "0.70%", "mda": "51.95%"},
            },
            {
                "id": "bottom_unnorm",
                "notebook": "bottom.ipynb",
                "name": "Model 2: Bottom-Up (Unnormalized)",
                "approach": "Top 5 raw weights (36.16%) + 0% drift for remaining 45 stocks",
                "predicted_price": round(pred_price_unnorm, 2),
                "point_change": round(pred_price_unnorm - nifty_close, 2),
                "predicted_return_pct": round(pred_ret_unnorm * 100, 3),
                "direction": "UP" if pred_ret_unnorm > 0 else "DOWN",
                "paper_metrics": {"rmse": 206.53, "mape": "0.64%", "mda": "47.03%"},
            },
            {
                "id": "bottom_norm",
                "notebook": "bottom2.ipynb",
                "name": "Model 3: Bottom-Up (Normalized)",
                "approach": "Top 5 heavyweight predictions scaled to 100% index weight",
                "predicted_price": round(pred_price_norm, 2),
                "point_change": round(pred_price_norm - nifty_close, 2),
                "predicted_return_pct": round(pred_ret_norm * 100, 3),
                "direction": "UP" if pred_ret_norm > 0 else "DOWN",
                "paper_metrics": {"rmse": 250.20, "mape": "0.80%", "mda": "48.05%"},
            },
        ]

        up_votes = sum(1 for m in models_comparison if m["direction"] == "UP")
        consensus = (
            "STRONG BULLISH (3/3 UP)" if up_votes == 3
            else "LEAN BULLISH (2/3 UP)" if up_votes == 2
            else "LEAN BEARISH (2/3 DOWN)" if up_votes == 1
            else "STRONG BEARISH (3/3 DOWN)"
        )

        return {
            "market": {
                "index": "NIFTY 50 (^NSEI)",
                "as_of_date": as_of_date,
                "current_price": round(nifty_close, 2),
                "today_change_pct": round(nifty_day_chg, 2),
                "consensus": consensus,
                "spread_points": round(
                    max(m["predicted_price"] for m in models_comparison)
                    - min(m["predicted_price"] for m in models_comparison),
                    2,
                ),
            },
            "models": models_comparison,
            "constituents": constituents_breakdown,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve React build in production (Docker / Render)
if os.path.isdir("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
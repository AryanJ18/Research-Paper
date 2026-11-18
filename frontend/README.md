# Nifty 50 Model Comparator (React frontend)

Calls `GET /api/predict` on the FastAPI backend and compares the 3 models
(Top-Down, Bottom-Up Unnormalized, Bottom-Up Normalized).

## Run locally
```bash
# terminal 1 (repo root)
pip install fastapi uvicorn yfinance joblib scikit-learn xgboost pandas
uvicorn backend.main:app --port 8000

# terminal 2
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api -> :8000)
```

## Production (Docker / Render)
`npm run build` outputs `frontend/dist`. Copy it to `./static` at the repo root
(`cp -r frontend/dist static`) and FastAPI serves it on the same origin
(see the `StaticFiles` mount at the bottom of `backend/main.py`).

Env vars: `VITE_API_URL` (API base, default same-origin), `VITE_PROXY_TARGET` (dev proxy target).

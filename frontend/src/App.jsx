import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPredictions } from "./api.js";
import {
  MarketHeader,
  ModelCard,
  ComparisonChart,
  ComparisonTable,
  ConstituentsTable,
} from "./components.jsx";

const AUTO_REFRESH_MS = 60_000;

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchedAt, setFetchedAt] = useState(null);
  const [auto, setAuto] = useState(false);
  const abortRef = useRef(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const json = await fetchPredictions(ctrl.signal);
      setData(json);
      setFetchedAt(new Date());
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "Something went wrong");
    } finally {
      if (abortRef.current === ctrl) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => abortRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(load, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [auto, load]);

  return (
    <div className="page">
      <header className="top">
        <div>
          <p className="eyebrow">Bottom-Up vs Top-Down</p>
          <h1>Nifty 50 Model Comparator</h1>
          <p className="sub">
            Live next-day forecast from all three models, run on the latest market data.
          </p>
        </div>
        <div className="actions">
          <button className="btn" onClick={load} disabled={loading}>
            {loading ? "Running models…" : "Run predictions"}
          </button>
          <label className="check">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-refresh every 60s
          </label>
          {fetchedAt && (
            <span className="muted small">Updated {fetchedAt.toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {error && (
        <div className="error" role="alert">
          <strong>Couldn’t get predictions.</strong> {error}
          <div className="small">
            Check the FastAPI server is running and that Yahoo Finance data is reachable.
          </div>
        </div>
      )}

      {!data && loading && (
        <div className="skeleton" aria-busy="true">
          Fetching live data and running three models… the first call can take 10–20 seconds.
        </div>
      )}

      {data && (
        <main className={loading ? "dim" : ""}>
          <MarketHeader market={data.market} />

          <section>
            <h2>Model outputs</h2>
            <div className="cards">
              {data.models.map((m) => (
                <ModelCard key={m.id} model={m} current={data.market.current_price} />
              ))}
            </div>
          </section>

          <section>
            <h2>Comparison</h2>
            <ComparisonChart models={data.models} />
            <ComparisonTable models={data.models} current={data.market.current_price} />
          </section>

          <section>
            <h2>Top 5 constituents</h2>
            <p className="muted small">
              Inputs to the two bottom-up models. Predicted return and signal come from the
              normalized model.
            </p>
            <ConstituentsTable rows={data.constituents} />
          </section>
        </main>
      )}

      <footer className="muted small">
        Research project, not financial advice. Paper metrics (RMSE, MAPE, MDA) are from the
        backtest, not live accuracy.
      </footer>
    </div>
  );
}

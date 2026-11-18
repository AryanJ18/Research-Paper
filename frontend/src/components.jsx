import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// One color per model, reused in cards and charts. Direction is also shown with arrows/text.
export const MODEL_COLORS = {
  baseline: "#3b6fd4",
  bottom_unnorm: "#d9801a",
  bottom_norm: "#1f9d7a",
};
const SHORT_NAMES = {
  baseline: "Top-Down",
  bottom_unnorm: "Bottom-Up (Unnorm.)",
  bottom_norm: "Bottom-Up (Norm.)",
};

const inr = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n) => inr.format(n);
const signed = (n, digits = 2) => `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const dirClass = (n) => (n > 0 ? "up" : n < 0 ? "down" : "flat");
const arrow = (n) => (n > 0 ? "▲" : n < 0 ? "▼" : "–");

export function MarketHeader({ market }) {
  return (
    <section className="market">
      <div>
        <p className="eyebrow">{market.index}</p>
        <div className="price">{fmt(market.current_price)}</div>
        <div className={`chg ${dirClass(market.today_change_pct)}`}>
          {arrow(market.today_change_pct)} {signed(market.today_change_pct)}% today
        </div>
        <p className="muted small">As of {market.as_of_date} close</p>
      </div>
      <div className="market-stats">
        <div>
          <span className="label">Consensus</span>
          <span
            className={`pill ${
              market.consensus.includes("BULLISH") ? "up" : "down"
            }`}
          >
            {market.consensus}
          </span>
        </div>
        <div>
          <span className="label">Spread between models</span>
          <span className="stat">{fmt(market.spread_points)} pts</span>
        </div>
      </div>
    </section>
  );
}

export function ModelCard({ model, current }) {
  const color = MODEL_COLORS[model.id];
  const { rmse, mape, mda } = model.paper_metrics;
  return (
    <article className="card" style={{ "--accent": color }}>
      <div className="card-head">
        <span className="dot" />
        <h3>{model.name}</h3>
      </div>
      <p className="muted small approach">{model.approach}</p>

      <div className="label">Predicted next close</div>
      <div className="big">{fmt(model.predicted_price)}</div>
      <div className={`chg ${dirClass(model.point_change)}`}>
        {arrow(model.point_change)} {signed(model.point_change)} pts ({signed(model.predicted_return_pct, 3)}%)
      </div>
      <div className="small muted">vs current {fmt(current)}</div>

      <div className={`pill ${model.direction === "UP" ? "up" : "down"}`}>
        {model.direction === "UP" ? "▲ UP" : "▼ DOWN"}
      </div>

      <dl className="metrics">
        <div>
          <dt>RMSE</dt>
          <dd>{rmse}</dd>
        </div>
        <div>
          <dt>MAPE</dt>
          <dd>{mape}</dd>
        </div>
        <div>
          <dt>MDA</dt>
          <dd>{mda}</dd>
        </div>
      </dl>
      <p className="muted tiny">{model.notebook}</p>
    </article>
  );
}

const METRICS = [
  {
    key: "ret",
    label: "Predicted return %",
    unit: "%",
    get: (m) => m.predicted_return_pct,
    fmt: (v) => `${signed(v, 3)}%`,
    diverging: true,
  },
  {
    key: "pts",
    label: "Point change",
    unit: " pts",
    get: (m) => m.point_change,
    fmt: (v) => `${signed(v)} pts`,
    diverging: true,
  },
  {
    key: "rmse",
    label: "RMSE (paper, lower is better)",
    unit: "",
    get: (m) => m.paper_metrics.rmse,
    fmt: (v) => v.toFixed(2),
  },
  {
    key: "mape",
    label: "MAPE % (paper, lower is better)",
    unit: "%",
    get: (m) => parseFloat(m.paper_metrics.mape),
    fmt: (v) => `${v.toFixed(2)}%`,
  },
  {
    key: "mda",
    label: "MDA % (paper, higher is better)",
    unit: "%",
    get: (m) => parseFloat(m.paper_metrics.mda),
    fmt: (v) => `${v.toFixed(2)}%`,
  },
];

export function ComparisonChart({ models }) {
  const [metricKey, setMetricKey] = useState("ret");
  const metric = METRICS.find((m) => m.key === metricKey);
  const data = models.map((m) => ({
    id: m.id,
    name: SHORT_NAMES[m.id] ?? m.name,
    value: metric.get(m),
  }));

  return (
    <div className="chart-box">
      <div className="seg" role="tablist" aria-label="Comparison metric">
        {METRICS.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={m.key === metricKey}
            className={m.key === metricKey ? "on" : ""}
            onClick={() => setMetricKey(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={56}
              domain={metric.diverging ? ["auto", "auto"] : [0, "auto"]}
            />
            {metric.diverging && <ReferenceLine y={0} stroke="var(--muted)" />}
            <Tooltip
              cursor={{ fill: "var(--grid)", opacity: 0.4 }}
              formatter={(v) => [metric.fmt(v), metric.label]}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                color: "var(--text)",
              }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={96}>
              {data.map((d) => (
                <Cell key={d.id} fill={MODEL_COLORS[d.id]} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={metric.fmt}
                style={{ fill: "var(--text)", fontSize: 12, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ComparisonTable({ models, current }) {
  const avg = models.reduce((s, m) => s + m.predicted_price, 0) / models.length;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th className="num">Predicted close</th>
            <th className="num">Change (pts)</th>
            <th className="num">Return</th>
            <th>Direction</th>
            <th className="num">vs model avg</th>
            <th className="num">RMSE</th>
            <th className="num">MAPE</th>
            <th className="num">MDA</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td>
                <span className="dot sm" style={{ background: MODEL_COLORS[m.id] }} />
                {m.name}
              </td>
              <td className="num">{fmt(m.predicted_price)}</td>
              <td className={`num ${dirClass(m.point_change)}`}>{signed(m.point_change)}</td>
              <td className={`num ${dirClass(m.predicted_return_pct)}`}>{signed(m.predicted_return_pct, 3)}%</td>
              <td className={dirClass(m.point_change)}>{arrow(m.point_change)} {m.direction}</td>
              <td className="num">{signed(m.predicted_price - avg)}</td>
              <td className="num">{m.paper_metrics.rmse}</td>
              <td className="num">{m.paper_metrics.mape}</td>
              <td className="num">{m.paper_metrics.mda}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Current index</td>
            <td className="num">{fmt(current)}</td>
            <td colSpan={7} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function ConstituentsTable({ rows }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Stock</th>
            <th className="num">Price</th>
            <th className="num">Today</th>
            <th className="num">Raw weight</th>
            <th className="num">Norm. weight</th>
            <th className="num">Predicted next return</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol}>
              <td>
                <strong>{r.symbol}</strong> <span className="muted small">{r.ticker}</span>
              </td>
              <td className="num">{fmt(r.current_price)}</td>
              <td className={`num ${dirClass(r.today_change_pct)}`}>{signed(r.today_change_pct)}%</td>
              <td className="num">{r.raw_weight_pct.toFixed(2)}%</td>
              <td className="num">{r.norm_weight_pct.toFixed(2)}%</td>
              <td className={`num ${dirClass(r.predicted_next_return_pct)}`}>{signed(r.predicted_next_return_pct, 3)}%</td>
              <td className={r.signal.includes("BULLISH") ? "up" : "down"}>
                {r.signal.includes("BULLISH") ? "▲" : "▼"} {r.signal}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

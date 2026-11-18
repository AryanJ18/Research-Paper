// Empty base = same origin (production) or Vite dev proxy. Set VITE_API_URL to point elsewhere.
const BASE = import.meta.env.VITE_API_URL ?? "";

async function request(path, signal) {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail;
    } catch {
      /* body was not JSON */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export const fetchPredictions = (signal) => request("/api/predict", signal);
export const fetchHealth = (signal) => request("/api/health", signal);

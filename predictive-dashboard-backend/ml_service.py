"""
ml_service.py — Persistent ML microservice
Node.js calls this via HTTP instead of spawning Python per tick.

Run once:  python ml_service.py
Then start: node server.js
"""

from flask import Flask, request, jsonify
import pickle
import numpy as np
import os, sys

app = Flask(__name__)

# ── Load models once at startup ───────────────────────────────────────────────
BASE = os.path.dirname(os.path.abspath(__file__))

def load(name):
    path = os.path.join(BASE, name)
    if not os.path.exists(path):
        print(f"❌ {name} not found — run: python train.py first")
        sys.exit(1)
    with open(path, "rb") as f:
        return pickle.load(f)

print("Loading models...")
lr     = load("rul_lr_model.pkl")
rf     = load("mtbf_rf_model.pkl")
scaler = load("scaler.pkl")
print("✅ Models loaded — ML service ready on port 5001")

ALERT_RUL = 72  # 72 cycles = 72 hours = 3 days

# ── Single engine prediction ──────────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
def predict():
    body = request.get_json()
    try:
        cycle = float(body["cycle"])
        s2    = float(body["s2"])
        s11   = float(body["s11"])
        s15   = float(body["s15"])
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": str(e)}), 400

    X        = np.array([[cycle, s2, s11, s15]])
    X_scaled = scaler.transform(X)

    rul        = max(0, int(round(lr.predict(X_scaled)[0])))
    # MTBF = cycle + RUL = total expected engine lifetime
    # RF predicts total lifetime; if it's less than cycle+rul, use cycle+rul
    rf_mtbf    = int(round(rf.predict(X_scaled)[0]))
    mtbf       = max(rf_mtbf, int(cycle) + rul)
    failure_risk = round(max(0, min(100, (1 - rul / max(mtbf, 1)) * 100)), 1)

    return jsonify({
        "rul":          rul,
        "mtbf":         mtbf,
        "failure_risk": failure_risk,
        "alert":        rul < ALERT_RUL,
        "alert_level":  "critical" if rul < 24 else ("warning" if rul < ALERT_RUL else "ok"),
    })

# ── Batch prediction (all engines in one call) ────────────────────────────────
@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    engines = request.get_json()   # list of {engine_id, cycle, s2, s11, s15}
    if not isinstance(engines, list):
        return jsonify({"error": "Expected a list"}), 400

    results = []
    for e in engines:
        try:
            X        = np.array([[float(e["cycle"]), float(e["s2"]), float(e["s11"]), float(e["s15"])]])
            X_scaled = scaler.transform(X)
            rul      = max(0, int(round(lr.predict(X_scaled)[0])))
            rf_mtbf  = int(round(rf.predict(X_scaled)[0]))
            mtbf     = max(rf_mtbf, int(float(e["cycle"])) + rul)
            risk     = round(max(0, min(100, (1 - rul / max(mtbf, 1)) * 100)), 1)
            results.append({
                "engine_id":    e.get("engine_id"),
                "rul":          rul,
                "mtbf":         mtbf,
                "failure_risk": risk,
                "alert":        rul < ALERT_RUL,
                "alert_level":  "critical" if rul < 24 else ("warning" if rul < ALERT_RUL else "ok"),
            })
        except Exception as ex:
            results.append({"engine_id": e.get("engine_id"), "error": str(ex)})

    return jsonify(results)

@app.route("/health")
def health():
    return jsonify({"status": "ok", "models": ["LinearRegression", "RandomForest"]})

if __name__ == "__main__":
    app.run(port=5001, debug=False)
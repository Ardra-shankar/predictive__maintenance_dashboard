"""
predict.py — Called by server.js per engine tick.

Usage:
    python predict.py <cycle> <s2> <s11> <s15>

Prints a single JSON line to stdout.
"""

import sys
import json
import pickle
import numpy as np
import os

# ── Load models once (fast on repeated calls if OS caches the files) ──────────
BASE = os.path.dirname(os.path.abspath(__file__))

def load(name):
    path = os.path.join(BASE, name)
    if not os.path.exists(path):
        raise FileNotFoundError(f"{name} not found — run: python train.py")
    with open(path, "rb") as f:
        return pickle.load(f)

try:
    lr     = load("rul_lr_model.pkl")
    rf     = load("mtbf_rf_model.pkl")
    scaler = load("scaler.pkl")
except FileNotFoundError as e:
    # Graceful fallback so server.js can still use its health-based estimate
    print(json.dumps({"error": str(e)}))
    sys.exit(1)

# ── Parse args ────────────────────────────────────────────────────────────────
# FIX: old predict.py took engine_id — server.js actually passes cycle s2 s11 s15
if len(sys.argv) < 5:
    print(json.dumps({"error": "Usage: predict.py <cycle> <s2> <s11> <s15>"}))
    sys.exit(1)

try:
    cycle = float(sys.argv[1])
    s2    = float(sys.argv[2])
    s11   = float(sys.argv[3])
    s15   = float(sys.argv[4])
except ValueError as e:
    print(json.dumps({"error": f"Bad argument: {e}"}))
    sys.exit(1)

# ── Predict ───────────────────────────────────────────────────────────────────
X = np.array([[cycle, s2, s11, s15]])
X_scaled = scaler.transform(X)

rul  = max(0, int(round(lr.predict(X_scaled)[0])))
mtbf = max(rul, int(round(rf.predict(X_scaled)[0])))

failure_risk_pct = round(max(0, min(100, (1 - rul / max(mtbf, 1)) * 100)), 1)

result = {
    "rul":          rul,
    "mtbf":         mtbf,
    "failure_risk": failure_risk_pct,
    "alert":        rul < 48,
    "alert_level":  "critical" if rul < 20 else ("warning" if rul < 48 else "ok"),
}

print(json.dumps(result))
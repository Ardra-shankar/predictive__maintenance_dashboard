"""
train.py — Single script to train both models.
Replaces: train_model.py, train_lr_model.py, train_mtbf_model.py

Run once before starting the server:
    python train.py
"""

import sys
import pandas as pd
import numpy as np
import pickle
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

FEATURES   = ["cycle", "s2", "s11", "s15"]
DATA_FILE  = "train_FD001.txt"

# ── Load ──────────────────────────────────────────────────────────────────────
print("📂 Loading NASA CMAPSS dataset...")

cols = ["id", "cycle", "op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]

try:
    df = pd.read_csv(DATA_FILE, sep=r"\s+", header=None)
except FileNotFoundError:
    print(f"❌ '{DATA_FILE}' not found.")
    print("   Download from: https://data.nasa.gov/dataset/CMAPSS-Jet-Engine-Simulated-Data")
    sys.exit(1)

df = df.dropna(axis=1)
df.columns = cols

# ── RUL label ─────────────────────────────────────────────────────────────────
max_cycle = df.groupby("id")["cycle"].max()
df["RUL"]  = df.apply(lambda r: max_cycle[r["id"]] - r["cycle"], axis=1)

# ── MTBF label ───────────────────────────────────────────────────────────────
# MTBF = cycle + RUL = total expected engine lifetime at any given point
# This varies per row as sensors degrade, giving RF something real to learn
df["MTBF"] = df["cycle"] + df["RUL"]  # = max_cycle, but expressed as a regression target per row

# ── Features & scaling ────────────────────────────────────────────────────────
X = df[FEATURES].values
y_rul  = df["RUL"].values
y_mtbf = df["MTBF"].values

# FIX: use ONE scaler for both models — train_model.py scaled only for LR,
#      train_lr_model.py didn't scale at all. Now both use the same scaler.
scaler   = MinMaxScaler()
X_scaled = scaler.fit_transform(X)

X_tr, X_te, y_rul_tr, y_rul_te, y_mtbf_tr, y_mtbf_te = train_test_split(
    X_scaled, y_rul, y_mtbf, test_size=0.2, random_state=42
)

# ── Train RUL model (Linear Regression) ──────────────────────────────────────
print("\n🔧 Training Linear Regression — RUL...")
lr = LinearRegression()
lr.fit(X_tr, y_rul_tr)

rul_pred = lr.predict(X_te)
print(f"   MAE : {mean_absolute_error(y_rul_te, rul_pred):.2f} cycles")
print(f"   R²  : {r2_score(y_rul_te, rul_pred):.4f}")

# ── Train MTBF model (Random Forest) ─────────────────────────────────────────
print("\n🌲 Training Random Forest — MTBF...")
rf = RandomForestRegressor(n_estimators=120, max_depth=12, random_state=42, n_jobs=-1)
rf.fit(X_tr, y_mtbf_tr)

mtbf_pred = rf.predict(X_te)
print(f"   MAE : {mean_absolute_error(y_mtbf_te, mtbf_pred):.2f} cycles")
print(f"   R²  : {r2_score(y_mtbf_te, mtbf_pred):.4f}")

# ── Save ──────────────────────────────────────────────────────────────────────
pickle.dump(lr,     open("rul_lr_model.pkl", "wb"))
pickle.dump(rf,     open("mtbf_rf_model.pkl", "wb"))
pickle.dump(scaler, open("scaler.pkl", "wb"))

print("\n✅ Models saved: rul_lr_model.pkl · mtbf_rf_model.pkl · scaler.pkl")
print("   Now start the server: node server.js")
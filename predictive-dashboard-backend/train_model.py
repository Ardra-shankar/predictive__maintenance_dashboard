"""
train.py — Train RUL and MTBF models on NASA CMAPSS Dataset

SUPERVISED LEARNING — labels are engineered from the data structure:
  - RUL  (Remaining Useful Life)  → target for Linear Regression
  - MTBF (Mean Time Between Failures) → target for Random Forest

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

# ── Config ────────────────────────────────────────────────────────────────────
DATA_FILE = "train_FD001.txt"

# Feature selection — only 4 out of 26 columns used
# cycle : age of engine — strongest predictor (correlation -0.95 with RUL)
# s2    : LPC outlet temperature — rises as engine degrades
# s11   : HPC outlet static pressure — drops as components wear
# s15   : bypass ratio — shifts as engine efficiency decreases
# All other sensors are either constant (std=0) or noisy in FD001
FEATURES = ["cycle", "s2", "s11", "s15"]

# ── Step 1: Load raw data ─────────────────────────────────────────────────────
print("=" * 55)
print("  NASA CMAPSS Predictive Maintenance — Model Training")
print("=" * 55)
print("\n📂 Step 1: Loading NASA CMAPSS dataset...")

# Column names assigned manually — raw file has no header row
# Layout: id | cycle | op1 op2 op3 | s1 s2 ... s21
cols = ["id", "cycle", "op1", "op2", "op3"] + [f"s{i}" for i in range(1, 22)]

try:
    df = pd.read_csv(DATA_FILE, sep=r"\s+", header=None)
except FileNotFoundError:
    print(f"\n❌ '{DATA_FILE}' not found.")
    print("   Download from: https://data.nasa.gov/dataset/CMAPSS-Jet-Engine-Simulated-Data")
    sys.exit(1)

# Raw file has trailing spaces → pandas creates extra NaN columns → drop them
df = df.dropna(axis=1)
df.columns = cols

print(f"   Loaded {len(df):,} rows | {df['id'].nunique()} engines | {len(df.columns)} columns")
print(f"   Engines run between {df.groupby('id')['cycle'].max().min()} "
      f"and {df.groupby('id')['cycle'].max().max()} cycles before failure")

# ── Step 2: Data Cleaning ─────────────────────────────────────────────────────
print("\n🧹 Step 2: Data Cleaning...")

missing = df.isnull().sum().sum()
print(f"   Missing values after dropna: {missing}")

# Check which sensors are constant (std=0 = useless for prediction)
sensor_cols = [f"s{i}" for i in range(1, 22)]
std_vals    = df[sensor_cols].std()
constant    = std_vals[std_vals < 0.001].index.tolist()
varying     = std_vals[std_vals >= 0.001].index.tolist()

print(f"   Constant sensors (std~0, removed) : {constant}")
print(f"   Varying sensors  (usable)         : {varying}")
print(f"   Features selected for training    : {FEATURES}")

# ── Step 3: Label Engineering ─────────────────────────────────────────────────
# This is what makes supervised learning possible.
# The raw dataset has NO labels — RUL and MTBF must be calculated.
#
# Key insight: dataset is run-to-failure
#   → last cycle recorded for each engine = the cycle it failed
#   → RUL at any cycle = (failure cycle) - (current cycle)
print("\n🏷️  Step 3: Label Engineering (creating supervised labels)...")

# Find the failure cycle for each engine
max_cycle = df.groupby("id")["cycle"].max()
print(f"   Example: Engine 1 failed at cycle {max_cycle[1]}")

# RUL = cycles remaining before failure (counts down to 0)
df["RUL"] = df.apply(lambda r: max_cycle[r["id"]] - r["cycle"], axis=1)

# MTBF = total expected engine lifetime = current cycle + remaining life
df["MTBF"] = df["cycle"] + df["RUL"]

print(f"   RUL  range : {df['RUL'].min()} to {df['RUL'].max()} cycles")
print(f"   MTBF range : {df['MTBF'].min()} to {df['MTBF'].max()} cycles")
print(f"\n   Engine 1 label sample:")
sample = df[df["id"] == 1][["cycle", "RUL", "MTBF"]].iloc[[0, 49, 99, -2, -1]]
print(sample.to_string(index=False))

# ── Step 4: Feature Selection ─────────────────────────────────────────────────
print("\n🎯 Step 4: Feature Selection...")

X      = df[FEATURES].values
y_rul  = df["RUL"].values
y_mtbf = df["MTBF"].values

print("   Correlation of each feature with RUL:")
for feat in FEATURES:
    corr = df[feat].corr(df["RUL"])
    bar  = "█" * int(abs(corr) * 20)
    print(f"   {feat:>6} : {corr:+.4f}  {bar}")

print(f"\n   Input  shape (X)       : {X.shape}")
print(f"   Label  shape (y_rul)   : {y_rul.shape}")
print(f"   Label  shape (y_mtbf)  : {y_mtbf.shape}")

# ── Step 5: Normalization ─────────────────────────────────────────────────────
# MinMaxScaler → all features scaled to 0–1 range
# Without this: cycle (1–350) dominates s15 (8.3–8.5) in Linear Regression
print("\n📐 Step 5: Normalization (MinMaxScaler 0 to 1)...")

print("   Before scaling:")
for i, feat in enumerate(FEATURES):
    print(f"   {feat:>6} : min={X[:,i].min():.2f}  max={X[:,i].max():.2f}")

scaler   = MinMaxScaler()
X_scaled = scaler.fit_transform(X)

print("   After scaling:")
for i, feat in enumerate(FEATURES):
    print(f"   {feat:>6} : min={X_scaled[:,i].min():.2f}  max={X_scaled[:,i].max():.2f}")

# ── Step 6: Train / Test Split ────────────────────────────────────────────────
# 80% → model learns from these
# 20% → held back, never seen during training, used to measure real accuracy
print("\n✂️  Step 6: Train/Test Split (80/20)...")

X_tr, X_te, y_rul_tr, y_rul_te, y_mtbf_tr, y_mtbf_te = train_test_split(
    X_scaled, y_rul, y_mtbf,
    test_size=0.2,
    random_state=42    # fixed seed = same split every run = reproducible
)

print(f"   Training rows : {len(X_tr):,}  (80%)")
print(f"   Testing rows  : {len(X_te):,}  (20%)")

# ── Step 7: Train Linear Regression → RUL ────────────────────────────────────
# Why LR for RUL?
#   Engine degradation is roughly linear over time.
#   LR finds best-fit line: RUL = w1*cycle + w2*s2 + w3*s11 + w4*s15 + bias
print("\n🔧 Step 7: Training Linear Regression for RUL prediction...")

lr = LinearRegression()
lr.fit(X_tr, y_rul_tr)

rul_pred = lr.predict(X_te)
rul_mae  = mean_absolute_error(y_rul_te, rul_pred)
rul_r2   = r2_score(y_rul_te, rul_pred)

print(f"   Weights learned by the model:")
for feat, coef in zip(FEATURES, lr.coef_):
    print(f"   {feat:>6} weight : {coef:+.4f}")
print(f"   Bias (intercept)   : {lr.intercept_:.4f}")
print(f"\n   MAE : {rul_mae:.2f} cycles  (average prediction error)")
print(f"   R²  : {rul_r2:.4f}         (1.0 = perfect)")

# ── Step 8: Train Random Forest → MTBF ───────────────────────────────────────
# Why RF for MTBF?
#   Total engine lifetime has complex non-linear sensor interactions.
#   RF builds 120 trees, averages predictions → stable and accurate.
print("\n🌲 Step 8: Training Random Forest for MTBF prediction...")
print("   Building 120 trees (may take 20-30 seconds)...")

rf = RandomForestRegressor(
    n_estimators=120,   # 120 decision trees
    max_depth=12,       # max depth per tree
    random_state=42,
    n_jobs=-1           # use all CPU cores
)
rf.fit(X_tr, y_mtbf_tr)

mtbf_pred = rf.predict(X_te)
mtbf_mae  = mean_absolute_error(y_mtbf_te, mtbf_pred)
mtbf_r2   = r2_score(y_mtbf_te, mtbf_pred)

print(f"   Feature importances (contribution to prediction):")
for feat, imp in zip(FEATURES, rf.feature_importances_):
    bar = "█" * int(imp * 40)
    print(f"   {feat:>6} : {imp:.4f}  {bar}")

print(f"\n   MAE : {mtbf_mae:.2f} cycles")
print(f"   R²  : {mtbf_r2:.4f}")

# ── Step 9: Save trained models ───────────────────────────────────────────────
print("\n💾 Step 9: Saving trained models to disk (pickle)...")

pickle.dump(lr,     open("rul_lr_model.pkl",  "wb"))
pickle.dump(rf,     open("mtbf_rf_model.pkl", "wb"))
pickle.dump(scaler, open("scaler.pkl",        "wb"))

print("   rul_lr_model.pkl  — Linear Regression weights for RUL")
print("   mtbf_rf_model.pkl — Random Forest (120 trees) for MTBF")
print("   scaler.pkl        — MinMaxScaler fitted on training data")

# ── Final Summary ─────────────────────────────────────────────────────────────
print("\n" + "=" * 55)
print("  Training Complete")
print("=" * 55)
print(f"  Dataset       : {len(df):,} rows | {df['id'].nunique()} engines")
print(f"  Features used : {FEATURES}")
print(f"  LR  (RUL)     : MAE = {rul_mae:.1f} cycles | R² = {rul_r2:.4f}")
print(f"  RF  (MTBF)    : MAE = {mtbf_mae:.1f} cycles | R² = {mtbf_r2:.4f}")
print("=" * 55)
print("\n  Next: python ml_service.py")
print("  Then: node server.js\n")
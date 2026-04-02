"""
metrics.py — Detailed evaluation metrics for both ML models
Run after train.py:
    python metrics.py

Shows: MAE, RMSE, R², Accuracy, Precision, Recall, F1
for both Linear Regression (RUL) and Random Forest (MTBF)
"""

import pickle
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)
from sklearn.model_selection import train_test_split

# ── Load models ───────────────────────────────────────────────────────────────
print("=" * 60)
print("  ML Model Evaluation Metrics")
print("=" * 60)

try:
    lr     = pickle.load(open("rul_lr_model.pkl",  "rb"))
    rf     = pickle.load(open("mtbf_rf_model.pkl", "rb"))
    scaler = pickle.load(open("scaler.pkl",        "rb"))
    print("\n✅ Models loaded successfully")
except FileNotFoundError:
    print("❌ Models not found. Run: python train.py first")
    exit(1)

# ── Recreate dataset (same as train.py) ───────────────────────────────────────
print("📂 Loading dataset...")
cols = ["id","cycle","op1","op2","op3"] + [f"s{i}" for i in range(1,22)]
df   = pd.read_csv("train_FD001.txt", sep=r"\s+", header=None)
df   = df.dropna(axis=1)
df.columns = cols

max_cycle  = df.groupby("id")["cycle"].max()
df["RUL"]  = df.apply(lambda r: max_cycle[r["id"]] - r["cycle"], axis=1)
df["MTBF"] = df["cycle"] + df["RUL"]

FEATURES = ["cycle", "s2", "s11", "s15"]
X        = scaler.transform(df[FEATURES].values)
y_rul    = df["RUL"].values
y_mtbf   = df["MTBF"].values

_, X_te, _, y_rul_te, _, y_mtbf_te = train_test_split(
    X, y_rul, y_mtbf, test_size=0.2, random_state=42
)

rul_pred  = lr.predict(X_te)
mtbf_pred = rf.predict(X_te)

# ═══════════════════════════════════════════════════════════
# SECTION 1 — REGRESSION METRICS (for both models)
# These are the standard metrics for regression problems
# ═══════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  SECTION 1 — Regression Metrics")
print("  (RUL and MTBF are continuous values → regression problem)")
print("═" * 60)

def regression_metrics(y_true, y_pred, model_name, target):
    mae  = mean_absolute_error(y_true, y_pred)
    mse  = mean_squared_error(y_true, y_pred)
    rmse = np.sqrt(mse)
    r2   = r2_score(y_true, y_pred)
    mape = np.mean(np.abs((y_true - y_pred) / np.maximum(y_true, 1))) * 100

    print(f"\n  {model_name} → {target}")
    print(f"  {'─'*45}")
    print(f"  MAE  (Mean Absolute Error)      : {mae:.2f} cycles")
    print(f"       → On average, prediction is off by {mae:.1f} cycles")
    print(f"  RMSE (Root Mean Squared Error)  : {rmse:.2f} cycles")
    print(f"       → Penalizes large errors more than MAE")
    print(f"  MSE  (Mean Squared Error)       : {mse:.2f}")
    print(f"  MAPE (Mean Abs Percentage Error): {mape:.2f}%")
    print(f"       → Prediction is off by {mape:.1f}% on average")
    print(f"  R²   (Coefficient of Determination): {r2:.4f}")
    print(f"       → Model explains {r2*100:.1f}% of variance in {target}")
    print(f"       → (1.0 = perfect | 0.0 = no better than mean)")
    return mae, rmse, r2

lr_mae, lr_rmse, lr_r2 = regression_metrics(y_rul_te,  rul_pred,  "Linear Regression", "RUL")
rf_mae, rf_rmse, rf_r2 = regression_metrics(y_mtbf_te, mtbf_pred, "Random Forest",     "MTBF")

# ═══════════════════════════════════════════════════════════
# SECTION 2 — CLASSIFICATION METRICS
# Convert regression to classification:
#   Alert = 1 if RUL < 72 (failure within 3 days)
#   OK    = 0 if RUL >= 72
# This lets us calculate Accuracy, Precision, Recall, F1
# ═══════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  SECTION 2 — Classification Metrics")
print("  (Converting RUL prediction to Alert/No-Alert classification)")
print("  Threshold: RUL < 72 cycles = ALERT (failure within 3 days)")
print("═" * 60)

THRESHOLD = 72   # cycles = 3 days

# True labels — based on actual RUL
y_true_class = (y_rul_te < THRESHOLD).astype(int)

# Predicted labels — based on predicted RUL
y_pred_class = (rul_pred < THRESHOLD).astype(int)

acc  = accuracy_score(y_true_class, y_pred_class)
prec = precision_score(y_true_class, y_pred_class, zero_division=0)
rec  = recall_score(y_true_class, y_pred_class, zero_division=0)
f1   = f1_score(y_true_class, y_pred_class, zero_division=0)
cm   = confusion_matrix(y_true_class, y_pred_class)

print(f"\n  Linear Regression — Alert Classification (RUL < {THRESHOLD})")
print(f"  {'─'*45}")
print(f"  Accuracy  : {acc:.4f}  ({acc*100:.1f}%)")
print(f"  → Out of all predictions, {acc*100:.1f}% were correctly classified")
print(f"\n  Precision : {prec:.4f}  ({prec*100:.1f}%)")
print(f"  → Of all predicted ALERTS, {prec*100:.1f}% were actual alerts")
print(f"  → Low precision = too many false alarms")
print(f"\n  Recall    : {rec:.4f}  ({rec*100:.1f}%)")
print(f"  → Of all actual ALERTS, {rec*100:.1f}% were correctly caught")
print(f"  → Low recall = missing real failures (dangerous!)")
print(f"\n  F1 Score  : {f1:.4f}  ({f1*100:.1f}%)")
print(f"  → Harmonic mean of Precision and Recall")
print(f"  → Best single metric for imbalanced alert detection")

print(f"\n  Confusion Matrix:")
print(f"  {'─'*35}")
print(f"                  Predicted")
print(f"                  OK    ALERT")
print(f"  Actual  OK    [ {cm[0][0]:5d}  {cm[0][1]:5d} ]")
print(f"          ALERT [ {cm[1][0]:5d}  {cm[1][1]:5d} ]")
print(f"\n  True Negatives  (OK → OK)       : {cm[0][0]}")
print(f"  False Positives (OK → ALERT)    : {cm[0][1]}  ← false alarms")
print(f"  False Negatives (ALERT → OK)    : {cm[1][0]}  ← missed failures ⚠")
print(f"  True Positives  (ALERT → ALERT) : {cm[1][1]}")

# Same for Random Forest MTBF → alert classification
print(f"\n  Random Forest — Alert Classification (MTBF-based risk)")
print(f"  {'─'*45}")
# For RF: predict alert if predicted MTBF is close to current cycle
# Using test set cycle approximation from y_rul and y_mtbf
approx_cycle = y_mtbf_te - y_rul_te
rf_rul_approx = mtbf_pred - approx_cycle
y_pred_rf_class = (rf_rul_approx < THRESHOLD).astype(int)

acc_rf  = accuracy_score(y_true_class, y_pred_rf_class)
prec_rf = precision_score(y_true_class, y_pred_rf_class, zero_division=0)
rec_rf  = recall_score(y_true_class, y_pred_rf_class, zero_division=0)
f1_rf   = f1_score(y_true_class, y_pred_rf_class, zero_division=0)

print(f"  Accuracy  : {acc_rf:.4f}  ({acc_rf*100:.1f}%)")
print(f"  Precision : {prec_rf:.4f}  ({prec_rf*100:.1f}%)")
print(f"  Recall    : {rec_rf:.4f}  ({rec_rf*100:.1f}%)")
print(f"  F1 Score  : {f1_rf:.4f}  ({f1_rf*100:.1f}%)")

# ═══════════════════════════════════════════════════════════
# SECTION 3 — FINAL COMPARISON TABLE
# ═══════════════════════════════════════════════════════════
print("\n" + "═" * 60)
print("  SECTION 3 — Final Comparison Table")
print("═" * 60)
print(f"""
  ┌─────────────────────┬──────────────────┬──────────────────┐
  │ Metric              │ Linear Regression│  Random Forest   │
  │                     │    (RUL)         │    (MTBF)        │
  ├─────────────────────┼──────────────────┼──────────────────┤
  │ MAE  (cycles)       │   {lr_mae:>8.2f}     │   {rf_mae:>8.2f}     │
  │ RMSE (cycles)       │   {lr_rmse:>8.2f}     │   {rf_rmse:>8.2f}     │
  │ R² Score            │   {lr_r2:>8.4f}     │   {rf_r2:>8.4f}     │
  │ Accuracy (alert)    │   {acc:>8.4f}     │   {acc_rf:>8.4f}     │
  │ Precision           │   {prec:>8.4f}     │   {prec_rf:>8.4f}     │
  │ Recall              │   {rec:>8.4f}     │   {rec_rf:>8.4f}     │
  │ F1 Score            │   {f1:>8.4f}     │   {f1_rf:>8.4f}     │
  └─────────────────────┴──────────────────┴──────────────────┘
""")

print("  What each metric means:")
print("  MAE       → average error in cycles (lower = better)")
print("  RMSE      → error penalizing big mistakes (lower = better)")
print("  R²        → how well model fits data (1.0 = perfect)")
print("  Accuracy  → % of alert/no-alert correctly classified")
print("  Precision → of predicted alerts, how many were real")
print("  Recall    → of real alerts, how many were caught")
print("  F1        → balance of precision and recall (higher = better)")
print("\n" + "=" * 60)

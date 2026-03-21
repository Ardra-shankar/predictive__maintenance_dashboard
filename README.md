# AI-Driven Fleet Predictive Maintenance System 

## 📌 Project Overview

This project presents a **machine learning–based predictive maintenance platform** designed to estimate the **Remaining Useful Life (RUL)** of fleet engines and provide early maintenance alerts.

The system simulates real-time sensor data, predicts engine degradation using a trained ML model, and visualizes fleet health through an interactive dashboard.

It demonstrates concepts from:

* Prognostics and Health Management (PHM)
* Reliability Engineering
* Condition-Based Maintenance
* Full-Stack Industrial Monitoring Systems

---

 Objectives

* Predict engine failure before it occurs
* Reduce unexpected downtime
* Support intelligent maintenance scheduling
* Provide fleet-level reliability analytics
* Visualize degradation trends in real time

---

##  Machine Learning Approach

* Dataset: **NASA Turbofan Engine Degradation Dataset**
* Problem Type: **Regression (RUL Prediction)**
* Model Used: **Random Forest Regressor**
* Features:

  * Operating cycle
  * Selected sensor measurements
* Output:

  * Predicted Remaining Useful Life (cycles)

Model evaluation performed using:

* RMSE
* MAE
* R² Score

---

##  System Architecture

Sensor Simulation → ML Prediction Engine → Node.js Backend API
→ MongoDB Predictive Logging → React Fleet Dashboard

The architecture mimics **real aerospace fleet monitoring systems**.

---

##  Key Features

✅ Real-time fleet engine simulation
✅ Remaining Useful Life prediction
✅ Mean Time Between Failures (MTBF) estimation
✅ Failure risk probability visualization
✅ 24–48 hour predictive maintenance alerts
✅ Historical degradation trend analysis
✅ MongoDB maintenance log storage
✅ Professional industrial dashboard UI

---

##  Technology Stack

**Frontend**

* React.js
* Recharts visualization

**Backend**

* Node.js
* Express.js

**Machine Learning**

* Python
* Scikit-learn
* NumPy / Pandas

**Database**

* MongoDB

---

## Dashboard Capabilities

* Fleet health summary analytics
* Engine-wise degradation monitoring
* Failure probability gauge
* MTBF reliability metrics
* Maintenance alert indicators
* Historical performance charts

---

##  How to Run the Project

### Backend

```
cd predictive-dashboard-backend
node server.js
```

### Frontend

```
cd predictive-dashboard-frontend
npm start
```

### MongoDB

Start MongoDB server before running backend.

---

##  Academic Contribution

This project demonstrates the practical application of **machine learning in predictive maintenance**, integrating data analytics, real-time system design, and reliability engineering concepts.

---

##  Author

MCA Final Year Project
AI Fleet Predictive Maintenance System

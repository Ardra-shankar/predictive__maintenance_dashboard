import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import './App.css';

function App() {
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [engineData, setEngineData] = useState([]);
  const [stats, setStats] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load initial list of units and stats
  useEffect(() => {
    fetch('http://localhost:5000/api/engines')
      .then(res => res.json())
      .then(data => {
        setUnits(data);
        if (data.length > 0) setSelectedUnit(data[0]);
      })
      .catch(err => console.error("Error loading units:", err));

    fetch('http://localhost:5000/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error("Error loading stats:", err));
  }, []);

  // Load data when unit changes
  useEffect(() => {
    if (!selectedUnit) return;
    setLoading(true);
    setPrediction(null);
    setEngineData([]); // Clear previous data

    const fetchData = async () => {
      try {
        const res = await fetch(`http://localhost:5000/api/engine/${selectedUnit}`);
        const fullData = await res.json();

        if (fullData.length === 0) {
          setLoading(false);
          return;
        }

        // SIMULATION START:
        // Start from a reasonable point (e.g., 50 cycles or 20% of life) to show history, 
        // then update every 10 seconds.
        let currentIdx = Math.max(50, Math.floor(fullData.length * 0.2));

        // Initial set
        updateState(fullData, currentIdx);
        setLoading(false);

        const interval = setInterval(() => {
          if (currentIdx < fullData.length) {
            currentIdx++;
            updateState(fullData, currentIdx);
          } else {
            clearInterval(interval); // End of life
          }
        }, 10000); // 10 Seconds

        // Cleanup interval on unmount or unit change
        return () => clearInterval(interval);

      } catch (err) {
        console.error("Error loading engine data:", err);
        setLoading(false);
      }
    };

    // Helper to update state and predict
    const updateState = async (allData, index) => {
      const sliced = allData.slice(0, index);
      setEngineData(sliced);

      // Predict RUL for the *last* cycle in the sliced data
      if (sliced.length > 0) {
        const lastCycle = sliced[sliced.length - 1];
        const features = [
          lastCycle.settings[0], lastCycle.settings[1],
          lastCycle.sensors[1], lastCycle.sensors[2], lastCycle.sensors[3],
          lastCycle.sensors[6], lastCycle.sensors[7], lastCycle.sensors[8],
          lastCycle.sensors[10], lastCycle.sensors[11]
        ];

        try {
          const predRes = await fetch('http://localhost:5000/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ features })
          });
          const predResult = await predRes.json();
          setPrediction(predResult.predictedRul);
        } catch (e) { console.error("Prediction failed", e); }
      }
    };

    // We need to handle the cleanup of the async fetchData if it sets up an interval?
    // Actually, we can't easily return the cleanup function from an async function in useEffect.
    // Let's refactor to keep the interval logic outside or managing it with a ref/variable scope.
    // A simpler way:

    let intervalId = null;

    fetch(`http://localhost:5000/api/engine/${selectedUnit}`)
      .then(res => res.json())
      .then(fullData => {
        if (fullData.length === 0) { setLoading(false); return; }

        let currentIdx = Math.max(50, Math.floor(fullData.length * 0.2));
        updateState(fullData, currentIdx);
        setLoading(false);

        intervalId = setInterval(() => {
          if (currentIdx < fullData.length) {
            currentIdx++;
            updateState(fullData, currentIdx);
          } else {
            clearInterval(intervalId);
          }
        }, 10000);
      })
      .catch(err => {
        console.error("Error:", err);
        setLoading(false);
      });

    return () => {
      if (intervalId) clearInterval(intervalId);
    };

  }, [selectedUnit]);

  return (
    <div className="App">
      <header className="dashboard-header">
        <h1> Predictive Maintenance Dashboard</h1>
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Engines Monitored</span>
            <span className="stat-value">{stats.totalEngines || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Model Training Set</span>
            <span className="stat-value">{stats.trainingSize || 0}</span>
          </div>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <h3>Select Engine</h3>
          <div className="engine-list">
            <select
              multiple
              value={[selectedUnit]}
              onChange={(e) => setSelectedUnit(parseInt(e.target.value))}
              style={{ width: '100%', height: 'calc(100vh - 200px)' }}
            >
              {units.map(u => <option key={u} value={u}>Engine #{u}</option>)}
            </select>
          </div>
        </aside>

        <main className="dashboard-view">
          {loading ? <div className="loading">Loading Engine Data...</div> : (
            <>
              <div className="kpi-cards">
                <div className="card">
                  <h4>Current Cycle</h4>
                  <p className="big-number">{engineData.length}</p>
                </div>
                <div className={`card ${prediction && prediction < 20 ? 'danger' : (prediction && prediction < 50 ? 'warning' : 'safe')}`}>
                  <h4>Predicted RUL</h4>
                  <p className="big-number">
                    {prediction !== null ? prediction.toFixed(1) : '...'}
                    <small style={{ fontSize: '1rem' }}> cycles</small>
                  </p>
                  {prediction !== null && (
                    <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                      ~{(prediction / 4).toFixed(1)} days (at 4 flights/day)
                    </div>
                  )}
                </div>
                <div className="card">
                  <h4>Actual RUL (Diff)</h4>
                  <p className="big-number">
                    {engineData.length > 0 ? engineData[engineData.length - 1].rul : 0}
                  </p>
                </div>
              </div>


              {/* Alerts Section */}
              {prediction !== null && prediction < 20 && (
                <div className="alert-banner critical">
                  <span className="alert-icon">⚠️</span>
                  <div>
                    <strong>CRITICAL ALERT: ENGINE FAILURE IMMINENT!</strong><br />
                    Predicted RUL: {prediction.toFixed(1)} cycles (~{(prediction / 4).toFixed(1)} days).<br />
                    SCHEDULE MAINTENANCE IMMEDIATELY.
                  </div>
                </div>
              )}
              {prediction !== null && prediction >= 20 && prediction <= 48 && (
                <div className="alert-banner warning">
                  <span className="alert-icon">🔧</span>
                  <div>
                    <strong>MAINTENANCE WARNING</strong><br />
                    Predicted RUL: {prediction.toFixed(1)} cycles (~{(prediction / 4).toFixed(1)} days).<br />
                    Plan maintenance within the next 48 hours.
                  </div>
                </div>
              )}
              {prediction !== null && prediction > 48 && (
                <div className="alert-banner success">
                  <span className="alert-icon">✅</span>
                  <div>
                    <strong>SYSTEM NORMAL</strong><br />
                    Engine is healthy. Estimated {(prediction / 4).toFixed(1)} days remaining useful life.
                  </div>
                </div>
              )}

              <div className="charts-grid">
                <div className="chart-box">
                  <h4>Pressure (Sensor 2)</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={engineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cycle" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="s2_pressure" stroke="#8884d8" dot={false} name="Pressure" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-box">
                  <h4>Vibration (Sensor 3)</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={engineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cycle" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="s3_vibration" stroke="#82ca9d" dot={false} name="Vibration" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="chart-box full-width">
                  <h4>Remaining Useful Life (RUL) History</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={engineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="cycle" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="rul" stroke="#ff7300" dot={false} name="Actual RUL" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

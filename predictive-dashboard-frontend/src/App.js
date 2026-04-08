import React, { useState, useEffect, useCallback } from "react"
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend
} from "recharts"

const BASE = "http://localhost:5000"

// 1 cycle = 1 hour (NASA CMAPSS). Days = RUL / 24
const rulToDays = (rul) => {
  if (rul == null) return null
  const days  = rul / 24
  if (days < 1) return `${Math.round(rul)}h`          // show hours if < 1 day
  return days % 1 === 0 ? `${days}d` : `${days.toFixed(1)}d`
}
const rulToDaysNum = (rul) => rul != null ? +(rul / 24).toFixed(1) : null

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: "#0b1f3a", border: "1px solid #1e3a5f",
      borderRadius: 8, padding: "10px 14px", fontSize: 12
    }}>
      <div style={{ color: "#e3e7ed", marginBottom: 4 }}>Cycle {label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
const Card = ({ title, value, color = "#fff", unit = "" }) => (
  <div style={{
    background: "#0b1f3a", padding: "20px 24px",
    borderRadius: 12, minWidth: 160, flex: 1,
    border: "1px solid #1e3a5f"
  }}>
    <div style={{ fontSize: 11, color: "#e5eaef", letterSpacing: 1, marginBottom: 8 }}>
      {title.toUpperCase()}
    </div>
    <div style={{ fontSize: 28, fontWeight: 800, color }}>
      {value !== undefined && value !== null ? `${value}${unit}` : "—"}
    </div>
  </div>
)

// ── Alert Card — one per engine in alert state ────────────────────────────────
const AlertCard = ({ eng, onView }) => {
  const isCritical = eng.alert_level === "critical"
  const borderCol  = isCritical ? "#ef4444" : "#f59e0b"
  const bgCol      = isCritical ? "#1a0a0a" : "#1a1200"
  const labelCol   = isCritical ? "#ef4444" : "#f59e0b"
  const icon       = isCritical ? "🚨" : "⚠️"

  return (
    <div style={{
      background: bgCol,
      border: `1.5px solid ${borderCol}`,
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      gap: 16,
      animation: isCritical ? "flashBorder 1.5s infinite" : "none",
    }}>
      {/* Icon + level */}
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>

      {/* Engine info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>
            Engine {String(eng.engine_id).padStart(2, "0")}
          </span>
          <span style={{
            background: `${borderCol}22`,
            color: labelCol,
            border: `1px solid ${borderCol}66`,
            borderRadius: 20,
            padding: "2px 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}>
            {eng.alert_level}
          </span>
        </div>

        {/* Metrics row */}
        <div style={{ display: "flex", gap: 20, fontSize: 12 }}>
          <span style={{ color: "#dae4f1" }}>
            RUL: <strong style={{ color: isCritical ? "#ef4444" : "#f59e0b" }}>
              {eng.rul} cycles
            </strong>
          </span>
          <span style={{ color: "#dae1ec" }}>
            Days Left: <strong style={{ color: isCritical ? "#ef4444" : "#f59e0b" }}>
              {rulToDays(eng.rul)}
            </strong>
          </span>
          <span style={{ color: "#edf2fa" }}>
            Risk: <strong style={{ color: labelCol }}>{eng.failure_risk}%</strong>
          </span>
          <span style={{ color: "#e2ebf8" }}>
            MTBF: <strong style={{ color: "#fff" }}>{eng.mtbf}</strong>
          </span>
          <span style={{ color: "#f7faff" }}>
            Health: <strong style={{ color: "#a78bfa" }}>
              {eng.health != null ? (eng.health * 100).toFixed(1) : "—"}%
            </strong>
          </span>
        </div>

        {/* Urgency message */}
        <div style={{ marginTop: 6, fontSize: 12, color: labelCol }}>
          {isCritical
            ? `⛔ Failure in ~${rulToDays(eng.rul)} — Immediate maintenance required`
            : `🔧 Failure in ~${rulToDays(eng.rul)} — Schedule maintenance soon`}
        </div>
      </div>

      {/* RUL bar */}
      <div style={{ width: 90, textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>RUL</div>
        <div style={{ height: 6, background: "#1e3a5f", borderRadius: 3 }}>
          <div style={{
            width: `${Math.min(100, (eng.rul / 200) * 100)}%`,
            height: "100%",
            background: labelCol,
            borderRadius: 3,
            boxShadow: `0 0 6px ${labelCol}`,
          }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: labelCol, marginTop: 4 }}>
          {eng.rul}
        </div>
      </div>

      {/* View button */}
      <button
        onClick={() => onView(eng.engine_id)}
        style={{
          background: `${borderCol}22`,
          border: `1px solid ${borderCol}`,
          color: labelCol,
          borderRadius: 8,
          padding: "8px 16px",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 700,
          whiteSpace: "nowrap",
          transition: "background 0.2s",
        }}
        onMouseEnter={e => e.target.style.background = `${borderCol}44`}
        onMouseLeave={e => e.target.style.background = `${borderCol}22`}
      >
        View Engine →
      </button>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [engineId, setEngineId]     = useState(1)
  const [engine, setEngine]         = useState(null)
  const [history, setHistory]       = useState([])
  const [fleetStats, setFleetStats] = useState(null)
  const [alerts, setAlerts]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [tab, setTab]               = useState("dashboard") // "dashboard" | "alerts"

  // ── Fetchers ─────────────────────────────────────────────────────────────
  const fetchEngine = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [engRes, histRes] = await Promise.all([
        fetch(`${BASE}/api/engine/${engineId}`),
        fetch(`${BASE}/api/history/${engineId}?limit=40`),
      ])
      if (!engRes.ok) throw new Error(`Engine ${engineId} not found`)
      setEngine(await engRes.json())
      setHistory(await histRes.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [engineId])

  const fetchFleetAndAlerts = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        fetch(`${BASE}/api/fleet-status`),
        fetch(`${BASE}/api/alerts`),
      ])
      setFleetStats(await statsRes.json())
      setAlerts(await alertsRes.json())
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => { fetchEngine(); fetchFleetAndAlerts() }, [fetchEngine, fetchFleetAndAlerts])

  useEffect(() => {
    const id = setInterval(() => { fetchEngine(); fetchFleetAndAlerts() }, 5000)
    return () => clearInterval(id)
  }, [fetchEngine, fetchFleetAndAlerts])

  const alertLevel    = engine?.alert_level
  const criticalCount = alerts.filter(a => a.alert_level === "critical").length
  const warningCount  = alerts.filter(a => a.alert_level === "warning").length

  // Jump to dashboard tab and select the engine
  const handleViewEngine = (id) => {
    setEngineId(id)
    setTab("dashboard")
  }

  return (
    <div style={{ background: "#06142b", minHeight: "100vh", color: "white", padding: 30, fontFamily: "sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Predictive Maintenance Dashboard</h1>
          <div style={{ fontSize: 14, color: "#e7eaee", marginTop: 4 }}>NASA CMAPSS </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#22c55e",
            boxShadow: "0 0 8px #22c55e", animation: "pulse 2s infinite"
          }} />
          <span style={{ fontSize: 12, color: "#edf1f7" }}>LIVE · 5s refresh</span>
        </div>
      </div>

      {/* ── Fleet summary bar ── */}
      {fleetStats && (
        <div style={{
          display: "flex", gap: 24, marginTop: 20, flexWrap: "wrap",
          background: "#0b1f3a", borderRadius: 10, padding: "12px 20px", fontSize: 13
        }}>
          <span>🚗 <b>{fleetStats.engines}</b> engines</span>
          <span style={{ color: "#f59e0b" }}>⚠ <b>{fleetStats.alerts}</b> warnings</span>
          <span style={{ color: "#ef4444" }}>🚨 <b>{fleetStats.critical}</b> critical</span>
          <span>Avg RUL <b style={{ color: "#22c55e" }}>{fleetStats.avg_rul}</b></span>
          <span>Avg MTBF <b style={{ color: "#3b82f6" }}>{fleetStats.avg_mtbf}</b></span>
        </div>
      )}

      {/* ── Tab buttons ── */}
      <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
        {[
          { key: "dashboard", label: "📊 Dashboard" },
          {
            key: "alerts",
            label: alerts.length > 0
              ? `🚨 Active Alerts (${alerts.length})`
              : "✅ Alerts",
          },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: tab === t.key
                ? "1px solid #3b82f6"
                : "1px solid #1e3a5f",
              background: tab === t.key ? "#1e3a5f" : "#0b1f3a",
              color: tab === t.key ? "#fff" : "#64748b",
              cursor: "pointer",
              fontWeight: tab === t.key ? 700 : 400,
              fontSize: 13,
              position: "relative",
            }}
          >
            {t.label}
            {/* Red dot on alerts tab when there are critical ones */}
            {t.key === "alerts" && criticalCount > 0 && tab !== "alerts" && (
              <span style={{
                position: "absolute", top: -4, right: -4,
                width: 10, height: 10, borderRadius: "50%",
                background: "#ef4444",
                boxShadow: "0 0 6px #ef4444",
                animation: "pulse 1.5s infinite",
              }} />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB: ALERTS
      ══════════════════════════════════════════ */}
      {tab === "alerts" && (
        <div style={{ marginTop: 24 }}>

          {/* Summary row */}
          {alerts.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <div style={{
                background: "#1a0a0a", border: "1px solid #ef4444",
                borderRadius: 10, padding: "12px 20px", flex: 1, textAlign: "center"
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 1 }}>CRITICAL ENGINES</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#ef4444" }}>{criticalCount}</div>
                <div style={{ fontSize: 11, color: "#ef4444" }}>Immediate action needed</div>
              </div>
              <div style={{
                background: "#1a1200", border: "1px solid #f59e0b",
                borderRadius: 10, padding: "12px 20px", flex: 1, textAlign: "center"
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 1 }}>WARNING ENGINES</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#f59e0b" }}>{warningCount}</div>
                <div style={{ fontSize: 11, color: "#f59e0b" }}>Schedule maintenance soon</div>
              </div>
              <div style={{
                background: "#0b1f3a", border: "1px solid #1e3a5f",
                borderRadius: 10, padding: "12px 20px", flex: 1, textAlign: "center"
              }}>
                <div style={{ fontSize: 11, color: "#94a3b8", letterSpacing: 1 }}>LOWEST RUL</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: "#ef4444" }}>
                  {alerts[0]?.rul ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  Engine {alerts[0]?.engine_id} — most urgent
                </div>
              </div>
            </div>
          )}

          {/* Alert cards — sorted by urgency (server already sorts lowest RUL first) */}
          {alerts.length === 0 ? (
            <div style={{
              background: "#0b1f3a", border: "1px solid #1e3a5f",
              borderRadius: 12, padding: 40, textAlign: "center"
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#22c55e" }}>All engines operating normally</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>No maintenance alerts at this time</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

              {/* Critical first */}
              {criticalCount > 0 && (
                <div style={{ fontSize: 11, color: "#ef4444", letterSpacing: 2, marginBottom: 4 }}>
                  🚨 CRITICAL — FAILURE WITHIN 24 HOURS
                </div>
              )}
              {alerts
                .filter(a => a.alert_level === "critical")
                .map(eng => <AlertCard key={eng.engine_id} eng={eng} onView={handleViewEngine} />)
              }

              {/* Then warnings */}
              {warningCount > 0 && (
                <div style={{ fontSize: 11, color: "#f59e0b", letterSpacing: 2, marginTop: 8, marginBottom: 4 }}>
                  ⚠️ WARNING — FAILURE WITHIN 24–72 HOURS
                </div>
              )}
              {alerts
                .filter(a => a.alert_level === "warning")
                .map(eng => <AlertCard key={eng.engine_id} eng={eng} onView={handleViewEngine} />)
              }
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB: DASHBOARD
      ══════════════════════════════════════════ */}
      {tab === "dashboard" && (
        <div>
          {/* Alert banner for currently selected engine */}
          {alertLevel && alertLevel !== "ok" && (
            <div style={{
              background: alertLevel === "critical" ? "#1a0a0a" : "#1a1200",
              border: `1.5px solid ${alertLevel === "critical" ? "#ef4444" : "#f59e0b"}`,
              padding: "14px 18px", borderRadius: 10, marginTop: 20,
              display: "flex", alignItems: "center", gap: 12,
              animation: alertLevel === "critical" ? "flashBorder 1.5s infinite" : "none",
            }}>
              <span style={{ fontSize: 24 }}>{alertLevel === "critical" ? "🚨" : "⚠️"}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: alertLevel === "critical" ? "#ef4444" : "#f59e0b" }}>
                  ENGINE {String(engineId).padStart(2, "0")} —{" "}
                  {alertLevel === "critical"
                    ? "CRITICAL: Immediate maintenance required"
                    : "WARNING: Schedule maintenance soon"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  RUL: <b style={{ color: "#fff" }}>{engine?.rul} cycles</b>
                  &nbsp;·&nbsp;
                  <b style={{ color: alertLevel === "critical" ? "#ef4444" : "#f59e0b" }}>
                    ~{rulToDays(engine?.rul)} before failure
                  </b>
                  &nbsp;·&nbsp;
                  Failure Risk: <b style={{ color: alertLevel === "critical" ? "#ef4444" : "#f59e0b" }}>{engine?.failure_risk}%</b>
                  &nbsp;·&nbsp;
                  MTBF: <b style={{ color: "#fff" }}>{engine?.mtbf}</b>
                </div>
              </div>
            </div>
          )}

          {/* Engine selector */}
          <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#eff5fd" }}>Select Engine:</span>
            <select
              value={engineId}
              onChange={e => setEngineId(parseInt(e.target.value))}
              style={{ padding: "6px 10px", borderRadius: 6, background: "#0b1f3a", color: "white", border: "1px solid #1e3a5f" }}
            >
              {[...Array(20)].map((_, i) => {
                const id    = i + 1
                const alert = alerts.find(a => a.engine_id === id)
                return (
                  <option key={i} value={id}>
                    {alert?.alert_level === "critical" ? "🚨" : alert?.alert_level === "warning" ? "⚠️" : "✅"} Engine {id}
                  </option>
                )
              })}
            </select>
            {loading && <span style={{ fontSize: 12, color: "#64748b" }}>Refreshing…</span>}
            {error   && <span style={{ fontSize: 12, color: "#ef4444" }}>⚠ {error}</span>}
          </div>

          {/* KPI cards */}
          <div style={{ display: "flex", gap: 16, marginTop: 24, flexWrap: "wrap" }}>
            <Card title="Current Cycle"         value={engine?.cycle} />
            <Card title="Remaining Useful Life" value={engine?.rul}   color="#22c55e" unit=" cyc" />
            <Card title="Days Before Failure"
              value={rulToDaysNum(engine?.rul)}
              color={alertLevel === "critical" ? "#ef4444" : alertLevel === "warning" ? "#f59e0b" : "#22c55e"}
              unit=" days" />
            <Card title="Health Score"
              value={engine?.health != null ? (engine.health * 100).toFixed(1) : null}
              color="#a78bfa" unit="%" />
            <Card title="MTBF"         value={engine?.mtbf} color="#3b82f6" unit=" cyc" />
            <Card title="Failure Risk"
              value={engine?.failure_risk ?? (engine?.alert ? ">50" : "<20")}
              color={alertLevel === "critical" ? "#ef4444" : alertLevel === "warning" ? "#f59e0b" : "#22c55e"}
              unit="%" />
          </div>

          {/* Degradation chart */}
          <div style={{ marginTop: 32, background: "#0b1f3a", padding: 20, borderRadius: 12, border: "1px solid #1e3a5f" }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#e3ebf6", letterSpacing: 1 }}>
              ENGINE {String(engineId).padStart(2, "0")} — RUL & MTBF DEGRADATION TREND
            </h3>
            {history.length === 0 ? (
              <div style={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155" }}>
                {loading ? "Loading history…" : "No history yet — wait for first tick"}
              </div>
            ) : (
              <div style={{ height: 280 }}>
                <ResponsiveContainer>
                  <LineChart data={history} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis dataKey="cycle" stroke="#334155" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#334155" tick={{ fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="rul"  name="RUL"  stroke="#22c55e" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line dataKey="mtbf" name="MTBF" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(1.4); }
        }
        @keyframes flashBorder {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

#thisisacomment
#thisis a commnet 
# this  is a commenttt
#this is a comment
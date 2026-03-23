const express = require("express")
const cors    = require("cors")
const http    = require("http")
const { MongoClient } = require("mongodb")

const app = express()
app.use(cors())
app.use(express.json())

// ===== Config =====
const MONGO_URI    = process.env.MONGO_URI || "mongodb://127.0.0.1:27017"
const ML_HOST      = "127.0.0.1"
const ML_PORT      = 5001
const PORT         = process.env.PORT || 5000
const TICK_MS      = 5000
const ENGINE_COUNT = 20
const ALERT_RUL    = 72   // 72 cycles = 72 hours = 3 days before failure

// ===== MongoDB =====
const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
let db
let dbConnected = false

async function initDB() {
    try {
        await client.connect()
        db = client.db("fleet_pm")
        await db.collection("logs").createIndex({ timestamp: 1 }, { expireAfterSeconds: 604800, background: true })
        await db.collection("logs").createIndex({ engine_id: 1, timestamp: -1 }, { background: true })
        dbConnected = true
        console.log("MongoDB Connected")
    } catch (err) {
        console.error("MongoDB failed:", err.message)
        dbConnected = false
        setTimeout(() => initDB(), 10000)
    }
}

// ===== ONE batch HTTP call to ml_service.py instead of 20 exec() spawns =====
function callMLBatch(engineInputs) {
    return new Promise((resolve) => {
        const body = JSON.stringify(engineInputs)
        const req = http.request(
            { host: ML_HOST, port: ML_PORT, path: "/predict/batch", method: "POST",
              headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
            (res) => {
                let data = ""
                res.on("data", chunk => data += chunk)
                res.on("end", () => {
                    try { resolve({ ok: true, results: JSON.parse(data) }) }
                    catch { resolve({ ok: false }) }
                })
            }
        )
        req.on("error", () => resolve({ ok: false }))
        req.setTimeout(4000, () => { req.destroy(); resolve({ ok: false }) })
        req.write(body)
        req.end()
    })
}

function fallbackPrediction(health, cycle = 0) {
    const rul = Math.max(5, Math.round(health * 250))
    return {
        rul,
        mtbf:         cycle + rul,   // total expected lifetime = how far gone + remaining
        failure_risk: +((1 - health) * 100).toFixed(1),
        alert:        rul < ALERT_RUL,
        alert_level:  rul < 24 ? "critical" : rul < ALERT_RUL ? "warning" : "ok",
    }
}

// ===== Fleet State =====
let fleetData     = []
let fleetDataPrev = {}

async function simulateFleet() {
    const snapshots = []
    for (let i = 1; i <= ENGINE_COUNT; i++) {
        const prev      = fleetDataPrev[i] || { cycle: Math.floor(Math.random() * 50), health: 1 }
        const newHealth = Math.max(0, prev.health - (0.002 + Math.random() * 0.003))
        const cycle     = prev.cycle + 1
        snapshots.push({
            engine_id: i, cycle, health: +newHealth.toFixed(4),
            s2:  +(518 + (1 - newHealth) * 8   + (Math.random() - 0.5)).toFixed(2),
            s11: +(47  + (1 - newHealth) * 2   + (Math.random() - 0.5) * 0.5).toFixed(2),
            s15: +(8.4 + (1 - newHealth) * 0.4 + (Math.random() - 0.5) * 0.1).toFixed(2),
        })
    }

    const mlResponse = await callMLBatch(
        snapshots.map(e => ({ engine_id: e.engine_id, cycle: e.cycle, s2: e.s2, s11: e.s11, s15: e.s15 }))
    )

    const mlMap = {}
    if (mlResponse.ok) mlResponse.results.forEach(r => { mlMap[r.engine_id] = r })

    fleetData = snapshots.map(e => {
        const pred = mlMap[e.engine_id] || fallbackPrediction(e.health, e.cycle)
        return { engine_id: e.engine_id, cycle: e.cycle, health: e.health,
                 sensors: { s2: e.s2, s11: e.s11, s15: e.s15 },
                 rul: pred.rul, mtbf: pred.mtbf, failure_risk: pred.failure_risk,
                 alert: pred.alert, alert_level: pred.alert_level }
    })

    fleetDataPrev = {}
    fleetData.forEach(e => { fleetDataPrev[e.engine_id] = { cycle: e.cycle, health: e.health } })
}

async function tick() {
    try {
        await simulateFleet()
        if (!dbConnected || !db) return

        const bulkLogs = fleetData.map(e => ({
            engine_id: e.engine_id, cycle: e.cycle, rul: e.rul, mtbf: e.mtbf,
            failure_risk: e.failure_risk, alert: e.alert, alert_level: e.alert_level,
            health: e.health, timestamp: new Date(),
        }))
        await db.collection("logs").insertMany(bulkLogs)
        console.log("Tick saved —", bulkLogs.filter(e => e.alert).length, "alert(s)")
    } catch (err) {
        console.error("Tick error:", err.message)
    }
}

tick()
setInterval(tick, TICK_MS)

// ===== Middleware =====
function parseEngineId(req, res, next) {
    const id = parseInt(req.params.id)
    if (isNaN(id) || id < 1 || id > ENGINE_COUNT)
        return res.status(400).json({ error: "engine_id must be 1-" + ENGINE_COUNT })
    req.engineId = id
    next()
}

// ===== Routes =====
app.get("/api/fleet-status", (req, res) => {
    if (!fleetData.length) return res.status(503).json({ error: "Not ready" })
    const total = fleetData.length
    res.json({
        engines:  total,
        alerts:   fleetData.filter(e => e.alert).length,
        critical: fleetData.filter(e => e.alert_level === "critical").length,
        avg_rul:  Math.round(fleetData.reduce((a, b) => a + b.rul,  0) / total),
        avg_mtbf: Math.round(fleetData.reduce((a, b) => a + b.mtbf, 0) / total),
    })
})

app.get("/api/fleet", (req, res) => {
    if (!fleetData.length) return res.status(503).json({ error: "Not ready" })
    res.json(fleetData.map(({ sensors, ...rest }) => rest))
})

app.get("/api/engine/:id", parseEngineId, (req, res) => {
    const engine = fleetData.find(e => e.engine_id === req.engineId)
    if (!engine) return res.status(404).json({ error: "Engine not found" })
    res.json(engine)
})

app.get("/api/history/:id", parseEngineId, async (req, res) => {
    if (!dbConnected || !db) return res.json([])
    try {
        const limit   = Math.min(parseInt(req.query.limit) || 40, 200)
        const history = await db.collection("logs")
            .find({ engine_id: req.engineId })
            .sort({ timestamp: -1 }).limit(limit)
            .project({ _id: 0, engine_id: 0 }).toArray()
        res.json(history.reverse())
    } catch {
        res.status(500).json({ error: "Database error" })
    }
})

app.get("/api/alerts", (req, res) => {
    res.json(fleetData.filter(e => e.alert).sort((a, b) => a.rul - b.rul).map(({ sensors, ...rest }) => rest))
})

// ===== Start =====
const server = app.listen(PORT, () => {
    initDB()
    console.log("Fleet PM Backend running on port", PORT)
    console.log("Expects ml_service.py running on port", ML_PORT)
})

async function shutdown(signal) {
    server.close(async () => { await client.close(); process.exit(0) })
}
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT",  () => shutdown("SIGINT"))
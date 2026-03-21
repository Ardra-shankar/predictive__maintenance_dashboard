const express = require("express")
const cors = require("cors")
const { execSync } = require("child_process")
const { MongoClient } = require("mongodb")

const app = express()
app.use(cors())
app.use(express.json())

// ===== MongoDB =====
const client = new MongoClient("mongodb://127.0.0.1:27017")

let db

async function initDB(){
    await client.connect()
    db = client.db("fleet_pm")
    console.log("✅ MongoDB Connected")
}
initDB()

// ===== Predict RUL using Python =====
function predictRUL(sensor){
    try{
        const cmd = `python predict.py ${sensor.cycle} ${sensor.s2} ${sensor.s11} ${sensor.s15}`
        const output = execSync(cmd).toString().trim()
        return Math.max(5, Math.round(parseFloat(output)))
    }
    catch{
        return Math.floor(80 + Math.random()*120)
    }
}

// ===== Fleet Simulation =====
let fleetDataPrev = {}

function simulateFleet(){

    const engines = 20
    fleetData = []

    for(let i=1;i<=engines;i++){

        const prev = fleetDataPrev[i] || {
            cycle: Math.floor(Math.random()*50),
            health: 1
        }

        const degradation = 0.002 + Math.random()*0.003

        const newHealth = Math.max(0, prev.health - degradation)

        const cycle = prev.cycle + 1

        const rul = Math.round(newHealth * 250)

        const mtbf = cycle + rul

        const alert = rul < 48

        fleetData.push({
            engine_id:i,
            cycle,
            rul,
            mtbf,
            alert,
            health:newHealth
        })
    }

    fleetDataPrev = {}
    fleetData.forEach(e=>{
        fleetDataPrev[e.engine_id] = {
            cycle:e.cycle,
            health:e.health
        }
    })
}

// ===== Real-Time Loop (Optimized Batch Write) =====
setInterval(async ()=>{

    simulateFleet()

    const bulkLogs = fleetData.map(e => ({
        engine_id: e.engine_id,
        cycle: e.cycle,
        rul: e.rul,
        mtbf: e.mtbf,
        alert: e.alert,
        timestamp: new Date()
    }))

    await db.collection("logs").insertMany(bulkLogs)

    console.log(" fleet tick + batch mongo saved")

},5000)


// ===== APIs =====

// Fleet summary
app.get("/api/fleet-status",(req,res)=>{

    const total = fleetData.length

    const alerts = fleetData.filter(e=>e.alert).length

    const avg_rul = total
        ? Math.round(fleetData.reduce((a,b)=>a+b.rul,0)/total)
        : 0

    const avg_mtbf = total
        ? Math.round(fleetData.reduce((a,b)=>a+b.mtbf,0)/total)
        : 0

    res.json({
        engines: total,
        alerts,
        avg_rul,
        avg_mtbf
    })
})

// single engine realtime
app.get("/api/engine/:id",(req,res)=>{

    const id = parseInt(req.params.id)
    const engine = fleetData.find(e=>e.engine_id===id)

    res.json(engine || {})
})

// history from MongoDB
app.get("/api/history/:id", async (req,res)=>{

    const id = parseInt(req.params.id)

    const history = await db.collection("logs")
        .find({engine_id:id})
        .sort({timestamp:-1})
        .limit(40)
        .toArray()

    res.json(history)
})

app.listen(5000,()=>{
    console.log(" Fleet Predictive Maintenance Backend Running")
})
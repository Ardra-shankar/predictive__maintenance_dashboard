const express = require("express")
const cors = require("cors")
const { spawn } = require("child_process")

const app = express()
app.use(cors())

// -------- MULTI ENGINE STATE --------
let engines = {
   1: { cycle: 1, data: randomSensor() },
   2: { cycle: 1, data: randomSensor() },
   3: { cycle: 1, data: randomSensor() }
}

function randomSensor(){
   return {
      s2: 600 + Math.random()*50,
      s11: 500 + Math.random()*40,
      s15: 10 + Math.random()*5
   }
}

// realtime simulation
setInterval(()=>{
   Object.keys(engines).forEach(id=>{
      engines[id].cycle++
      engines[id].data = randomSensor()
   })
},5000)

// -------- SENSOR API --------
app.get("/api/sensors/:id",(req,res)=>{
   const id = req.params.id
   res.json({
      engine: id,
      cycle: engines[id].cycle,
      ...engines[id].data
   })
})

// -------- PREDICTION API --------
app.get("/api/predict/:id",(req,res)=>{
   const id = req.params.id
   const e = engines[id]

   const py = spawn("python",[
      "predict.py",
      e.cycle,
      e.data.s2,
      e.data.s11,
      e.data.s15
   ])

   py.stdout.on("data",(data)=>{
      res.json({ engine:id, rul: parseFloat(data.toString()) })
   })
})

app.listen(5000,()=>console.log("Fleet ML Backend Running"))
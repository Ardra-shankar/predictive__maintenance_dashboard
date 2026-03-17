const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("ML Backend Running ✅");
});


//  DEMO ENGINE APIs 

const demoEngines = [1,2,3,4,5];

app.get("/api/engines", (req, res) => {
    res.json(demoEngines);
});

app.get("/api/engine/:unit", (req, res) => {

    const data = [];

    for(let i=1;i<=50;i++){
        data.push({
            cycle:i,
            s2_pressure:500+Math.random()*50,
            s3_vibration:600+Math.random()*50,
            s4_ratio:1400+Math.random()*20,
            rul:120-i
        });
    }

    res.json(data);
});

app.get("/api/stats",(req,res)=>{
    res.json({
        totalEngines:5,
        totalCycles:250,
        trainingSize:20631
    });
});


// ================= ML PREDICTION =================

app.post("/api/predict",(req,res)=>{

    const predictedRUL =
        Math.floor(70 + Math.random()*40);

    res.json({
        predictedRUL
    });

});


// START SERVER 

app.listen(PORT,()=>{
    console.log("🚀 ML Backend Running at http://localhost:5000");
});
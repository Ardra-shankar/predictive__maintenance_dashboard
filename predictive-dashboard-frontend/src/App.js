import React, { useEffect, useState } from "react"
import {
 LineChart, Line, XAxis, YAxis,
 Tooltip, CartesianGrid,
 ResponsiveContainer, RadialBarChart, RadialBar
} from "recharts"

function App(){

 const [fleet,setFleet] = useState({})
 const [engineId,setEngineId] = useState(1)
 const [engine,setEngine] = useState({})
 const [history,setHistory] = useState([])

 useEffect(()=>{

   const load = async ()=>{

     try{

       const [f,e,h] = await Promise.all([
         fetch("http://localhost:5000/api/fleet-status"),
         fetch(`http://localhost:5000/api/engine/${engineId}`),
         fetch(`http://localhost:5000/api/history/${engineId}`)
       ])

       setFleet(await f.json())
       setEngine(await e.json())
       const hist = await h.json()
       setHistory(hist.reverse())

     }catch(err){
       console.log("API lag",err)
     }

   }

   load()
   const t = setInterval(load,4000)   // ⭐ faster refresh

   return ()=> clearInterval(t)

 },[engineId])

 const rul = engine?.rul || 0
 const mtbf = engine?.mtbf || 0
 const days = (rul/24).toFixed(2)

 const risk = (100/(1+Math.exp(rul/50))).toFixed(1)

 const alert = engine?.alert

 return(
   <div style={{
     background:"#071029",
     minHeight:"100vh",
     padding:30,
     color:"white",
     fontFamily:"Segoe UI"
   }}>

     <h1> Fleet Predictive Maintenance Dashboard</h1>

     <div style={grid4}>
       <Card title="Total Engines" value={fleet.engines}/>
       <Card title="Active Alerts" value={fleet.alerts}/>
       <Card title="Average RUL" value={fleet.avg_rul}/>
       <Card title="Average MTBF" value={fleet.avg_mtbf}/>
     </div>

     {alert &&
       <div style={alertBox}>
         🚨 Maintenance required within 24-48 hours
       </div>
     }

     <div style={{marginTop:20}}>
       Select Engine :
       <select
         value={engineId}
         onChange={e=>setEngineId(e.target.value)}
         style={{marginLeft:10,padding:6}}
       >
         {[...Array(20)].map((_,i)=>
           <option key={i+1} value={i+1}>
             Engine {i+1}
           </option>
         )}
       </select>
     </div>

     <div style={grid5}>
       <Card title="Current Cycle" value={engine?.cycle}/>
       <Card title="Remaining Useful Life" value={rul}/>
       <Card title="Days Before Failure" value={days}/>
       <Card title="MTBF" value={mtbf}/>
       <Card title="Failure Risk %" value={risk}/>
     </div>

     <div style={{display:"flex",gap:30,marginTop:30}}>

       <div style={panel}>
         <h3>Failure Probability</h3>
         <RadialBarChart
           width={260}
           height={260}
           innerRadius="70%"
           outerRadius="100%"
           data={[{risk:Number(risk)}]}
           startAngle={180}
           endAngle={0}
         >
           <RadialBar dataKey="risk" fill="#ff4d4f"/>
         </RadialBarChart>
         <h2 style={{textAlign:"center"}}>{risk}%</h2>
       </div>

       <div style={{...panel,flex:1}}>
         <h3>Engine RUL Degradation Trend</h3>
         <div style={{height:350}}>
           <ResponsiveContainer>
             <LineChart data={history}>
               <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
               <XAxis dataKey="cycle" stroke="#94a3b8"/>
               <YAxis stroke="#94a3b8"/>
               <Tooltip/>
               <Line
                 type="monotone"
                 dataKey="rul"
                 stroke="#22c55e"
                 strokeWidth={3}
                 dot={false}
               />
             </LineChart>
           </ResponsiveContainer>
         </div>
       </div>

     </div>

   </div>
 )
}

const Card = ({title,value})=>(
 <div style={{
   background:"#0f172a",
   padding:20,
   borderRadius:12,
   textAlign:"center",
   boxShadow:"0 0 12px rgba(0,0,0,0.4)"
 }}>
   <h3>{title}</h3>
   <h1>{value ?? 0}</h1>
 </div>
)

const grid4 = {
 display:"grid",
 gridTemplateColumns:"repeat(4,1fr)",
 gap:20,
 marginTop:20
}

const grid5 = {
 display:"grid",
 gridTemplateColumns:"repeat(5,1fr)",
 gap:20,
 marginTop:20
}

const panel = {
 background:"#0f172a",
 padding:20,
 borderRadius:12
}

const alertBox = {
 background:"#dc2626",
 padding:14,
 borderRadius:8,
 marginTop:20,
 fontWeight:"bold"
}

export default App
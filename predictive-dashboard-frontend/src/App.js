import React, { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"

function App() {

  const [sensor, setSensor] = useState([])
  const [rul, setRul] = useState(0)
  const [status, setStatus] = useState("NORMAL")
  const [cycle, setCycle] = useState(0)
  const [engineId, setEngineId] = useState(1)

  useEffect(() => {

    const interval = setInterval(async () => {

      try {

        const sensorRes = await fetch(`http://localhost:5000/api/sensors/${engineId}`)
        const sensorData = await sensorRes.json()

        const predRes = await fetch(`http://localhost:5000/api/predict/${engineId}`)
        const predData = await predRes.json()

        setCycle(sensorData.cycle)

        setSensor(prev => [
          ...prev,
          {
            cycle: sensorData.cycle,
            s2: sensorData.s2
          }
        ])

        setRul(predData.rul)

        if (predData.rul < 24) setStatus("CRITICAL")
        else if (predData.rul < 72) setStatus("WARNING")
        else setStatus("NORMAL")

      } catch (err) {
        console.log(err)
      }

    }, 5000)

    return () => clearInterval(interval)

  }, [engineId])

  const changeEngine = (e) => {
    setSensor([])
    setEngineId(e.target.value)
  }

  return (
    <div style={{ padding: 40, fontFamily: "Arial" }}>

      <h1>Fleet Predictive Maintenance Dashboard</h1>

      <h3>Select Engine</h3>
      <select onChange={changeEngine} value={engineId}>
        <option value={1}>Engine 1</option>
        <option value={2}>Engine 2</option>
        <option value={3}>Engine 3</option>
      </select>

      <h2>Current Cycle: {cycle}</h2>
      <h2>Remaining Useful Life: {rul.toFixed(1)}</h2>
      <h2>Status: {status}</h2>

      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={sensor}>
            <XAxis dataKey="cycle" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="s2" stroke="#ff7300" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  )
}

export default App
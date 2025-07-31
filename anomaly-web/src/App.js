import React, { useEffect, useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Dot
} from 'recharts';

function App() {
  const [status, setStatus] = useState('Connecting...');
  const [log, setLog] = useState([]);
  const [data, setData] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const chartDataRef = useRef([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5050');

    ws.onopen = () => setStatus('🟢 Connected');
    ws.onerror = () => setStatus('🔴 WebSocket error');
    ws.onclose = () => setStatus('⚪️ Disconnected');

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const timestamp = new Date(message.timestamp * 1000).toLocaleTimeString();

        const logEntry = `[${timestamp}] ${message.is_anomaly ? "Anomaly detected" : "Normal"} — Voltage: ${message.voltage}`;
        setLog(prev => [logEntry, ...prev].slice(0, 30));

        const newPoint = {
          time: timestamp,
          value: message.voltage,
          isAnomaly: message.is_anomaly
        };

        if (!isPaused) {
          chartDataRef.current = [...chartDataRef.current, newPoint].slice(-50);
          setData([...chartDataRef.current]);
        }

        if (message.is_anomaly) {
          setAnomalies(prev => [newPoint, ...prev.slice(0, 9)]);
        }
      } catch (err) {
        console.error("Invalid message from server:", event.data);
      }
    };

    return () => ws.close();
  }, [isPaused]);

  const handleExport = () => {
    const csv = anomalies.map(a => `${a.time},${a.value}`).join('\n');
    const blob = new Blob(["Time,Value\n" + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anomalies.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '2rem' }}>
      <h1 style={{ fontSize: '2rem' }}>Anomaly Detection Dashboard</h1>
      <p>Status: <strong>{status}</strong></p>

      <div style={{ marginBottom: '1rem' }}>
        <button onClick={() => setIsPaused(prev => !prev)} style={{ marginRight: '1rem', padding: '0.5rem 1rem' }}>
          {isPaused ? '▶️ Resume' : '⏸ Pause'} Chart
        </button>
        <button onClick={handleExport} style={{ padding: '0.5rem 1rem' }}>💾 Export Anomalies</button>
      </div>

      <h2>📊 Real-Time Sensor Data</h2>
      <div style={{ width: '100%', height: 300, backgroundColor: '#f9f9f9', borderRadius: '10px', padding: '1rem' }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#ccc" />
            <XAxis dataKey="time" minTickGap={20} />
            <YAxis domain={['auto', 'auto']} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="value" stroke="#8884d8" dot={false} name="Voltage" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#ff4d4f"
              dot={({ cx, cy, payload }) =>
                payload.isAnomaly ? <circle cx={cx} cy={cy} r={5} fill="#ff4d4f" /> : null
              }
              activeDot={false}
              name="Anomaly"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2>🚨 Flagged Anomalies</h2>
      {anomalies.length === 0 ? (
        <p>No anomalies detected yet.</p>
      ) : (
        <ul style={{ background: '#ffe6e6', padding: '1rem', borderRadius: '10px' }}>
          {anomalies.map((a, idx) => (
            <li key={idx}><strong>{a.time}</strong> — Voltage: {a.value}</li>
          ))}
        </ul>
      )}

      <h2>📜 Event Log</h2>
      <ul style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '10px', listStyle: 'none' }}>
        {log.map((entry, index) => (
          <li key={index} style={{ marginBottom: '0.5rem' }}>{entry}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;

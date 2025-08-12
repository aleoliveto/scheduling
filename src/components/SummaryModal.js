import React from 'react';

const fmt = (m) => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;

export default function SummaryModal({ allAircraft, onClose }) {
  const total = allAircraft.reduce((s, a) => s + a.points, 0);

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
    }}>
      <div style={{ width: 'min(720px, 92vw)', background:'#fff', borderRadius:12, padding:20, boxShadow:'0 10px 30px rgba(0,0,0,.15)' }}>
        <h2 style={{ marginTop:0 }}>Day Summary</h2>

        {allAircraft.map(({ id, points, kpis, flightMins }) => (
          <div key={id} style={{ border:'1px solid #eee', borderRadius:10, padding:12, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong>✈ {id}</strong>
              <span>Score: <strong>{points}</strong></span>
            </div>
            <div style={{ marginTop:6 }}>Total flight: {fmt(flightMins)}</div>
            <ul style={{ margin:'6px 0 0', paddingLeft:18 }}>
              {kpis.map(k => (
                <li key={k.crewIndex}>
                  Crew {k.crewIndex}: {k.sectors} sectors — duty {fmt(k.dutyMins)} (limit {fmt(k.limitMins)})
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ textAlign:'right', marginTop:8 }}>
          <strong>Total score: {total}</strong>
        </div>

        <div style={{ textAlign:'right', marginTop:12 }}>
          <button onClick={onClose} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #ddd', cursor:'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

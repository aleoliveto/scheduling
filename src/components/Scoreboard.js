import React from 'react';

const fmt = (m) => `${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;

export default function Scoreboard({ allAircraft }) {
  const total = allAircraft.reduce((s, a) => s + a.points, 0);

  return (
    <div style={{ padding: '12px 16px', border: '1px solid #eee', borderRadius: 10, margin: '10px 0', background:'#fff' }}>
      <h3 style={{ margin: 0, marginBottom: 8 }}>Scoreboard</h3>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {allAircraft.map(({ id, kpis, points, flightMins }) => (
          <li key={id} style={{ margin: '6px 0' }}>
            <strong>✈ {id}</strong> — Score: <strong>{points}</strong> | Flight: {fmt(flightMins)} |
            {kpis.map(k => (
              <span key={k.crewIndex} style={{ marginLeft: 10 }}>
                Crew {k.crewIndex}: {k.sectors} sectors, duty {fmt(k.dutyMins)} (limit {fmt(k.limitMins)})
              </span>
            ))}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 8 }}><strong>Total score:</strong> {total}</div>
    </div>
  );
}

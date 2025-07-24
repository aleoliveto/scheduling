import React from 'react';

const Scoreboard = ({ allAircraft }) => {
  const formatMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  const calculateStats = (routes) => {
    const trips = new Set(routes.map(r => r.tripId)).size;
    const dutyTime = routes.reduce((acc, r) => acc + (r.end - r.start), 0);
    const flightTime = routes.filter(r => !r.isTurnaround).reduce((acc, r) => acc + (r.end - r.start), 0);

    let bonus = 0;
    if (dutyTime <= 720 && trips >= 3) bonus += 10;
    if (routes.some(r => r.end > 1380 || r.start < 360)) bonus -= 10;

    return { trips, flightTime, dutyTime, bonus };
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', marginBottom: '1rem' }}>
      <h3>Scoreboard</h3>
      <ul>
        {allAircraft.map(({ id, routes }) => {
          const { trips, flightTime, dutyTime, bonus } = calculateStats(routes);
          return (
            <li key={id}>
              ✈ Aircraft {id}: {trips} trips | 🕑 Flight: {formatMinutes(flightTime)} | ⏱ Duty: {formatMinutes(dutyTime)} | 🎯 Score: {bonus}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Scoreboard;

import React from 'react';

const curfewStart = 1380; // 23:00
const curfewEnd = 330;    // 05:29
const lateDutyLimit = 1350; // 22:30
const earlyStartLimit = 420; // 07:00

export function calculateStats(routes) {
  if (routes.length === 0) return { trips: 0, flightTime: 0, dutyTime: 0, score: 0, factors: [] };

  const trips = new Set(routes.map(r => r.tripId)).size;
  const flightTime = routes.filter(r => !r.isTurnaround).reduce((acc, r) => acc + (r.end - r.start), 0);
  const dutyTime = routes[routes.length - 1].end - routes[0].start;
  const earlyStart = routes[0].start < earlyStartLimit;
  const endsLate = routes[routes.length - 1].end > lateDutyLimit;
  const sectorCount = routes.filter(r => !r.isTurnaround).length;

  let score = 0;
  const factors = [];

  // Utilisation bonus
  const utilHours = flightTime / 60;
  score += utilHours;
  factors.push({ label: 'Utilisation', value: `+${utilHours.toFixed(1)} pts` });

  // Crew duty length
  if (earlyStart) {
    if (dutyTime <= 420) { score += 10; factors.push({ label: 'Early duty OK', value: '+10' }); }
    else { score -= 10; factors.push({ label: 'Early duty exceeded', value: '-10' }); }
  } else {
    if (dutyTime <= 600) { score += 10; factors.push({ label: 'Duty OK', value: '+10' }); }
    else { score -= 10; factors.push({ label: 'Duty exceeded', value: '-10' }); }
  }

  // Sector limit
  if (sectorCount <= 4) { score += 5; factors.push({ label: 'Sector limit OK', value: '+5' }); }
  else { score -= 5; factors.push({ label: 'Sector limit exceeded', value: '-5' }); }

  // Curfew check
  const violatesCurfew = routes.some(r =>
    r.start >= curfewStart || r.end >= curfewStart || r.start < curfewEnd || r.end < curfewEnd
  );
  if (violatesCurfew) { score -= 10; factors.push({ label: 'Curfew violation', value: '-10' }); }

  // Late duty
  if (endsLate) { score -= 5; factors.push({ label: 'Late duty', value: '-5' }); }

  // Variety bonus
  const routeTypes = new Set(routes.filter(r => !r.isTurnaround).map(r => r.type));
  if (routeTypes.size >= 2) { score += 5; factors.push({ label: 'Variety bonus', value: '+5' }); }

  return { trips, flightTime, dutyTime, score: Math.round(score), factors };
}

export default function Scoreboard({ allAircraft }) {
  const formatMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', marginBottom: '1rem' }}>
      <h3>Scoreboard</h3>
      <ul>
        {allAircraft.map(({ id, routes }) => {
          const { trips, flightTime, dutyTime, score } = calculateStats(routes);
          return (
            <li key={id}>
              ✈ Aircraft {id}: {trips} trips | 🕑 Flight: {formatMinutes(flightTime)} | ⏱ Duty: {formatMinutes(dutyTime)} | 🎯 Score: {score}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

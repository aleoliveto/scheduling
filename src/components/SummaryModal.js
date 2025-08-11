import React from 'react';
import { calculateStats } from './Scoreboard';

export default function SummaryModal({ allAircraft, onClose }) {
  const total = allAircraft.reduce((acc, { routes }) => {
    const stats = calculateStats(routes);
    acc.score += stats.score;
    acc.factors.push(...stats.factors.map(f => ({ ...f, aircraft: acc.index })));
    return acc;
  }, { score: 0, factors: [], index: 1 });

  return (
    <div
      style={{
        position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)',
        backgroundColor: 'white', padding: '2rem', border: '2px solid #333', zIndex: 2000,
        width: '90%', maxWidth: '600px', maxHeight: '80%', overflow: 'auto'
      }}
    >
      <h2>Final Score</h2>
      <p>Total Score: <strong>{total.score}</strong></p>
      <h3>Scoring Factors</h3>
      <ul>
        {total.factors.map((f, i) => (
          <li key={i}>{f.label}: {f.value}</li>
        ))}
      </ul>
      <button
        onClick={onClose}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px' }}
      >
        Close
      </button>
    </div>
  );
}

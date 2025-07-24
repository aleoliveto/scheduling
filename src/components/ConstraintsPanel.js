import React from 'react';

const ConstraintsPanel = () => {
  return (
    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>🛑 Operational Constraints</h3>

      <ul style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
        <li>🕓 <strong>Earliest Departure:</strong> 06:00</li>
        <li>🌙 <strong>Latest Arrival (Curfew):</strong> 23:00</li>
        <li>⏱ <strong>Max Duty Time:</strong> 12 hours per aircraft</li>
        <li>🔁 <strong>Turnaround Time:</strong> varies by aircraft</li>
        <li>❌ <strong>No Overlaps:</strong> sectors cannot overlap</li>
      </ul>

      <h3 style={{ marginBottom: '0.5rem' }}>🎯 Tips to Score Better</h3>
      <ul style={{ paddingLeft: '1rem' }}>
        <li>📈 Keep flights sequential and efficient</li>
        <li>💸 Avoid unproductive time blocks</li>
        <li>🚫 Penalties apply for curfews and overlaps</li>
        <li>✅ Bonus for fitting all sectors within rules</li>
      </ul>
    </div>
  );
};

export default ConstraintsPanel;

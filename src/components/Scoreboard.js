import React from 'react';

const Scoreboard = ({ allAircraft }) => {
  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', marginBottom: '1rem' }}>
      <h3>Scoreboard</h3>
      <ul>
        {allAircraft.map(({ id, routes }) => (
          <li key={id}>
            Aircraft {id}: {routes.length} flights assigned
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Scoreboard;

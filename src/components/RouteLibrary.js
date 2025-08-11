import React from 'react';
import { useDrag } from 'react-dnd';

// Example Naples-based routes (blocks in HH:MM)
// Turn times are downroute minimums by type (simplified from your PDF)
const mockRoutes = [
  { from: 'NAP', to: 'JMK', block: '1:45', turnTimes: { A320: 40, A321: 50 } },
  { from: 'NAP', to: 'CFU', block: '1:15', turnTimes: { A320: 40, A321: 50 } },
  { from: 'NAP', to: 'JSI', block: '1:40', turnTimes: { A320: 40, A321: 50 } },
  { from: 'NAP', to: 'MLA', block: '1:15', turnTimes: { A320: 40, A321: 50 } },
  { from: 'NAP', to: 'OLB', block: '1:10', turnTimes: { A320: 35, A321: 45 } },
  { from: 'NAP', to: 'PMO', block: '0:55', turnTimes: { A320: 35, A321: 40 } },
  { from: 'NAP', to: 'CTA', block: '1:05', turnTimes: { A320: 35, A321: 45 } },
  { from: 'NAP', to: 'ATH', block: '1:45', turnTimes: { A320: 40, A321: 50 } },
  { from: 'NAP', to: 'IBZ', block: '2:05', turnTimes: { A320: 35, A321: 45 } },
];

function RouteTile({ route }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'ROUTE',
    item: (() => {
      const { start, end, id, ...clean } = route;
      return clean; // clean object for drop
    })(),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }));

  return (
    <div
      ref={drag}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: '#f5f5f5',
        padding: '10px',
        margin: '8px',
        borderRadius: '8px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
        cursor: 'grab',
        width: '180px',
        textAlign: 'center',
      }}
    >
      <strong>{route.from} → {route.to}</strong>
      <div style={{ fontSize: '0.85rem', color: '#555' }}>
        Block: {route.block}
      </div>
    </div>
  );
}

export default function RouteLibrary() {
  return (
    <div style={{ marginTop: '1rem' }}>
      <h2 style={{ marginLeft: '1rem' }}>Available Routes</h2>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        {mockRoutes.map((r, i) => <RouteTile key={i} route={r} />)}
      </div>
    </div>
  );
}

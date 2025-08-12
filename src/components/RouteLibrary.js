import React from 'react';
import { useDrag } from 'react-dnd';
import { ROUTES } from '../data/routesData';

const Tile = ({ route, remaining }) => {
  const disabled = remaining <= 0;

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'ROUTE',
    canDrag: !disabled,
    item: {
      // pass the full route object
      ...route,
    },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  }), [route, disabled]);

  return (
    <div
      ref={drag}
      title={disabled ? 'No more available' : `${remaining} available`}
      style={{
        opacity: disabled ? 0.4 : isDragging ? 0.6 : 1,
        backgroundColor: '#f7f8fb',
        padding: 10,
        margin: 8,
        borderRadius: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        cursor: disabled ? 'not-allowed' : 'grab',
        width: 200,
        position: 'relative'
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        {route.from} → {route.to}
      </div>
      <div style={{ fontSize: 12, color: '#555' }}>
        Block: {route.block} · {route.type}
      </div>
      <span
        style={{
          position: 'absolute', right: 8, top: 8,
          background: '#eef2ff', color: '#3b5bdb',
          borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 700
        }}
      >
        ×{remaining}
      </span>
    </div>
  );
};

export default function RouteLibrary({ availability }) {
  return (
    <div style={{ marginTop: 12 }}>
      <h2 style={{ marginLeft: 8 }}>Available Routes</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ROUTES.map((r) => (
          <Tile key={r.id} route={r} remaining={availability[r.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}

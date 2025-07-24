import React from 'react';
import { useDrag } from 'react-dnd';

const mockRoutes = [
  { from: 'LGW', to: 'BCN', block: '2:10', turnTimes: { A320: 35, A321: 40 } },
  { from: 'LGW', to: 'MAD', block: '2:30', turnTimes: { A320: 30, A321: 35 } },
  { from: 'LGW', to: 'FAO', block: '2:40', turnTimes: { A320: 35, A321: 40 } },
  { from: 'LGW', to: 'NCE', block: '1:50', turnTimes: { A320: 25, A321: 30 } },
  { from: 'LGW', to: 'FCO', block: '2:45', turnTimes: { A320: 40, A321: 45 } },
  { from: 'LGW', to: 'LIS', block: '2:55', turnTimes: { A320: 35, A321: 40 } },
  { from: 'LGW', to: 'AMS', block: '1:15', turnTimes: { A320: 20, A321: 25 } },
  { from: 'LGW', to: 'PRG', block: '2:05', turnTimes: { A320: 30, A321: 35 } },
  { from: 'LGW', to: 'ATH', block: '3:20', turnTimes: { A320: 45, A321: 50 } },
];

const RouteTile = ({ route }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'ROUTE',
    // ensure id is always undefined for new drags!
    item: { ...route, id: undefined },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
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
};

const RouteLibrary = () => {
  return (
    <div style={{ marginTop: '2rem' }}>
      <h2 style={{ marginLeft: '1rem' }}>Available Routes</h2>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          maxWidth: '700px',
          margin: '0 auto',
        }}
      >
        {mockRoutes.map((route, i) => (
          <RouteTile key={i} route={route} />
        ))}
      </div>
    </div>
  );
};

export default RouteLibrary;

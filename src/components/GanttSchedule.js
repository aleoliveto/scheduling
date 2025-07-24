import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';

const hours = Array.from({ length: 19 }, (_, i) => 6 + i); // 06:00 to 24:00
const totalMinutes = 18 * 60; // 1080 minutes from 6:00 to 24:00

const GanttSchedule = ({ routesByAircraft, onRouteDrop, onRouteDelete }) => {
  return (
    <div style={{ padding: '1rem' }}>
      {/* Timeline Header */}
      <div style={{ display: 'flex', marginBottom: '0.5rem', paddingLeft: '100px' }}>
        {hours.map((hour) => (
          <div
            key={hour}
            style={{
              width: '60px',
              textAlign: 'center',
              fontSize: '0.8rem',
              borderLeft: '1px solid #ddd',
            }}
          >
            {String(hour).padStart(2, '0')}:00
          </div>
        ))}
      </div>

      {/* Aircraft Rows */}
      {Object.entries(routesByAircraft).map(([aircraftId, assignedRoutes]) => (
        <AircraftRow
          key={aircraftId}
          aircraftId={aircraftId}
          assignedRoutes={assignedRoutes}
          onRouteDrop={onRouteDrop}
          onRouteDelete={onRouteDelete}
        />
      ))}
    </div>
  );
};

const AircraftRow = ({ aircraftId, assignedRoutes, onRouteDrop, onRouteDelete }) => {
  const containerRef = useRef(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'ROUTE',
    drop: (item, monitor) => {
      if (!containerRef.current) return;
      const boundingRect = containerRef.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const relativeX = clientOffset.x - boundingRect.left;
      const percent = Math.min(Math.max(relativeX / boundingRect.width, 0), 1);
      const dropTime = 6 * 60 + Math.floor(percent * totalMinutes); // minutes from midnight starting at 6:00

      onRouteDrop(aircraftId, item, dropTime);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }));

  drop(containerRef);

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
      <div style={{ width: '100px', fontWeight: 'bold' }}>✈ {aircraftId}</div>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: '50px',
          flex: 1,
          border: '1px dashed #aaa',
          backgroundColor: isOver ? '#f0f0f0' : '#fff',
        }}
      >
        {assignedRoutes.map((route) => {
          const startPercent = ((route.start - 6 * 60) / totalMinutes) * 100;
          const widthPercent = ((route.end - route.start) / totalMinutes) * 100;

          // Format time for input HH:mm
          const formatTime = (mins) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          };

          const formattedStart = formatTime(route.start);

          const onStartTimeChange = (e) => {
            const value = e.target.value; // expected HH:mm
            const [h, m] = value.split(':').map(Number);
            if (h >= 6 && h <= 24 && m >= 0 && m < 60) {
              const newStart = h * 60 + m;
              const duration = route.end - route.start;
              const newEnd = newStart + duration;

              onRouteDrop(aircraftId, { ...route, start: newStart, end: newEnd }, newStart);
            }
          };

          return (
            <div
              key={route.id}
              title={`${route.from} → ${route.to}\n${formatTime(route.start)}–${formatTime(route.end)}`}
              style={{
                position: 'absolute',
                left: `${startPercent}%`,
                width: `${widthPercent}%`,
                height: '100%',
                backgroundColor: '#69c0ff',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                fontSize: '0.7rem',
                border: '2px solid #0050b3',
                boxSizing: 'border-box',
                userSelect: 'none',
              }}
            >
              <span>{route.from} → {route.to}</span>
              <input
                type="time"
                value={formattedStart}
                onChange={onStartTimeChange}
                style={{
                  marginTop: 2,
                  width: '70%',
                  fontSize: '0.7rem',
                  textAlign: 'center',
                  borderRadius: '3px',
                  border: 'none',
                  outline: 'none',
                  color: '#003a8c',
                  fontWeight: 'bold',
                }}
              />
              <button
                onClick={() => onRouteDelete(aircraftId, route.id)}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '4px',
                  background: 'transparent',
                  color: 'white',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                }}
                title="Delete route"
              >
                ✖
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttSchedule;

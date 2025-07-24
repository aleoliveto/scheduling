import React, { useRef } from 'react';
import { useDrop } from 'react-dnd';

const baseTime = 360; // 06:00 in minutes
const totalMinutes = 1080; // 18 hours (06:00 to 24:00)
const hours = Array.from({ length: 19 }, (_, i) => 6 + i); // 06:00–24:00
const timelineWidth = 1140; // 19 * 60px

const GanttSchedule = ({
  routesByAircraft,
  onRouteDrop,
  onRouteDelete,
  onUpdateTripStart
}) => {
  return (
    <div style={{ padding: '1rem' }}>
      <div style={{ width: `${timelineWidth + 100}px`, overflowX: 'auto' }}>
        {/* Timeline Header */}
        <div style={{ display: 'flex', width: `${timelineWidth}px`, marginLeft: '100px' }}>
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
            onUpdateTripStart={onUpdateTripStart}
            timelineWidth={timelineWidth}
          />
        ))}
      </div>
    </div>
  );
};

const AircraftRow = ({
  aircraftId,
  assignedRoutes,
  onRouteDrop,
  onRouteDelete,
  onUpdateTripStart,
  timelineWidth
}) => {
  const containerRef = useRef(null);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'ROUTE',
    drop: (item, monitor) => {
      if (!containerRef.current) return;
      const boundingRect = containerRef.current.getBoundingClientRect();
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const relativeX = clientOffset.x - boundingRect.left;
      const percent = Math.min(Math.max(relativeX / timelineWidth, 0), 1);
      const dropTime = baseTime + Math.floor(percent * totalMinutes);

      onRouteDrop(aircraftId, item, dropTime);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  }));

  drop(containerRef);

  // Dropdown options (every 5 min between 06:00 and 24:00)
  const startOptions = [];
  for (let mins = baseTime; mins <= baseTime + totalMinutes - 5; mins += 5) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    startOptions.push(
      <option key={mins} value={mins}>
        {label}
      </option>
    );
  }

  const formatTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
      <div style={{ width: '100px', fontWeight: 'bold' }}>✈ {aircraftId}</div>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: `${timelineWidth}px`,
          height: '50px',
          border: '1px dashed #aaa',
          backgroundColor: isOver ? '#f0f0f0' : '#fff',
          overflow: 'hidden'
        }}
      >
        {assignedRoutes.map((route) => {
          const startPercent = ((route.start - baseTime) / totalMinutes) * 100;
          const widthPercent = ((route.end - route.start) / totalMinutes) * 100;

          // --- Outbound (first sector of the trip) ---
          if (!route.isTurnaround && route.id.endsWith('-out')) {
            const onStartTimeChange = (e) => {
              const newStart = parseInt(e.target.value, 10);
              onUpdateTripStart(aircraftId, route.tripId, newStart);
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
                  fontSize: '0.8rem',
                  border: '2px solid #0050b3',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                  zIndex: 3
                }}
              >
                <span>{route.from} → {route.to}</span>
                <select
                  value={route.start}
                  onChange={onStartTimeChange}
                  style={{
                    marginTop: 2,
                    fontSize: '0.7rem',
                    borderRadius: '3px',
                    border: 'none',
                    outline: 'none',
                    color: '#003a8c',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    width: '70%',
                  }}
                >
                  {startOptions}
                </select>
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
                  title="Delete whole trip"
                >
                  ✖
                </button>
              </div>
            );
          }

          // --- Turnaround segment ---
          if (route.isTurnaround) {
            return (
              <div
                key={route.id}
                title={`Turnaround: ${route.turnaround || (route.end - route.start)} min`}
                style={{
                  position: 'absolute',
                  left: `${startPercent}%`,
                  width: `${widthPercent}%`,
                  height: '100%',
                  backgroundColor: '#f5222d',
                  opacity: 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  zIndex: 2
                }}
              >
                {route.turnaround || (route.end - route.start)} min Turn
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
                  title="Delete whole trip"
                >
                  ✖
                </button>
              </div>
            );
          }

          // --- Inbound segment ---
          if (!route.isTurnaround && route.id.endsWith('-in')) {
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
                  fontSize: '0.8rem',
                  border: '2px solid #0050b3',
                  boxSizing: 'border-box',
                  userSelect: 'none',
                  zIndex: 3
                }}
              >
                <span>{route.from} → {route.to}</span>
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
                  title="Delete whole trip"
                >
                  ✖
                </button>
              </div>
            );
          }

          // Should not hit this, but return null if segment is malformed
          return null;
        })}
      </div>
    </div>
  );
};

export default GanttSchedule;

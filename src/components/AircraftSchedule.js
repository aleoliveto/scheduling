import React, { useState } from 'react';
import { useDrop } from 'react-dnd';

const AircraftSchedule = ({ aircraftId, onUpdateRoutes }) => {
  const aircraftType = aircraftId === 'A1' ? 'A320' : 'A321';
  const [assignedRoutes, setAssignedRoutes] = useState([]);
  const startHour = 6;

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'ROUTE',
    drop: (item) => addRoute(item),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const parseDuration = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

 // const formatTime = (mins) => {
  //  const hours = Math.floor(mins / 60);
   // const minutes = mins % 60;
   // return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  //};

  const addRoute = (route) => {
    const last = assignedRoutes[assignedRoutes.length - 1];
    const lastEnd = last ? last.end : startHour * 60;
    const blockMins = parseDuration(route.block);
    const turnTime = route.turnTimes?.[aircraftType] ?? 35;

    const start = lastEnd;
    const end = start + blockMins + turnTime;

    const fullRoute = {
      ...route,
      start,
      end,
      id: Date.now() + Math.random(),
      aircraftType,
      turnUsed: turnTime,
    };

    setAssignedRoutes((prev) => {
      const updated = [...prev, fullRoute];
      onUpdateRoutes(updated);
      return updated;
    });
  };

  const deleteRoute = (id) => {
    setAssignedRoutes((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      onUpdateRoutes(updated);
      return updated;
    });
  };

  const dutyTime =
    assignedRoutes.length > 0
      ? assignedRoutes[assignedRoutes.length - 1].end - assignedRoutes[0].start
      : 0;

  const earlyStart = assignedRoutes.length > 0 && assignedRoutes[0].start < 420;
  const tooLong = !earlyStart && dutyTime > 600;
  const earlyLimitExceeded = earlyStart && dutyTime > 420;
  const sectorLimitExceeded = assignedRoutes.length > 4;

  const curfewViolations = assignedRoutes.filter(
    (r) =>
      r.start < 330 || r.start >= 1380 || r.end < 330 || r.end >= 1380
  ).length > 0;

  const endsLate =
    assignedRoutes.length > 0 &&
    assignedRoutes[assignedRoutes.length - 1].end > 1350;

  return (
    <div
      ref={drop}
      style={{
        width: '30%',
        minHeight: '300px',
        padding: '1rem',
        border: '2px dashed #ccc',
        backgroundColor: isOver ? '#f0f0f0' : '#fafafa',
        margin: '0 10px',
      }}
    >
      <h2>
        Aircraft {aircraftId}{' '}
        <span style={{ fontWeight: 'normal', fontSize: '0.8rem' }}>({aircraftType})</span>
      </h2>

      {assignedRoutes.length === 0 && <p>🟧 Drop routes here</p>}

      {/* Visual timeline blocks */}
      {assignedRoutes.map((route) => {
        const left = ((route.start - 360) / 1080) * 100;
        const width = ((route.end - route.start) / 1080) * 100;

        const curfew =
          route.start < 330 || route.end < 330 || route.start >= 1380 || route.end >= 1380;
        const late = route.end > 1350;

        return (
          <div
            key={route.id}
            style={{
              position: 'relative',
              margin: '0.5rem 0',
              height: '40px',
              background: curfew ? '#ffccc7' : late ? '#ffe58f' : '#bae7ff',
              border: '1px solid #91d5ff',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${left}%`,
                width: `${width}%`,
                height: '100%',
                backgroundColor: curfew ? '#ff4d4f' : late ? '#faad14' : '#1890ff',
                opacity: 0.9,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
              }}
            >
              {route.from} → {route.to} ({route.block})
            </div>

            <button
              onClick={() => deleteRoute(route.id)}
              style={{
                position: 'absolute',
                top: 2,
                right: 2,
                background: 'black',
                color: 'white',
                border: 'none',
                fontSize: '0.7rem',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              ✖
            </button>
          </div>
        );
      })}

      {/* Timeline labels */}
      <div style={{ marginTop: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#999',
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => {
            const hour = 6 + i * 2;
            return <span key={hour}>{String(hour).padStart(2, '0')}:00</span>;
          })}
        </div>
      </div>

      {/* Warnings */}
      {assignedRoutes.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>🕓 Duty Time:</strong> {Math.floor(dutyTime / 60)}h {dutyTime % 60}m
          {tooLong && <p style={{ color: 'red' }}>⚠️ Exceeds 10-hour crew limit!</p>}
          {earlyLimitExceeded && (
            <p style={{ color: 'orange' }}>⚠️ Early start: exceeds 7-hour duty limit!</p>
          )}
          {sectorLimitExceeded && (
            <p style={{ color: 'red' }}>⚠️ Max 4 sectors exceeded!</p>
          )}
          {curfewViolations && (
            <p style={{ color: 'red' }}>🚫 Curfew violation (23:00–05:29) detected!</p>
          )}
          {endsLate && (
            <p style={{ color: 'orange' }}>⚠️ Last arrival after 22:30 – late duty!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AircraftSchedule;

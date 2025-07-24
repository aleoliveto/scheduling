// src/components/GanttSchedule.js
import React, { useRef } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import './GanttSchedule.scss';

const baseTime = 360;
const totalMinutes = 1080;
const hours = Array.from({ length: 19 }, (_, i) => 6 + i);

export default function GanttSchedule({ routesByAircraft, onRouteDrop, onRouteDelete, onUpdateTripStart }) {
  return (
    <div className="gantt-container">
      <div className="timeline-header">
        <div className="aircraft-label-placeholder" />
        {hours.map(h => (
          <div key={h} className="timeline-hour">{`${String(h).padStart(2,'0')}:00`}</div>
        ))}
      </div>

      {Object.entries(routesByAircraft).map(([aircraftId, segments]) => (
        <AircraftRow
          key={aircraftId}
          aircraftId={aircraftId}
          segments={segments}
          onRouteDrop={onRouteDrop}
          onRouteDelete={onRouteDelete}
          onUpdateTripStart={onUpdateTripStart}
        />
      ))}
    </div>
  );
}

function AircraftRow({ aircraftId, segments, onRouteDrop, onRouteDelete, onUpdateTripStart }) {
  const ref = useRef(null);
  const [{ isOver }, drop] = useDrop({
    accept: 'ROUTE',
    drop: (item, monitor) => {
      const rect = ref.current?.getBoundingClientRect();
      const x = monitor.getClientOffset()?.x - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const dropTime = baseTime + Math.round(percent * totalMinutes);
      onRouteDrop(aircraftId, item, dropTime);
    },
    collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) })
  });
  drop(ref);

  return (
    <div className="aircraft-row">
      <div className="aircraft-label">✈ {aircraftId}</div>
      <div ref={ref} className={`timeline ${isOver ? 'over' : ''}`}>
        {segments.map(route => (
          <Segment
            key={route.id}
            route={route}
            onDelete={() => onRouteDelete(aircraftId, route.id)}
            onStartChange={route.id.endsWith('-out') ? value => onUpdateTripStart(aircraftId, route.tripId, +value) : null}
          />
        ))}
      </div>
    </div>
  );
}

function Segment({ route, onDelete, onStartChange }) {
  const widthPercent = ((route.end - route.start) / totalMinutes) * 100;
  const leftPercent = ((route.start - baseTime) / totalMinutes) * 100;
  const mode = route.isTurnaround ? 'turnaround' : 'outbound';

  const [{ isDragging }, drag] = useDrag({
    type: 'SEGMENT',
    item: { id: route.id },
    collect: m => ({ isDragging: m.isDragging() })
  });

  return (
    <div
      ref={drag}
      style={{ width: `${widthPercent}%`, left: `${leftPercent}%`, opacity: isDragging ? 0.7 : 1 }}
      className={`segment ${mode}`}
    >
      <div className="info">
        {!route.isTurnaround ? route.from + ' → ' + route.to : `${route.turnaround || route.end - route.start}m Turn`}
        {onStartChange && (
          <select
            className="start-select"
            value={route.start}
            onChange={e => onStartChange(e.target.value)}
          >
            {Array.from({ length:  (totalMinutes / 5) + 1 }, (_, i) => {
              const m = baseTime + i * 5;
              const hh = Math.floor(m/60);
              const mm = m%60;
              return (
                <option key={m} value={m}>{`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}</option>
              );
            })}
          </select>
        )}
      </div>
      <button className="delete-btn" onClick={onDelete}>✖</button>
    </div>
  );
}

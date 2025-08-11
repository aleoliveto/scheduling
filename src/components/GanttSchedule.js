import React, { useRef, useState, useEffect } from 'react';
import { useDrop, useDrag } from 'react-dnd';
import './GanttSchedule.scss';

const baseTime = 360;
const totalMinutes = 1080;
const latestAllowed = 1380;
const gridMinutes = 5;
const hours = Array.from({ length: 19 }, (_, i) => 6 + i);

export default function GanttSchedule({ routesByAircraft, crewState, onRouteDrop, onRouteDelete, onUpdateTripStart, onForceCrewChange }) {
  return (
    <div className="gantt-container">
      <div className="timeline-header">
        <div className="aircraft-label-placeholder" />
        {hours.map(h => (
          <div key={h} className="timeline-hour">{`${String(h).padStart(2, '0')}:00`}</div>
        ))}
      </div>

      {Object.entries(routesByAircraft).map(([aircraftId, segments]) => (
        <AircraftRow
          key={aircraftId}
          aircraftId={aircraftId}
          segments={segments}
          pendingCrew={crewState?.[aircraftId]?.pendingCrewIndex ?? null}
          onRouteDrop={onRouteDrop}
          onRouteDelete={onRouteDelete}
          onUpdateTripStart={onUpdateTripStart}
          onForceCrewChange={onForceCrewChange}
        />
      ))}
    </div>
  );
}

/* helpers */
function snap(m) {
  const r = Math.round(m / gridMinutes) * gridMinutes;
  return Math.max(baseTime, r);
}
function findNextAvailableStart(existing, wantStart, blockMins, turnaround) {
  const span = blockMins * 2 + turnaround;
  const segs = [...existing].sort((a,b)=>a.start-b.start);
  const busy = [];
  for (const s of segs) {
    const last = busy[busy.length-1];
    if (!last || s.start > last.end) busy.push({ start: s.start, end: s.end });
    else last.end = Math.max(last.end, s.end);
  }
  const windows = [];
  if (busy.length === 0) windows.push({ start: baseTime, end: latestAllowed });
  else {
    if (busy[0].start > baseTime) windows.push({ start: baseTime, end: busy[0].start });
    for (let i=0;i<busy.length-1;i++) windows.push({ start: busy[i].end, end: busy[i+1].start });
    windows.push({ start: busy[busy.length-1].end, end: latestAllowed });
  }
  const candidate = windows.filter(w => w.end - w.start >= span);
  for (const w of candidate) {
    const start = snap(Math.max(w.start, wantStart));
    const end = start + span;
    if (end <= w.end && end <= latestAllowed) return start;
  }
  return null;
}
export function scheduleTripWithAutoResolve(existing, route, aircraftType, desiredStart) {
  const [h,m] = route.block.split(':').map(Number);
  const blockMins = h*60+m;
  const turnaround = route.turnTimes?.[aircraftType] ?? 40;
  const start = findNextAvailableStart(existing, desiredStart ?? baseTime, blockMins, turnaround);
  if (start == null) return null;
  const end = start + blockMins;
  const inboundStart = end + turnaround;
  const inboundEnd = inboundStart + blockMins;
  if (inboundEnd > latestAllowed) return null;

  const tripId = Date.now() + Math.random();
  return [
    { ...route, start, end, id: tripId+'-out', tripId, isTurnaround: false },
    { start: end, end: inboundStart, id: tripId+'-turn', tripId, isTurnaround: true, turnaround },
    { from: route.to, to: route.from, block: route.block, turnTimes: route.turnTimes, start: inboundStart, end: inboundEnd, id: tripId+'-in', tripId, isTurnaround: false }
  ];
}

/* row */
function AircraftRow({ aircraftId, segments, pendingCrew, onRouteDrop, onRouteDelete, onUpdateTripStart, onForceCrewChange }) {
  const ref = useRef(null);
  const [preview, setPreview] = useState(null);
  const typeFor = id => (id==='A1' ? 'A320' : 'A321');

  const [{ isOver }, drop] = useDrop({
    accept: 'ROUTE',
    hover: (item, monitor) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const x = (monitor.getClientOffset()?.x ?? rect.left) - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const desiredStart = snap(baseTime + Math.round(percent * totalMinutes));
      const planned = scheduleTripWithAutoResolve(segments, item, typeFor(aircraftId), desiredStart);
      if (planned) {
        const out = planned.find(s=>s.id.endsWith('-out'));
        const turn = planned.find(s=>s.id.endsWith('-turn'));
        const inb = planned.find(s=>s.id.endsWith('-in'));
        setPreview({
          out: { start: out.start, end: out.end },
          turn: { start: turn.start, end: turn.end },
          inb: { start: inb.start, end: inb.end },
          invalid: false,
          label: `${item.from} → ${item.to} (${item.block})`
        });
      } else {
        const [hh,mm] = item.block.split(':').map(Number);
        const block = hh*60+mm;
        const turn = item.turnTimes?.[typeFor(aircraftId)] ?? 40;
        setPreview({
          out: { start: desiredStart, end: desiredStart+block },
          turn: { start: desiredStart+block, end: desiredStart+block+turn },
          inb: { start: desiredStart+block+turn, end: desiredStart+2*block+turn },
          invalid: true,
          label: `${item.from} → ${item.to} (${item.block})`
        });
      }
    },
    drop: (item, monitor) => {
      const rect = ref.current?.getBoundingClientRect();
      const x = monitor.getClientOffset()?.x - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      const dropTime = snap(baseTime + Math.round(percent * totalMinutes));
      setPreview(null);
      onRouteDrop(aircraftId, item, dropTime);
    },
    collect: monitor => ({ isOver: monitor.isOver({ shallow: true }) }),
    leave: () => setPreview(null),
  });
  drop(ref);

  useEffect(() => { if (!isOver && preview) setPreview(null); }, [isOver]); // clear on iPad when finger leaves

  return (
    <div className="aircraft-row">
      <div className="aircraft-label">
        ✈ {aircraftId}
        <div className="crew-toggle">
          <button
            className={pendingCrew === 1 ? 'active' : ''}
            onClick={() => onForceCrewChange?.(aircraftId, 1)}
            title="Next trip: Crew 1"
          >
            CR1
          </button>
          <button
            className={pendingCrew === 2 ? 'active' : ''}
            onClick={() => onForceCrewChange?.(aircraftId, 2)}
            title="Next trip: Crew 2"
          >
            CR2
          </button>
        </div>
      </div>

      <div ref={ref} className={`timeline ${isOver ? 'over' : ''}`}>
        {preview && (
          <>
            <GhostBlock range={preview.out} label={preview.label} invalid={preview.invalid} />
            <GhostTurn range={preview.turn} invalid={preview.invalid} />
            <GhostBlock range={preview.inb} invalid={preview.invalid} />
          </>
        )}

        {segments.map(route => (
          <Segment
            key={route.id}
            route={route}
            onDelete={() => onRouteDelete(aircraftId, route.id)}
            onStartChange={
              route.id.endsWith('-out')
                ? value => onUpdateTripStart(aircraftId, route.tripId, +value)
                : null
            }
          />
        ))}
      </div>
    </div>
  );
}

/* segment */
function Segment({ route, onDelete, onStartChange }) {
  const widthPercent = ((route.end - route.start) / totalMinutes) * 100;
  const leftPercent = ((route.start - baseTime) / totalMinutes) * 100;

  const isCurfew = route.start < baseTime || route.end > latestAllowed;
  const isLate = route.end > 1350 && !isCurfew;
  const isTurn = route.isTurnaround;
  const isCrewChange = route.isCrewChange;
  const showDelete = route.id?.endsWith('-in');
  const mode = isCrewChange ? 'crew-change' : isTurn ? 'turnaround' : 'outbound';

  const fullLabel = isTurn ? `${route.turnaround || route.end - route.start}m Turn`
    : `${route.from ?? ''}${route.from ? ' → ' : ''}${route.to ?? ''}${route.block ? ` (${route.block})` : ''}`;

  let shortLabel = fullLabel;
  if (!isTurn && !isCrewChange) {
    if (widthPercent < 8) shortLabel = `${route.from}→${route.to}`;
    else if (widthPercent < 14) shortLabel = `${route.from}→${route.to} ${route.block}`;
  }

  const [{ isDragging }, drag] = useDrag({
    type: 'SEGMENT',
    item: { id: route.id },
    collect: m => ({ isDragging: m.isDragging() })
  });

  const showCrewBadge = !isCrewChange && !isTurn && route.id?.endsWith('-out');

  return (
    <div
      ref={drag}
      style={{ width: `${widthPercent}%`, left: `${leftPercent}%`, opacity: isDragging ? 0.7 : 1 }}
      className={`segment ${mode} ${isCurfew ? 'curfew' : isLate ? 'late' : ''}`}
      title={fullLabel}
    >
      {!isCrewChange && !isTurn && (
        <>
          <span className="seg-label">{shortLabel}</span>
          {showCrewBadge && <span className="crew-badge">Crew {route.crewIndex ?? 1}</span>}
          {onStartChange && (
            <select
              className="start-select start-pill"
              value={route.start}
              onChange={e => onStartChange(e.target.value)}
            >
              {Array.from({ length: (totalMinutes / 5) + 1 }, (_, i) => {
                const m = baseTime + i * 5;
                const hh = Math.floor(m / 60);
                const mm = m % 60;
                return <option key={m} value={m}>{`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`}</option>;
              })}
            </select>
          )}
          {showDelete && <button className="delete-btn" onClick={onDelete} aria-label="Delete trip">✖</button>}
        </>
      )}

      {isTurn && <span className="turn-band" title={fullLabel} />}
      {isCrewChange && <span className="crew-change-chip">Crew change +10m</span>}
    </div>
  );
}

/* ghosts */
function GhostBlock({ range, label, invalid }) {
  if (!range) return null;
  const widthPercent = ((range.end - range.start) / totalMinutes) * 100;
  const leftPercent = ((range.start - baseTime) / totalMinutes) * 100;
  return (
    <div className={`segment preview ${invalid ? 'invalid' : ''}`} style={{ width: `${widthPercent}%`, left: `${leftPercent}%` }} title={label}>
      {label && <span className="seg-label">{label}</span>}
    </div>
  );
}
function GhostTurn({ range, invalid }) {
  if (!range) return null;
  const widthPercent = ((range.end - range.start) / totalMinutes) * 100;
  const leftPercent = ((range.start - baseTime) / totalMinutes) * 100;
  return (
    <div className={`segment turnaround preview ${invalid ? 'invalid' : ''}`} style={{ width: `${widthPercent}%`, left: `${leftPercent}%` }}>
      <span className="turn-band preview" />
    </div>
  );
}

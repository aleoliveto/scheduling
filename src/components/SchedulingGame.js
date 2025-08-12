import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';

import GanttSchedule, { scheduleTripWithAutoResolve } from './GanttSchedule';
import RouteLibrary from './RouteLibrary';
import ConstraintsPanel from './ConstraintsPanel';
import Scoreboard from './Scoreboard';
import EventModal from './EventModal';
import SummaryModal from './SummaryModal';

import { ROUTES, TURN_TIMES, initialAvailability, toMinutes } from '../data/routesData';
import './App.scss';

const baseTime = 360;       // 06:00
const latestAllowed = 1380; // 23:00
const maxDutyTime = 720;    // day guard (12h)

// sector points grow with duration (shorter = fewer points)
const sectorPoints = (mins) => Math.max(2, Math.min(8, Math.floor(mins / 30)));
const TYPE_POINTS = { Holidays: 5, Leisure: 3, Domestic: 2 };
const UTIL_BONUS_MIN = 8 * 60;
const UTIL_BONUS_POINTS = 10;
const LATE_DUTY_PENALTY = 10;
const CURFEW_PENALTY = 15;
const IDLE_STEP = 30;

const dutyLimitFor = (startMins) => (startMins < 420 ? 420 : 600);

function recomputeCrewStateForAircraft(segments) {
  const nonTurn = segments.filter(s => !s.isTurnaround && !s.isCrewChange);
  if (nonTurn.length === 0) {
    return { crewIndex: 1, sectors: 0, dutyStart: null, pendingChange: false, pendingCrewIndex: null };
  }
  const maxCrew = Math.max(...nonTurn.map(s => s.crewIndex || 1));
  const lastCrewSegs = nonTurn.filter(s => (s.crewIndex || 1) === maxCrew).sort((a, b) => a.start - b.start);
  const sectors = lastCrewSegs.length;
  const dutyStart = lastCrewSegs[0]?.start ?? null;
  return { crewIndex: maxCrew, sectors, dutyStart, pendingChange: false, pendingCrewIndex: null };
}
function cleanUpCrewMarkers(list) {
  const starts = new Set(list.filter(s => !s.isCrewChange).map(s => s.start));
  return list.filter(s => !s.isCrewChange || starts.has(s.end));
}

export default function SchedulingGame() {
  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const [routesByAircraft, setRoutesByAircraft] = useState({ A1: [], A2: [], A3: [] });
  const routesRef = useRef(routesByAircraft);
  useEffect(() => { routesRef.current = routesByAircraft; }, [routesByAircraft]);

  const [availability, setAvailability] = useState(initialAvailability);

  const [crewByAc, setCrewByAc] = useState({
    A1: { crewIndex: 1, sectors: 0, dutyStart: null, pendingChange: false, pendingCrewIndex: null },
    A2: { crewIndex: 1, sectors: 0, dutyStart: null, pendingChange: false, pendingCrewIndex: null },
    A3: { crewIndex: 1, sectors: 0, dutyStart: null, pendingChange: false, pendingCrewIndex: null },
  });

  const [activeEvent, setActiveEvent] = useState(null);
  const [disruptionState, setDisruptionState] = useState({
    frozenAircraft: [],
    delayedAirport: null,
    charterBonusActive: false,
  });

  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [showConstraints, setShowConstraints] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => { const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (timeLeft === 0) setShowSummary(true); }, [timeLeft]);

  const getAircraftType = id => (id === 'A1' ? 'A320' : 'A321');
  const minTurn = (airport, acType) => TURN_TIMES[airport]?.[acType] ?? 40;

  const forceCrewChange = (aircraftId, nextCrewIndex) => {
    const idx = Math.max(1, Math.min(2, nextCrewIndex || 2));
    setCrewByAc(prev => ({
      ...prev,
      [aircraftId]: { ...prev[aircraftId], pendingChange: true, pendingCrewIndex: idx }
    }));
  };

  const updateRoutes = (aircraftId, newList) => {
    const sorted = [...newList].sort((a, b) => a.start - b.start);
    const cleaned = cleanUpCrewMarkers(sorted);
    setRoutesByAircraft(prev => ({ ...prev, [aircraftId]: cleaned }));
    const rebuilt = recomputeCrewStateForAircraft(cleaned);
    setCrewByAc(prev => ({ ...prev, [aircraftId]: { ...prev[aircraftId], ...rebuilt } }));
  };

  const handleRouteDrop = (aircraftId, route, dropTime = null) => {
    // inventory gate
    if ((availability[route.id] ?? 0) <= 0) {
      alert('No more of this route available.');
      return;
    }
    if (disruptionState.frozenAircraft.includes(aircraftId)) {
      alert(`Aircraft ${aircraftId} is unavailable.`);
      return;
    }

    const acType = getAircraftType(aircraftId);
    const existing = routesRef.current[aircraftId] || [];
    const blockMins = toMinutes(route.block);

    let desiredStart = dropTime ?? baseTime;
    if (disruptionState.delayedAirport && [route.from, route.to].includes(disruptionState.delayedAirport)) {
      desiredStart += 15;
    }

    // crew logic
    let { crewIndex, sectors, dutyStart, pendingChange, pendingCrewIndex } = crewByAc[aircraftId];
    let crewChangeMarker = null;
    if (pendingChange) desiredStart += 10;

    // use exact turn times (downroute + base)
    const turnDown = minTurn(route.to, acType);
    const turnBase = minTurn(route.from, acType);

    // we’ll ask the auto-resolver to place at desiredStart, then we’ll insert a base turn *after* inbound if needed later
    let plannedTrip = scheduleTripWithAutoResolve(
      existing,
      { ...route, turnTimes: { [acType]: turnDown } }, // keep API shape the same
      acType,
      desiredStart
    );
    if (!plannedTrip) { alert('No space before curfew without overlap.'); return; }

    const outSeg = plannedTrip.find(s => s.id.endsWith('-out'));
    const inSeg  = plannedTrip.find(s => s.id.endsWith('-in'));
    const tripEnd = inSeg.end;

    // duty limits
    const effectiveDutyStart = dutyStart ?? outSeg.start;
    const limit = dutyLimitFor(effectiveDutyStart);
    const wouldExceedSectors = (sectors + 2) > 4;
    const wouldExceedTime = (tripEnd - effectiveDutyStart) > limit;

    if (wouldExceedSectors || wouldExceedTime) {
      if (crewIndex >= 2) { alert('Crew limits reached (max 2 crews).'); return; }
      desiredStart += 10;
      const rePlanned = scheduleTripWithAutoResolve(
        existing,
        { ...route, turnTimes: { [acType]: turnDown } },
        acType,
        desiredStart
      );
      if (!rePlanned) { alert('No space after crew change before curfew.'); return; }

      const markerEnd = desiredStart;
      const markerExists = existing.some(s => s.isCrewChange && s.end === markerEnd);
      if (!markerExists) {
        const markerId = Date.now() + Math.random();
        crewChangeMarker = { start: desiredStart - 10, end: desiredStart, id: `${markerId}-crewchange`, tripId: `crewchange-${markerId}`, isCrewChange: true };
      }

      plannedTrip = rePlanned;
      crewIndex = 2;
      sectors = 0;
      dutyStart = rePlanned.find(s => s.id.endsWith('-out')).start;
      pendingChange = false; pendingCrewIndex = null;
    }

    if (crewByAc[aircraftId].pendingChange && !crewChangeMarker) {
      const target = pendingCrewIndex || (crewIndex === 1 ? 2 : 1);
      desiredStart += 10;
      const rePlanned = scheduleTripWithAutoResolve(
        existing,
        { ...route, turnTimes: { [acType]: turnDown } },
        acType,
        desiredStart
      );
      if (!rePlanned) { alert('No space after crew change before curfew.'); return; }

      const markerEnd = desiredStart;
      const markerExists = existing.some(s => s.isCrewChange && s.end === markerEnd);
      if (!markerExists) {
        const markerId = Date.now() + Math.random();
        crewChangeMarker = { start: desiredStart - 10, end: desiredStart, id: `${markerId}-crewchange`, tripId: `crewchange-${markerId}`, isCrewChange: true };
      }

      plannedTrip = rePlanned;
      crewIndex = target;
      sectors = 0;
      dutyStart = rePlanned.find(s => s.id.endsWith('-out')).start;
      pendingChange = false; pendingCrewIndex = null;
    }

    // aircraft-day guard
    const addedDuty = plannedTrip.reduce((s, seg) => s + (seg.end - seg.start), 0);
    const currentDuty = existing.reduce((s, seg) => s + (seg.end - seg.start), 0);
    if (currentDuty + addedDuty > maxDutyTime) { alert('Duty time exceeded for aircraft day.'); return; }

    // tag with crew + routeKey (so we can restore inventory on delete) + type for scoring
    const tagged = plannedTrip.map(s =>
      s.isTurnaround
        ? { ...s, crewIndex }
        : { ...s, crewIndex, type: route.type, routeKey: route.id, blockMins }
    );
    sectors += 2;

    const base = crewChangeMarker ? [...existing, crewChangeMarker, ...tagged] : [...existing, ...tagged];
    updateRoutes(aircraftId, base);

    // decrement availability on successful placement
    setAvailability(prev => ({ ...prev, [route.id]: Math.max(0, (prev[route.id] ?? 0) - 1) }));

    setCrewByAc(prev => ({ ...prev, [aircraftId]: { crewIndex, sectors, dutyStart, pendingChange, pendingCrewIndex } }));
  };

  const restoreAvailabilityForTrip = (list, tripId) => {
    const out = list.find(s => s.tripId === tripId && s.id.endsWith('-out'));
    if (out?.routeKey) {
      setAvailability(prev => ({ ...prev, [out.routeKey]: (prev[out.routeKey] ?? 0) + 1 }));
    }
  };

  const handleRouteDelete = (aircraftId, routeId) => {
    const list = routesRef.current[aircraftId] || [];
    const tid = list.find(r => r.id === routeId)?.tripId;
    if (!tid) return;

    restoreAvailabilityForTrip(list, tid);
    updateRoutes(aircraftId, list.filter(s => s.tripId !== tid));
  };

  const handleUpdateTripStart = (aircraftId, tripId, newStart) => {
    const arr = routesRef.current[aircraftId] || [];
    const segs = arr.filter(r => r.tripId === tripId);
    if (segs.length !== 3) return;

    const out = segs.find(s => s.id.endsWith('-out'));
    const turn = segs.find(s => s.id.endsWith('-turn'));
    const inb = segs.find(s => s.id.endsWith('-in'));
    if (!out || !turn || !inb) return;

    const dur = out.end - out.start;
    const newOut = { ...out, start: +newStart, end: +newStart + dur };
    const newTurn = { ...turn, start: newOut.end, end: newOut.end + (turn.end - turn.start) };
    const newIn = { ...inb, start: newTurn.end, end: newTurn.end + (inb.end - inb.start) };

    if (newIn.end > latestAllowed || newOut.start < baseTime) return;

    const remaining = arr.filter(r => r.tripId !== tripId);
    const overlap = remaining.some(e =>
      [newOut, newTurn, newIn].some(p => !(e.end <= p.start || e.start >= p.end))
    );
    if (overlap) return;

    updateRoutes(aircraftId, remaining.concat([newOut, newTurn, newIn]));
  };

  // random events (with inventory restore for crew illness)
  const eventTimeoutRef = useRef(null);
  const clearEventTimeout = () => { if (eventTimeoutRef.current) { clearTimeout(eventTimeoutRef.current); eventTimeoutRef.current = null; } };
  const scheduleNextEvent = () => { clearEventTimeout(); const wait = Math.random() * 30000 + 60000; eventTimeoutRef.current = setTimeout(fireRandomEvent, wait); };
  const fireRandomEvent = () => {
    const candidates = [
      { message: 'Crew illness on A2. Removing last trip.', type: 'crewIllness', affectedAircraft: 'A2' },
      { message: 'Delay at LGW. +15m on affected flights for 2 min.', type: 'delayAirport', affectedAirport: 'LGW' },
      { message: 'Tech on A1. No new routes for 2 min.', type: 'freezeAircraft', affectedAircraft: 'A1' },
      { message: 'Charter bonus on A3 for 2 min.', type: 'charterBonus', affectedAircraft: 'A3' }
    ];
    const state = routesRef.current;
    const usable = candidates.filter(ev =>
      ev.type !== 'crewIllness' || (state[ev.affectedAircraft] || []).some(s => s.id?.endsWith('-in'))
    );
    const ev = usable[Math.floor(Math.random() * usable.length)] || candidates[0];
    setActiveEvent(ev);

    if (ev.type === 'freezeAircraft') {
      setDisruptionState(p => ({ ...p, frozenAircraft: [...p.frozenAircraft, ev.affectedAircraft] }));
      setTimeout(() =>
        setDisruptionState(p => ({ ...p, frozenAircraft: p.frozenAircraft.filter(a => a !== ev.affectedAircraft) })),
      120000);
    }
    if (ev.type === 'delayAirport') {
      setDisruptionState(p => ({ ...p, delayedAirport: ev.affectedAirport }));
      setTimeout(() => setDisruptionState(p => ({ ...p, delayedAirport: null })), 120000);
    }
    if (ev.type === 'crewIllness') {
      const ac = ev.affectedAircraft;
      const list = routesRef.current[ac] || [];
      if (list.length > 0) {
        const lastTrip = list
          .filter(s => s.tripId && s.id.endsWith('-in'))
          .reduce((acc, s) => (!acc || s.end > acc.end ? { tripId: s.tripId, end: s.end } : acc), null);
        if (lastTrip) {
          restoreAvailabilityForTrip(list, lastTrip.tripId);
          updateRoutes(ac, list.filter(s => s.tripId !== lastTrip.tripId));
        }
      }
    }
    if (ev.type === 'charterBonus') {
      setDisruptionState(p => ({ ...p, charterBonusActive: true }));
      setTimeout(() => setDisruptionState(p => ({ ...p, charterBonusActive: false })), 120000);
    }
    scheduleNextEvent();
  };
  useEffect(() => { scheduleNextEvent(); return () => clearEventTimeout(); }, []);

  // scoring per aircraft (longer flights → more points)
  const scoreAircraftDay = (segments) => {
    const flights = segments.filter(s => !s.isTurnaround && !s.isCrewChange).sort((a, b) => a.start - b.start);
    const turns   = segments.filter(s => s.isTurnaround);
    let points = 0;
    let flightMins = 0;

    for (const f of flights) {
      const mins = f.blockMins ?? (f.end - f.start);
      points += sectorPoints(mins);
      if (f.type && TYPE_POINTS[f.type]) points += TYPE_POINTS[f.type];
      flightMins += mins;
    }
    if (flightMins >= UTIL_BONUS_MIN) points += UTIL_BONUS_POINTS;

    const lastArrival = flights.length ? flights[flights.length - 1].end : 0;
    if (lastArrival > 1350) points -= LATE_DUTY_PENALTY;

    const inCurfew = (t) => t < 330 || t >= 1380;
    const violatesCurfew = segments.some(s => !s.isCrewChange && (inCurfew(s.start) || inCurfew(s.end)));
    if (violatesCurfew) points -= CURFEW_PENALTY;

    const seq = [...flights, ...turns].sort((a, b) => a.start - b.start);
    let idle = 0;
    for (let i = 1; i < seq.length; i++) idle += Math.max(0, seq[i].start - seq[i - 1].end);
    points -= Math.floor(idle / IDLE_STEP);

    return { points, flightMins };
  };

  // derived for UI
  const allAircraft = Object.entries(routesByAircraft).map(([id, routes]) => {
    // kpis per crew
    const flights = routes.filter(s => !s.isTurnaround && !s.isCrewChange);
    const byCrew = new Map();
    for (const s of flights) {
      const idx = s.crewIndex || 1;
      if (!byCrew.has(idx)) byCrew.set(idx, []);
      byCrew.get(idx).push(s);
    }
    const kpis = [...byCrew.entries()].map(([idx, arr]) => {
      arr.sort((a, b) => a.start - b.start);
      const start = arr[0].start, end = arr[arr.length - 1].end;
      return { crewIndex: idx, sectors: arr.length, dutyStart: start, dutyEnd: end, dutyMins: end - start, limitMins: dutyLimitFor(start) };
    }).sort((a, b) => a.crewIndex - b.crewIndex);

    const { points, flightMins } = scoreAircraftDay(routes);
    return { id, routes, kpis, points, flightMins };
  });

  return (
    <DndProvider
      backend={isTouch ? TouchBackend : HTML5Backend}
      options={isTouch ? { enableMouseEvents: true, enableTouchEvents: true, delayTouchStart: 0, touchSlop: 16 } : undefined}
    >
      <div className="app-container">
        <div className="top-bar">
          <h1>Schedule Mastery</h1>
          <span>⏳ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowConstraints(s => !s)}>{showConstraints ? 'Hide' : 'Show'} Constraints</button>
            <button onClick={() => setShowSummary(true)}>Submit</button>
          </div>
        </div>

        <Scoreboard allAircraft={allAircraft} />
        <EventModal event={activeEvent} onAcknowledge={() => setActiveEvent(null)} />

        <div className="main-column">
          <GanttSchedule
            routesByAircraft={routesByAircraft}
            crewState={crewByAc}
            onRouteDrop={handleRouteDrop}
            onRouteDelete={handleRouteDelete}
            onUpdateTripStart={handleUpdateTripStart}
            onForceCrewChange={forceCrewChange}
          />

          {/* Route library shows remaining counts; tiles disable at 0 */}
          <RouteLibrary availability={availability} />
        </div>

        {showConstraints && (
          <div className="overlay-constraints">
            <ConstraintsPanel />
          </div>
        )}

        {showSummary && (
          <SummaryModal
            allAircraft={allAircraft}
            onClose={() => setShowSummary(false)}
          />
        )}
      </div>
    </DndProvider>
  );
}

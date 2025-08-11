// src/components/SchedulingGame.jsx
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

import './App.scss';

const baseTime = 360;       // 06:00
const latestAllowed = 1380; // 23:00
const maxDutyTime = 720;    // aircraft-day guard (12h)

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

/** Remove crew-change markers that no longer align with any segment start */
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

  // Timer
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (timeLeft === 0) setShowSummary(true); }, [timeLeft]);

  const getAircraftType = id => (id === 'A1' ? 'A320' : 'A321');

  /** Arm a manual crew change for the next trip (+10m gap). nextCrewIndex: 1 or 2 */
  const forceCrewChange = (aircraftId, nextCrewIndex) => {
    setCrewByAc(prev => ({
      ...prev,
      [aircraftId]: { ...prev[aircraftId], pendingChange: true, pendingCrewIndex: nextCrewIndex }
    }));
  };

  /** Sort, cleanup markers, persist, and recompute crew state */
  const updateRoutes = (aircraftId, newList) => {
    const sorted = [...newList].sort((a, b) => a.start - b.start);
    const cleaned = cleanUpCrewMarkers(sorted);
    setRoutesByAircraft(prev => ({ ...prev, [aircraftId]: cleaned }));
    const rebuilt = recomputeCrewStateForAircraft(cleaned);
    setCrewByAc(prev => ({ ...prev, [aircraftId]: { ...prev[aircraftId], ...rebuilt } }));
  };

  const handleRouteDrop = (aircraftId, route, dropTime = null) => {
    if (disruptionState.frozenAircraft.includes(aircraftId)) {
      alert(`Aircraft ${aircraftId} is unavailable.`);
      return;
    }

    const aircraftType = getAircraftType(aircraftId);
    const existing = routesRef.current[aircraftId] || [];

    // Base desired start (+ any airport delay)
    let desiredStart = dropTime ?? baseTime;
    if (disruptionState.delayedAirport && [route.from, route.to].includes(disruptionState.delayedAirport)) {
      desiredStart += 15;
    }

    // Crew state
    let { crewIndex, sectors, dutyStart, pendingChange, pendingCrewIndex } = crewByAc[aircraftId];
    let crewChangeMarker = null;

    // If user armed a change, consume +10m
    if (pendingChange) desiredStart += 10;

    // Plan at desiredStart
    let plannedTrip = scheduleTripWithAutoResolve(existing, route, aircraftType, desiredStart);
    if (!plannedTrip) {
      alert('No space before curfew without overlap.');
      return;
    }

    const outSeg = plannedTrip.find(s => s.id.endsWith('-out'));
    const inSeg  = plannedTrip.find(s => s.id.endsWith('-in'));
    const tripEnd = inSeg.end;

    // Duty constraints (Early: start <07:00 => 7h limit; otherwise 10h). Max 4 sectors/crew.
    const effectiveDutyStart = dutyStart ?? outSeg.start;
    const dutyLimit = effectiveDutyStart < 420 ? 420 : 600;

    const wouldExceedSectors = (sectors + 2) > 4;
    const wouldExceedTime = (tripEnd - effectiveDutyStart) > dutyLimit;

    // Auto crew change if constraints would be violated
    if (wouldExceedSectors || wouldExceedTime) {
      desiredStart += 10;
      const rePlanned = scheduleTripWithAutoResolve(existing, route, aircraftType, desiredStart);
      if (!rePlanned) {
        alert('No space after crew change before curfew.');
        return;
      }

      // Add crew-change marker at the boundary (dedupe if already present)
      const markerEnd = desiredStart;
      const markerExists = existing.some(s => s.isCrewChange && s.end === markerEnd);
      if (!markerExists) {
        const markerId = Date.now() + Math.random();
        crewChangeMarker = {
          start: desiredStart - 10,
          end: desiredStart,
          id: `${markerId}-crewchange`,
          tripId: `crewchange-${markerId}`,
          isCrewChange: true,
        };
      }

      plannedTrip = rePlanned;
      crewIndex += 1;
      sectors = 0;
      dutyStart = rePlanned.find(s => s.id.endsWith('-out')).start;
      pendingChange = false;
      pendingCrewIndex = null;
    }

    // Manual change (if armed) and auto didn't already handle it
    if (crewByAc[aircraftId].pendingChange && !crewChangeMarker) {
      const markerEnd = desiredStart;
      const markerExists = existing.some(s => s.isCrewChange && s.end === markerEnd);
      if (!markerExists) {
        const markerId = Date.now() + Math.random();
        crewChangeMarker = {
          start: desiredStart - 10,
          end: desiredStart,
          id: `${markerId}-crewchange`,
          tripId: `crewchange-${markerId}`,
          isCrewChange: true,
        };
      }
      crewIndex = pendingCrewIndex || (crewIndex + 1);
      sectors = 0;
      dutyStart = plannedTrip.find(s => s.id.endsWith('-out')).start;
      pendingChange = false;
      pendingCrewIndex = null;
    }

    // Aircraft-day guard
    const addedDuty = plannedTrip.reduce((s, seg) => s + (seg.end - seg.start), 0);
    const currentDuty = existing.reduce((s, seg) => s + (seg.end - seg.start), 0);
    if (currentDuty + addedDuty > maxDutyTime) {
      alert('Duty time exceeded for aircraft day.');
      return;
    }

    // Tag segments with crew index (and type for scoring)
    const tagged = plannedTrip.map(s =>
      s.isTurnaround ? { ...s, crewIndex } : { ...s, crewIndex, type: s.type || route.type }
    );
    sectors += 2;

    const base = crewChangeMarker ? [...existing, crewChangeMarker, ...tagged] : [...existing, ...tagged];
    updateRoutes(aircraftId, base);

    setCrewByAc(prev => ({
      ...prev,
      [aircraftId]: { crewIndex, sectors, dutyStart, pendingChange, pendingCrewIndex }
    }));
  };

  const handleRouteDelete = (aircraftId, routeId) => {
    const list = routesRef.current[aircraftId] || [];
    const tid = list.find(r => r.id === routeId)?.tripId;
    if (!tid) return;
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

  const allAircraft = Object.entries(routesByAircraft).map(([id, routes]) => ({ id, routes }));

  // ------- Random events (safe loop) -------
  const eventTimeoutRef = useRef(null);
  const clearEventTimeout = () => {
    if (eventTimeoutRef.current) { clearTimeout(eventTimeoutRef.current); eventTimeoutRef.current = null; }
  };
  const scheduleNextEvent = () => {
    clearEventTimeout();
    const wait = Math.random() * 30000 + 60000; // 60–90s
    eventTimeoutRef.current = setTimeout(fireRandomEvent, wait);
  };

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
      setTimeout(() => setDisruptionState(p => ({ ...p, frozenAircraft: p.frozenAircraft.filter(a => a !== ev.affectedAircraft) })), 120000);
    }
    if (ev.type === 'delayAirport') {
      setDisruptionState(p => ({ ...p, delayedAirport: ev.affectedAirport }));
      setTimeout(() => setDisruptionState(p => ({ ...p, delayedAirport: null })), 120000);
    }
    if (ev.type === 'crewIllness') {
      const ac = ev.affectedAircraft;
      const list = routesRef.current[ac] || [];
      if (list.length > 0) {
        const lastTripId = list
          .filter(s => s.tripId && s.id.endsWith('-in'))
          .reduce((acc, s) => (!acc || s.end > acc.end ? { id: s.tripId, end: s.end } : acc), null)?.id;
        if (lastTripId) updateRoutes(ac, list.filter(s => s.tripId !== lastTripId));
      }
    }
    if (ev.type === 'charterBonus') {
      setDisruptionState(p => ({ ...p, charterBonusActive: true }));
      setTimeout(() => setDisruptionState(p => ({ ...p, charterBonusActive: false })), 120000);
    }

    scheduleNextEvent();
  };

  useEffect(() => { scheduleNextEvent(); return () => clearEventTimeout(); }, []);

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
          <RouteLibrary />
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

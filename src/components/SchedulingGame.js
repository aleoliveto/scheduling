// src/components/SchedulingGame.js
import React, { useState, useEffect, useRef } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';

import GanttSchedule from './GanttSchedule';
import RouteLibrary from './RouteLibrary';
import ConstraintsPanel from './ConstraintsPanel';
import Scoreboard from './Scoreboard';
import EventModal from './EventModal';

import './App.scss'; // Ensure this matches your file structure

const baseTime = 360;
const latestAllowed = 1380;
const maxDutyTime = 720;

const SchedulingGame = () => {
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

  const [routesByAircraft, setRoutesByAircraft] = useState({ A1: [], A2: [], A3: [] });
  const routesRef = useRef(routesByAircraft);
  useEffect(() => { routesRef.current = routesByAircraft; }, [routesByAircraft]);

  const [activeEvent, setActiveEvent] = useState(null);
  const [disruptionState, setDisruptionState] = useState({
    frozenAircraft: [],
    delayedAirport: null,
    charterBonusActive: false
  });
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [showConstraints, setShowConstraints] = useState(false);

  const getAircraftType = (id) => (id === 'A1' ? 'A320' : 'A321');

  const handleRouteDrop = (aircraftId, route, dropTime = null) => {
    if (disruptionState.frozenAircraft.includes(aircraftId)) {
      return alert(`🚫 Aircraft ${aircraftId} is unavailable.`);
    }
    const aircraftType = getAircraftType(aircraftId);
    const existing = routesRef.current[aircraftId] || [];
    const turnaround = route.turnTimes?.[aircraftType] ?? 40;
    const [h, m] = route.block.split(':').map(Number);
    const blockMins = h * 60 + m;

    let start = dropTime !== null ? dropTime : baseTime;
    if (dropTime === null && existing.length > 0) {
      const last = existing[existing.length - 1];
      start = last.end + turnaround;
    }

    if (disruptionState.delayedAirport &&
      [route.from, route.to].includes(disruptionState.delayedAirport)
    ) {
      start += 15;
    }

    const end = start + blockMins;
    const inboundStart = end + turnaround;
    const inboundEnd = inboundStart + blockMins;

    if (start < baseTime) return alert('🕓 Flight before 06:00.');
    if (inboundEnd > latestAllowed) return alert('🌙 Arrival after curfew.');
    const totalDuty = existing.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
    const newDuty = blockMins * 2 + turnaround;
    if (totalDuty + newDuty > maxDutyTime) return alert('⏱ Duty time exceeded.');

    const proposed = [
      { start, end },
      { start: end, end: inboundStart },
      { start: inboundStart, end: inboundEnd }
    ];
    const overlap = existing.some(e =>
      proposed.some(p => !(e.end <= p.start || e.start >= p.end))
    );
    if (overlap) return alert('❌ Overlaps existing flight.');

    const tripId = Date.now() + Math.random();
    const outbound = { ...route, start, end, id: tripId + '-out', tripId, isTurnaround: false };
    const turnaroundSeg = {
      start: end, end: inboundStart,
      id: tripId + '-turn', tripId,
      isTurnaround: true, turnaround
    };
    const inbound = {
      from: route.to,
      to: route.from,
      block: route.block,
      turnTimes: route.turnTimes,
      start: inboundStart,
      end: inboundEnd,
      id: tripId + '-in',
      tripId,
      isTurnaround: false
    };

    const updated = [...existing, outbound, turnaroundSeg, inbound]
      .sort((a, b) => a.start - b.start);
    setRoutesByAircraft(prev => ({ ...prev, [aircraftId]: updated }));
  };

  const handleRouteDelete = (aircraftId, routeId) => {
    setRoutesByAircraft(prev => {
      const all = prev[aircraftId];
      const tid = all.find(r => r.id === routeId)?.tripId;
      if (!tid) return prev;
      return { ...prev, [aircraftId]: all.filter(r => r.tripId !== tid) };
    });
  };

  const handleUpdateTripStart = (aircraftId, tripId, newStart) => {
    setRoutesByAircraft(prev => {
      const arr = prev[aircraftId];
      const segs = arr.filter(r => r.tripId === tripId);
      if (segs.length !== 3) return prev;

      const out = segs.find(s => s.id.endsWith('-out'));
      const turn = segs.find(s => s.id.endsWith('-turn'));
      const inb = segs.find(s => s.id.endsWith('-in'));
      if (!out || !turn || !inb) return prev;

      const dur = out.end - out.start;
      const newOut = { ...out, start: newStart, end: newStart + dur };
      const newTurn = {
        ...turn,
        start: newOut.end,
        end: newOut.end + (turn.end - turn.start)
      };
      const newIn = {
        ...inb,
        start: newTurn.end,
        end: newTurn.end + (inb.end - inb.start)
      };

      return {
        ...prev,
        [aircraftId]: arr
          .filter(r => r.tripId !== tripId)
          .concat([newOut, newTurn, newIn])
          .sort((a, b) => a.start - b.start)
      };
    });
  };

  const allAircraft = Object.entries(routesByAircraft).map(([id, routes]) => ({
    id, routes
  }));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const events = [
      { message: '⛑ Crew illness on A2—remove 1 sector!', type: 'crewIllness', affectedAircraft: 'A2' },
      { message: '🌩 Delay at LGW—15min delay!', type: 'delayAirport', affectedAirport: 'LGW' },
      { message: '🧯 Tech on A1—no new routes for 2min!', type: 'freezeAircraft', affectedAircraft: 'A1' },
      { message: '🛫 Charter bonus on A3—add a short route!', type: 'charterBonus', affectedAircraft: 'A3' },
    ];

    const schedule = () => {
      const wait = Math.random() * 30000 + 60000;
      setTimeout(() => {
        const ev = events[Math.floor(Math.random() * events.length)];
        setActiveEvent(ev);
        if (ev.type === 'freezeAircraft') {
          setDisruptionState(prev => ({
            ...prev,
            frozenAircraft: [...prev.frozenAircraft, ev.affectedAircraft]
          }));
          setTimeout(() => setDisruptionState(prev => ({
            ...prev,
            frozenAircraft: prev.frozenAircraft.filter(a => a !== ev.affectedAircraft)
          })), 120000);
        }
        if (ev.type === 'delayAirport') {
          setDisruptionState(prev => ({ ...prev, delayedAirport: ev.affectedAirport }));
          setTimeout(() => setDisruptionState(prev => ({ ...prev, delayedAirport: null })), 120000);
        }
        if (ev.type === 'crewIllness') {
          setRoutesByAircraft(prev => {
            const cpy = { ...prev };
            cpy[ev.affectedAircraft]?.pop();
            return cpy;
          });
        }
        if (ev.type === 'charterBonus') {
          setDisruptionState(prev => ({ ...prev, charterBonusActive: true }));
          setTimeout(() => setDisruptionState(prev => ({ ...prev, charterBonusActive: false })), 120000);
        }
        schedule();
      }, wait);
    };
    schedule();
  }, []);

  return (
    <DndProvider backend={isTouch ? TouchBackend : HTML5Backend} options={isTouch ? { enableMouseEvents: true } : undefined}>
      <div className="app-container">
        <div className="top-bar">
          <h1>🧠 Schedule Mastery</h1>
          <span>⏳ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</span>
          <button onClick={() => setShowConstraints(c => !c)}>
            {showConstraints ? 'Hide' : 'Show'} Constraints
          </button>
        </div>

        <Scoreboard allAircraft={allAircraft} />
        <EventModal event={activeEvent} onAcknowledge={() => setActiveEvent(null)} />

        <div className="layout">
          <div className="main-gantt">
            <GanttSchedule
              routesByAircraft={routesByAircraft}
              onRouteDrop={handleRouteDrop}
              onRouteDelete={handleRouteDelete}
              onUpdateTripStart={handleUpdateTripStart}
            />
          </div>
          <RouteLibrary />
        </div>

        {showConstraints && (
          <div className="overlay-constraints">
            <ConstraintsPanel />
          </div>
        )}
      </div>
    </DndProvider>
  );
};

export default SchedulingGame;

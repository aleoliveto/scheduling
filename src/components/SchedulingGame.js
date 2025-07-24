import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import GanttSchedule from './GanttSchedule';
import RouteLibrary from './RouteLibrary';
import ConstraintsPanel from './ConstraintsPanel';
import Scoreboard from './Scoreboard';
import EventModal from './EventModal';

const baseTime = 360; // 06:00

const SchedulingGame = () => {
  const aircraftList = ['A1', 'A2', 'A3'];

  const [routesByAircraft, setRoutesByAircraft] = useState({
    A1: [],
    A2: [],
    A3: [],
  });

  const [activeEvent, setActiveEvent] = useState(null);
  const [disruptionState, setDisruptionState] = useState({
    frozenAircraft: [],
    delayedAirport: null,
    charterBonusActive: false,
  });

  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 minutes
  const [showConstraints, setShowConstraints] = useState(true);

  // Utility: get aircraft type from id
  const getAircraftType = (aircraftId) =>
    aircraftId === 'A1' ? 'A320' : 'A321';

  // MAIN HANDLE DROP
  const handleRouteDrop = (aircraftId, route, dropTime = null) => {
    if (disruptionState.frozenAircraft.includes(aircraftId)) {
      alert(`🧯 Aircraft ${aircraftId} is under tech inspection. Cannot assign routes.`);
      return;
    }

    const aircraftType = getAircraftType(aircraftId);
    const existingRoutes = routesByAircraft[aircraftId] || [];

    // Get turnaround for this type
    const turnaround =
      route.turnTimes?.[aircraftType] ??
      (aircraftId === 'A1' ? 35 : aircraftId === 'A2' ? 40 : 50);

    // Parse duration
    const [h, m] = route.block.split(':');
    const blockMins = parseInt(h) * 60 + parseInt(m);

    // Start logic
    let startTime = dropTime !== null ? dropTime : baseTime;
    if (dropTime === null && existingRoutes.length > 0 && !route.start) {
      const lastRoute = existingRoutes[existingRoutes.length - 1];
      startTime = lastRoute.end + turnaround;
    }
    if (route.start !== undefined && route.start !== null) {
      startTime = route.start;
    }

    // Apply disruption delay
    if (
      disruptionState.delayedAirport &&
      (route.from === disruptionState.delayedAirport || route.to === disruptionState.delayedAirport)
    ) {
      startTime += 15;
    }

    const endTime = startTime + blockMins;

    // Prepare return
    const returnLeg = {
      from: route.to,
      to: route.from,
      block: route.block,
      turnTimes: route.turnTimes,
    };
    const inboundStart = endTime + turnaround;
    const inboundEnd = inboundStart + blockMins;

    // Create tripId
    const tripId = Date.now() + Math.random();

    // Overlap: Check only vs. other trips
    const proposedSegments = [
      { start: startTime, end: endTime },
      { start: endTime, end: endTime + turnaround },
      { start: inboundStart, end: inboundEnd }
    ];
    const overlaps = existingRoutes.some(r =>
      proposedSegments.some(seg =>
        r.tripId !== tripId &&
        !(r.end <= seg.start || r.start >= seg.end)
      )
    );
    if (overlaps) {
      alert('❌ Cannot place flight due to overlap.');
      return;
    }

    // OUTBOUND
    const outbound = {
      ...route,
      start: startTime,
      end: endTime,
      id: tripId + '-out',
      tripId,
      aircraftType,
      isTurnaround: false,
    };
    // TURNAROUND BAR
    const turnaroundBar = {
      start: endTime,
      end: endTime + turnaround,
      id: tripId + '-turn',
      tripId,
      aircraftType,
      isTurnaround: true,
      turnaround,
    };
    // INBOUND
    const inbound = {
      ...returnLeg,
      start: endTime + turnaround,
      end: inboundEnd,
      id: tripId + '-in',
      tripId,
      aircraftType,
      isTurnaround: false,
    };

    // Add all
    const updated = [...existingRoutes, outbound, turnaroundBar, inbound];
    updated.sort((a, b) => a.start - b.start);

    setRoutesByAircraft((prev) => ({
      ...prev,
      [aircraftId]: updated,
    }));
  };

  // REMOVE: Remove whole trip by tripId
  const handleRouteDelete = (aircraftId, routeId) => {
    setRoutesByAircraft((prev) => {
      const allRoutes = prev[aircraftId];
      const tripId = allRoutes.find(r => r.id === routeId)?.tripId;
      if (!tripId) return prev;
      return {
        ...prev,
        [aircraftId]: allRoutes.filter(r => r.tripId !== tripId),
      };
    });
  };

  // UPDATE: Move all trip segments if the outbound start changes
  const handleUpdateTripStart = (aircraftId, tripId, newStart) => {
    setRoutesByAircraft((prev) => {
      const routes = prev[aircraftId];
      const tripSegments = routes.filter(r => r.tripId === tripId);
      if (tripSegments.length !== 3) return prev;

      const [outbound, turnaround, inbound] = [
        tripSegments.find(r => r.id.endsWith('-out')),
        tripSegments.find(r => r.id.endsWith('-turn')),
        tripSegments.find(r => r.id.endsWith('-in')),
      ];
      if (!outbound || !turnaround || !inbound) return prev;

      const duration = outbound.end - outbound.start;
      const turn = turnaround.end - turnaround.start;
      const inboundDuration = inbound.end - inbound.start;

      const newOutbound = { ...outbound, start: newStart, end: newStart + duration };
      const newTurnaround = { ...turnaround, start: newOutbound.end, end: newOutbound.end + turn };
      const newInbound = { ...inbound, start: newTurnaround.end, end: newTurnaround.end + inboundDuration };

      // Replace in array
      const updatedRoutes = routes
        .filter(r => r.tripId !== tripId)
        .concat([newOutbound, newTurnaround, newInbound])
        .sort((a, b) => a.start - b.start);

      return { ...prev, [aircraftId]: updatedRoutes };
    });
  };

  const allAircraft = aircraftList.map((id) => ({
    id,
    routes: routesByAircraft[id] || [],
  }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const disruptions = [
      {
        message: '⛑ Crew illness on Aircraft A2 — please remove 1 sector!',
        type: 'crewIllness',
        affectedAircraft: 'A2',
      },
      {
        message: '🌩 Weather in LGW — delay all LGW flights by 15 minutes!',
        type: 'delayAirport',
        affectedAirport: 'LGW',
      },
      {
        message: '🧯 Tech issue on Aircraft A1 — no new routes can be added for 2 minutes!',
        type: 'freezeAircraft',
        affectedAircraft: 'A1',
      },
      {
        message: '🛫 Charter Request — Add a bonus short route to A3 to earn points!',
        type: 'charterBonus',
        affectedAircraft: 'A3',
      },
    ];

    const triggerRandomEvent = () => {
      const delay = Math.random() * 30000 + 60000;
      setTimeout(() => {
        const random = disruptions[Math.floor(Math.random() * disruptions.length)];
        setActiveEvent(random);

        if (random.type === 'freezeAircraft') {
          setDisruptionState((prev) => ({
            ...prev,
            frozenAircraft: [...prev.frozenAircraft, random.affectedAircraft],
          }));
          setTimeout(() => {
            setDisruptionState((prev) => ({
              ...prev,
              frozenAircraft: prev.frozenAircraft.filter(
                (id) => id !== random.affectedAircraft
              ),
            }));
          }, 2 * 60 * 1000);
        }

        if (random.type === 'delayAirport') {
          setDisruptionState((prev) => ({
            ...prev,
            delayedAirport: random.affectedAirport,
          }));
          setTimeout(() => {
            setDisruptionState((prev) => ({ ...prev, delayedAirport: null }));
          }, 2 * 60 * 1000);
        }

        if (random.type === 'crewIllness') {
          setRoutesByAircraft((prev) => {
            const updated = { ...prev };
            updated[random.affectedAircraft].pop();
            return updated;
          });
        }

        if (random.type === 'charterBonus') {
          setDisruptionState((prev) => ({ ...prev, charterBonusActive: true }));
          setTimeout(() => {
            setDisruptionState((prev) => ({ ...prev, charterBonusActive: false }));
          }, 2 * 60 * 1000);
        }

        triggerRandomEvent();
      }, delay);
    };

    triggerRandomEvent();
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: '1rem', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          Captain's Challenge: Schedule Mastery
        </h1>

        <div style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: '1rem' }}>
          ⏳ Time Left: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>

        <Scoreboard allAircraft={allAircraft} />

        <EventModal event={activeEvent} onAcknowledge={() => setActiveEvent(null)} />

        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <GanttSchedule
              routesByAircraft={routesByAircraft}
              onRouteDrop={handleRouteDrop}
              onRouteDelete={handleRouteDelete}
              onUpdateTripStart={handleUpdateTripStart}
            />
          </div>

          <div style={{ width: '250px', paddingLeft: '1rem' }}>
            <button
              onClick={() => setShowConstraints(!showConstraints)}
              style={{
                marginBottom: '0.5rem',
                padding: '6px 12px',
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              {showConstraints ? 'Hide' : 'Show'} Constraints
            </button>

            {showConstraints && (
              <div style={{ border: '1px solid #ddd', padding: '0.5rem', borderRadius: '5px' }}>
                <ConstraintsPanel />
              </div>
            )}
          </div>
        </div>

        <RouteLibrary />
      </div>
    </DndProvider>
  );
};

export default SchedulingGame;

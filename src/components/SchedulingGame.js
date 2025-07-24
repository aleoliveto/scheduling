import React, { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import GanttSchedule from './GanttSchedule';
import RouteLibrary from './RouteLibrary';
import ConstraintsPanel from './ConstraintsPanel';
import Scoreboard from './Scoreboard';
import EventModal from './EventModal';

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

  // This handles route drop with timing and overlap checks
  const handleRouteDrop = (aircraftId, route, dropTime = null) => {
    if (disruptionState.frozenAircraft.includes(aircraftId)) {
      alert(`🧯 Aircraft ${aircraftId} is under tech inspection. Cannot assign routes.`);
      return;
    }

    const existingRoutes = routesByAircraft[aircraftId] || [];
    const turnaround = route.turnTimes?.[route.aircraftType || 'A320'] ?? 35;

    const [h, m] = route.block.split(':');
    const blockMins = parseInt(h) * 60 + parseInt(m);

    // Use dropTime or default start time
    let startTime = dropTime !== null ? dropTime : 360; // default 06:00
    if (dropTime === null && existingRoutes.length > 0) {
      const lastRoute = existingRoutes[existingRoutes.length - 1];
      startTime = lastRoute.end + turnaround;
    }

    // Add delay if applicable
    if (
      disruptionState.delayedAirport &&
      (route.from === disruptionState.delayedAirport || route.to === disruptionState.delayedAirport)
    ) {
      startTime += 15;
    }

    const endTime = startTime + blockMins;

    // Overlap check at drop position
    const overlaps = existingRoutes.some(
      (r) => !(r.end <= startTime || r.start >= endTime)
    );

    if (overlaps && dropTime !== null) {
      // Fallback to after last flight + turnaround
      if (existingRoutes.length > 0) {
        const lastRoute = existingRoutes[existingRoutes.length - 1];
        startTime = lastRoute.end + turnaround;
        const fallbackEnd = startTime + blockMins;

        const fallbackOverlaps = existingRoutes.some(
          (r) => !(r.end <= startTime || r.start >= fallbackEnd)
        );

        if (fallbackOverlaps) {
          alert('❌ Cannot place flight due to overlap.');
          return;
        }
      } else {
        alert('❌ Cannot place flight due to overlap.');
        return;
      }
    }

    const newRoute = {
      ...route,
      start: startTime,
      end: endTime,
      id: Date.now() + Math.random(),
    };

    setRoutesByAircraft((prev) => ({
      ...prev,
      [aircraftId]: [...existingRoutes, newRoute],
    }));
  };

  const handleRouteDelete = (aircraftId, routeId) => {
    setRoutesByAircraft((prev) => ({
      ...prev,
      [aircraftId]: prev[aircraftId].filter((r) => r.id !== routeId),
    }));
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
    // Simple disruption event example - can expand later
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
              frozenAircraft: prev.frozenAircraft.filter((id) => id !== random.affectedAircraft),
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

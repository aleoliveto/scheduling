// src/data/routesData.js

// helper
export const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// === Route inventory from your PDF ===
export const ROUTES = [
  { id: 'NAPCTA', from: 'NAP', to: 'CTA', block: '01:05', type: 'Domestic', requested: 6 },
  { id: 'NAPJSI', from: 'NAP', to: 'JSI', block: '01:40', type: 'Holidays', requested: 2 },
  { id: 'NAPLGW', from: 'NAP', to: 'LGW', block: '02:55', type: 'Leisure',  requested: 2 },
  { id: 'NAPJMK', from: 'NAP', to: 'JMK', block: '01:45', type: 'Holidays', requested: 2 },
  { id: 'NAPIBZ', from: 'NAP', to: 'IBZ', block: '02:05', type: 'Leisure',  requested: 4 },
  { id: 'NAPDBV', from: 'NAP', to: 'DBV', block: '01:05', type: 'Leisure',  requested: 2 },
  { id: 'NAPMLA', from: 'NAP', to: 'MLA', block: '01:15', type: 'Leisure',  requested: 2 },
  { id: 'NAPOLB', from: 'NAP', to: 'OLB', block: '01:10', type: 'Domestic', requested: 2 },
  { id: 'NAPPMO', from: 'NAP', to: 'PMO', block: '00:55', type: 'Domestic', requested: 4 },
  { id: 'NAPATH', from: 'NAP', to: 'ATH', block: '01:45', type: 'Holidays', requested: 2 },
  { id: 'NAPCFU', from: 'NAP', to: 'CFU', block: '01:15', type: 'Holidays', requested: 2 },
];

// initial availability map: { NAPCTA: 6, ... }
export const initialAvailability = ROUTES.reduce((acc, r) => {
  acc[r.id] = r.requested;
  return acc;
}, {});

// === Turn times (min) exactly from your tables ===
const t = (mm) => mm; // already minutes

export const TURN_TIMES = {
  ATH: { A320: t(40), A321: t(50) },
  CFU: { A320: t(40), A321: t(50) },
  CTA: { A320: t(35), A321: t(45) },
  DBV: { A320: t(40), A321: t(50) },
  IBZ: { A320: t(35), A321: t(45) },
  JMK: { A320: t(40), A321: t(50) },
  JSI: { A320: t(40), A321: t(50) },
  LGW: { A320: t(35), A321: t(45) },
  MLA: { A320: t(40), A321: t(50) },
  NAP: { A320: t(35), A321: t(45) },
  OLB: { A320: t(35), A321: t(45) },
  PMO: { A320: t(35), A321: t(40) },
};

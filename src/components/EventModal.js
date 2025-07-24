import React from 'react';

const EventModal = ({ event, onAcknowledge }) => {
  if (!event) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translate(-50%, -20%)',
        backgroundColor: 'white',
        border: '2px solid #333',
        padding: '1rem 2rem',
        zIndex: 1000,
        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
      }}
    >
      <h2>Event Alert</h2>
      <p>{event.message}</p>
      <button
        onClick={onAcknowledge}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          backgroundColor: '#1890ff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
        }}
      >
        OK
      </button>
    </div>
  );
};

export default EventModal;

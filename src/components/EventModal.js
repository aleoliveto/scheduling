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
        backgroundColor: '#1f1f1f',
        border: '1px solid #333',
        padding: '1.5rem 2rem',
        zIndex: 1000,
        boxShadow: '0 0 25px rgba(255,102,0,0.6)',
        borderRadius: '12px',
        color: '#f0f0f0',
        maxWidth: '500px',
        textAlign: 'center',
      }}
    >
      <h2 style={{ color: '#ffa500', marginBottom: '1rem' }}>Event Alert</h2>
      <p style={{ color: '#ccc', fontSize: '1rem', lineHeight: 1.4 }}>{event.message}</p>
      <button
        onClick={onAcknowledge}
        style={{
          marginTop: '1.5rem',
          padding: '0.6rem 1.4rem',
          cursor: 'pointer',
          backgroundColor: '#ff6600',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '1rem',
          boxShadow: '0 0 8px rgba(255,102,0,0.5)',
        }}
        onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e65c00')}
        onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#ff6600')}
      >
        OK
      </button>
    </div>
  );
};

export default EventModal;

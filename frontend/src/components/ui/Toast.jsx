import React, { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => { if (!message || !onClose || !duration) return undefined; const timer = window.setTimeout(onClose, duration); return () => window.clearTimeout(timer); }, [message, onClose, duration]);
  if (!message) return null;
  return <div className={`toast toast--${type}`} role="status"><span>{message}</span><button type="button" onClick={onClose} aria-label="Cerrar notificación">×</button></div>;
}

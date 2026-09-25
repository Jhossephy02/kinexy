import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
export default function Modal({ open, title, children, onClose, className = '' }) {
  const dialog = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('button')?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = [...dialog.current.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(el => !el.disabled);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [open]);
  if (!open) return null;
  return createPortal(<div className="overlay" role="presentation" onClick={onClose}><section ref={dialog} className={'modal ' + className} role="dialog" aria-modal="true" aria-label={title || 'Detalles'} onClick={e => e.stopPropagation()}><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar">×</button>{title && <h2>{title}</h2>}{children}</section></div>, document.body);
}
export function CityModal({ open, city, cities = [], setCity, onClose }) { return <Modal open={open} title="Selecciona tu ciudad" onClose={onClose}><div className="city-list">{cities.map(item => <button key={item} className={item === city ? 'active' : ''} onClick={() => { setCity(item); onClose(); }}>{item}</button>)}</div></Modal>; }

import React, { useEffect, useState } from 'react';

const CONFIRMED = 'kinexy_adult_confirmed';
const BLOCKED = 'kinexy_age_blocked';

export default function AgeGate() {
  const [status, setStatus] = useState(() => localStorage.getItem(BLOCKED) === '1' ? 'blocked' : localStorage.getItem(CONFIRMED) === '1' ? 'accepted' : 'pending');
  useEffect(() => {
    if (status === 'accepted') return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [status]);
  if (status === 'accepted') return null;
  function confirm() {
    localStorage.removeItem(BLOCKED);
    localStorage.setItem(CONFIRMED, '1');
    localStorage.setItem('kinexy_adult_confirmed_at', new Date().toISOString());
    setStatus('accepted');
  }
  function reject() {
    localStorage.removeItem(CONFIRMED);
    localStorage.setItem(BLOCKED, '1');
    setStatus('blocked');
  }
  if (status === 'blocked') return <div className="age-gate age-gate-blocked" role="alert" aria-live="assertive"><section><span className="age-gate-mark">k</span><p className="eyebrow">ACCESO RESTRINGIDO</p><h1>Este sitio es solo para adultos</h1><p>Indicaste que eres menor de 18 años. Por seguridad, el acceso a Kinexy quedó bloqueado en este navegador.</p><div className="age-gate-safety"><strong>No intentes continuar.</strong><span>Cierra esta pestaña o visita un sitio apropiado para tu edad.</span></div></section></div>;
  return <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-title" aria-describedby="age-description"><section><span className="age-gate-mark">k</span><p className="eyebrow">VERIFICACIÓN DE EDAD</p><h1 id="age-title">Antes de entrar, confirma tu edad</h1><p id="age-description">Kinexy contiene perfiles y contenido destinado exclusivamente a personas adultas. Debes tener 18 años o más para continuar.</p><div className="age-gate-actions"><button type="button" onClick={confirm}>Sí, tengo 18 años o más</button><button type="button" className="age-gate-decline" onClick={reject}>No, soy menor de 18 años</button></div><small>Al continuar declaras que cumples la edad mínima aplicable. Esta confirmación no sustituye una verificación de identidad.</small></section></div>;
}

import React, { useEffect, useMemo, useState } from 'react';
import { publicationPlanService } from '../api/client';
import AppIcon from '../components/ui/AppIcon.jsx';
import './PublicationPlanPanel.css';

const statusCopy = { pending: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' };

export default function PublicationPlanPanel() {
  const [state, setState] = useState(null);
  const [plan, setPlan] = useState('free');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = async () => { try { const next = await publicationPlanService.get(); setState(next); setPlan(current => next.plans.some(item => item.id === current) ? current : next.plans[0]?.id || 'free'); setError(''); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  const chosen = useMemo(() => state?.plans.find(item => item.id === plan), [state, plan]);
  const isFree = Number(chosen?.soles) === 0;

  async function submit(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await publicationPlanService.request(plan, isFree ? undefined : code);
      setCode(''); await load();
      setNotice(result.activated ? 'Tu membresía Gratis está activa por 7 días.' : 'Pago enviado a revisión. Tu membresía se activará cuando confirmemos el pago.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const activePlan = state?.plans.find(item => item.id === state?.subscription?.plan);
  return <section className="publication-plan-panel">
    <header className="publication-hero">
      <div><span className="eyebrow">MEMBRESÍA DE CREADOR</span><h2>Impulsa tu espacio<span>.</span></h2><p>Elige un plan semanal para acceder a prioridad y beneficios dentro de tu dashboard de creador.</p></div>
      <div className={`publication-state ${state?.active ? 'is-active' : ''}`}><AppIcon name={state?.active ? 'check' : 'history'}/><span>{state?.active ? 'Membresía activa' : 'Sin membresía activa'}</span><strong>{state?.active && state.subscription ? `Hasta ${new Date(state.subscription.expires_at).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}` : 'Elige tu plan'}</strong></div>
    </header>

    {error && <p role="alert" className="publication-error">{error}</p>}
    {notice && <p role="status" className="publication-current">{notice}</p>}

    <div className="publication-plans" role="radiogroup" aria-label="Planes semanales">
      {state?.plans.map((item, index) => <button type="button" key={item.id} role="radio" aria-checked={plan === item.id} className={`${plan === item.id ? 'selected' : ''} ${item.id === 'pro' ? 'featured' : ''}`} onClick={() => setPlan(item.id)}>
        {item.id === 'pro' && <span className="plan-badge">Más elegido</span>}
        <span className="plan-icon"><AppIcon name={index === 0 ? 'sparkles' : index === 3 ? 'shield' : 'trend'}/></span>
        <strong>{item.name}</strong>
        <b>{item.soles === 0 ? 'Gratis' : <>S/ {item.soles}<small>/ semana</small></>}</b>
        <div>{item.benefits.map(benefit => <span key={benefit}><AppIcon name="check"/>{benefit}</span>)}</div>
      </button>)}
    </div>

    {chosen && <form className="publication-checkout" onSubmit={submit}>
      <div className="checkout-summary"><span className="checkout-icon"><AppIcon name="wallet"/></span><div><small>PLAN SELECCIONADO</small><strong>{chosen.name} · {isFree ? 'sin costo' : `S/ ${chosen.soles}.00 por semana`}</strong><p>{isFree ? 'Se activa de inmediato y mantiene tu perfil visible durante 7 días.' : 'Paga por Yape y registra el código de operación para su validación.'}</p></div></div>
      {isFree ? <button className="publication-action" disabled={busy}>{busy ? 'Activando…' : 'Activar membresía Gratis'}<AppIcon name="arrowRight"/></button> : <><div className="publication-yape"><img src="/payments/yape-qr.jpg" alt="Código QR de Yape para pagar la membresía"/><div><span className="eyebrow">PAGO SEGURO CON YAPE</span><h3>Envía S/ {chosen.soles}.00</h3><p>Comprueba el destinatario en Yape y escribe aquí el código de tu comprobante.</p><label htmlFor="publication-code">Código de operación</label><input id="publication-code" required minLength={6} maxLength={40} value={code} onChange={event => setCode(event.target.value.toUpperCase())} placeholder="Ej. 12345678"/></div></div><button className="publication-action" disabled={busy || code.trim().length < 6}>{busy ? 'Enviando…' : 'Enviar pago a revisión'}<AppIcon name="arrowRight"/></button></>}
    </form>}

    {!!state?.payments.length && <div className="publication-payments"><header><div><span className="eyebrow">HISTORIAL</span><h3>Solicitudes de pago</h3></div></header>{state.payments.map(payment => <article key={payment.id}><span className={`payment-status is-${payment.status}`}><AppIcon name={payment.status === 'approved' ? 'check' : payment.status === 'rejected' ? 'close' : 'history'}/></span><div><strong>{state.plans.find(item => item.id === payment.publication_plan)?.name || payment.publication_plan}</strong><small>{new Date(payment.created_at).toLocaleString('es-PE')}</small></div><b>S/ {Number(payment.amount_pen).toFixed(2)}</b><em>{statusCopy[payment.status] || payment.status}</em></article>)}</div>}
  </section>;
}

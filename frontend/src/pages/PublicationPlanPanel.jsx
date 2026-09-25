import React, { useEffect, useState } from 'react';
import { publicationPlanService } from '../api/client';
import './PublicationPlanPanel.css';

export default function PublicationPlanPanel() {
  const [state,setState] = useState(null);
  const [plan,setPlan] = useState('basico');
  const [code,setCode] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const load = async () => { try { setState(await publicationPlanService.get()); setError(''); } catch (err) { setError(err.message); } };
  useEffect(() => { load(); }, []);
  const chosen = state?.plans.find(item => item.id === plan);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await publicationPlanService.request(plan,code); setCode(''); await load(); setNotice('Pago enviado a revisión. Tu semana empezará cuando el moderador lo apruebe.'); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  if (state?.beta_free) return <section className="publication-plan-panel"><header><h2>Acceso beta gratuito</h2><p>Durante las pruebas no necesitas pagar un plan semanal. Cuando el equipo apruebe tu perfil, aparecerá gratuitamente en el directorio.</p></header><p className="publication-current">✓ Publicación gratuita activada para esta etapa de pruebas.</p></section>;
  return <section className="publication-plan-panel">
    <header><h2>Publicación semanal</h2><p>Para que tu anuncio aparezca en el directorio necesitas un plan vigente y la aprobación de tu perfil. Puedes completar y editar tu perfil mientras esperas.</p></header>
    {state?.active ? <p className="publication-current">Plan {state.subscription.plan} activo hasta el {new Date(state.subscription.expires_at).toLocaleString('es-PE')}.</p> : <p className="publication-expired">No tienes un plan vigente. Tu anuncio no aparece en el directorio.</p>}
    {error && <p role="alert" className="publication-error">{error}</p>}{notice && <p role="status" className="publication-current">{notice}</p>}
    <div className="publication-plans">{state?.plans.map(item => <button type="button" key={item.id} className={plan === item.id ? 'selected' : ''} onClick={() => setPlan(item.id)}><strong>{item.name}</strong><b>S/ {item.soles} <small>/ semana</small></b>{item.benefits.map(benefit => <span key={benefit}>✓ {benefit}</span>)}</button>)}</div>
    <form onSubmit={submit}><div className="publication-yape"><img src="/payments/yape-qr.jpg" alt="QR de Yape para pagar el plan de publicación"/><div><h3>Paga S/ {chosen?.soles || 80} por Yape</h3><p>Verifica el destinatario en Yape. Luego pega el código de operación del comprobante. El equipo de moderación comprobará el pago antes de activar tu plan. Si renuevas antes de vencer, añadimos 7 días a tu vigencia.</p><label htmlFor="publication-code">Código de operación</label><input id="publication-code" required minLength={6} maxLength={40} value={code} onChange={event => setCode(event.target.value)} placeholder="Código del comprobante"/><button disabled={busy || code.trim().length < 6}>{busy ? 'Enviando…' : 'Enviar pago a revisión'}</button></div></div></form>
    {!!state?.payments.length && <div className="publication-payments"><h3>Solicitudes anteriores</h3>{state.payments.map(payment => <p key={payment.id}>S/ {Number(payment.amount_pen).toFixed(2)} · {payment.publication_plan} · {payment.status === 'pending' ? 'Pendiente' : payment.status === 'approved' ? 'Aprobada' : 'Rechazada'}{payment.review_note ? ` · ${payment.review_note}` : ''}</p>)}</div>}
  </section>;
}

import React, { useEffect, useState } from 'react';
import { paymentsService } from '../api/client';

export default function PaymentReviewPanel() {
  const [payments,setPayments] = useState([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(null);
  const refresh = async () => { try { const data = await paymentsService.reviewQueue(); setPayments(data.payments || []); setError(''); } catch (err) { setError(err.message); } };
  useEffect(() => { refresh(); }, []);
  async function review(payment,decision) {
    const note = decision === 'rejected' ? window.prompt('Motivo del rechazo (obligatorio):') : '';
    if (decision === 'rejected' && !note?.trim()) return;
    if (decision === 'approved' && !window.confirm(`¿Verificaste en Yape el pago de S/ ${Number(payment.amount_pen).toFixed(2)} con código ${payment.operation_code}? ${payment.purpose === 'creator_publication' ? `Se activará una semana del plan ${payment.publication_plan} para ${payment.user_name}.` : `Se acreditarán ${payment.amount_tokens} tokens a ${payment.user_name}.`}`)) return;
    setBusy(payment.id);
    try { await paymentsService.review(payment.id,decision,note || ''); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusy(null); }
  }
  return <section className="payment-review-panel">
    <div className="payment-review-header"><div><h2>Pagos Yape de toda la plataforma</h2><p>Compara importe, código de operación y destinatario en tu cuenta Yape antes de aprobar. El código enviado por el usuario no demuestra por sí solo que pagó.</p></div><button onClick={refresh}>Actualizar</button></div>
    {error && <p role="alert">{error}</p>}
    {!payments.length && <p>No hay solicitudes de pago.</p>}
    <div className="payment-review-list">{payments.map(payment => <article key={payment.id}>
      <div><strong>{payment.user_name} · {payment.user_email}</strong><span>{new Date(payment.created_at).toLocaleString('es-PE')}</span></div>
      <div><b>{payment.purpose === 'creator_publication' ? `Publicación semanal · ${payment.publication_plan}` : `${payment.amount_tokens} tokens`} · S/ {Number(payment.amount_pen).toFixed(2)}</b><span>Operación: {payment.operation_code}</span><span>Estado: {payment.status === 'pending' ? 'Pendiente' : payment.status === 'approved' ? 'Aprobado' : 'Rechazado'}</span></div>
      {payment.review_note && <p>{payment.review_note}</p>}
      {payment.status === 'pending' && <div className="payment-review-actions"><button disabled={busy === payment.id} onClick={() => review(payment,'approved')}>Aprobar y acreditar</button><button disabled={busy === payment.id} onClick={() => review(payment,'rejected')}>Rechazar</button></div>}
    </article>)}</div>
  </section>;
}

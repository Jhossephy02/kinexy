import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { walletService, paymentsService } from '../api/client';
import AppIcon from '../components/ui/AppIcon.jsx';
import './WalletPage.css';

export default function WalletPage() {
  const { user, isAuthenticated } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [selectedPack, setSelectedPack] = useState(180);
  const [packs, setPacks] = useState([]);
  const [payments, setPayments] = useState([]);
  const [operationCode, setOperationCode] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      setError('');
      const data = await walletService.get();
      setWallet(data);
      const historyData = await api.get('/wallet/history');
      setTransactions(historyData?.transactions || data?.transactions || []);
      const [packData, paymentData] = await Promise.all([paymentsService.packs(), paymentsService.mine()]);
      setPacks(packData.packs || []);
      if (packData.packs?.length && !packData.packs.some(item => item.tokens === selectedPack)) setSelectedPack(packData.packs[0].tokens);
      setPayments(paymentData.payments || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    load();
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update' && /wallet|tips|unlock|payments|messages/.test(event.detail?.data?.path || '')) load(); };
    window.addEventListener('kinexy-realtime', onRealtime);
    return () => window.removeEventListener('kinexy-realtime', onRealtime);
  }, [isAuthenticated]);

  async function recharge() {
    if (recharging) return;
    setRecharging(true); setError(''); setNotice('');
    try {
      await paymentsService.request(selectedPack, operationCode);
      await load();
      setOperationCode('');
      setNotice('Solicitud enviada. Un moderador verificará la operación en Yape antes de acreditar los tokens.');
    } catch (err) { setError(err.message); }
    finally { setRecharging(false); }
  }

  if (!isAuthenticated) return <Navigate to="/login" replace/>;

  return (
    <main className="wallet-page" id="main-content">
      <section className="wallet-hero">
        <div>
          <span className="eyebrow"><AppIcon name="wallet"/>BILLETERA KINEXY</span>
          <h1>Tus tokens,<br/><em>siempre visibles.</em></h1>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <a href="#recargar" className="primary-button" style={{ textDecoration: 'none' }}>Recargar mi cuenta</a>
            <Link className="secondary-button" to="/messages" style={{ textDecoration: 'none' }}>Enviar tip</Link>
          </div>
        </div>
        <div className="wallet-balance">
          <span>SALDO DISPONIBLE</span>
          <strong>{wallet?.balance ?? '—'}</strong>
          <small>tokens disponibles</small>
        </div>
        <span className="wallet-orbit" aria-hidden="true">K</span>
      </section>
      
      {error && (
        <div className="wallet-alert" role="alert">
          <AppIcon name="shield"/>{error}
          <button onClick={() => setError('')} aria-label="Cerrar error">×</button>
        </div>
      )}
      {notice && <div className="wallet-notice" role="status"><AppIcon name="check"/>{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso">×</button></div>}

      <section className="wallet-content">
        <section className="wallet-recharge" id="recargar" aria-labelledby="recharge-title">
          <header><span className="eyebrow">RECARGA CON YAPE</span><h2 id="recharge-title">Añade tokens a tu saldo<span>.</span></h2><p>Elige un paquete, paga exactamente el importe indicado y registra el código de operación. Un moderador de Kinexy verificará el pago antes de acreditar tus tokens.</p></header>
          {packs.length ? <>
            <div className="recharge-packs">{packs.map(item => <button key={item.tokens} type="button" onClick={() => setSelectedPack(item.tokens)} className={selectedPack === item.tokens ? 'is-selected' : ''} aria-pressed={selectedPack === item.tokens}><strong>{item.tokens}</strong><span>tokens</span><small>S/ {Number(item.soles).toFixed(2)}</small></button>)}</div>
            <div className="yape-instructions"><img src="/payments/yape-qr.jpg" alt="Código QR de Yape para pagar a Kinexy"/><div><strong>1. Escanea el QR con Yape</strong><p>Envía S/ {Number(packs.find(item => item.tokens === selectedPack)?.soles || packs[0].soles).toFixed(2)}. Comprueba el destinatario en Yape antes de pagar.</p><strong>2. Registra tu operación</strong><label htmlFor="yape-operation">Código de operación</label><input id="yape-operation" value={operationCode} onChange={event => setOperationCode(event.target.value)} placeholder="Código del comprobante" maxLength={40}/><p>El código se usa para verificar tu pago; enviarlo no acredita tokens automáticamente.</p></div></div>
            <div className="recharge-action"><div><small>RECARGA SELECCIONADA</small><strong>{selectedPack} tokens</strong><span>Yape · revisión manual</span></div><button className="primary-button" onClick={recharge} disabled={recharging || !packs.some(item => item.tokens === selectedPack) || operationCode.trim().length < 6}>{recharging ? 'Enviando…' : 'Enviar pago a revisión'}<AppIcon name="arrow"/></button></div>
          </> : <p className="yape-unavailable">Las recargas están temporalmente desactivadas hasta configurar los precios en soles.</p>}
          {payments.length > 0 && <div className="yape-status"><h3>Mis solicitudes</h3>{payments.map(payment => <p key={payment.id}>{payment.amount_tokens} tokens · S/ {Number(payment.amount_pen).toFixed(2)} · {payment.status === 'pending' ? 'Pendiente de revisión' : payment.status === 'approved' ? 'Aprobada' : 'Rechazada'}{payment.review_note ? ` · ${payment.review_note}` : ''}</p>)}</div>}
        </section>
        <aside className="wallet-history" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
          <header>
            <span><AppIcon name="history"/></span>
            <div>
              <h2>Movimientos</h2>
              <p>Historial de transacciones de tu cuenta.</p>
            </div>
          </header>
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
              <article key={transaction.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', gap: '12px' }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>
                  {transaction.amount > 0 ? '⬆️' : '⬇️'}
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '0.9rem' }}>{transaction.description || (transaction.amount > 0 ? 'Recarga de tokens' : 'Gasto de tokens')}</strong>
                  <time style={{ color: 'var(--muted)', fontSize: '0.8rem' }} dateTime={transaction.created_at}>
                    {new Date(transaction.created_at).toLocaleString('es-PE')}
                  </time>
                </div>
                <b style={{ color: transaction.amount > 0 ? '#4ade80' : '#f2677f', fontSize: '1rem', fontWeight: '700' }}>
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                </b>
              </article>
            ))
          ) : (
            <div className="wallet-empty">
              <AppIcon name="history"/>
              <p>Tus recargas y desbloqueos aparecerán aquí.</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

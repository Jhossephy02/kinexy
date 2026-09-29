import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { walletService, paymentsService, profilesService, tipsService, withdrawalsService } from '../api/client';
import AppIcon from '../components/ui/AppIcon.jsx';
import './WalletPage.css';
import './WalletWorkspace.css';

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
  const [withdrawals, setWithdrawals] = useState([]); const [profiles, setProfiles] = useState([]); const [tipTo, setTipTo] = useState(''); const [tipAmount, setTipAmount] = useState(''); const [withdrawAmount, setWithdrawAmount] = useState(''); const [withdrawMethod, setWithdrawMethod] = useState('yape'); const [destination, setDestination] = useState(''); const [busy, setBusy] = useState(false); const [filter, setFilter] = useState('all');
  const isCreator = ['creator','admin','superadmin'].includes(user?.role);

  const load = async () => {
    try {
      setError('');
      const data = await walletService.get();
      setWallet(data);
      const historyData = await api.get('/wallet/history');
      setTransactions(historyData?.transactions || data?.transactions || []);
      const [packData, paymentData, withdrawalData, profileData] = await Promise.all([paymentsService.packs(), paymentsService.mine(), withdrawalsService.mine(), profilesService.list({})]);
      setPacks(packData.packs || []);
      if (packData.packs?.length && !packData.packs.some(item => item.tokens === selectedPack)) setSelectedPack(packData.packs[0].tokens);
      setPayments(paymentData.payments || []); setWithdrawals(withdrawalData.withdrawals || []); setProfiles((profileData.profiles || []).filter(item => item.owner_id && Number(item.owner_id) !== Number(user?.id)));
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

  async function donate() { setBusy(true); try { await tipsService.send(Number(tipTo), Number(tipAmount)); setTipAmount(''); setNotice('Donación enviada correctamente.'); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function withdraw() { setBusy(true); try { const result = await withdrawalsService.request({ amount_tokens: Number(withdrawAmount), method: withdrawMethod, destination }); setWithdrawAmount(''); setDestination(''); setNotice(`Retiro solicitado. Recibirás S/ ${Number(result.amount_pen).toFixed(2)} cuando sea validado.`); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  const filteredTransactions = transactions.filter(item => filter === 'all' || (filter === 'in' && item.amount > 0) || (filter === 'out' && item.amount < 0) || (filter === 'tips' && String(item.type).includes('tip')) || (filter === 'withdrawals' && String(item.type).startsWith('withdrawal')));
  const movementName = item => ({ manual_yape_credit:'Recarga aprobada', tip:'Donación enviada', tip_received:'Donación recibida', withdrawal_requested:'Retiro solicitado', withdrawal_refund:'Retiro reembolsado', message_unlock:'Acceso a chat', content_unlock:'Contenido desbloqueado', contact_unlock:'Contacto desbloqueado' }[item.type] || item.description || 'Movimiento de tokens');

  if (!isAuthenticated) return <Navigate to="/login" replace/>;

  return (
    <main className="wallet-page" id="main-content">
      <section className="wallet-hero">
        <div>
          <span className="eyebrow"><AppIcon name="wallet"/>BILLETERA KINEXY</span>
          <h1>Tus tokens,<br/><em>siempre visibles.</em></h1>
          <div className="wallet-hero-actions">
            <a href="#recargar" className="primary-button" style={{ textDecoration: 'none' }}>Recargar mi cuenta</a>
            <a className="secondary-button" href="#donar" style={{ textDecoration: 'none' }}>Donar tokens</a>
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
        <section className="wallet-recharge" id="donar"><header><span className="eyebrow">DONAR</span><h2>Apoya a una creadora<span>.</span></h2><p>La donación llega al instante y queda registrada en ambas billeteras.</p></header><label>Creadora<select value={tipTo} onChange={event => setTipTo(event.target.value)}><option value="">Selecciona una creadora</option>{profiles.map(profile => <option key={profile.id} value={profile.owner_id}>{profile.name}</option>)}</select></label><label>Tokens a donar<input type="text" inputMode="numeric" pattern="[0-9]*" min="1" value={tipAmount} onChange={event => setTipAmount(event.target.value)} placeholder="Ej. 10"/></label><button className="primary-button" disabled={busy || !tipTo || Number(tipAmount) < 1} onClick={donate}>Donar tokens</button></section>
        {isCreator && <section className="wallet-recharge"><header><span className="eyebrow">RETIRAR</span><h2>Retira tus ganancias<span>.</span></h2><p>Valor de retiro: S/ 0.30 por token. La solicitud reserva tokens hasta que un moderador valide el pago manual.</p></header><label>Tokens a retirar<input type="text" inputMode="numeric" pattern="[0-9]*" min="1" value={withdrawAmount} onChange={event => setWithdrawAmount(event.target.value)} placeholder="Ej. 100"/></label>{Number(withdrawAmount) > 0 && <p><strong>Recibirás S/ {(Number(withdrawAmount) * 0.3).toFixed(2)}</strong></p>}<label>Método<select value={withdrawMethod} onChange={event => setWithdrawMethod(event.target.value)}><option value="yape">Yape</option><option value="bank">Cuenta bancaria</option></select></label><label>{withdrawMethod === 'yape' ? 'Número Yape' : 'Cuenta bancaria o CCI'}<input value={destination} onChange={event => setDestination(event.target.value)} placeholder="Destino del pago"/></label><button className="primary-button" disabled={busy || Number(withdrawAmount) < 1 || destination.trim().length < 6} onClick={withdraw}>Solicitar retiro</button>{withdrawals.length > 0 && <div className="yape-status"><h3>Mis retiros</h3>{withdrawals.map(item => <p key={item.id}>{item.amount_tokens} tokens · S/ {(Number(item.amount_tokens) * 0.3).toFixed(2)} · {item.status}{item.review_note ? ` · ${item.review_note}` : ''}</p>)}</div>}</section>}
        <aside className="wallet-history">
          <header>
            <span><AppIcon name="history"/></span>
            <div>
              <h2>Movimientos</h2>
              <p>Historial de transacciones de tu cuenta.</p>
            </div>
          </header>
          <div className="wallet-filters">{[['all','Todos'],['in','Ingresos'],['out','Gastos'],['tips','Donaciones'],['withdrawals','Retiros']].map(([key,label]) => <button key={key} className={filter === key ? 'is-selected' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>{filteredTransactions.length > 0 ? (
            filteredTransactions.map((transaction) => (
              <article key={transaction.id}>
                <span>
                  {transaction.amount > 0 ? '⬆️' : '⬇️'}
                </span>
                <div>
                  <strong>{movementName(transaction)}</strong>
                  <time dateTime={transaction.created_at}>
                    {new Date(transaction.created_at).toLocaleString('es-PE')}
                  </time>
                </div>
                <b className={transaction.amount > 0 ? 'credit-text' : ''}>
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

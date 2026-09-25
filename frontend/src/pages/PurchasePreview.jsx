import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../components/ui/AppIcon.jsx';
import { useAuth } from '../context/AuthContext';
import { walletService } from '../api/client';
import './PurchasePreview.css';

const methods = [
  { id: 'cards', name: 'Tarjeta bancaria', mark: 'VISA · Mastercard', caption: 'Crédito o débito' },
  { id: 'yape', name: 'Yape', mark: 'yape', caption: 'Pago móvil local' },
  { id: 'cash', name: 'PagoEfectivo', mark: 'PagoEfectivo', caption: 'Código de pago' },
  { id: 'bank', name: 'Transferencia bancaria', mark: 'BANCO', caption: 'Transferencia local' },
  { id: 'paypal', name: 'PayPal', mark: 'PayPal', caption: 'Cuenta internacional' },
  { id: 'crypto', name: 'Criptomonedas', mark: '₿  ◈  ₮', caption: 'USDT, BTC, ETH y USDC' },
];
const packs = [
  { tokens: 40, price: '4,99', numericPrice: 4.99 },
  { tokens: 80, price: '7,99', numericPrice: 7.99, old: '9,99', note: '20% de descuento', promo: true },
  { tokens: 180, price: '20,99', numericPrice: 20.99, note: 'Ahorra 1,49 US$', featured: true },
  { tokens: 460, price: '49,99', numericPrice: 49.99, note: 'Ahorra 7 US$', extra: '+ OFERTA ULTIMATE' },
  { tokens: 900, price: '89,99', numericPrice: 89.99, note: 'Mejor valor' },
  { tokens: 1500, price: '139,99', numericPrice: 139.99, note: 'Paquete máximo' },
];

export default function PurchasePreview() {
  const { user } = useAuth();
  const [method, setMethod] = useState('paypal');
  const [pack, setPack] = useState(180);
  const [showAll, setShowAll] = useState(false);
  const [complete, setComplete] = useState(false);
  const [crediting, setCrediting] = useState(false);
  const [credited, setCredited] = useState(false);
  const [creditError, setCreditError] = useState('');
  const selectedMethod = methods.find((item) => item.id === method);
  const selectedPack = packs.find((item) => item.tokens === pack);
  async function creditTokens() { if (crediting || credited) return; setCrediting(true); setCreditError(''); try { await walletService.demoCredit(selectedPack.tokens, selectedMethod.id); setCredited(true); window.dispatchEvent(new Event('kinexy-wallet-updated')); } catch (error) { setCreditError(error.message); } finally { setCrediting(false); } }
  if (complete) return <main className="purchase-preview purchase-complete"><section className="demo-complete-card"><span className="complete-icon"><AppIcon name="check"/></span><span className="eyebrow">DEMOSTRACIÓN COMPLETADA</span><h1>Así se vería tu compra<span>.</span></h1><p>Seleccionaste <strong>{selectedPack.tokens} tokens</strong> por <strong>{selectedPack.price} US$</strong> mediante <strong>{selectedMethod.name}</strong>.</p><div className="complete-safety"><AppIcon name="shield"/><span>No se realizó ningún cargo ni se enviaron datos a un proveedor.</span></div>{user ? <button className="credit-demo-button" onClick={creditTokens} disabled={crediting || credited}>{credited ? <><AppIcon name="check"/>Tokens acreditados</> : crediting ? 'Acreditando…' : <><AppIcon name="wallet"/>Acreditar tokens de prueba</>}</button> : <Link className="credit-demo-button" to="/login"><AppIcon name="login"/>Inicia sesión para acreditar tokens</Link>}{creditError && <p className="credit-error" role="alert">{creditError}</p>}{credited && <Link className="wallet-link" to="/wallet">Abrir mi billetera<AppIcon name="arrow"/></Link>}<div className="complete-actions"><button onClick={() => { setComplete(false); setCredited(false); setCreditError(''); }}><AppIcon name="back"/>Volver a la muestra</button><Link to="/">Ir al inicio<AppIcon name="arrow"/></Link></div></section></main>;
  return <main className="purchase-preview">
    <header className="purchase-top"><Link to="/" className="purchase-brand">kinexy<span>.</span></Link><h1><AppIcon name="coins"/>Comprar tokens</h1><span className="demo-tag"><i/>VISTA DE MUESTRA</span><Link to="/" className="purchase-close" aria-label="Cerrar vista de compra"><AppIcon name="close"/></Link></header>
    <nav className="purchase-steps" aria-label="Progreso de compra"><span className="is-active"><i>1</i>Elige un método</span><b/><span className="is-active"><i>2</i>Selecciona tokens</span><b/><span><i>3</i>Confirma</span></nav>
    <section className="purchase-surface" aria-label="Demostración de compra de tokens">
      <div className="purchase-notice"><AppIcon name="shield"/><span><strong>Demostración segura</strong> Métodos e importes de referencia. No se procesarán pagos.</span></div>
      <div className="purchase-columns">
        <section aria-labelledby="payment-heading"><div className="purchase-section-title"><span><AppIcon name="coins"/></span><div><small>PASO 01</small><h2 id="payment-heading">Método de pago</h2></div></div><div className="payment-options">{methods.map((item) => <button type="button" key={item.id} className={`payment-option ${method === item.id ? 'sample-selected' : ''}`} onClick={() => setMethod(item.id)} aria-pressed={method === item.id}><span className="sample-radio" aria-hidden="true"/><span className="method-copy"><strong>{item.name}</strong><small>{item.caption}</small></span><span className={`payment-wordmark wordmark-${item.id}`}>{item.mark}</span></button>)}</div></section>
        <section aria-labelledby="package-heading"><div className="purchase-section-title"><span><AppIcon name="star"/></span><div><small>PASO 02</small><h2 id="package-heading">Paquete de tokens</h2></div></div><div className="package-options">{packs.slice(0, showAll ? packs.length : 4).map((item) => <button type="button" key={item.tokens} className={`package-option ${pack === item.tokens ? 'sample-selected ' : ''}${item.promo ? 'sample-promo ' : ''}${item.featured ? 'sample-featured' : ''}`} onClick={() => setPack(item.tokens)} aria-pressed={pack === item.tokens}><span className="sample-radio" aria-hidden="true"/><div className="token-label"><strong>{item.tokens} tokens</strong>{item.extra && <small>{item.extra}</small>}</div><div className="token-price"><span>{item.old && <del>{item.old} US$</del>} <strong>{item.price} US$</strong></span>{item.note && <small>{item.note}</small>}</div></button>)}</div><button className="more-packages" type="button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}><span/>{showAll ? 'Mostrar menos paquetes' : 'Mostrar más paquetes'}<AppIcon name={showAll ? 'back' : 'arrow'}/><span/></button><div className="provider-sample"><span className="epoch-wordmark">epoch</span><div><p>Proveedor ilustrativo de la referencia.</p><small>Sin conexión con procesadores reales.</small></div></div></section>
      </div>
      <aside className="purchase-summary" aria-label="Resumen de selección"><div><span className="summary-icon"><AppIcon name="coins"/></span><div><small>TU SELECCIÓN</small><strong>{selectedPack.tokens} tokens</strong></div></div><dl><div><dt>Método</dt><dd>{selectedMethod.name}</dd></div><div><dt>Total de muestra</dt><dd>{selectedPack.price} US$</dd></div></dl><button className="sample-continue" onClick={() => setComplete(true)}>Continuar en demo<AppIcon name="arrow"/></button></aside>
      <div className="purchase-bottom"><p><AppIcon name="shield"/>Esta interacción termina en una confirmación de muestra. No realiza cargos.</p><div className="sample-footer"><span>DISEÑO DE REFERENCIA</span><i/><span>SIN TRANSACCIONES</span><i/><span>KINEXY</span></div></div>
    </section>
  </main>;
}

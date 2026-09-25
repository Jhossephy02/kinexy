import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { membershipsService } from '../api/client';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/ui/AppIcon.jsx';

const planIcons = ['heart', 'star', 'gem'];
export default function MembershipsPage() {
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]), [active, setActive] = useState(null), [costs, setCosts] = useState({ 1: 20, 2: 40, 3: 70 }), [betaFree, setBetaFree] = useState(false);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    let mounted = true;
    Promise.all([membershipsService.list(), isAuthenticated ? membershipsService.mine() : Promise.resolve(null)])
      .then(([catalog, mine]) => { if (mounted) { setPlans(catalog.plans); setActive(mine?.subscription || null); setBetaFree(Boolean(catalog.beta_free || mine?.beta_free)); if (mine?.costs) setCosts(mine.costs); } })
      .catch(err => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [isAuthenticated]);
  const subscribe = async tier => {
    setPending(tier); setError(''); setNotice('');
    try { const result = await membershipsService.subscribe(tier); setActive(result.subscription); setNotice(result.beta_free ? `Membresía gratuita activa hasta ${new Date(result.subscription.expires_at).toLocaleDateString('es-PE')}.` : `Membresía activa hasta ${new Date(result.subscription.expires_at).toLocaleDateString('es-PE')}. Saldo: ${result.wallet.balance} tokens.`); }
    catch (err) { setError(err.message); }
    finally { setPending(0); }
  };
  return <main className="memberships-page refined-memberships" id="main-content">
    <section className="memberships-hero"><div className="membership-hero-copy"><span className="eyebrow"><AppIcon name="sparkles"/>MÁS CERCA DE TU COMUNIDAD</span><h1>Elige cómo<br/>quieres <em>conectar.</em></h1><p>Cada nivel abre una forma distinta de acompañar a los creadores que eliges.</p><div className="membership-benefit-strip"><span><AppIcon name="shield"/>Acceso según tu nivel</span><span><AppIcon name="heart"/>30 días por activación</span></div></div><span className="membership-orbit" aria-hidden="true">k</span></section>
    <section className="membership-catalog" aria-labelledby="membership-title"><div className="membership-heading"><div><span className="eyebrow">MEMBRESÍAS KINEXY</span><h2 id="membership-title">Una experiencia a tu medida<span>.</span></h2></div><span className="payments-off"><span/>{betaFree ? 'Gratis durante la beta' : 'Activación de prueba con tokens'}</span></div>
      {active && <p className="membership-feedback">Nivel activo: {['', 'Esencial', 'Plus', 'Premium'][active.tier]} hasta {new Date(active.expires_at).toLocaleDateString('es-PE')}.</p>}
      {notice && <p className="membership-feedback" role="status">{notice}</p>}{error && <p className="membership-feedback" role="alert">{error}{!betaFree && <> <Link to="/wallet">Ver billetera</Link></>}</p>}
      {loading ? <div className="membership-grid" aria-label="Cargando membresías">{[1,2,3].map(item => <div className="membership-skeleton" key={item}/>)}</div> : <div className="membership-grid">{plans.filter(plan => !plan.creator_id).slice(0,3).map((plan, index) => { const tier = index + 1; const already = active && active.tier >= tier; return <article className={`membership-card membership-${index} ${index === 1 ? 'membership-featured' : ''}`} key={plan.id}>{index === 1 && <span className="membership-popular"><AppIcon name="sparkles"/>Más elegido</span>}<div className="membership-number">0{tier}</div><span className="membership-plan-icon"><AppIcon name={planIcons[index]}/></span><span className="membership-kicker">NIVEL {tier}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="membership-price"><strong>{betaFree ? 'Gratis' : `${costs[tier]} tokens`}</strong><span>/ 30 días de prueba</span></div><ul>{plan.benefits.map(benefit => <li key={benefit}><span><AppIcon name="check"/></span>{benefit}</li>)}</ul>{isAuthenticated ? <button disabled={already || Boolean(pending)} onClick={() => subscribe(tier)}>{pending === tier ? 'Activando…' : already ? 'Acceso incluido' : active ? `Subir a ${plan.name}` : `Activar ${plan.name}`}<AppIcon name="arrow"/></button> : <Link to="/login">Iniciar sesión para activar</Link>}</article>; })}</div>}
      <div className="membership-note"><span><AppIcon name="shield"/></span><div><strong>Solo pruebas</strong><p>{betaFree ? 'Las membresías se activan gratis durante la beta. Los tokens se usan únicamente para probar chats y mensajes.' : 'El saldo de tokens de prueba se descuenta al activar. No se realiza ningún cobro real.'}</p></div></div>
    </section>
  </main>;
}

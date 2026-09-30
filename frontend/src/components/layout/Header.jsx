import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppIcon from '../ui/AppIcon.jsx';
import { walletService } from '../../api/client';
import kinexyIsotype from '../../assets/kinexy-isotype.png';

export default function Header({ onNavigate, city, onCityChange, user, onLogout }) {
  const [expanded, setExpanded] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(null);
  const { pathname } = useLocation();
  const go = (path) => { onNavigate(path); setExpanded(false); };
  const panel = ['superadmin', 'admin', 'moderator'].includes(user?.role) ? '/admin' : '/advertiser';
  const panelLabel = user?.role === 'superadmin' ? 'Mi dashboard' : user?.role === 'admin' ? 'Dashboard admin' : user?.role === 'moderator' ? 'Dashboard moderación' : 'Mi dashboard';
  const canBecomeCreator = user?.role === 'client';

  useEffect(() => {
    let active = true;
    const refreshBalance = () => user ? walletService.get().then((wallet) => { if (active) setTokenBalance(wallet.balance); }).catch(() => { if (active) setTokenBalance(null); }) : setTokenBalance(null);
    refreshBalance();
    const timer = user ? window.setInterval(refreshBalance, 60000) : null;
    const onVisible = () => { if (document.visibilityState === 'visible') refreshBalance(); };
    window.addEventListener('kinexy-wallet-updated', refreshBalance);
    window.addEventListener('focus', refreshBalance);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; if (timer) window.clearInterval(timer); window.removeEventListener('kinexy-wallet-updated', refreshBalance); window.removeEventListener('focus', refreshBalance); document.removeEventListener('visibilitychange', onVisible); };
  }, [user?.id, pathname]);

  const hasTokens = Number(tokenBalance) > 0;

  return <header className="site-header refined-header"><a className="skip-link" href="#main-content">Saltar al contenido</a>
    <button className="brand" onClick={() => go('/')} aria-label="Kinexy, inicio"><img className="brand-mark" src={kinexyIsotype} alt=""/>kinexy<span className="brand-dot">.</span></button>
    <span className="header-divider"/><span className="header-caption">Anuncios y perfiles por ciudad</span>
    <button className="menu-toggle icon-button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls="main-navigation"><AppIcon name={expanded ? 'close' : 'menu'}/><span>{expanded ? 'Cerrar' : 'Menú'}</span></button>
    <nav id="main-navigation" className={`desktop-nav ${expanded ? 'nav-open' : ''}`} aria-label="Navegación principal">
      <button className={pathname === '/' ? 'nav-active' : ''} onClick={() => go('/')}><AppIcon name="compass"/>Ver anuncios</button>
      {['superadmin', 'admin', 'moderator', 'creator'].includes(user?.role) && <button className={`dashboard-entry ${pathname === panel ? 'nav-active' : ''}`} onClick={() => go(panel)}><AppIcon name="dashboard"/>{panelLabel}</button>}
      {user && <button className={`header-token-button ${pathname === '/wallet' ? 'nav-active' : ''} ${hasTokens ? 'has-balance' : 'is-empty'}`} onClick={() => go('/wallet')} aria-label={`${tokenBalance ?? 0} tokens disponibles. Abrir billetera`}><AppIcon name="wallet"/><span>{tokenBalance === null ? '—' : tokenBalance}</span>{hasTokens && <i></i>}</button>}
      {canBecomeCreator && <button className="creator-invite" onClick={() => go('/profile?activate=creator')}><AppIcon name="plus"/><span>¿Quieres ser creador/a?</span></button>}
      {(pathname === '/' || pathname.startsWith('/escorts/')) && <label className="header-city"><AppIcon name="map"/><select className="city-select" value={city} onChange={(e) => onCityChange(e.target.value)} aria-label="Filtrar por ciudad">{['Todas', 'Pucallpa', 'Iquitos', 'Tarapoto', 'Tingo María', 'Yurimaguas'].map((item) => <option key={item}>{item}</option>)}</select></label>}
      {user ? <button className={`account-button ${pathname === '/profile' ? 'nav-active' : ''}`} onClick={() => go('/profile')}><AppIcon name="user"/>Mi perfil · {user.name || user.email}</button> : <button className="account-button" onClick={() => go('/login')}><AppIcon name="login"/>Iniciar sesión</button>}
    </nav>
  </header>;
}

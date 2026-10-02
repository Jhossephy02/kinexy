import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/ui/AppIcon.jsx';
import Toast from '../components/ui/Toast.jsx';
import Modal from '../components/ui/Modal.jsx';
import { walletService } from '../api/client';
import './UserProfilePage.css';

export default function UserProfilePage() {
  const { user, isAuthenticated, isCreator, isModerator, isAdmin, isSuperadmin, logout, becomeCreator } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (location.search.includes('activate=creator') && isAuthenticated && !isCreator) setShowPaymentModal(true);
  }, [location.search, isAuthenticated, isCreator]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    walletService.get().then((data) => {
      if (active) setBalance(data.balance);
    }).catch(() => {
      if (active) setBalance(0);
    });
    return () => { active = false; };
  }, [isAuthenticated]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleBecomeCreator = async () => {
    setPending(true);
    setError('');
    try {
      await becomeCreator({ method: 'free' });
      setShowPaymentModal(false);
      setToast('Cuenta de creador activada gratis. Ahora completa tu anuncio.');
      setTimeout(() => {
        navigate('/advertiser?onboarding=profile');
      }, 1200);
    } catch (err) {
      setError(err.message || 'No se pudo completar el pago de activación.');
    } finally {
      setPending(false);
    }
  };

  const roleTitle = isSuperadmin ? 'Superadministrador' : isAdmin ? 'Administrador' : isModerator ? 'Moderador' : isCreator ? 'Creador Kinexy' : 'Cliente / Usuario';

  return (
    <main className="page profile-user-page" id="main-content" style={{ maxWidth: '850px', margin: '40px auto', padding: '0 20px' }}>
      {/* HEADER DE USUARIO */}
      <header className="profile-header-box" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '30px', marginBottom: '25px', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ width: '74px', height: '74px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--red), #802340)', display: 'grid', placeItems: 'center', fontSize: '30px', color: 'white', fontWeight: 'bold' }}>
          {(user?.name || user?.email || 'U').slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <span className="eyebrow" style={{ color: 'var(--red)', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
            ✦ {roleTitle}
          </span>
          <h1 style={{ margin: '4px 0', fontSize: '1.8rem' }}>{user?.name || 'Usuario Kinexy'}</h1>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>{user?.email}</p>
        </div>
        <button onClick={logout} className="secondary-button" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AppIcon name="logout" size={16} />
          <span>Cerrar sesión</span>
        </button>
      </header>

      {/* BANNER ADMINISTRATIVO (SI EL USUARIO ES ADMIN, SUPERADMIN O MODERADOR) */}
      {isModerator && (
        <section className="admin-pass-card" style={{ background: 'linear-gradient(135deg, #1f121d, #0d0c11)', border: '1px solid #4d2638', borderRadius: 'var(--radius)', padding: '24px', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <span className="eyebrow" style={{ color: '#f2677f', fontSize: '0.8rem', letterSpacing: '1px' }}>★ ACCESO ADMINISTRATIVO DETECTADO</span>
            <h3 style={{ margin: '4px 0 6px 0', fontSize: '1.3rem' }}>Panel de Control ({roleTitle})</h3>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>Tienes privilegios para supervisar la plataforma, moderar contenido y gestionar solicitudes.</p>
          </div>
          <Link to="/admin" className="primary-button" style={{ textDecoration: 'none', background: '#f2677f', color: '#140a10', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
            <AppIcon name="dashboard" size={16} />
            <span>Abrir Panel Admin</span>
          </Link>
        </section>
      )}

      {error && (
        <div style={{ background: '#3b1820', border: '1px solid var(--red)', color: '#ffb3c1', padding: '16px', borderRadius: '12px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>No se pudo activar:</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>{error}</p>
          </div>
          <button className="primary-button" onClick={() => setShowPaymentModal(true)} style={{ fontSize: '0.85rem', padding: '8px 14px', whiteSpace: 'nowrap' }}>Reintentar</button>
        </div>
      )}

      {/* TARJETA DE CONVERTIRSE EN CREADOR */}
      {!isCreator ? (
        <section className="become-creator-card" style={{ background: 'linear-gradient(135deg, #2a1422, #141018)', border: '1px solid #5a2a40', borderRadius: 'var(--radius)', padding: '30px', marginBottom: '25px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <span className="eyebrow" style={{ color: '#ff8ca3', fontSize: '0.8rem', letterSpacing: '1.5px' }}>✦ ACTIVA TU CUENTA DE CREADOR</span>
              <span style={{ background: 'rgba(246, 106, 128, 0.2)', border: '1px solid var(--red)', color: '#ffe5eb', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                Gratis durante la beta
              </span>
            </div>
            <h2 style={{ fontSize: '1.6rem', marginTop: '8px', marginBottom: '12px' }}>Publica con la cuenta que ya tienes</h2>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem', lineHeight: '1.5', maxWidth: '580px', marginBottom: '20px' }}>
              Activa el rol de creador <strong>sin costo por ahora</strong>. Conservarás esta cuenta, tus compras y tus conversaciones; luego podrás completar tu anuncio.
            </p>

            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="primary-button" onClick={() => setShowPaymentModal(true)} style={{ background: 'var(--red)', color: 'white', padding: '12px 24px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AppIcon name="sparkles" size={18} />
                <span>Activar gratis</span>
              </button>
            </div>
          </div>
          <span style={{ position: 'absolute', right: '-20px', bottom: '-40px', fontSize: '180px', fontFamily: 'Georgia', fontStyle: 'italic', opacity: 0.05, color: 'var(--red)', pointerEvents: 'none' }}>k</span>
        </section>
      ) : (
        <section className="creator-active-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '25px', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', marginBottom: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>
              <AppIcon name="check" size={14} /> CUENTA DE CREADOR ACTIVA
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem' }}>Panel Creator Studio activo</h3>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem' }}>Completa tu perfil y sube fotos. Durante la beta será visible gratuitamente después de la aprobación.</p>
          </div>
          <Link to="/advertiser" className="primary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <AppIcon name="dashboard" size={16} />
            <span>Ir a Creator Studio</span>
          </Link>
        </section>
      )}

      <Modal open={showPaymentModal && !isCreator} title="Activar cuenta de creador" onClose={() => !pending && setShowPaymentModal(false)}>
        <p>Usarás esta misma cuenta. La activación es <strong>gratis durante esta etapa</strong> y no descontará tokens. Después podrás crear tu anuncio y subir fotos.</p>
        {error && <p role="alert" className="wizard-error">{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          <button className="secondary-button" onClick={() => setShowPaymentModal(false)} disabled={pending}>Cancelar</button>
          <button className="primary-button" onClick={handleBecomeCreator} disabled={pending}>{pending ? 'Activando…' : 'Activar gratis'}</button>
        </div>
      </Modal>

      {/* ENLACES RÁPIDOS A BILLETERA Y MENSAJES */}
      <section className="profile-quick-links" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px' }}>
        <Link to="/wallet" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#241a24', display: 'grid', placeItems: 'center', color: 'var(--red)' }}>
            <AppIcon name="wallet" size={20} />
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '1rem' }}>Mi Billetera</strong>
            <small style={{ color: 'var(--muted)' }}>{balance !== null ? `${balance} tokens disponibles` : 'Saldo y recargas'}</small>
          </div>
        </Link>

        <Link to="/messages" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#241a24', display: 'grid', placeItems: 'center', color: 'var(--red)' }}>
            <AppIcon name="message" size={20} />
          </div>
          <div>
            <strong style={{ display: 'block', fontSize: '1rem' }}>Mensajes</strong>
            <small style={{ color: 'var(--muted)' }}>Tus conversaciones</small>
          </div>
        </Link>
      </section>

      <Toast message={toast} type="success" onClose={() => setToast('')} />
    </main>
  );
}


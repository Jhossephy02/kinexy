import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppIcon from '../components/ui/AppIcon.jsx';
import { profilesService } from '../api/client';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const destinationFor = (user) => ['superadmin', 'admin', 'moderator'].includes(user.role) ? '/admin' : user.role === 'creator' ? '/advertiser' : '/';

export default function LoginPage() {
  const navigate = useNavigate(); const location = useLocation(); const isCreatorRegister = location.pathname === '/register/creator' || (location.pathname === '/register' && new URLSearchParams(location.search).get('role') === 'creator'); const isRegister = location.pathname === '/register' || isCreatorRegister;
  const { login, register, loginWithGoogle } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', dateOfBirth: '', accepted: false, privacyAccepted: false });
  const [error, setError] = useState(''); const [pending, setPending] = useState(false); const [show, setShow] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const googleButtonRef = useRef(null);
  const googleCallbackRef = useRef(null);
  const [googleReady, setGoogleReady] = useState(Boolean(window.google?.accounts?.id));

  useEffect(() => { if (location.pathname === '/register' && new URLSearchParams(location.search).get('role') === 'creator') navigate('/register/creator', { replace: true }); }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (!googleClientId) return undefined;
    const script = document.getElementById('google-identity-script') || document.createElement('script');
    const onLoad = () => setGoogleReady(true);
    const onError = () => setGoogleError('No se pudo cargar Google. Revisa tu conexión o los bloqueadores del navegador.');
    if (window.google?.accounts?.id) setGoogleReady(true);
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!script.isConnected) { script.id = 'google-identity-script'; script.src = 'https://accounts.google.com/gsi/client'; script.async = true; document.head.appendChild(script); }
    return () => { script.removeEventListener('load', onLoad); script.removeEventListener('error', onError); };
  }, []);
  const finish = async (user) => { if (user.role === 'creator') { try { const result = await profilesService.mine(); if (!result.profiles?.length) return navigate('/advertiser?onboarding=profile'); } catch {} } if (user.role === 'client' && isCreatorRegister) return navigate('/profile?activate=creator'); navigate(destinationFor(user)); };
  const registrationReady = !isRegister || (form.accepted && form.privacyAccepted && form.dateOfBirth);
  const passwordStrong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/.test(form.password);
  async function submit(event) { event.preventDefault(); if (pending || !registrationReady) return; if (isRegister && form.password !== form.confirmPassword) return setError('Las contraseñas no coinciden.'); if (isRegister && !passwordStrong) return setError('Usa al menos 10 caracteres, mayúscula, minúscula, número y símbolo.'); setError(''); setPending(true); try { const payload = isRegister ? { name: form.name, email: form.email, password: form.password, date_of_birth: form.dateOfBirth, accepted_terms: form.accepted, accepted_privacy: form.privacyAccepted, role: isCreatorRegister ? 'creator' : 'client' } : { email: form.email, password: form.password }; await finish(isRegister ? await register(payload) : await login(payload)); } catch (err) { setError(err.message); } finally { setPending(false); } }
  async function handleGoogleCredential(response) { if (!response?.credential || !registrationReady) { setGoogleError('Completa la fecha de nacimiento y las confirmaciones antes de continuar con Google.'); return; } setGoogleError(''); setPending(true); try { await finish(await loginWithGoogle(response.credential, isCreatorRegister ? 'creator' : 'client', isRegister ? { date_of_birth: form.dateOfBirth, accepted_terms: form.accepted, accepted_privacy: form.privacyAccepted } : {})); } catch (err) { setGoogleError(err.message); } finally { setPending(false); } }
  googleCallbackRef.current = handleGoogleCredential;
  useEffect(() => {
    if (!googleReady || !googleClientId || !googleButtonRef.current || !registrationReady) return;
    const google = window.google?.accounts?.id;
    if (!google) return;
    google.initialize({
      client_id: googleClientId,
      callback: (response) => googleCallbackRef.current?.(response),
      auto_select: false,
      use_fedcm_for_button: true,
      itp_support: true,
      context: isRegister ? 'signup' : 'signin'
    });
    googleButtonRef.current.replaceChildren();
    google.renderButton(googleButtonRef.current, { type: 'standard', theme: 'outline', size: 'large', text: isRegister ? 'signup_with' : 'signin_with', shape: 'rectangular', width: Math.min(420, googleButtonRef.current.clientWidth), locale: 'es' });
  }, [googleReady, isRegister, registrationReady, form.dateOfBirth]);
  const intro = isCreatorRegister ? ['CREA TU PERFIL', 'Publica tu anuncio', 'paso a paso.', 'Completa tus datos, descripción y fotos. Durante la beta la publicación es gratuita.'] : isRegister ? ['CREA TU CUENTA', 'Explora el', 'directorio.', 'Guarda tus perfiles favoritos y desbloquea contenido con tokens.'] : ['BIENVENIDO DE NUEVO', 'Vuelve al', 'directorio.', 'Accede a tus anuncios y tokens.'];

  return <main className="login-experience refined-login" id="main-content">
    <section className="login-story"><Link to="/" className="login-brand">kinexy<span>.</span></Link><div><span className="eyebrow"><AppIcon name="sparkles"/> {intro[0]}</span><h1>{intro[1]}{' '}<br/><em>{intro[2]}</em></h1><p>{intro[3]}</p><div className="login-trust"><span><AppIcon name="shield"/>Acceso protegido</span><span><AppIcon name="heart"/>Tu comunidad</span></div></div><span className="login-monogram" aria-hidden="true">k</span><small>KINEXY / TU COMUNIDAD</small></section>
    <section className="login-panel"><Link to="/" className="login-back"><AppIcon name="back"/>Volver a explorar</Link><div className="login-form-wrap"><span className="eyebrow">{isCreatorRegister ? 'REGISTRO DE CREADORA' : isRegister ? 'REGISTRO DE CLIENTE' : 'BIENVENIDO DE NUEVO'}</span><h2>{isCreatorRegister ? <>Crea tu perfil<span>.</span></> : isRegister ? <>Crea tu cuenta<span>.</span></> : <>Entra a tu espacio<span>.</span></>}</h2><p>{isCreatorRegister ? 'Crea tu cuenta y completa tu perfil. Durante la beta se publica gratis después de la revisión.' : isRegister ? 'Regístrate para explorar y conectar con las creadoras.' : 'La misma entrada sirve para clientes y creadoras; tu cuenta determina el acceso.'}</p>
      {isRegister && <div className="auth-registration-choice"><p className="registration-type">{isCreatorRegister ? 'Estás creando una cuenta de creadora.' : 'Estás creando una cuenta de cliente.'}</p><label className="birth-date-field">Fecha de nacimiento<input type="date" required max={new Date().toISOString().slice(0,10)} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}/><small>La usamos para comprobar que tienes al menos 18 años.</small></label><label className="auth-consent"><input type="checkbox" checked={form.accepted} onChange={(e) => setForm({ ...form, accepted: e.target.checked })}/><span>Confirmo que tengo 18 años o más y acepto los <Link to="/legal">términos de uso</Link>.</span></label><label className="auth-consent"><input type="checkbox" checked={form.privacyAccepted} onChange={(e) => setForm({ ...form, privacyAccepted: e.target.checked })}/><span>He leído y acepto la <Link to="/privacy">política de privacidad</Link>.</span></label></div>}
      {isRegister && !registrationReady ? <><button type="button" className="google-auth-button" disabled><span aria-hidden="true">G</span>Continuar con Google</button><p className="google-consent-hint">Completa tu fecha de nacimiento y las dos confirmaciones para habilitar el registro.</p></> : <div className="google-button-wrap" ref={googleButtonRef} aria-label="Continuar con Google">{!googleReady && <span>{googleClientId ? 'Cargando acceso con Google…' : 'Google no está configurado'}</span>}</div>}{googleError && <p className="login-error google-inline-error" role="alert">{googleError}</p>}<div className="auth-divider"><span/>o continúa con tu correo<span/></div>
      <form onSubmit={submit}>{isRegister && <label>Nombre<div className="login-input"><AppIcon name="user"/><input autoComplete="name" required maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Cómo quieres que te llamemos"/></div></label>}<label>Correo o usuario<div className="login-input"><AppIcon name="user"/><input name="username" type={isRegister ? 'email' : 'text'} autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={isRegister ? 'tu@correo.com' : 'Tu correo o nombre de usuario'}/></div></label><label htmlFor="account-password">Contraseña<div className="password-field login-input"><AppIcon name="lock"/><input id="account-password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={isRegister ? 10 : undefined} maxLength="72" type={show ? 'text' : 'password'} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={isRegister ? '10+ caracteres, número y símbolo' : 'Tu contraseña'}/><button type="button" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={show} onClick={() => setShow(!show)}><AppIcon name={show ? 'eyeOff' : 'eye'}/><span>{show ? 'Ocultar' : 'Ver'}</span></button></div></label>{isRegister && <><div className={`password-strength ${passwordStrong ? 'is-strong' : ''}`}><i/><span>{passwordStrong ? 'Contraseña segura' : 'Incluye mayúscula, minúscula, número y símbolo'}</span></div><label>Confirmar contraseña<div className="login-input"><AppIcon name="lock"/><input type={show ? 'text' : 'password'} autoComplete="new-password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Repite tu contraseña"/></div></label></>}{error && <p className="login-error" role="alert">{error}</p>}<button className="login-submit" type="submit" disabled={pending || !registrationReady}>{pending ? <><span className="button-spinner"/>{isRegister ? 'Creando…' : 'Entrando…'}</> : <>{isRegister ? 'Crear cuenta segura' : 'Iniciar sesión'}<AppIcon name="arrow"/></>}</button></form>
      <p className="auth-switch">{isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Inicia sesión' : 'Regístrate como cliente'}</Link></p>{!isRegister && <p className="auth-switch">¿Quieres publicar? <Link to="/register/creator">Crear cuenta de creadora</Link></p>}{isRegister && <p className="auth-switch">{isCreatorRegister ? '¿Solo quieres explorar?' : '¿Quieres publicar un anuncio?'} <Link to={isCreatorRegister ? '/register' : '/register/creator'}>{isCreatorRegister ? 'Registro de cliente' : 'Registro de creadora'}</Link></p>}<p className="login-footnote"><AppIcon name="shield"/>Tus datos y tus tokens están protegidos.</p>
    </div></section>
  </main>;
}


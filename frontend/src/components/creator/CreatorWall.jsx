import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { contactService, profilesService } from '../../api/client';
import PostImage from './PostImage.jsx';
import './CreatorWall.css';

const photoUrl = value => /^(\/|https?:|data:)/.test(value || '');

export default function CreatorWall({ profile, posts = [], isAuthenticated, onUnlock, unlocking, engagement, onLike }) {
  const photos = [...new Set([profile.photo, ...(Array.isArray(profile.photos) ? profile.photos : [])].filter(photoUrl))];
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [resolvedPostUrls, setResolvedPostUrls] = useState({});
  const [contact, setContact] = useState(null);
  const [contactError, setContactError] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(() => { try { return JSON.parse(localStorage.getItem('kinexy_saved') || '[]').map(Number).includes(Number(profile.id)); } catch { return false; } });
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: '' });
  const [reviewStatus, setReviewStatus] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ reason: 'Información incorrecta', details: '' });
  const [reportStatus, setReportStatus] = useState('');
  const hasContact = profile.contact_whatsapp_enabled || profile.contact_telegram_enabled;
  useEffect(() => {
    setSelected(0); setLightbox(null); setResolvedPostUrls({}); setContact(null); setContactError('');
    if (!hasContact || !isAuthenticated) return;
    let active = true;
    contactService.status(profile.id).then(result => { if (active) setContact(result); }).catch(error => { if (active) setContactError(error.message); });
    return () => { active = false; };
  }, [profile.id, hasContact, isAuthenticated]);
  useEffect(() => {
    let active = true;
    profilesService.reviews(profile.id).then(result => { if (active) { setReviews(result.reviews || []); setReviewSummary(result.summary || { average: 0, count: 0 }); } }).catch(() => {});
    return () => { active = false; };
  }, [profile.id]);
  async function unlockContact() {
    if (pending) return;
    setPending(true); setContactError('');
    try { setContact(await contactService.unlock(profile.id)); window.dispatchEvent(new Event('kinexy-wallet-updated')); }
    catch (error) { setContactError(error.message); }
    finally { setPending(false); }
  }
  function toggleSaved() {
    let values = []; try { values = JSON.parse(localStorage.getItem('kinexy_saved') || '[]').map(Number); } catch {}
    values = saved ? values.filter(id => id !== Number(profile.id)) : [...new Set([...values, Number(profile.id)])];
    localStorage.setItem('kinexy_saved', JSON.stringify(values)); setSaved(!saved);
  }
  async function submitReview(event) {
    event.preventDefault(); setReviewStatus('Enviando…');
    try { await profilesService.addReview(profile.id, reviewForm); const result = await profilesService.reviews(profile.id); setReviews(result.reviews || []); setReviewSummary(result.summary || { average: 0, count: 0 }); setReviewForm({ rating: 5, text: '' }); setReviewStatus('Tu opinión quedó publicada.'); }
    catch (error) { setReviewStatus(error.message); }
  }
  async function submitReport(event) {
    event.preventDefault(); setReportStatus('Enviando…');
    try { await profilesService.report(profile.id, reportForm); setReportStatus('Reporte enviado al equipo de moderación.'); setReportOpen(false); }
    catch (error) { setReportStatus(error.message); }
  }
  const price = contact?.price_tokens ?? profile.contact_price_tokens ?? 10;
  const paid = posts.filter(post => post.type === 'photo' || post.type === 'gallery' || post.type === 'video');
  useEffect(() => { const close = event => { if (event.key === 'Escape') setLightbox(null); }; window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close); }, []);
  const openImage = (url, alt) => setLightbox({ url, alt });

  return <article className="creator-wall directory-detail">
    <nav className="detail-tabs" aria-label="Secciones del anuncio"><a href="#galeria">Galería</a><a href="#descripcion">Sobre mí</a><a href="#informacion">Información</a><a href="#contenido">Publicaciones</a><a href="#opiniones">Opiniones ({reviewSummary.count})</a></nav>
    <div className="detail-gallery" id="galeria">
      <div className="detail-featured">{photos[selected] ? <button className="detail-photo-open" onClick={() => openImage(photos[selected], `Foto ${selected + 1} de ${profile.name}`)} aria-label="Ampliar foto"><img src={photos[selected]} alt={`Foto ${selected + 1} de ${profile.name}`} /><span>⌕ Ampliar</span></button> : <div className="detail-no-photo">Sin foto pública</div>}</div>
      {photos.length > 1 && <div className="detail-thumbs" aria-label="Fotos del perfil">{photos.map((url, index) => <button key={url} className={index === selected ? 'selected' : ''} onClick={() => setSelected(index)} aria-label={`Ver foto ${index + 1}`}><img src={url} alt="" loading="lazy" /></button>)}</div>}
    </div>
    <div className="detail-info">
      <span className="detail-category">{profile.category || 'Anuncio'}</span><h1>{profile.name}</h1>
      <p className="detail-location">◎ {profile.city}{profile.area ? ` · ${profile.area}` : ''}</p>
      <div className="detail-actions"><button className={saved ? 'active' : ''} onClick={toggleSaved}>{saved ? '♥ Guardado' : '♡ Guardar anuncio'}</button>{isAuthenticated && <button className={engagement?.liked ? 'active' : ''} onClick={onLike}>{engagement?.liked ? '♥ Me gusta' : '♡ Me gusta'} · {engagement?.likes || 0}</button>}<span className="detail-views">◉ {engagement?.views || 0} vistas</span>{isAuthenticated ? <button onClick={() => setReportOpen(value => !value)}>⚑ Reportar</button> : <Link to="/login">Inicia sesión para reportar</Link>}</div>
      {reportOpen && <form className="detail-report" onSubmit={submitReport}><label>Motivo<select value={reportForm.reason} onChange={event => setReportForm(current => ({ ...current, reason: event.target.value }))}><option>Información incorrecta</option><option>Contenido no autorizado</option><option>Posible fraude</option><option>Riesgo o seguridad</option><option>Otro</option></select></label><label>Detalle opcional<textarea maxLength="800" value={reportForm.details} onChange={event => setReportForm(current => ({ ...current, details: event.target.value }))} /></label><button>Enviar reporte</button></form>}
      {reportStatus && <p className="detail-feedback" role="status">{reportStatus}</p>}
      <div className="detail-facts">{[
        ['Edad', Number(profile.age) >= 18 ? `${profile.age} años` : 'No indicada'],
        ['Tarifa', profile.show_price !== false && profile.price ? profile.price : 'A consultar'],
        ['Horario', profile.schedule || 'A coordinar'],
        ['Tipo', profile.identity || profile.category || 'No indicado']
      ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      {profile.description && <section className="detail-description" id="descripcion"><h2>Sobre este perfil</h2><p>{profile.description}</p></section>}
      {profile.services && <section className="detail-description" id="informacion"><h2>Información adicional</h2><p>{profile.services}</p></section>}
    </div>
    {(profile.owner_id || hasContact) && <div className="detail-access">
      {profile.owner_id && <section className="detail-booking"><span>CONTACTO SEGURO</span><h2>Solicitar disponibilidad</h2><p>Consulta horario, tarifa y disponibilidad en un chat privado. El primer mensaje requiere un aporte único de 10 tokens al creador.</p>{isAuthenticated ? <Link to={`/messages?partner_id=${profile.owner_id}`}>Solicitar servicio · abrir chat →</Link> : <Link to="/login">Inicia sesión para solicitar →</Link>}</section>}
      {hasContact && <section className="detail-contact"><h2>Contacto directo</h2><p>Accede a {profile.contact_whatsapp_enabled && 'WhatsApp'}{profile.contact_whatsapp_enabled && profile.contact_telegram_enabled && ' y '}{profile.contact_telegram_enabled && 'Telegram'} gratuitamente durante la beta.</p>
        {contact?.unlocked ? <div className="detail-contact-links">{contact.links?.whatsapp && <a href={contact.links.whatsapp} target="_blank" rel="noopener noreferrer">Abrir WhatsApp ↗</a>}{contact.links?.telegram && <a href={contact.links.telegram} target="_blank" rel="noopener noreferrer">Abrir Telegram ↗</a>}</div> : isAuthenticated ? <button onClick={unlockContact} disabled={pending}>{pending ? 'Cargando…' : 'Mostrar contacto gratuito'}</button> : <Link to="/login">Inicia sesión para ver el contacto gratuito</Link>}
        {contactError && <p role="alert">{contactError}</p>}
      </section>}
    </div>}
    <section className="detail-content" id="contenido"><h2>Fotos y videos publicados</h2><p>Las publicaciones públicas son gratuitas. Las fotos marcadas como exclusivas se desbloquean con tokens.</p>
      {paid.length ? <div className="detail-posts">{paid.map(post => <article key={post.id} className="detail-post">
        <div className="detail-post-media">{post.locked ? <div className="detail-locked"><span>Contenido protegido</span><b>{post.visibility === 'tokens' ? `${post.price_tokens} tokens` : 'Solo miembros'}</b></div> : post.media_url ? post.type === 'video' ? <PostImage src={post.media_url} type="video" alt={post.title} /> : <button className="detail-post-open" onClick={() => resolvedPostUrls[post.id] && openImage(resolvedPostUrls[post.id], post.title)} disabled={!resolvedPostUrls[post.id]} aria-label={`Ampliar ${post.title}`}><PostImage src={post.media_url} type="photo" alt={post.title} onResolved={url => setResolvedPostUrls(current => current[post.id] === url ? current : { ...current, [post.id]: url })}/><span>⌕ Ver foto</span></button> : <div className="detail-no-photo">Sin archivo disponible</div>}</div>
        <div className="detail-post-copy"><h3>{post.title}</h3>{post.caption && <p>{post.caption}</p>}{post.locked && (post.visibility === 'tokens' ? isAuthenticated ? <button onClick={() => onUnlock(post)} disabled={unlocking === post.id}>{unlocking === post.id ? 'Procesando…' : `Desbloquear · ${post.price_tokens} tokens`}</button> : <Link to="/login">Inicia sesión para desbloquear</Link> : <Link to={isAuthenticated ? '/memberships' : '/login'}>Consultar acceso</Link>)}</div>
      </article>)}</div> : <div className="detail-empty">Todavía no hay publicaciones.</div>}
    </section>
    {lightbox && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={() => setLightbox(null)}><button className="photo-lightbox-close" onClick={() => setLightbox(null)} aria-label="Cerrar foto">×</button><img src={lightbox.url} alt={lightbox.alt} onClick={event => event.stopPropagation()}/><p>{lightbox.alt}</p></div>}
    <section className="detail-reviews" id="opiniones"><div><span className="detail-category">EXPERIENCIAS</span><h2>Opiniones sobre {profile.name}</h2><p className="review-score">{reviewSummary.count ? <><strong>{reviewSummary.average}</strong> de 5 · {reviewSummary.count} {reviewSummary.count === 1 ? 'opinión' : 'opiniones'}</> : 'Aún no hay opiniones. Sé la primera persona en compartir una experiencia.'}</p></div>
      <div className="review-list">{reviews.map(review => <article key={review.id}><div><strong>{review.author_name}</strong><span>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div><p>{review.text}</p><time>{new Date(review.updated_at || review.created_at).toLocaleDateString('es-PE')}</time></article>)}</div>
      {isAuthenticated ? <form className="review-form" onSubmit={submitReview}><h3>Escribe tu opinión</h3><label>Calificación<select value={reviewForm.rating} onChange={event => setReviewForm(current => ({ ...current, rating: Number(event.target.value) }))}>{[5,4,3,2,1].map(value => <option key={value} value={value}>{value} estrellas</option>)}</select></label><label>Tu experiencia<textarea required minLength="10" maxLength="800" placeholder="Cuenta cómo fue tu experiencia de forma respetuosa." value={reviewForm.text} onChange={event => setReviewForm(current => ({ ...current, text: event.target.value }))} /></label><button>Publicar opinión</button>{reviewStatus && <p role="status">{reviewStatus}</p>}</form> : <Link className="review-login" to="/login">Inicia sesión para dejar una opinión</Link>}
    </section>
  </article>;
}

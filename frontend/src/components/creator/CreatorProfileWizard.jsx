import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { creatorService } from '../../api/client';
import './CreatorProfileWizard.css';

const cities = ['Pucallpa', 'Iquitos', 'Tarapoto', 'Tingo María', 'Yurimaguas'];
const categories = ['Premium', 'A Domicilio', 'Económicas', 'Maduras'];
const labels = ['Tu perfil', 'Presentación', 'Fotos', 'Confirmación'];

export default function CreatorProfileWizard({ profiles, form, setForm, submit, pending, account }) {
  const [step, setStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [photoAccess, setPhotoAccess] = useState({});
  const photos = Array.isArray(form.photos) ? form.photos : [];
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const paidPhotos = photos.filter(url => url !== form.photo && photoAccess[url]?.visibility === 'tokens').map(url => ({ url, price_tokens: Number(photoAccess[url]?.price_tokens), caption: photoAccess[url]?.caption?.trim() || '' }));
  const pricesValid = paidPhotos.every(item => Number.isInteger(item.price_tokens) && item.price_tokens >= 1 && item.price_tokens <= 10000);
  const contactPrice = Number(form.contact_price_tokens);
  const contactPriceValid = Number.isInteger(contactPrice) && contactPrice >= 1 && contactPrice <= 10000;
  const validStep = step === 0 ? Boolean(form.name?.trim() && Number(form.age) >= 18 && form.city && form.area?.trim()) : step === 1 ? Boolean(form.description?.trim() && contactPriceValid) : step === 2 ? Boolean(form.photo && photos.length && pricesValid) : adultConfirmed;

  async function uploadFiles(event) {
    const files = [...(event.target.files || [])];
    if (!files.length) return;
    if (files.length + photos.length > 12) return setError('Puedes añadir hasta 12 fotos.');
    setUploading(true); setError('');
    try {
      const uploaded = [];
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Usa imágenes JPG, PNG o WEBP.');
        const result = await creatorService.uploadImage(file);
        uploaded.push(result.url);
      }
      setForm(current => ({ ...current, photos: [...(current.photos || []), ...uploaded], photo: current.photo || uploaded[0] }));
    } catch (cause) { setError(cause.message); }
    finally { setUploading(false); event.target.value = ''; }
  }

  function removePhoto(url) {
    setForm(current => { const next = (current.photos || []).filter(item => item !== url); return { ...current, photos: next, photo: current.photo === url ? next[0] || '' : current.photo }; });
    setPhotoAccess(current => { const next = { ...current }; delete next[url]; return next; });
  }

  function updateAccess(url, patch) { setPhotoAccess(current => ({ ...current, [url]: { visibility: 'public', price_tokens: 25, caption: '', ...current[url], ...patch } })); }

  return <div className="profile-wizard-layout">
    <section className="profile-wizard">
      <header className="creator-onboarding-header">
        <div className="creator-onboarding-kicker"><span className="eyebrow">CREACIÓN DE PERFIL</span><span className="creator-onboarding-status">Paso {step + 1} de 4</span></div>
        <h2>{form.id ? 'Edita tu perfil público' : 'Crea tu perfil público'}</h2>
        <p>Tu cuenta ya está lista. Completa los datos que verá la comunidad y envía tu perfil a revisión cuando termines.</p>
        <div className="creator-account-proof"><span aria-hidden="true">✓</span><div><b>Cuenta autenticada</b><small>{account?.email || 'Tu correo protegido'}</small></div><em>1 · Cuenta</em><strong>2 · Perfil</strong><em>3 · Revisión</em></div>
      </header>
      <nav className="wizard-progress" aria-label="Pasos del perfil">{labels.map((label, index) => <button type="button" key={label} className={index === step ? 'current' : index < step ? 'done' : ''} onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={index === step ? 'step' : undefined}><b>{index < step ? '✓' : index + 1}</b><span>{label}</span></button>)}</nav>
      <form onSubmit={event => { event.preventDefault(); if (step < 3) return setStep(step + 1); if (validStep) submit(event, paidPhotos); }}>
        {step === 0 && <div className="wizard-fields"><h3>Cuéntanos cómo quieres aparecer</h3><p>Estos datos formarán la ficha pública que verán los visitantes después de la revisión.</p><label>Nombre público<input required maxLength={100} value={form.name || ''} onChange={event => set('name', event.target.value)} placeholder="Cómo quieres aparecer"/></label><label>Edad<input required type="text" inputMode="numeric" pattern="[0-9]*" min="18" max="120" value={form.age ?? 18} onChange={event => set('age', event.target.value)}/></label><label>Ciudad<select value={form.city || 'Pucallpa'} onChange={event => set('city', event.target.value)}>{cities.map(city => <option key={city}>{city}</option>)}</select></label><label>Zona o barrio<input required maxLength={100} value={form.area || ''} onChange={event => set('area', event.target.value)} placeholder="Tu zona"/></label><label>Categoría<select value={form.category || 'Premium'} onChange={event => set('category', event.target.value)}>{categories.map(category => <option key={category}>{category}</option>)}</select></label></div>}
        {step === 1 && <div className="wizard-fields"><h3>Presenta tu espacio</h3><p>Cuenta a la comunidad qué encontrará en tu perfil y cómo prefieres conectar.</p><label>Me identifico como<select value={form.identity || 'Creador/a'} onChange={event => set('identity', event.target.value)}><option>Creador/a</option><option>Creadora</option><option>Creador</option></select></label><label>Precio de referencia<input maxLength={100} value={form.price || ''} onChange={event => set('price', event.target.value)} placeholder="Opcional"/></label><label className="wizard-checkbox"><input type="checkbox" checked={form.show_price !== false} onChange={event => set('show_price', event.target.checked)}/>Mostrar precio en mi perfil</label><label>Disponibilidad<input maxLength={100} value={form.schedule || ''} onChange={event => set('schedule', event.target.value)} placeholder="Por ejemplo, tardes y fines de semana"/></label><label>Sobre mí<textarea required maxLength={3000} value={form.description || ''} onChange={event => set('description', event.target.value)} placeholder="Preséntate con tus propias palabras…"/></label><label>Qué comparto<input maxLength={250} value={form.services || ''} onChange={event => set('services', event.target.value)} placeholder="Fotos, videos, publicaciones y comunidad…"/></label><section className="wizard-contact"><h4>Contacto durante la beta</h4><p>WhatsApp y Telegram se muestran gratuitamente durante las pruebas. El aporte de tokens se conserva únicamente para abrir el chat interno.</p><label>WhatsApp (opcional)<input value={form.contact_whatsapp || ''} onChange={event => set('contact_whatsapp', event.target.value)} placeholder="51987654321"/></label><label>Telegram (opcional)<input value={form.contact_telegram || ''} onChange={event => set('contact_telegram', event.target.value)} placeholder="tuusuario"/></label><label>Acceso al contacto<input value="Gratuito durante la beta" disabled/></label></section></div>}
        {step === 2 && <div className="wizard-photos"><h3>Elige tus imágenes</h3><p>Selecciona una foto principal pública. Las demás pueden ser públicas o exclusivas con un precio en tokens.</p><label className="wizard-upload">＋ Subir fotos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadFiles} disabled={uploading}/></label><small>JPG, PNG o WEBP · hasta 12 imágenes · máximo 8 MB por archivo</small>{uploading && <p role="status">Cargando fotos…</p>}{error && <p role="alert" className="wizard-error">{error}</p>}<div className="wizard-photo-grid">{photos.map((url, index) => <article key={url} className={form.photo === url ? 'is-main' : ''}><img src={url} alt={`Foto ${index + 1} del perfil`}/><div className="wizard-photo-actions"><button type="button" onClick={() => { set('photo', url); updateAccess(url, { visibility: 'public' }); }} disabled={form.photo === url}>{form.photo === url ? 'Principal y pública ✓' : 'Hacer principal'}</button><button type="button" onClick={() => removePhoto(url)} aria-label={`Quitar foto ${index + 1}`}>Quitar</button></div>{form.photo !== url && <div className="wizard-photo-access"><label>Acceso<select value={photoAccess[url]?.visibility || 'public'} onChange={event => updateAccess(url, { visibility: event.target.value })}><option value="public">Pública y gratuita</option><option value="tokens">Exclusiva · cobrar tokens</option></select></label>{photoAccess[url]?.visibility === 'tokens' && <label>Precio en tokens<input type="text" inputMode="numeric" pattern="[0-9]*" min="1" max="10000" value={photoAccess[url]?.price_tokens ?? 25} onChange={event => updateAccess(url, { price_tokens: event.target.value })}/></label>}</div>}</article>)}</div></div>}
        {step === 3 && <div className="wizard-review"><h3>Revisa antes de enviar</h3><div className="wizard-preview">{form.photo && <img src={form.photo} alt="Foto principal"/>}<div><span>{form.category}</span><h4>{form.name}</h4><p>{form.age} años · {form.city} · {form.area}</p><p>{form.description}</p><small>{photos.length} fotos públicas · Contacto gratuito en beta · {form.show_price !== false && form.price ? form.price : 'Precio a consultar'}</small></div></div><p>El anuncio se enviará a revisión. Después de aprobarse, sus fotos y datos públicos estarán disponibles gratuitamente durante la beta.</p><label className="wizard-checkbox"><input type="checkbox" checked={adultConfirmed} onChange={event => setAdultConfirmed(event.target.checked)}/>Confirmo que soy mayor de 18 años y que tengo derecho a publicar estas fotos.</label><small>Esta confirmación no sustituye una verificación de identidad.</small></div>}
        <footer><button type="button" onClick={() => setStep(step - 1)} disabled={step === 0}>Atrás</button><button type="submit" disabled={!validStep || uploading || Boolean(pending)}>{pending === 'profile' ? 'Guardando…' : step === 3 ? form.id ? 'Guardar cambios' : 'Enviar a revisión' : 'Continuar →'}</button></footer>
      </form>
    </section>
    <aside className="wizard-side"><h3>Estado de publicación</h3><p>El equipo revisa tu perfil. Después de aprobarlo aparecerá gratis en el directorio durante la beta.</p><div><strong>{profiles.length}</strong><span>{profiles.length === 1 ? 'perfil creado' : 'perfiles creados'}</span></div>{profiles.map(item => item.approved ? <Link key={item.id} to={`/creators/${item.id}`}>{item.name} · Aprobado y visible gratis ↗</Link> : <p className="wizard-pending" key={item.id}><b>{item.name}</b><span>En revisión por el equipo. Todavía no es visible al público.</span></p>)}</aside>
  </div>;
}

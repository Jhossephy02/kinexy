import React from 'react';
import AppIcon from './AppIcon.jsx';
import './ProfileCard.css';
export default function ProfileCard({ profile, onOpen, saved = false, onSave }) {
  const hasPhoto = /^(\/|https?:|data:)/.test(profile.photo || '');
  return <article className={`profile-card directory-card plan-${profile.plan || 'basico'}`}>
    <button className="profile-open" onClick={() => onOpen(profile)} aria-label={'Ver perfil de ' + profile.name}>
      <div className={'creator-art ' + (hasPhoto ? 'has-photo' : '')} data-tone={(Number(profile.id) || 0) % 6}>{hasPhoto && <img className="creator-photo" src={profile.photo} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement.classList.remove('has-photo'); }} />}{profile.plan && profile.plan !== 'basico' ? <span className="category-badge">{profile.plan === 'premium' ? 'Premium' : 'Destacado'}</span> : profile.category && <span className="category-badge">{profile.category}</span>}<span className="art-orbit" /><span className="art-initial">{profile.name?.slice(0, 1)}</span><span className={`directory-available ${profile.online ? 'is-online' : 'is-offline'}`}><i/>{profile.online ? 'En línea' : 'Desconectada'}</span></div>
      <div className="profile-card__body"><div className="profile-card__topline"><strong>{profile.name}{profile.approved && <span className="verified-badge" aria-label="Perfil aprobado"><AppIcon name="check" size={12}/></span>}</strong><span className="creator-arrow" aria-hidden="true">↗</span></div><p>{profile.city || 'Comunidad Kinexy'}{profile.area ? ` · ${profile.area}` : ''}</p><div className="directory-card-meta"><span>{Number(profile.age) >= 18 ? `${profile.age} años` : 'Edad por confirmar'}</span><strong>{profile.show_price !== false && profile.price ? profile.price : 'Precio a consultar'}</strong></div><small>Ver perfil, fotos y publicaciones</small></div>
    </button>
    {onSave && <button className={'save-profile ' + (saved ? 'is-saved' : '')} aria-label={(saved ? 'Quitar de guardados a ' : 'Guardar a ') + profile.name} aria-pressed={saved} onClick={() => onSave(profile.id)}>{saved ? '♥' : '♡'}</button>}
  </article>;
}

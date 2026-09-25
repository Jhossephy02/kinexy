import React from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '../components/ui/AppIcon.jsx';
import './DiscoveryExtensions.css';

const categoryCopy = {
  Premium: 'Experiencias destacadas y perfiles con información completa.',
  'A Domicilio': 'Opciones con disponibilidad para coordinar según tu zona.',
  'Económicas': 'Alternativas accesibles para explorar con libertad.',
  Maduras: 'Perfiles con estilo, presencia y una comunidad propia.',
};

export function QuickDiscovery({ current, counts, onChange, onSearch }) {
  const options = [
    { id: 'active', icon: 'sparkles', title: 'Perfiles activos', copy: 'Fichas visibles', count: counts.active },
    { id: 'nearby', icon: 'map', title: 'Cerca de ti', copy: 'Explora tu ciudad', count: counts.nearby },
    { id: 'new', icon: 'history', title: 'Perfiles nuevos', copy: 'Recién publicados', count: counts.new },
  ];
  return <section className="quick-discovery" aria-label="Formas rápidas de descubrir">
    {options.map(option => <button key={option.id} className={current === option.id ? 'is-active' : ''} aria-pressed={current === option.id} onClick={() => onChange(option.id)}>
      <span className="quick-icon"><AppIcon name={option.icon} size={20} /></span>
      <span><strong>{option.title}</strong><small>{option.copy}</small></span>
      <b>{option.count}</b>
    </button>)}
    <button onClick={onSearch} className="quick-search">
      <span className="quick-icon"><AppIcon name="compass" size={20} /></span>
      <span><strong>Búsqueda precisa</strong><small>Nombre, zona o ciudad</small></span>
      <b>↗</b>
    </button>
  </section>;
}

export default function DiscoveryExtensions({ profiles, selectedCategory, onCategory, isAuthenticated }) {
  const categories = Object.keys(categoryCopy).map(name => ({
    name,
    count: profiles.filter(profile => normalizeCategory(profile.category) === normalizeCategory(name)).length,
  }));

  return <div className="discovery-extensions">
    <section className="trust-rail" aria-label="Confianza y seguridad">
      <div><AppIcon name="shield" size={21} /><span><strong>Perfiles revisados</strong><small>Publicaciones sujetas a validación</small></span></div>
      <div><AppIcon name="eye" size={21} /><span><strong>Contenido moderado</strong><small>Reglas claras para la comunidad</small></span></div>
      <div><AppIcon name="message" size={21} /><span><strong>Reportes atendidos</strong><small>Herramientas de ayuda y control</small></span></div>
    </section>

    <section className="category-explorer" aria-labelledby="category-title">
      <header><div><span className="eyebrow">EXPLORA A TU MANERA</span><h2 id="category-title">Encuentra tu categoría<span>.</span></h2></div><button className={!selectedCategory ? 'is-active' : ''} onClick={() => onCategory('')}>Ver todas</button></header>
      <div className="category-grid">{categories.map((item, index) => <button key={item.name} className={selectedCategory === item.name ? 'is-active' : ''} onClick={() => onCategory(selectedCategory === item.name ? '' : item.name)} aria-pressed={selectedCategory === item.name}>
        <span className="category-number">0{index + 1}</span><span className="category-mark" aria-hidden="true">{['✦','⌁','◇','◌'][index]}</span>
        <strong>{item.name}</strong><small>{categoryCopy[item.name]}</small><b>{item.count} {item.count === 1 ? 'perfil' : 'perfiles'} <span>↗</span></b>
      </button>)}</div>
    </section>

    <section className="discovery-guide">
      <div className="guide-copy"><span className="eyebrow">UNA EXPERIENCIA MÁS CLARA</span><h2>Conecta con confianza<span>.</span></h2><p>Kinexy reúne descubrimiento, comunidad y herramientas de control en un solo lugar.</p><ol>
        <li><b>01</b><span><strong>Explora</strong><small>Filtra por ciudad, categoría o disponibilidad.</small></span></li>
        <li><b>02</b><span><strong>Conoce el perfil</strong><small>Revisa su información y guarda tus favoritos.</small></span></li>
        <li><b>03</b><span><strong>Elige tu experiencia</strong><small>Usa membresías o tokens cuando la función lo requiera.</small></span></li>
      </ol></div>
      {isAuthenticated && <aside className="creator-callout"><span className="creator-callout-orbit" aria-hidden="true">k</span><span className="eyebrow">PARA CREADORAS Y CREADORES</span><h3>Haz crecer tu espacio.</h3><p>Publica tu perfil, administra contenido y construye una comunidad desde tu panel.</p><Link to="/advertiser">Ir al panel de creador <AppIcon name="arrow" size={17} /></Link></aside>}
    </section>

    <section className="discovery-faq" aria-labelledby="faq-title"><header><span className="eyebrow">LO ESENCIAL, SIN VUELTAS</span><h2 id="faq-title">Preguntas frecuentes<span>.</span></h2></header><div>
      <details><summary>¿Cómo encuentro perfiles en mi ciudad?<span>+</span></summary><p>Usa el selector de ciudad o el acceso “Cerca de ti”. Después puedes refinar por nombre, zona o categoría.</p></details>
      <details><summary>¿Cómo funcionan los perfiles guardados?<span>+</span></summary><p>El corazón guarda tu selección en este navegador para que puedas volver a ella rápidamente.</p></details>
      <details><summary>¿Para qué sirven los tokens?<span>+</span></summary><p>Los tokens permiten probar compras y desbloqueos dentro de Kinexy. Tu saldo aparece en la billetera de la cabecera.</p></details>
      <details><summary>¿Cómo se revisa el contenido?<span>+</span></summary><p>Las publicaciones pasan por herramientas de moderación y los usuarios pueden enviar reportes para revisión.</p></details>
    </div></section>
  </div>;
}

function normalizeCategory(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { profilesService } from '../api/client';
import { useAuth } from '../context/AuthContext';
import ProfileCard from '../components/ui/ProfileCard.jsx';
import './Directory.css';

const cities = ['Todas', 'Pucallpa', 'Iquitos', 'Tarapoto', 'Tingo María', 'Yurimaguas'];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function DiscoverPage({ city, setCity }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [area, setArea] = useState('Todas');
  const [age, setAge] = useState('Todas');
  const [sort, setSort] = useState('recent');
  const [quick, setQuick] = useState('all');
  const [savedIds, setSavedIds] = useState(() => { try { return JSON.parse(localStorage.getItem('kinexy_saved') || '[]').map(Number); } catch { return []; } });
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    profilesService.list().then(result => { if (active) setProfiles(Array.isArray(result.profiles) ? result.profiles : []); })
      .catch(() => { if (active) setError('No se pudieron cargar los anuncios.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update' && /profiles|creator\/posts/.test(event.detail?.data?.path || '')) setRetry(value => value + 1); };
    window.addEventListener('kinexy-realtime', onRealtime);
    return () => window.removeEventListener('kinexy-realtime', onRealtime);
  }, []);

  const areas = useMemo(() => [...new Set(profiles.filter(p => city === 'Todas' || p.city === city).map(p => p.area).filter(Boolean))].sort(), [profiles, city]);
  const categories = useMemo(() => [...new Set(profiles.map(p => p.category).filter(Boolean))].sort(), [profiles]);
  const visible = useMemo(() => profiles.filter(p =>
    (city === 'Todas' || p.city === city) && (area === 'Todas' || p.area === area) &&
    (quick !== 'active' || p.online) &&
    (quick !== 'new' || Number(p.id) >= Math.max(...profiles.map(item => Number(item.id) || 0), 0) - 3) &&
    (quick !== 'saved' || savedIds.includes(Number(p.id))) &&
    (category === 'Todas' || p.category === category) &&
    (age === 'Todas' || (age === '18-25' ? Number(p.age) >= 18 && Number(p.age) <= 25 : age === '26-35' ? Number(p.age) >= 26 && Number(p.age) <= 35 : Number(p.age) >= 36)) &&
    [p.name, p.area, p.city, p.description].some(value => normalize(value).includes(normalize(query)))
  ).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : Number(b.id) - Number(a.id)), [profiles, city, area, category, age, query, sort, quick, savedIds]);
  useEffect(() => { setLimit(12); }, [city, area, category, age, query, sort, quick]);
  const clear = () => { setQuery(''); setArea('Todas'); setCategory('Todas'); setAge('Todas'); setSort('recent'); setQuick('all'); };
  const toggleSaved = id => { const numeric = Number(id); const next = savedIds.includes(numeric) ? savedIds.filter(value => value !== numeric) : [...savedIds, numeric]; setSavedIds(next); localStorage.setItem('kinexy_saved', JSON.stringify(next)); };

  return <main className="discover-page directory-page" id="main-content">
    <section className="listing-intro"><div><span className="eyebrow">DIRECTORIO KINEXY</span><h1>Anuncios en {city === 'Todas' ? 'todas las ciudades' : city}</h1><p>Encuentra perfiles por ubicación y revisa gratuitamente sus fotos, descripción y formas de contacto durante la beta. Los tokens se prueban únicamente en los chats.</p></div><Link className="listing-create" to={user?.role === 'creator' ? '/advertiser?onboarding=profile' : user ? '/profile?activate=creator' : '/register/creator'}>Publicar mi anuncio →</Link></section>
    <nav className="listing-shortcuts" aria-label="Accesos rápidos">
      <button className={quick === 'active' ? 'selected' : ''} onClick={() => setQuick(quick === 'active' ? 'all' : 'active')}><b>●</b><span>En línea ahora</span><small>{profiles.filter(p => p.online).length}</small></button>
      <button onClick={() => document.querySelector('.listing-filters label:nth-child(2) select')?.focus()}><b>◎</b><span>Cerca de mí</span><small>Elige tu zona</small></button>
      <button className={quick === 'new' ? 'selected' : ''} onClick={() => { setQuick(quick === 'new' ? 'all' : 'new'); setSort('recent'); }}><b>✦</b><span>Perfiles nuevos</span><small>Últimos anuncios</small></button>
      <button className={quick === 'saved' ? 'selected' : ''} onClick={() => setQuick(quick === 'saved' ? 'all' : 'saved')}><b>♥</b><span>Mis guardados</span><small>{savedIds.length} perfiles</small></button>
    </nav>
    <section className="listing-filters" aria-label="Buscar anuncios">
      <label>Ciudad<select value={city} onChange={e => { setCity(e.target.value); setArea('Todas'); }}>{cities.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Zona<select value={area} onChange={e => setArea(e.target.value)}><option>Todas</option>{areas.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Categoría<select value={category} onChange={e => setCategory(e.target.value)}><option>Todas</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Edad<select value={age} onChange={e => setAge(e.target.value)}><option>Todas</option><option value="18-25">18 a 25</option><option value="26-35">26 a 35</option><option value="36+">36 o más</option></select></label>
      <label className="listing-search-label">Nombre o palabra clave<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar anuncios…" /></label>
    </section>
    <div className="listing-categories">{['Todas', ...categories].map(item => <button key={item} className={category === item ? 'selected' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
    <div className="listing-toolbar"><div><strong>{loading ? 'Cargando…' : `${visible.length} ${visible.length === 1 ? 'anuncio' : 'anuncios'}`}</strong><span>{city === 'Todas' ? 'Todas las ciudades' : city}</span></div><div><label>Ordenar <select value={sort} onChange={e => setSort(e.target.value)}><option value="recent">Más recientes</option><option value="name">Nombre A–Z</option></select></label><button onClick={clear}>Limpiar filtros</button></div></div>
    {error ? <div className="empty-state" role="alert"><p>{error}</p><button onClick={() => setRetry(retry + 1)}>Reintentar</button></div> : loading ? <div className="profile-grid">{[1, 2, 3, 4].map(n => <div key={n} className="profile-skeleton" />)}</div> : visible.length ? <><div className="profile-grid listing-grid">{visible.slice(0, limit).map(profile => <ProfileCard key={profile.id} profile={profile} saved={savedIds.includes(Number(profile.id))} onSave={toggleSaved} onOpen={() => navigate(`/creators/${profile.id}`)} />)}</div>{visible.length > limit && <div className="listing-more"><button onClick={() => setLimit(value => value + 12)}>Mostrar 12 anuncios más</button><span>{limit} de {visible.length}</span></div>}</> : <div className="empty-state"><h2>{quick === 'saved' ? 'Todavía no guardaste anuncios' : 'No hay anuncios con estos filtros'}</h2><p>{quick === 'saved' ? 'Pulsa el corazón de un perfil para encontrarlo aquí después.' : 'Prueba otra zona, categoría o ciudad.'}</p><button onClick={clear}>{quick === 'saved' ? 'Explorar anuncios' : 'Limpiar filtros'}</button></div>}
  </main>;
}

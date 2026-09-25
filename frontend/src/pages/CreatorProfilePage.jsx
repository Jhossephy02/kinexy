import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { postAccessService, profilesService } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CreatorWall from '../components/creator/CreatorWall.jsx';
import './CreatorProfilePage.css';

export default function CreatorProfilePage() {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [accessError, setAccessError] = useState('');
  const [unlocking, setUnlocking] = useState(null);
  useEffect(() => {
    let active = true;
    const load = () => profilesService.getById(id).then(async ({ profile: value }) => { if (!active) return; setProfile(value); if (value.owner_id) { try { const result = await api.get(`/creator/posts/${value.owner_id}`); if (active) setPosts(result.posts || []); } catch { if (active) setPosts([]); } } }).catch(err => active && setError(err.message));
    load();
    const onRealtime = (event) => { if (event.detail?.event === 'platform:update' && /profiles|creator\/posts|comments|likes/.test(event.detail?.data?.path || '')) load(); };
    window.addEventListener('kinexy-realtime', onRealtime);
    return () => { active = false; window.removeEventListener('kinexy-realtime', onRealtime); };
  }, [id]);
  async function unlockPost(post) {
    setUnlocking(post.id); setAccessError('');
    try { await postAccessService.unlock(post.id); const result = await api.get(`/creator/posts/${profile.owner_id}`); setPosts(result.posts || []); window.dispatchEvent(new Event('kinexy-wallet-updated')); }
    catch (err) { setAccessError(err.message); }
    finally { setUnlocking(null); }
  }
  if (error) return <main className="creator-profile-page"><section className="creator-profile-state"><h1>Perfil no disponible</h1><p>{error}</p><Link to="/">Volver a explorar</Link></section></main>;
  if (!profile) return <main className="creator-profile-page"><div className="creator-profile-loading">Cargando perfil…</div></main>;
  const citySlug = String(profile.city || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '-');
  return <main className="creator-profile-page"><div className="creator-profile-top"><nav aria-label="Ruta del anuncio"><Link to="/">Kinexy</Link><span>›</span><Link to={citySlug ? `/escorts/${citySlug}` : '/'}>{profile.city || 'Directorio'}</Link>{profile.area && <><span>›</span><span>{profile.area}</span></>}</nav><span>ANUNCIO KINEXY</span></div>{accessError && <p role="alert" className="post-access-error">{accessError} <Link to="/wallet">Ver saldo</Link></p>}<CreatorWall profile={profile} posts={posts} isAuthenticated={isAuthenticated} onUnlock={unlockPost} unlocking={unlocking}/></main>;
}

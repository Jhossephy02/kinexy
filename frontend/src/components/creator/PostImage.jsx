import React, { useEffect, useState } from 'react';
import AppIcon from '../ui/AppIcon.jsx';

export default function PostImage({ src, alt = '', type = 'photo' }) {
  const [url, setUrl] = useState(src?.startsWith('/api/') ? '' : src);
  useEffect(() => {
    if (!src?.startsWith('/api/')) { setUrl(src); return; }
    let active = true, objectUrl;
    fetch(src, { headers: { Authorization: `Bearer ${localStorage.getItem('kinexy_token') || ''}` } })
      .then(response => { if (!response.ok) throw new Error('Acceso denegado'); return response.blob(); })
      .then(blob => { objectUrl = URL.createObjectURL(blob); if (active) setUrl(objectUrl); else URL.revokeObjectURL(objectUrl); })
      .catch(() => active && setUrl(''));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src]);
  return url ? type === 'video' ? <video src={url} controls playsInline aria-label={alt}/> : <img src={url} alt={alt}/> : <span className="protected-media-placeholder"><AppIcon name="lock"/>Contenido protegido</span>;
}

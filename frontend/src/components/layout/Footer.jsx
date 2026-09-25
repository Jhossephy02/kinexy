import React from 'react';
export default function Footer({ onNavigate }) {
  return <footer className="footer"><div><strong>kinexy.</strong><p>Un espacio para conectar.</p></div><nav aria-label="Información"><button onClick={() => onNavigate('/legal')}>Términos y seguridad</button><button onClick={() => onNavigate('/privacy')}>Privacidad</button></nav><small>© {new Date().getFullYear()} Kinexy</small></footer>;
}

/**
 * Kinexy – Site Footer
 */
function SiteFooter({ go, setAccepted }) {
  return h('footer', { className: 'footer' },
    h('p', null, h('strong', null, 'Kinexy'), ' > MVP frontend'),
    h('nav', null,
      h('button', { onClick: () => go('about') }, 'Sobre Nosotros'),
      h('button', { onClick: () => go('private') }, 'Kinexy Private'),
      h('button', { onClick: () => go('strategy') }, 'Modelo Operativo'),
      h('button', { onClick: () => go('legal') }, 'Denunciar Contenido'),
      h('button', { onClick: () => go('legal') }, 'Términos de Uso'),
      h('button', { onClick: () => go('privacy') }, 'Política de Privacidad'),
      h('button', { onClick: () => { localStorage.removeItem('adult-ok'); setAccepted(false); } }, 'Ver aviso +18')
    ),
    h('small', null, '© 2026 Kinexy - MVP frontend demostrativo')
  );
}

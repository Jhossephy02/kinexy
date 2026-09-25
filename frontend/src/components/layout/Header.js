/**
 * Kinexy – Site Header
 */
function Brand({ compact = false }) {
  return h('button', { className: `brand ${compact ? 'brand--compact' : ''}`, onClick: () => window.dispatchEvent(new CustomEvent('go-home')), 'aria-label': 'Kinexy' },
    h('img', { className: 'brand__img', src: './assets/kinexy-logo-red.png', alt: 'Kinexy', onLoad: (e) => e.currentTarget.parentElement.classList.add('brand--has-image'), onError: (e) => e.currentTarget.style.display = 'none' }),
    h('span', { className: 'horn horn--left' }),
    h('span', { className: 'brand__text' }, 'Kinexy'),
    h('span', { className: 'horn horn--right' })
  );
}

function Header({ city, onCity, onMenu, onAccount, go }) {
  return h('header', { className: 'site-header' },
    h('div', { className: 'header__left' },
      h(Brand, { compact: true }),
      h('button', { className: 'city-button', onClick: onCity }, city, h(ChevronDown, { size: 14 }))
    ),
    h('nav', { className: 'desktop-nav' },
      h('button', { onClick: () => go('home') }, 'Inicio'),
      h('button', { onClick: () => go('private') }, 'Private'),
      h('button', { onClick: () => go('advertiser') }, 'Panel anunciante'),
      h('button', { onClick: () => go('admin') }, 'Admin'),
      h('button', { onClick: () => go('strategy') }, 'Modelo'),
      h('button', { onClick: () => go('legal') }, 'Legal')
    ),
    h('div', { className: 'header__actions' },
      h('button', { className: 'icon-button', onClick: onMenu, 'aria-label': 'Abrir menu' }, h(Menu, { size: 31 })),
      h('button', { className: 'icon-button', onClick: onAccount, 'aria-label': 'Abrir cuenta' }, h(User, { size: 29 }))
    )
  );
}

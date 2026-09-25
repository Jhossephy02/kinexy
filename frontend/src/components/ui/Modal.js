/**
 * Kinexy – Modal / CityModal Component
 */
function CityModal({ open, city, setCity, onClose }) {
  if (!open) return null;
  return h('div', { className: 'overlay', onClick: onClose },
    h('div', { className: 'city-modal', onClick: (e) => e.stopPropagation() },
      h('button', { className: 'close-button', onClick: onClose, 'aria-label': 'Cerrar' }, h(X, { size: 22 })),
      h('h2', null, 'Selecciona tu ciudad'),
      h('div', { className: 'city-list' },
        cities.map((item) => h('button', { key: item, className: item === city ? 'active' : '', onClick: () => { setCity(item); onClose(); } }, item))
      ),
      h('button', { className: 'ghost-button', onClick: onClose }, 'Cancelar')
    )
  );
}

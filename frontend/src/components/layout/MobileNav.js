/**
 * Kinexy – Bottom Navigation Bar
 */
function BottomNav({ go, setQuick }) {
  const items = [
    [Zap, 'ACTIVAS AHORA', 'available'],
    [LocateFixed, 'CERCA DE MÍ', 'near'],
    [Flame, 'PERFILES NUEVOS', 'new'],
    [Search, 'BÚSQUEDA', 'home'],
  ];
  return h('nav', { className: 'bottom-nav', 'aria-label': 'Herramientas' },
    items.map(([Icon, label, action]) => h('button', { key: label, onClick: () => { action === 'home' ? go('home') : (setQuick(action), go('home')); } }, h(Icon, { size: 28 }), h('span', null, label)))
  );
}

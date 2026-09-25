/**
 * Kinexy – ChipBar and Toolbar Components
 */
function ChipBar({ active, setFilter }) {
  return h('nav', { className: 'chips', 'aria-label': 'Categorías' },
    ['Todos', ...categories].map((chip) => h('button', { className: active === chip ? 'active' : '', onClick: () => setFilter(chip), key: chip }, chip))
  );
}

function Toolbar({ city, setCity, quick, setQuick }) {
  return h('section', { className: 'toolbar' },
    h('label', null, 'Ciudad', h('select', { value: city, onChange: (e) => setCity(e.target.value) }, cities.map((item) => h('option', { key: item }, item)))),
    h('button', { className: quick === 'available' ? 'active' : '', onClick: () => setQuick(quick === 'available' ? 'all' : 'available') }, 'Disponibles ahora'),
    h('button', { className: quick === 'new' ? 'active' : '', onClick: () => setQuick(quick === 'new' ? 'all' : 'new') }, 'Perfiles nuevos'),
    h('button', { className: quick === 'near' ? 'active' : '', onClick: () => setQuick(quick === 'near' ? 'all' : 'near') }, 'Cerca de mí')
  );
}

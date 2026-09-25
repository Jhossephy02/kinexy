/**
 * Kinexy – Badge Component
 */
function Badge({ text, variant = 'default' }) {
  return h('span', { className: `badge badge--${variant}` }, text);
}

function Stat({ label, value }) {
  return h('div', { className: 'stat' }, h('strong', null, value), h('span', null, label));
}

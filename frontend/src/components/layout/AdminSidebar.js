/**
 * Kinexy – Admin Table Component
 */
function AdminTable({ title, rows, render }) {
  return h('article', { className: 'panel admin-table' },
    h('h2', null, title),
    rows.map((row) => h('div', { className: 'admin-row', key: row.id }, render(row).map((cell, index) => h('span', { key: index }, cell))))
  );
}

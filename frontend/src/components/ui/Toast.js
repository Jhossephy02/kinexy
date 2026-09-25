/**
 * Kinexy – Toast notification (placeholder)
 */
function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;
  return h('div', { className: `toast toast--${type}`, onClick: onClose },
    h('span', null, message),
    h('button', { onClick: onClose }, '✕')
  );
}

/**
 * Kinexy – Plans Section Component
 */
function PlansSection({ go }) {
  return h('section', { className: 'plan-grid' },
    plans.map((plan) => h('article', { className: 'plan-card', key: plan.name },
      h('span', { className: 'plan-badge' }, plan.badge),
      h('h3', null, plan.name),
      h('strong', null, plan.price),
      plan.features.map((feature) => h('p', { key: feature }, feature)),
      h('button', { onClick: () => go('payments') }, 'Elegir plan')
    ))
  );
}

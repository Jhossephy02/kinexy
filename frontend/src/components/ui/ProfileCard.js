/**
 * Kinexy – Profile Card Component
 */
function ProfileCard({ profile, onOpen }) {
  return h('article', { className: `profile-card ${!profile.approved ? 'is-pending' : ''}`, onClick: () => onOpen(profile.id) },
    h('div', { className: `profile-card__image ${profile.photo}` },
      h('span', { className: 'tier' }, h(Crown, { size: 13 }), profile.tier),
      profile.price && h('span', { className: 'price' }, profile.price),
      h('span', { className: 'watermark' }, 'Kinexy'),
      h('span', { className: 'watermark-small' }, 'Kinexy'),
      profile.available && h('span', { className: 'availability' }, 'disponible', h('em', null, profile.available)),
      !profile.approved && h('span', { className: 'review-badge' }, 'en revisión')
    ),
    h('div', { className: 'profile-card__body' },
      h('div', { className: 'profile-card__topline' },
        h('strong', null, profile.name),
        h('span', { className: 'rating' }, profile.video && h(PlayCircle, { size: 15 }), h(Star, { size: 17 }), profile.rating)
      ),
      h('p', null, `${profile.age} años — ${profile.area}`)
    )
  );
}

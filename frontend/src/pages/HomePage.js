/**
 * Kinexy – Home Page
 */
function HomePaymentMethods() {
  const methods = ["Yape", "Plin", "Visa", "Mastercard", "Amex", "Diners", "Culqi", "Izipay", "Mercado Pago", "PagoEfectivo", "BCP", "Interbank"];
  const perks = [
    ["Pago manual seguro", "El anunciante sube comprobante y el admin valida antes de activar."],
    ["Planes flexibles", "Basico, Destacado, Premium y acceso Private segun objetivo."],
    ["Casi todos los medios", "Billeteras, tarjetas, transferencias y pasarelas listas para integrar."]
  ];

  return h("section", { className: "home-payments" },
    h("div", { className: "home-payments__copy" },
      h("p", { className: "eyebrow" }, "Medios de pago"),
      h("h2", null, "Contamos con casi todos los métodos de pago"),
      h("p", null, "Para que publicar o renovar un perfil sea fácil: pagos manuales con Yape/Plin/Transferencia al inicio y estructura preparada para tarjetas, Culqi, Izipay y Mercado Pago.")
    ),
    h("div", { className: "home-payments__logos" },
      methods.map((method) => h("span", { key: method, className: `pay-badge pay-badge--${method.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` }, method))
    ),
    h("div", { className: "home-payments__plus" },
      perks.map(([title, text]) => h("article", { key: title },
        h("strong", null, title),
        h("p", null, text)
      ))
    )
  );
}

function Home({ city, setCity, filter, setFilter, quick, setQuick, profiles, openProfile }) {
  const visible = React.useMemo(() => profiles.filter((profile) => {
    const cityOk = profile.city === city;
    const catOk = filter === "Todos" || profile.category === filter || profile.plan.toLowerCase() === filter.toLowerCase();
    const quickOk = quick === "all" || (quick === "available" && profile.active) || (quick === "new" && profile.fresh) || (quick === "near" && profile.near);
    return cityOk && catOk && quickOk;
  }), [city, filter, quick, profiles]);

  return h("main", { className: "page" },
    h("div", { className: "mobile-section-title" }, `PERFILES EN ${city.toUpperCase()}`),
    h("section", { className: "hero-strip hero-strip--mvp" },
      h("div", { className: "hero-strip__copy" },
        h("p", { className: "eyebrow" }, "La plataforma #1"),
        h("h1", null, "Líder en la Amazonía Peruana"),
        h("p", { className: "hero-strip__lead" }, "Tú ya nos elegiste. Miles de personas también. Perfiles verificados, discreción total y acceso Private para una experiencia premium en la selva peruana.")
      ),
      h(ChipBar, { active: filter, setFilter }),
      h(Toolbar, { city, setCity, quick, setQuick })
    ),
    h("section", { className: "stats-row" },
      h(Stat, { label: "Perfiles visibles", value: visible.length }),
      h(Stat, { label: "Disponibles ahora", value: profiles.filter((p) => p.city === city && p.active).length }),
      h(Stat, { label: "Pendientes admin", value: profiles.filter((p) => !p.approved).length })
    ),
    h("section", { className: "profile-grid", "aria-label": "Perfiles" },
      visible.map((profile) => h(ProfileCard, { profile, onOpen: openProfile, key: profile.id }))
    ),
    visible.length === 0 && h("div", { className: "empty-state" }, "No hay perfiles para este filtro. Cambia ciudad o categoría."),
    h(HomePaymentMethods, null),
    h("div", { className: "loading" }, "Cargando más perfiles...")
  );
}

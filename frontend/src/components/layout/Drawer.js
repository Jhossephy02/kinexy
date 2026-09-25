/**
 * Kinexy – Drawer Component (Menu + Account panels)
 */
function Drawer({ open, mode, onClose, go }) {
  if (!open) return null;
  return h("div", { className: "overlay overlay--right", onClick: onClose },
    h("aside", { className: "drawer", onClick: (e) => e.stopPropagation() },
      h("button", { className: "close-button drawer__close", onClick: onClose, "aria-label": "Cerrar" }, h(X, { size: 24 })),
      mode === "account" ? h(AuthPanel, { go, onClose }) : h(MenuContent, { go, onClose })
    )
  );
}

function MenuContent({ go, onClose }) {
  const links = [
    ["Inicio por ciudad", "home"],
    ["Disponibles ahora", "available"],
    ["Perfiles nuevos", "new"],
    ["Cerca de mí", "near"],
    ["Registro/Login", "auth"],
    ["Kinexy Private", "private"],
    ["Panel anunciante", "advertiser"],
    ["Panel administrador", "admin"],
    ["Modelo operativo", "strategy"],
    ["Términos y privacidad", "legal"],
  ];
  return h("div", { className: "drawer-menu" },
    h(Brand, { compact: true }),
    h("div", { className: "drawer-group" },
      h("h3", null, "Secciones principales"),
      links.map(([label, route]) => h("button", { key: label, onClick: () => { go(route); onClose(); } }, label))
    )
  );
}

function AuthPanel({ go, onClose }) {
  const [role, setRole] = React.useState("Perfil");
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [terms, setTerms] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [recoverMode, setRecoverMode] = React.useState(false);
  const roleCopy = {
    Perfil: {
      title: "Entrar a Mi Cuenta",
      userLabel: "Celular o correo",
      placeholder: "usuario@email.com",
      button: "Entrar a Mi Cuenta",
      route: "advertiser",
      helper: "Gestiona fotos, plan, pagos y estado de aprobación."
    },
    Empresa: {
      title: "Entrar como Empresa",
      userLabel: "Correo de empresa",
      placeholder: "empresa@email.com",
      button: "Entrar como Empresa",
      route: "company",
      helper: "Administra varios perfiles, renovaciones y comprobantes."
    },
    Usuario: {
      title: "Entrar como Usuario",
      userLabel: "Correo o celular",
      placeholder: "visitante@email.com",
      button: "Entrar como Usuario",
      route: "visitor",
      helper: "Consulta favoritos, citas solicitadas y denuncias enviadas."
    }
  };
  const current = roleCopy[role];
  const expectedRole = {
    Perfil: "Perfil / anunciante",
    Empresa: "Empresa",
    Usuario: "Usuario visitante"
  }[role];
  const demo = initialUsers.find((user) => user.role === expectedRole);

  const submit = async () => {
    const cleanId = identifier.trim().toLowerCase();
    if (!terms) {
      setMessage("Debes aceptar los términos y condiciones.");
      return;
    }
    try {
      const response = await fetch("http://127.0.0.1:8000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      if (response.ok) {
        const session = await response.json();
        if (session.user.role !== expectedRole) {
          setMessage(`Esta cuenta pertenece al rol ${session.user.role}. Selecciona el tab correcto.`);
          return;
        }
        if (session.user.status === "Bloqueada") {
          setMessage("Esta cuenta está bloqueada por administración.");
          return;
        }
        if (!session.user.validated) {
          setMessage("Cuenta pendiente de validación. Revisa tu correo/celular.");
          return;
        }
        localStorage.setItem("session-token", session.token);
        localStorage.setItem("session-role", session.user.role);
        localStorage.setItem("session-user", session.user.name);
        go(current.route);
        onClose();
        return;
      }
    } catch (error) {
      // Fallback a credenciales demo si el backend no está corriendo
    }
    const user = initialUsers.find((item) =>
      item.role === expectedRole &&
      (item.email.toLowerCase() === cleanId || item.phone === identifier.trim()) &&
      item.password === password
    );
    if (!user) {
      setMessage(`Credenciales incorrectas. Demo: ${demo.email} / ${demo.password}`);
      return;
    }
    if (user.status === "Bloqueada") {
      setMessage("Esta cuenta está bloqueada por administración.");
      return;
    }
    if (!user.validated) {
      setMessage("Cuenta pendiente de validación. Revisa tu correo/celular.");
      return;
    }
    localStorage.setItem("session-role", user.role);
    localStorage.setItem("session-user", user.name);
    go(current.route);
    onClose();
  };

  const recover = (e) => {
    e.preventDefault();
    setRecoverMode(true);
    setMessage(identifier ? `Enviamos recuperación a ${identifier}.` : "Ingresa tu correo o celular para recuperar la contraseña.");
  };

  return h("div", { className: "account" },
    h(Brand, { compact: true }),
    h("h2", null, current.title),
    h("div", { className: "account__tabs" },
      ["Perfil", "Empresa", "Usuario"].map((tab) => h("button", { className: role === tab ? "active" : "", key: tab, onClick: () => setRole(tab) }, tab))
    ),
    h("p", { className: "account-helper" }, current.helper),
    h("p", { className: "demo-credentials" }, `Demo: ${demo.email} o ${demo.phone} / ${demo.password}`),
    h("label", null, current.userLabel, h("input", { type: "text", value: identifier, onChange: (e) => setIdentifier(e.target.value), placeholder: current.placeholder })),
    !recoverMode && h("label", null, "Contraseña", h("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "********" })),
    h("label", { className: "terms-check" }, h("input", { type: "checkbox", checked: terms, onChange: (e) => setTerms(e.target.checked) }), "Acepto términos y condiciones"),
    message && h("strong", { className: "login-message" }, message),
    h("button", { className: "login-button", onClick: recoverMode ? () => setRecoverMode(false) : submit }, recoverMode ? "Volver al login" : current.button),
    h("a", { href: "#", className: "forgot", onClick: recover }, "¿Olvidaste tu contraseña?"),
    h("button", { className: "new-profile", onClick: () => { go("auth"); onClose(); } }, "Crear perfil / empresa")
  );
}

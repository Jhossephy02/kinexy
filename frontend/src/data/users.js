/**
 * Kinexy – Usuarios iniciales del sistema (datos semilla)
 */
const initialUsers = [
  { id: "U-001", name: "Laura", email: "perfil@demo.com", phone: "900111222", password: "perfil", role: "Perfil / anunciante", status: "Activa", validated: true, termsAccepted: true },
  { id: "U-002", name: "Agencia Centro", email: "empresa@demo.com", phone: "900222333", password: "empresa", role: "Empresa", status: "Activa", validated: true, termsAccepted: true },
  { id: "U-003", name: "Visitante Lima", email: "usuario@demo.com", phone: "900333444", password: "usuario", role: "Usuario visitante", status: "Activa", validated: true, termsAccepted: true },
  { id: "U-004", name: "Cuenta observada", email: "revision@demo.com", phone: "900444555", password: "demo", role: "Perfil / anunciante", status: "Revisión", validated: false, termsAccepted: false },
];
window.initialUsers = initialUsers;

/**
 * Kinexy – Cuentas bancarias para pagos manuales
 */
const bankAccounts = [
  { bank: "BCP", account: "191-98765432-0-88", cci: "002-191-0098765432088-53", holder: "Kinexy S.A.C." },
  { bank: "BBVA", account: "0011-0320-0200987654", cci: "011-320-000200987654-21", holder: "Kinexy S.A.C." },
  { bank: "Interbank", account: "200-3001234567", cci: "003-200-003001234567-33", holder: "Kinexy S.A.C." },
  { bank: "Banco de la Nación", account: "04-015-998877", cci: "018-000-004015998877-05", holder: "Kinexy S.A.C." },
];
window.bankAccounts = bankAccounts;

/**
 * Métodos de pago móvil
 */
const mobilePayments = [
  { name: "Yape", number: "999 888 777", type: "Manual con comprobante" },
  { name: "Plin", number: "999 888 777", type: "Manual con comprobante" },
];
window.mobilePayments = mobilePayments;

/**
 * Pasarelas de pago online
 */
const onlinePayments = [
  { name: "Culqi", type: "Pago online con tarjeta" },
  { name: "Mercado Pago", type: "Billetera y tarjeta" },
  { name: "Izipay", type: "POS/pasarela peruana" },
  { name: "Tarjeta", type: "Visa, Mastercard y débito" },
];
window.onlinePayments = onlinePayments;

/**
 * Códigos de acceso privado (demostración)
 */
const privateCodesDemo = [
  { id: "PV-001", code: "KINEXY-VIP-2026", access_type: "SUPER VIP", max_uses: 25, used_count: 0, expires_at: "30 dias", status: "Activo" },
  { id: "PV-002", code: "AMAZONIA-GOLD", access_type: "KINEXY PRIVATE", max_uses: 10, used_count: 0, expires_at: "15 dias", status: "Activo" },
  { id: "PV-003", code: "PRIVATE-BLOCKED", access_type: "SUPER VIP", max_uses: 5, used_count: 5, expires_at: "7 dias", status: "Bloqueado" },
];
window.privateCodesDemo = privateCodesDemo;

/**
 * Perfiles privados / VIP
 */
const privateProfiles = [
  { id: "vip-1", name: "Ambar", city: "Pucallpa", tier: "SUPER VIP", signal: "Acceso con codigo", photo: "photo-8" },
  { id: "vip-2", name: "Isabella", city: "Iquitos", tier: "PRIVATE", signal: "Verificacion avanzada", photo: "photo-3" },
  { id: "vip-3", name: "Renata", city: "Pucallpa", tier: "GOLD", signal: "Cliente premium", photo: "photo-5" },
];
window.privateProfiles = privateProfiles;

/**
 * Administradores del sistema
 */
const administrators = [
  { id: "A-001", name: "Administrador", email: "admin", permissions: "usuarios, perfiles, fotos, pagos, citas, mensajes, denuncias, bloqueos", active: true },
];
window.administrators = administrators;

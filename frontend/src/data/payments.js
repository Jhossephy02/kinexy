/**
 * Kinexy – Pagos iniciales (datos semilla)
 */
const initialPayments = [
  { id: "P-1042", profile: "Malena", method: "Yape", provider: "Manual", amount: "S/ 89", plan: "Destacado", status: "Pendiente" },
  { id: "P-1043", profile: "Danna", method: "Plin", provider: "Manual", amount: "S/ 49", plan: "Básico", status: "En revisión" },
  { id: "P-1044", profile: "Valentina", method: "Yape", provider: "Manual", amount: "S/ 149", plan: "Premium", status: "Aprobado" },
  { id: "P-1045", profile: "Ava Leon", method: "Tarjeta", provider: "Culqi", amount: "S/ 149", plan: "Premium", status: "Aprobado" },
  { id: "P-1046", profile: "Malena", method: "Tarjeta", provider: "Mercado Pago", amount: "S/ 89", plan: "Destacado", status: "Pendiente" },
  { id: "P-1047", profile: "Laura", method: "Tarjeta", provider: "Izipay", amount: "S/ 49", plan: "Básico", status: "En revisión" },
];
window.initialPayments = initialPayments;

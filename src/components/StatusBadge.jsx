function StatusBadge({ status }) {
  const map = {
    Activo: "bg-teal-50 text-teal-600",
    Inactivo: "bg-slate-100 text-slate-500",
    Pendiente: "bg-amber-50 text-amber-600",
    "En stock": "bg-teal-50 text-teal-600",
    Agotado: "bg-rose-50 text-rose-600",
    "Stock bajo": "bg-amber-50 text-amber-600",
    Administrador: "bg-indigo-50 text-indigo-600",
    Trabajador: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${map[status] || "bg-slate-100 text-slate-500"}`}
    >
      {status}
    </span>
  );
}

export default StatusBadge;

import { useEffect, useMemo, useState } from "react";
import { Lock, CheckCircle2, CalendarCheck, AlertTriangle } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { esAdministrador } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function hoyISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia} de ${MESES[Number(mes) - 1]} de ${anio}`;
}

function Reportes() {
  const { rol } = useAuth();
  const esAdmin = esAdministrador(rol);
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [ventasHoy, setVentasHoy] = useState({ total: 0, cantidad: 0 });
  const [cierres, setCierres] = useState([]);
  const [cerrando, setCerrando] = useState(false);
  const [confirmandoCierre, setConfirmandoCierre] = useState(false);

  const cierreDeHoy = useMemo(
    () => cierres.find((c) => c.fecha === hoyISO()),
    [cierres],
  );

  useEffect(() => {
    cargarTodo();
  }, []);

  async function cargarTodo() {
    setCargando(true);
    await Promise.all([cargarVentasHoy(), cargarCierres()]);
    setCargando(false);
  }

  async function cargarVentasHoy() {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("store_ventas")
      .select("total")
      .eq("estado", "completada")
      .gte("created_at", inicioHoy.toISOString());
    if (!error) {
      const total = data.reduce((acc, v) => acc + Number(v.total), 0);
      setVentasHoy({ total, cantidad: data.length });
    }
  }

  async function cargarCierres() {
    const { data, error } = await supabase
      .from("store_cierres_caja")
      .select("id, fecha, total_ventas, cantidad_ventas, store_usuarios(nombre_usuario)")
      .order("fecha", { ascending: false });
    if (!error) setCierres(data);
  }

  async function confirmarCierre() {
    setCerrando(true);
    const { error } = await supabase.rpc("cerrar_dia");
    setCerrando(false);
    setConfirmandoCierre(false);
    if (error) {
      console.error(error);
      toast.error(error.message || "No se pudo cerrar el día.");
      return;
    }
    toast.exito(
      `Día cerrado: S/ ${ventasHoy.total.toFixed(2)} en ${ventasHoy.cantidad} venta(s).`,
    );
    cargarCierres();
  }

  // ---------- Cierre de mes: agrupa los cierres diarios ----------
  const cierresPorMes = useMemo(() => {
    const grupos = {};
    for (const c of cierres) {
      const clave = c.fecha.slice(0, 7); // "YYYY-MM"
      if (!grupos[clave]) grupos[clave] = { clave, total: 0, dias: 0 };
      grupos[clave].total += Number(c.total_ventas);
      grupos[clave].dias += 1;
    }
    return Object.values(grupos).sort((a, b) => b.clave.localeCompare(a.clave));
  }, [cierres]);

  if (cargando) return <div className="p-6 text-slate-400">Cargando reportes...</div>;

  return (
    <div>
      <SectionHeader
        title="Reportes"
        subtitle="Cierra el día para ir armando el histórico y el cierre de mes."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Ventas de hoy" value={`S/ ${ventasHoy.total.toFixed(2)}`} />
        <StatCard label="N° de ventas hoy" value={ventasHoy.cantidad} />
        <StatCard label="Días cerrados" value={cierres.length} />
      </div>

      <div className="mb-6 rounded-xl border border-slate-100 bg-white p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck size={16} className="text-teal-600" />
          <p className="text-sm font-semibold text-slate-800">Cierre del día de hoy</p>
        </div>

        {cierreDeHoy ? (
          <div className="flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-700">
            <CheckCircle2 size={16} />
            Hoy ya se cerró: S/ {Number(cierreDeHoy.total_ventas).toFixed(2)} en{" "}
            {cierreDeHoy.cantidad_ventas} venta(s).
          </div>
        ) : esAdmin ? (
          <div>
            <p className="mb-3 text-sm text-slate-500">
              Al cerrar, queda guardado el total vendido hoy (S/ {ventasHoy.total.toFixed(2)} en{" "}
              {ventasHoy.cantidad} venta(s)). Solo se puede cerrar una vez por día.
            </p>
            <button
              onClick={() => setConfirmandoCierre(true)}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Cerrar el día
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <Lock size={14} /> Solo un administrador puede cerrar el día.
          </div>
        )}
      </div>

      <div className="mb-6">
        <p className="mb-3 text-sm font-semibold text-slate-800">Cierre de mes</p>
        {cierresPorMes.length === 0 ? (
          <EmptyState message="Todavía no hay días cerrados para armar un cierre de mes." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Mes</th>
                  <th className="px-4 py-3 font-medium">Días cerrados</th>
                  <th className="px-4 py-3 font-medium">Total del mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cierresPorMes.map((m) => {
                  const [anio, mes] = m.clave.split("-");
                  return (
                    <tr key={m.clave} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium capitalize text-slate-700">
                        {MESES[Number(mes) - 1]} {anio}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{m.dias}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        S/ {m.total.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-slate-800">Días cerrados</p>
        {cierres.length === 0 ? (
          <EmptyState message="Todavía no cerraste ningún día." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Ventas</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Cerrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cierres.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-700">{formatoFecha(c.fecha)}</td>
                    <td className="px-4 py-3 text-slate-500">{c.cantidad_ventas}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">
                      S/ {Number(c.total_ventas).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.store_usuarios?.nombre_usuario || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmación para cerrar el día */}
      {confirmandoCierre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
              <AlertTriangle size={22} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold text-slate-800">
              Cerrar el día
            </h3>
            <p className="mb-5 text-sm text-slate-500">
              ¿Cerrar el día de hoy con un total de{" "}
              <strong className="text-slate-700">
                S/ {ventasHoy.total.toFixed(2)}
              </strong>
              ? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoCierre(false)}
                disabled={cerrando}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarCierre}
                disabled={cerrando}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {cerrando ? "Cerrando..." : "Sí, cerrar el día"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reportes;

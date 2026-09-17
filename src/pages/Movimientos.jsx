import { useEffect, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { supabase } from "../supabaseClient";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";

const LIMITE = 100;

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMovimientos();
  }, []);

  async function fetchMovimientos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("store_movimientos_inventario")
      .select(
        "id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, created_at, store_productos(nombre), store_usuarios(nombre_usuario)",
      )
      .order("created_at", { ascending: false })
      .limit(LIMITE);

    if (error) {
      console.error("Error al cargar movimientos:", error);
      setError("No se pudieron cargar los movimientos.");
    } else {
      setMovimientos(data);
    }
    setLoading(false);
  }

  if (loading)
    return <div className="p-6 text-slate-400">Cargando movimientos...</div>;
  if (error) return <div className="p-6 text-rose-500">{error}</div>;

  const entradas = movimientos.filter((m) => m.tipo === "entrada").length;
  const salidas = movimientos.filter((m) => m.tipo === "salida").length;

  return (
    <div>
      <SectionHeader
        title="Movimientos"
        subtitle="Historial de entradas y salidas de inventario (los últimos 100)."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Movimientos" value={movimientos.length} />
        <StatCard label="Entradas" value={entradas} />
        <StatCard label="Salidas" value={salidas} />
      </div>

      {movimientos.length === 0 ? (
        <EmptyState message="Todavía no hay movimientos registrados. Aparecerán aquí apenas registres una entrada o salida desde Productos o desde una venta." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Stock resultante</th>
                <th className="px-4 py-3 font-medium">Motivo</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {m.store_productos?.nombre || "Producto eliminado"}
                  </td>
                  <td className="px-4 py-3">
                    {m.tipo === "entrada" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-600">
                        <ArrowUpCircle size={12} /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
                        <ArrowDownCircle size={12} /> Salida
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.cantidad}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {m.stock_anterior} → {m.stock_nuevo}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.motivo || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {m.store_usuarios?.nombre_usuario || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {formatoFecha(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Movimientos;

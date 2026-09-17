import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Award, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";

const DIAS_GRAFICO = 14;
const DIAS_TOP_PRODUCTOS = 30;

function inicioDelDia(fecha) {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function claveDia(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function etiquetaDia(clave) {
  const [, mes, dia] = clave.split("-");
  return `${dia}/${mes}`;
}

function Resumen() {
  const { usuario } = useAuth();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [ventasHoy, setVentasHoy] = useState({ total: 0, cantidad: 0 });
  const [serieVentas, setSerieVentas] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [productosStockBajo, setProductosStockBajo] = useState([]);
  const [agotados, setAgotados] = useState(0);

  useEffect(() => {
    cargarResumen();
  }, []);

  async function cargarResumen() {
    setCargando(true);
    setError(null);

    const hoy = inicioDelDia(new Date());
    const hace14 = new Date(hoy);
    hace14.setDate(hace14.getDate() - (DIAS_GRAFICO - 1));
    const hace30 = new Date(hoy);
    hace30.setDate(hace30.getDate() - DIAS_TOP_PRODUCTOS);

    const [ventasResp, itemsResp, productosResp] = await Promise.all([
      supabase
        .from("store_ventas")
        .select("total, created_at")
        .eq("estado", "completada")
        .gte("created_at", hace14.toISOString()),
      supabase
        .from("store_venta_items")
        .select("nombre_producto, cantidad, store_ventas!inner(created_at, estado)")
        .eq("store_ventas.estado", "completada")
        .gte("store_ventas.created_at", hace30.toISOString()),
      supabase.from("store_productos").select("id, nombre, stock"),
    ]);

    if (ventasResp.error || itemsResp.error || productosResp.error) {
      console.error(
        ventasResp.error || itemsResp.error || productosResp.error,
      );
      setError("No se pudo cargar el resumen.");
      setCargando(false);
      return;
    }

    // ---- Serie de ventas por día (últimos 14 días) ----
    const dias = [];
    for (let i = 0; i < DIAS_GRAFICO; i++) {
      const d = new Date(hace14);
      d.setDate(d.getDate() + i);
      dias.push(d.toISOString().slice(0, 10));
    }
    const totalesPorDia = Object.fromEntries(dias.map((d) => [d, 0]));
    let totalHoy = 0;
    let cantidadHoy = 0;
    const claveHoy = hoy.toISOString().slice(0, 10);

    for (const v of ventasResp.data) {
      const clave = claveDia(v.created_at);
      if (clave in totalesPorDia) totalesPorDia[clave] += Number(v.total);
      if (clave === claveHoy) {
        totalHoy += Number(v.total);
        cantidadHoy += 1;
      }
    }
    setVentasHoy({ total: totalHoy, cantidad: cantidadHoy });
    setSerieVentas(
      dias.map((d) => ({
        dia: etiquetaDia(d),
        ventas: Number(totalesPorDia[d].toFixed(2)),
      })),
    );

    // ---- Top productos vendidos (últimos 30 días) ----
    const porProducto = {};
    for (const it of itemsResp.data) {
      porProducto[it.nombre_producto] =
        (porProducto[it.nombre_producto] || 0) + it.cantidad;
    }
    setTopProductos(
      Object.entries(porProducto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nombre, cantidad]) => ({ nombre, cantidad })),
    );

    // ---- Inventario ----
    const productos = productosResp.data || [];
    setTotalProductos(productos.length);
    setAgotados(productos.filter((p) => p.stock === 0).length);
    setProductosStockBajo(
      productos
        .filter((p) => p.stock > 0 && p.stock <= 10)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5),
    );

    setCargando(false);
  }

  if (cargando)
    return <div className="p-6 text-slate-400">Cargando resumen...</div>;
  if (error) return <div className="p-6 text-rose-500">{error}</div>;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Hola, {usuario?.nombre_usuario || "de nuevo"} 👋
        </h2>
        <p className="text-sm text-slate-400">
          Esto es lo que está pasando hoy en tu tienda.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Ventas de hoy"
          value={`S/ ${ventasHoy.total.toFixed(2)}`}
          delta={`${ventasHoy.cantidad} venta${ventasHoy.cantidad === 1 ? "" : "s"}`}
        />
        <StatCard label="Productos en catálogo" value={totalProductos} />
        <StatCard
          label="Agotados"
          value={agotados}
          delta={agotados > 0 ? "Revisar" : undefined}
          positive={false}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-100 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-teal-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Ventas de los últimos {DIAS_GRAFICO} días
              </p>
              <p className="text-xs text-slate-400">Total vendido por día (S/)</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieVentas} margin={{ left: -20, right: 10 }}>
                <defs>
                  <linearGradient id="ventasDia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="dia"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  interval={1}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <Tooltip
                  formatter={(value) => [`S/ ${value}`, "Ventas"]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ventas"
                  stroke="#2dd4bf"
                  fill="url(#ventasDia)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <Award size={16} className="text-amber-500" />
            <p className="text-sm font-semibold text-slate-800">
              Más vendidos (30 días)
            </p>
          </div>
          {topProductos.length === 0 ? (
            <p className="text-sm text-slate-400">
              Todavía no hay ventas registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {topProductos.map((p, i) => (
                <div
                  key={p.nombre}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                      {i + 1}
                    </span>
                    {p.nombre}
                  </span>
                  <span className="font-medium text-slate-700">
                    {p.cantidad} u.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-100 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          <p className="text-sm font-semibold text-slate-800">
            Productos con stock bajo
          </p>
        </div>
        {productosStockBajo.length === 0 ? (
          <EmptyState message="Ningún producto está por debajo del mínimo. Todo en orden." />
        ) : (
          <div className="divide-y divide-slate-100">
            {productosStockBajo.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-slate-600">{p.nombre}</span>
                <span className="font-medium text-amber-600">
                  {p.stock} u. restantes
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Resumen;

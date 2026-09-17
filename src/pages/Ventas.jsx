import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CheckCircle2,
  Ban,
  Package,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { esAdministrador } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "otro", label: "Otro" },
];

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Miniatura del producto en el selector; si no hay imagen o no carga, ícono. */
function ImagenProducto({ url }) {
  const [error, setError] = useState(false);
  if (!url || error) {
    return (
      <div className="flex h-20 w-full items-center justify-center rounded-lg bg-slate-100 text-slate-300">
        <Package size={22} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-20 w-full rounded-lg object-cover"
      onError={() => setError(true)}
    />
  );
}

function Ventas() {
  const { rol, usuario } = useAuth();
  const toast = useToast();
  const esAdmin = esAdministrador(rol);

  const [tab, setTab] = useState("nueva"); // "nueva" | "historial"

  // Catálogo para la venta
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]); // [{producto_id, nombre, precio, cantidad, stock}]
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [guardando, setGuardando] = useState(false);
  const [errorVenta, setErrorVenta] = useState("");
  const [recibo, setRecibo] = useState(null); // venta recién confirmada, para mostrar

  // Historial
  const [ventas, setVentas] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [rangoFecha, setRangoFecha] = useState("hoy"); // "hoy" | "7dias" | "todo"

  useEffect(() => {
    fetchProductos();
  }, []);

  useEffect(() => {
    if (tab === "historial") fetchVentas();
  }, [tab]);

  async function fetchProductos() {
    const { data, error } = await supabase
      .from("store_productos")
      .select("id, nombre, precio, stock, imagen_url, categoria_id, store_categorias(nombre)")
      .order("nombre", { ascending: true });
    if (!error) setProductos(data);
  }

  async function fetchVentas() {
    setCargandoHistorial(true);
    const { data, error } = await supabase
      .from("store_ventas")
      .select(
        "id, total, metodo_pago, estado, created_at, store_usuarios(nombre_usuario), store_venta_items(count)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setVentas(data);
    setCargandoHistorial(false);
  }

  // ---------- Carrito ----------

  // Catálogo organizado por categoría (como en el mostrador físico:
  // "arriba Snacks, abajo Bebidas"), filtrado por lo que se escriba
  // en el buscador. Las categorías vacías tras filtrar se ocultan.
  const gruposFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const filtrados = texto
      ? productos.filter((p) => p.nombre.toLowerCase().includes(texto))
      : productos;

    const porCategoria = {};
    for (const p of filtrados) {
      const nombreCat = p.store_categorias?.nombre || "Sin categoría";
      (porCategoria[nombreCat] ||= []).push(p);
    }

    const nombres = Object.keys(porCategoria)
      .filter((n) => n !== "Sin categoría")
      .sort((a, b) => a.localeCompare(b, "es"));
    if (porCategoria["Sin categoría"]) nombres.push("Sin categoría");

    return nombres.map((nombre) => ({ nombre, productos: porCategoria[nombre] }));
  }, [productos, busqueda]);

  function agregarAlCarrito(producto) {
    if (producto.stock <= 0) return;
    setCarrito((prev) => {
      const existente = prev.find((l) => l.producto_id === producto.id);
      if (existente) {
        if (existente.cantidad >= producto.stock) return prev;
        return prev.map((l) =>
          l.producto_id === producto.id
            ? { ...l, cantidad: l.cantidad + 1 }
            : l,
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          precio: Number(producto.precio),
          stock: producto.stock,
          cantidad: 1,
        },
      ];
    });
  }

  function cambiarCantidad(producto_id, delta) {
    setCarrito((prev) =>
      prev
        .map((l) =>
          l.producto_id === producto_id
            ? { ...l, cantidad: Math.min(l.stock, Math.max(1, l.cantidad + delta)) }
            : l,
        )
        .filter(Boolean),
    );
  }

  function quitarDelCarrito(producto_id) {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== producto_id));
  }

  const total = useMemo(
    () => carrito.reduce((acc, l) => acc + l.precio * l.cantidad, 0),
    [carrito],
  );

  async function confirmarVenta() {
    if (carrito.length === 0) return;
    setGuardando(true);
    setErrorVenta("");

    const items = carrito.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
    }));

    const { data, error } = await supabase.rpc("registrar_venta", {
      p_metodo_pago: metodoPago,
      p_items: items,
    });

    setGuardando(false);

    if (error) {
      console.error(error);
      setErrorVenta(error.message || "No se pudo registrar la venta.");
      return;
    }

    setRecibo({
      id: data,
      items: carrito,
      total,
      metodoPago,
      fecha: new Date().toISOString(),
    });
    setCarrito([]);
    fetchProductos();
  }

  async function anularVenta(venta) {
    if (!confirm("¿Anular esta venta? Se repondrá el stock vendido."))
      return;
    const { error } = await supabase.rpc("anular_venta", {
      p_venta_id: venta.id,
    });
    if (error) {
      console.error(error);
      toast.error(error.message || "No se pudo anular la venta.");
      return;
    }
    toast.exito("Venta anulada.");
    fetchVentas();
  }

  const ventasFiltradas = useMemo(() => {
    if (rangoFecha === "todo") return ventas;
    const ahora = Date.now();
    const limite =
      rangoFecha === "hoy" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    return ventas.filter((v) => {
      const fecha = new Date(v.created_at).getTime();
      return rangoFecha === "hoy"
        ? fecha >= inicioHoy.getTime()
        : ahora - fecha <= limite;
    });
  }, [ventas, rangoFecha]);

  return (
    <div>
      <SectionHeader
        title="Ventas"
        subtitle="Registra una venta rápida y descuenta el stock automáticamente."
      />

      <div className="mb-5 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setTab("nueva")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "nueva"
              ? "border-b-2 border-slate-800 text-slate-800"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Nueva venta
        </button>
        <button
          onClick={() => setTab("historial")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "historial"
              ? "border-b-2 border-slate-800 text-slate-800"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Historial
        </button>
      </div>

      {tab === "nueva" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Selector visual: catálogo organizado por categoría */}
          <div className="lg:col-span-3">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <Search size={16} className="text-slate-400" />
              <input
                autoFocus
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full text-sm text-slate-600 outline-none placeholder:text-slate-400"
              />
            </div>

            {gruposFiltrados.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                {productos.length === 0
                  ? "Todavía no hay productos en el catálogo."
                  : "Ningún producto coincide con la búsqueda."}
              </p>
            ) : (
              <div className="max-h-[65vh] space-y-5 overflow-y-auto pr-1">
                {gruposFiltrados.map((grupo) => (
                  <div key={grupo.nombre}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {grupo.nombre}
                    </h4>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {grupo.productos.map((p) => (
                        <button
                          key={p.id}
                          disabled={p.stock <= 0}
                          onClick={() => agregarAlCarrito(p)}
                          className="flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-white p-2.5 text-left hover:border-teal-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ImagenProducto url={p.imagen_url} />
                          <div className="w-full">
                            <p className="truncate text-sm font-medium text-slate-700">
                              {p.nombre}
                            </p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-600">
                                S/ {Number(p.precio).toFixed(2)}
                              </span>
                              <span
                                className={
                                  p.stock <= 0
                                    ? "text-rose-500"
                                    : "text-slate-400"
                                }
                              >
                                {p.stock <= 0 ? "Agotado" : `Stock: ${p.stock}`}
                              </span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carrito */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-700">
                <ShoppingCart size={16} />
                <h3 className="text-sm font-semibold">Venta actual</h3>
              </div>

              {carrito.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Todavía no agregaste productos.
                </p>
              ) : (
                <div className="space-y-3">
                  {carrito.map((l) => (
                    <div
                      key={l.producto_id}
                      className="flex items-center justify-between gap-2 border-b border-slate-50 pb-3 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {l.nombre}
                        </p>
                        <p className="text-xs text-slate-400">
                          S/ {l.precio.toFixed(2)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => cambiarCantidad(l.producto_id, -1)}
                          className="rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-6 text-center text-sm font-medium text-slate-700">
                          {l.cantidad}
                        </span>
                        <button
                          onClick={() => cambiarCantidad(l.producto_id, 1)}
                          disabled={l.cantidad >= l.stock}
                          className="rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-40"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <span className="w-16 text-right text-sm font-medium text-slate-700">
                        S/ {(l.precio * l.cantidad).toFixed(2)}
                      </span>
                      <button
                        onClick={() => quitarDelCarrito(l.producto_id)}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-medium text-slate-500">
                  Total
                </span>
                <span className="text-xl font-semibold text-slate-800">
                  S/ {total.toFixed(2)}
                </span>
              </div>

              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {errorVenta && (
                <p className="mt-2 text-sm text-rose-500">{errorVenta}</p>
              )}

              <button
                onClick={confirmarVenta}
                disabled={carrito.length === 0 || guardando}
                className="mt-3 w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {guardando ? "Registrando..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "historial" && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            {[
              { value: "hoy", label: "Hoy" },
              { value: "7dias", label: "Últimos 7 días" },
              { value: "todo", label: "Todo" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRangoFecha(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  rangoFecha === opt.value
                    ? "bg-slate-900 text-white"
                    : "bg-white text-slate-500 border border-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {cargandoHistorial ? (
            <p className="p-6 text-slate-400">Cargando historial...</p>
          ) : ventasFiltradas.length === 0 ? (
            <EmptyState message="No hay ventas registradas en este rango de fechas." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Método</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    {esAdmin && (
                      <th className="px-4 py-3 font-medium text-right">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ventasFiltradas.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-500">
                        {formatoFecha(v.created_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {v.store_usuarios?.nombre_usuario || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {v.store_venta_items?.[0]?.count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize">
                        {v.metodo_pago}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        S/ {Number(v.total).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={
                            v.estado === "anulada" ? "Inactivo" : "Activo"
                          }
                        />
                      </td>
                      {esAdmin && (
                        <td className="px-4 py-3 text-right">
                          {v.estado === "completada" && (
                            <button
                              onClick={() => anularVenta(v)}
                              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50"
                            >
                              <Ban size={13} /> Anular
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Recibo de la venta recién confirmada */}
      {recibo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-2 text-teal-600">
              <CheckCircle2 size={20} />
              <h3 className="text-base font-semibold text-slate-800">
                Venta registrada
              </h3>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {formatoFecha(recibo.fecha)} ·{" "}
              {usuario?.nombre_usuario || "Vendedor"}
            </p>
            <div className="mb-3 space-y-1.5 border-y border-slate-100 py-3 text-sm">
              {recibo.items.map((l) => (
                <div key={l.producto_id} className="flex justify-between">
                  <span className="text-slate-600">
                    {l.cantidad} × {l.nombre}
                  </span>
                  <span className="text-slate-700">
                    S/ {(l.precio * l.cantidad).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mb-4 flex justify-between text-base font-semibold text-slate-800">
              <span>Total</span>
              <span>S/ {recibo.total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setRecibo(null)}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Ventas;

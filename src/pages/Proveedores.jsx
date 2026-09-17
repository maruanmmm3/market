import { useEffect, useMemo, useState } from "react";
import {
  Truck,
  Pencil,
  Trash2,
  MoreVertical,
  Search,
  Plus,
  Minus,
  ShoppingBag,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { esAdministrador } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import EmptyState from "../components/EmptyState";

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Proveedores() {
  const { rol } = useAuth();
  const esAdmin = esAdministrador(rol);
  const toast = useToast();

  const [tab, setTab] = useState("proveedores"); // "proveedores" | "compra" | "historial"

  // ---------- Proveedores ----------
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [modalProveedor, setModalProveedor] = useState(null); // null | "crear" | proveedor
  const [formProveedor, setFormProveedor] = useState({ nombre: "", contacto: "" });
  const [errorForm, setErrorForm] = useState("");
  const [guardandoForm, setGuardandoForm] = useState(false);

  // ---------- Registrar compra ----------
  const [productos, setProductos] = useState([]);
  const [proveedorCompra, setProveedorCompra] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]); // [{producto_id, nombre, cantidad, costo_unitario}]
  const [guardandoCompra, setGuardandoCompra] = useState(false);
  const [errorCompra, setErrorCompra] = useState("");
  const [compraConfirmada, setCompraConfirmada] = useState(null);

  // ---------- Historial ----------
  const [compras, setCompras] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  useEffect(() => {
    fetchProveedores();
    fetchProductos();
  }, []);

  useEffect(() => {
    if (tab === "historial") fetchCompras();
  }, [tab]);

  async function fetchProveedores() {
    setLoading(true);
    const { data, error } = await supabase
      .from("store_proveedores")
      .select("id, nombre, contacto")
      .order("nombre", { ascending: true });
    if (!error) setProveedores(data);
    setLoading(false);
  }

  async function fetchProductos() {
    const { data, error } = await supabase
      .from("store_productos")
      .select("id, nombre, stock, tipo_venta")
      .order("nombre", { ascending: true });
    // stock es numeric en la base y llega como texto (ej. "10.500").
    if (!error) setProductos(data.map((p) => ({ ...p, stock: Number(p.stock) })));
  }

  async function fetchCompras() {
    setCargandoHistorial(true);
    const { data, error } = await supabase
      .from("store_compras")
      .select(
        "id, total, created_at, store_proveedores(nombre), store_usuarios(nombre_usuario), store_compra_items(count)",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error) setCompras(data);
    setCargandoHistorial(false);
  }

  // ---------- CRUD proveedor ----------

  function abrirCrearProveedor() {
    setFormProveedor({ nombre: "", contacto: "" });
    setErrorForm("");
    setModalProveedor("crear");
  }

  function abrirEditarProveedor(p) {
    setMenuAbierto(null);
    setFormProveedor({ nombre: p.nombre, contacto: p.contacto || "" });
    setErrorForm("");
    setModalProveedor(p);
  }

  async function handleGuardarProveedor(e) {
    e.preventDefault();
    const nombre = formProveedor.nombre.trim();
    if (!nombre) return setErrorForm("El nombre es obligatorio.");

    setGuardandoForm(true);
    setErrorForm("");

    const payload = { nombre, contacto: formProveedor.contacto.trim() || null };
    const editando = modalProveedor && modalProveedor !== "crear";
    const query = editando
      ? supabase.from("store_proveedores").update(payload).eq("id", modalProveedor.id)
      : supabase.from("store_proveedores").insert(payload);

    const { error } = await query;
    setGuardandoForm(false);

    if (error) {
      console.error(error);
      setErrorForm("No se pudo guardar el proveedor.");
      return;
    }
    toast.exito(editando ? "Proveedor actualizado." : "Proveedor creado.");
    setModalProveedor(null);
    fetchProveedores();
  }

  async function handleEliminarProveedor(p) {
    setMenuAbierto(null);
    if (!confirm(`¿Eliminar al proveedor "${p.nombre}"?`)) return;
    const { error } = await supabase.from("store_proveedores").delete().eq("id", p.id);
    if (error) {
      console.error(error);
      toast.error("No se pudo eliminar (puede tener compras registradas).");
      return;
    }
    toast.exito("Proveedor eliminado.");
    fetchProveedores();
  }

  // ---------- Carrito de compra ----------

  const resultadosBusqueda = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return [];
    return productos.filter((p) => p.nombre.toLowerCase().includes(texto)).slice(0, 8);
  }, [productos, busqueda]);

  function agregarAlCarrito(producto) {
    setCarrito((prev) => {
      if (prev.find((l) => l.producto_id === producto.id)) return prev;
      return [
        ...prev,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          tipo_venta: producto.tipo_venta,
          cantidad: 1,
          costo_unitario: "",
        },
      ];
    });
    setBusqueda("");
  }

  function actualizarLinea(producto_id, campo, valor) {
    setCarrito((prev) =>
      prev.map((l) => (l.producto_id === producto_id ? { ...l, [campo]: valor } : l)),
    );
  }

  function quitarDelCarrito(producto_id) {
    setCarrito((prev) => prev.filter((l) => l.producto_id !== producto_id));
  }

  const totalCompra = useMemo(
    () =>
      carrito.reduce(
        (acc, l) => acc + (Number(l.costo_unitario) || 0) * (Number(l.cantidad) || 0),
        0,
      ),
    [carrito],
  );

  async function confirmarCompra() {
    if (!proveedorCompra) {
      setErrorCompra("Selecciona un proveedor.");
      return;
    }
    if (carrito.length === 0) {
      setErrorCompra("Agrega al menos un producto.");
      return;
    }
    for (const l of carrito) {
      if (!(Number(l.cantidad) > 0) || !(Number(l.costo_unitario) >= 0)) {
        setErrorCompra(`Revisa la cantidad y el costo de "${l.nombre}".`);
        return;
      }
    }

    setGuardandoCompra(true);
    setErrorCompra("");

    const items = carrito.map((l) => ({
      producto_id: l.producto_id,
      cantidad: Number(l.cantidad),
      costo_unitario: Number(l.costo_unitario),
    }));

    const { data, error } = await supabase.rpc("registrar_compra", {
      p_proveedor_id: proveedorCompra,
      p_items: items,
    });

    setGuardandoCompra(false);

    if (error) {
      console.error(error);
      setErrorCompra(error.message || "No se pudo registrar la compra.");
      return;
    }

    setCompraConfirmada({ id: data, items: carrito, total: totalCompra });
    setCarrito([]);
    setProveedorCompra("");
    fetchProductos();
  }

  if (loading) return <div className="p-6 text-slate-400">Cargando...</div>;

  return (
    <div>
      <SectionHeader
        title="Proveedores"
        subtitle="Registra tus proveedores y las compras que reponen el stock."
      />

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { value: "proveedores", label: "Proveedores" },
          { value: "compra", label: "Registrar compra" },
          { value: "historial", label: "Historial de compras" },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.value
                ? "border-b-2 border-slate-800 text-slate-800"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "proveedores" && (
        <div>
          {esAdmin && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={abrirCrearProveedor}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
              >
                <Plus size={16} /> Nuevo proveedor
              </button>
            </div>
          )}

          {proveedores.length === 0 ? (
            <EmptyState message="Aún no hay proveedores registrados." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {proveedores.map((p) => (
                <div
                  key={p.id}
                  className="relative flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                      <Truck size={18} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{p.nombre}</p>
                      <p className="text-xs text-slate-400">{p.contacto || "Sin contacto"}</p>
                    </div>
                  </div>
                  {esAdmin && (
                    <div className="relative">
                      <button
                        className="rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                        onClick={() => setMenuAbierto(menuAbierto === p.id ? null : p.id)}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuAbierto === p.id && (
                        <div className="absolute right-0 top-9 z-10 w-36 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-lg">
                          <button
                            onClick={() => abrirEditarProveedor(p)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button
                            onClick={() => handleEliminarProveedor(p)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50"
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "compra" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <select
              value={proveedorCompra}
              onChange={(e) => setProveedorCompra(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-600"
            >
              <option value="">Selecciona un proveedor…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>

            <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <Search size={16} className="text-slate-400" />
              <input
                placeholder="Buscar producto por nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full text-sm text-slate-600 outline-none placeholder:text-slate-400"
              />
            </div>

            {busqueda && (
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                {resultadosBusqueda.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400">Ningún producto coincide.</p>
                ) : (
                  resultadosBusqueda.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => agregarAlCarrito(p)}
                      className="flex w-full items-center justify-between border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                    >
                      <p className="text-sm font-medium text-slate-700">{p.nombre}</p>
                      <span className="text-xs text-slate-400">Stock: {p.stock}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {proveedores.length === 0 && (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                Primero crea un proveedor en la pestaña "Proveedores".
              </p>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-700">
                <ShoppingBag size={16} />
                <h3 className="text-sm font-semibold">Compra actual</h3>
              </div>

              {carrito.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">
                  Busca productos y agrégalos a la compra.
                </p>
              ) : (
                <div className="space-y-3">
                  {carrito.map((l) => (
                    <div key={l.producto_id} className="border-b border-slate-50 pb-3 last:border-0">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-slate-700">{l.nombre}</p>
                        <button
                          onClick={() => quitarDelCarrito(l.producto_id)}
                          className="text-slate-300 hover:text-rose-500"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {(() => {
                            const esPorPeso = l.tipo_venta === "peso";
                            const paso = esPorPeso ? 0.1 : 1;
                            const minimo = esPorPeso ? 0.001 : 1;
                            return (
                              <>
                                <button
                                  onClick={() =>
                                    actualizarLinea(
                                      l.producto_id,
                                      "cantidad",
                                      Math.max(minimo, Number(l.cantidad || minimo) - paso),
                                    )
                                  }
                                  className="rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"
                                >
                                  <Minus size={13} />
                                </button>
                                <input
                                  type="number"
                                  min={minimo}
                                  step={esPorPeso ? "0.001" : "1"}
                                  value={l.cantidad}
                                  onChange={(e) =>
                                    actualizarLinea(l.producto_id, "cantidad", e.target.value)
                                  }
                                  className="w-16 rounded-md border border-slate-200 px-2 py-1 text-center text-sm"
                                />
                                <button
                                  onClick={() =>
                                    actualizarLinea(
                                      l.producto_id,
                                      "cantidad",
                                      Number(l.cantidad || 0) + paso,
                                    )
                                  }
                                  className="rounded-md bg-slate-100 p-1 text-slate-500 hover:bg-slate-200"
                                >
                                  <Plus size={13} />
                                </button>
                              </>
                            );
                          })()}
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Costo c/u"
                          value={l.costo_unitario}
                          onChange={(e) =>
                            actualizarLinea(l.producto_id, "costo_unitario", e.target.value)
                          }
                          className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-medium text-slate-500">Total</span>
                <span className="text-xl font-semibold text-slate-800">
                  S/ {totalCompra.toFixed(2)}
                </span>
              </div>

              {errorCompra && <p className="mt-2 text-sm text-rose-500">{errorCompra}</p>}

              <button
                onClick={confirmarCompra}
                disabled={guardandoCompra}
                className="mt-3 w-full rounded-lg bg-sky-600 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {guardandoCompra ? "Registrando..." : "Confirmar compra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "historial" && (
        <div>
          {cargandoHistorial ? (
            <p className="p-6 text-slate-400">Cargando historial...</p>
          ) : compras.length === 0 ? (
            <EmptyState message="Todavía no registraste ninguna compra." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Registrado por</th>
                    <th className="px-4 py-3 font-medium">Items</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {compras.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-500">{formatoFecha(c.created_at)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        {c.store_proveedores?.nombre || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.store_usuarios?.nombre_usuario || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {c.store_compra_items?.[0]?.count ?? 0}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">
                        S/ {Number(c.total).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal crear/editar proveedor */}
      {modalProveedor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              {modalProveedor === "crear" ? "Nuevo proveedor" : "Editar proveedor"}
            </h3>
            <form onSubmit={handleGuardarProveedor} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Nombre del proveedor"
                value={formProveedor.nombre}
                onChange={(e) => setFormProveedor({ ...formProveedor, nombre: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Contacto (teléfono o correo, opcional)"
                value={formProveedor.contacto}
                onChange={(e) => setFormProveedor({ ...formProveedor, contacto: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {errorForm && <p className="text-sm text-rose-500">{errorForm}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalProveedor(null)}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoForm}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {guardandoForm ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmación de compra */}
      {compraConfirmada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-base font-semibold text-slate-800">Compra registrada</h3>
            <div className="mb-3 space-y-1.5 border-y border-slate-100 py-3 text-sm">
              {compraConfirmada.items.map((l) => (
                <div key={l.producto_id} className="flex justify-between">
                  <span className="text-slate-600">
                    {l.cantidad} × {l.nombre}
                  </span>
                  <span className="text-slate-700">
                    S/ {(Number(l.costo_unitario) * Number(l.cantidad)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mb-4 flex justify-between text-base font-semibold text-slate-800">
              <span>Total</span>
              <span>S/ {compraConfirmada.total.toFixed(2)}</span>
            </div>
            <button
              onClick={() => setCompraConfirmada(null)}
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

export default Proveedores;

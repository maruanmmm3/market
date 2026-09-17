import { useEffect, useMemo, useState } from "react";
import { Package, Pencil, Trash2, ArrowUpDown, Search } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { esAdministrador } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";

const FORM_VACIO = {
  nombre: "",
  precio: "",
  stock: "",
  categoria_id: "",
  imagen_url: "",
  tipo_venta: "unidad",
};

function estadoDe(stock) {
  if (stock === 0) return "Agotado";
  if (stock <= 10) return "Stock bajo";
  return "En stock";
}

function formatoStock(producto) {
  return producto.tipo_venta === "peso"
    ? `${producto.stock.toFixed(3)} kg`
    : producto.stock;
}

/** Miniatura del producto; si no hay imagen o no carga, muestra el ícono. */
function ImagenProducto({ url }) {
  const [error, setError] = useState(false);
  if (!url || error) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Package size={20} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className="h-11 w-11 shrink-0 rounded-lg object-cover"
      onError={() => setError(true)}
    />
  );
}

function Productos() {
  const { rol } = useAuth();
  const toast = useToast();
  const esAdmin = esAdministrador(rol);

  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Búsqueda y filtros
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");

  // Modal de movimiento
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [tipoMovimiento, setTipoMovimiento] = useState("entrada");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);

  // Modal de crear/editar producto
  const [modalForm, setModalForm] = useState(null); // null | "crear" | producto a editar
  const [form, setForm] = useState(FORM_VACIO);
  const [guardandoForm, setGuardandoForm] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  useEffect(() => {
    fetchProductos();
    fetchCategorias();
  }, []);

  async function fetchProductos() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("store_productos")
      .select("*, store_categorias(id, nombre)")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar productos:", error);
      setError("No se pudieron cargar los productos.");
    } else {
      // stock es numeric en la base y Supabase lo devuelve como texto
      // (ej. "10.500"); se normaliza a número apenas se lee.
      setProductos(data.map((p) => ({ ...p, stock: Number(p.stock) })));
    }
    setLoading(false);
  }

  async function fetchCategorias() {
    const { data, error } = await supabase
      .from("store_categorias")
      .select("id, nombre")
      .order("nombre", { ascending: true });
    if (!error) setCategorias(data);
  }

  // ---------- Movimiento de stock ----------

  const registrarMovimiento = async (
    productoId,
    tipo,
    cantidad,
    stockActual,
    motivo,
  ) => {
    const stockNuevo =
      tipo === "entrada" ? stockActual + cantidad : stockActual - cantidad;

    if (stockNuevo < 0) {
      toast.error("No hay suficiente stock para esta salida.");
      return false;
    }

    const { error } = await supabase
      .from("store_movimientos_inventario")
      .insert({
        producto_id: productoId,
        tipo,
        cantidad,
        stock_anterior: stockActual,
        stock_nuevo: stockNuevo,
        motivo,
        usuario_id: (await supabase.auth.getUser()).data.user?.id,
      });

    if (error) {
      console.error(error);
      return false;
    }
    return true;
  };

  const handleGuardarMovimiento = async (e) => {
    e.preventDefault();
    if (!productoSeleccionado || !cantidad) return;

    setGuardandoMovimiento(true);
    const ok = await registrarMovimiento(
      productoSeleccionado.id,
      tipoMovimiento,
      Number(cantidad),
      productoSeleccionado.stock,
      motivo,
    );
    setGuardandoMovimiento(false);

    if (ok) {
      toast.exito(
        tipoMovimiento === "entrada"
          ? "Entrada registrada."
          : "Salida registrada.",
      );
      cerrarModalMovimiento();
      fetchProductos();
    }
  };

  const abrirModalMovimiento = (producto) => {
    setProductoSeleccionado(producto);
    setTipoMovimiento("entrada");
    setCantidad("");
    setMotivo("");
  };

  const cerrarModalMovimiento = () => setProductoSeleccionado(null);

  // ---------- Crear / editar producto ----------

  function abrirCrear() {
    setForm(FORM_VACIO);
    setErrorForm("");
    setModalForm("crear");
  }

  function abrirEditar(producto) {
    setForm({
      nombre: producto.nombre,
      precio: producto.precio,
      stock: producto.stock,
      categoria_id: producto.categoria_id || "",
      imagen_url: producto.imagen_url || "",
      tipo_venta: producto.tipo_venta || "unidad",
    });
    setErrorForm("");
    setModalForm(producto);
  }

  function cerrarModalForm() {
    setModalForm(null);
  }

  async function handleGuardarProducto(e) {
    e.preventDefault();
    const nombre = form.nombre.trim();
    const precio = Number(form.precio);
    const stock = Number(form.stock);

    const esPorPeso = form.tipo_venta === "peso";

    if (!nombre) return setErrorForm("El nombre es obligatorio.");
    if (!(precio >= 0)) return setErrorForm("El precio no es válido.");
    if (esPorPeso) {
      if (!(stock >= 0)) return setErrorForm("El stock inicial no es válido.");
    } else if (!Number.isInteger(stock) || stock < 0) {
      return setErrorForm("El stock inicial no es válido.");
    }

    setGuardandoForm(true);
    setErrorForm("");

    const payload = {
      nombre,
      precio,
      categoria_id: form.categoria_id || null,
      imagen_url: form.imagen_url.trim() || null,
    };

    const editando = modalForm && modalForm !== "crear";
    const query = editando
      ? supabase.from("store_productos").update(payload).eq("id", modalForm.id)
      : supabase
          .from("store_productos")
          .insert({ ...payload, stock, tipo_venta: form.tipo_venta });

    const { error } = await query;
    setGuardandoForm(false);

    if (error) {
      console.error(error);
      setErrorForm("No se pudo guardar el producto.");
      return;
    }

    toast.exito(editando ? "Producto actualizado." : "Producto creado.");
    cerrarModalForm();
    fetchProductos();
  }

  async function handleEliminarProducto(producto) {
    if (
      !confirm(
        `¿Eliminar "${producto.nombre}"? Esta acción no se puede deshacer.`,
      )
    )
      return;

    const { error } = await supabase
      .from("store_productos")
      .delete()
      .eq("id", producto.id);

    if (error) {
      console.error(error);
      toast.error(
        "No se pudo eliminar el producto (puede tener movimientos o ventas registradas).",
      );
      return;
    }
    toast.exito("Producto eliminado.");
    fetchProductos();
  }

  // ---------- Filtros ----------

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return (productos || []).filter((p) => {
      if (texto && !p.nombre.toLowerCase().includes(texto)) return false;
      if (filtroCategoria && p.categoria_id !== filtroCategoria) return false;
      if (filtroEstado && estadoDe(p.stock) !== filtroEstado) return false;
      return true;
    });
  }, [productos, busqueda, filtroCategoria, filtroEstado]);

  const agotados = (productos || []).filter((p) => p.stock === 0).length;

  if (loading)
    return <div className="p-6 text-slate-400">Cargando productos...</div>;
  if (error) return <div className="p-6 text-rose-500">{error}</div>;

  return (
    <div>
      <SectionHeader
        title="Productos"
        subtitle="Catálogo de productos disponibles en la tienda."
        actionLabel={esAdmin ? "Añadir producto" : undefined}
        onAction={abrirCrear}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total productos" value={productos.length} />
        <StatCard
          label="Agotados"
          value={agotados}
          delta={agotados > 0 ? "Revisar" : undefined}
          positive={false}
        />
        <StatCard
          label="Con stock bajo"
          value={productos.filter((p) => p.stock > 0 && p.stock <= 10).length}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex flex-1 min-w-[180px] items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            placeholder="Buscar producto..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full text-sm text-slate-600 outline-none placeholder:text-slate-400"
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
        >
          <option value="">Todos los estados</option>
          <option value="En stock">En stock</option>
          <option value="Stock bajo">Stock bajo</option>
          <option value="Agotado">Agotado</option>
        </select>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          message={
            productos.length === 0
              ? "Aún no hay productos registrados. Añade el primero para verlo aquí."
              : "Ningún producto coincide con la búsqueda o los filtros."
          }
        />
      ) : (
        <>
          {/* Vista de tabla: solo desde md hacia arriba */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-100 bg-white md:block">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="text-sm uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-4 font-medium">Producto</th>
                  <th className="px-5 py-4 font-medium">Categoría</th>
                  <th className="px-5 py-4 font-medium">Precio</th>
                  <th className="px-5 py-4 font-medium">Stock</th>
                  <th className="px-5 py-4 font-medium">Estado</th>
                  <th className="px-5 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <ImagenProducto url={p.imagen_url} />
                        <span className="font-medium text-slate-700">
                          {p.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {p.store_categorias?.nombre || "Sin categoría"}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      S/ {Number(p.precio).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatoStock(p)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={estadoDe(p.stock)} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button
                          className="rounded-md p-2.5 hover:bg-emerald-50 hover:text-emerald-600"
                          title="Registrar movimiento"
                          onClick={() => abrirModalMovimiento(p)}
                        >
                          <ArrowUpDown size={18} />
                        </button>
                        {esAdmin && (
                          <>
                            <button
                              className="rounded-md p-2.5 hover:bg-slate-100 hover:text-slate-600"
                              title="Editar"
                              onClick={() => abrirEditar(p)}
                            >
                              <Pencil size={18} />
                            </button>
                            <button
                              className="rounded-md p-2.5 hover:bg-rose-50 hover:text-rose-500"
                              title="Eliminar"
                              onClick={() => handleEliminarProducto(p)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Vista de tarjetas: solo en celular (debajo de md) */}
          <div className="space-y-3 md:hidden">
            {lista.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-100 bg-white p-4"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ImagenProducto url={p.imagen_url} />
                    <div>
                      <p className="font-medium text-slate-700">{p.nombre}</p>
                      <p className="text-sm text-slate-500">
                        {p.store_categorias?.nombre || "Sin categoría"}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={estadoDe(p.stock)} />
                </div>

                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Precio:{" "}
                    <span className="font-medium text-slate-700">
                      S/ {Number(p.precio).toFixed(2)}
                    </span>
                  </span>
                  <span className="text-slate-500">
                    Stock:{" "}
                    <span className="font-medium text-slate-700">
                      {formatoStock(p)}
                    </span>
                  </span>
                </div>

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <button
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 active:bg-emerald-100"
                    onClick={() => abrirModalMovimiento(p)}
                  >
                    <ArrowUpDown size={16} /> Movimiento
                  </button>
                  {esAdmin && (
                    <>
                      <button
                        className="flex items-center justify-center rounded-lg bg-slate-100 p-2.5 text-slate-600 active:bg-slate-200"
                        onClick={() => abrirEditar(p)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="flex items-center justify-center rounded-lg bg-rose-50 p-2.5 text-rose-500 active:bg-rose-100"
                        onClick={() => handleEliminarProducto(p)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de movimiento de inventario */}
      {productoSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-1 text-base font-semibold text-slate-800">
              Registrar movimiento
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              {productoSeleccionado.nombre} — Stock actual:{" "}
              <strong>{formatoStock(productoSeleccionado)}</strong>
            </p>

            <form onSubmit={handleGuardarMovimiento} className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoMovimiento("entrada")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    tipoMovimiento === "entrada"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setTipoMovimiento("salida")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    tipoMovimiento === "salida"
                      ? "border-rose-500 bg-rose-50 text-rose-700"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  Salida
                </button>
              </div>

              <input
                type="number"
                step={productoSeleccionado.tipo_venta === "peso" ? "0.001" : "1"}
                min={productoSeleccionado.tipo_venta === "peso" ? "0.001" : "1"}
                required
                placeholder={
                  productoSeleccionado.tipo_venta === "peso"
                    ? "Cantidad (kg)"
                    : "Cantidad"
                }
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalMovimiento}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoMovimiento}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {guardandoMovimiento ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de crear/editar producto */}
      {modalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              {modalForm === "crear" ? "Añadir producto" : "Editar producto"}
            </h3>

            <form onSubmit={handleGuardarProducto} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Nombre del producto"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />

              <select
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({ ...form, categoria_id: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-500">
                  Manejo de inventario
                </p>
                <div className="flex gap-2">
                  {[
                    { value: "unidad", label: "Por unidad" },
                    { value: "peso", label: "Por peso (kg)" },
                  ].map((opcion) => (
                    <button
                      key={opcion.value}
                      type="button"
                      disabled={modalForm !== "crear"}
                      onClick={() =>
                        setForm({ ...form, tipo_venta: opcion.value })
                      }
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
                        form.tipo_venta === opcion.value
                          ? "border-sky-500 bg-sky-50 text-sky-700"
                          : "border-slate-200 text-slate-500"
                      }`}
                    >
                      {opcion.label}
                    </button>
                  ))}
                </div>
                {modalForm !== "crear" && (
                  <p className="mt-1 text-xs text-slate-400">
                    El manejo de inventario no se puede cambiar después de
                    crear el producto.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    form.tipo_venta === "peso" ? "Precio por kg (S/)" : "Precio (S/)"
                  }
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  step={form.tipo_venta === "peso" ? "0.001" : "1"}
                  min="0"
                  placeholder={
                    form.tipo_venta === "peso"
                      ? "Stock inicial (kg)"
                      : "Stock inicial"
                  }
                  value={form.stock}
                  disabled={modalForm !== "crear"}
                  title={
                    modalForm !== "crear"
                      ? "El stock se ajusta con movimientos de inventario"
                      : undefined
                  }
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="url"
                  placeholder="URL de imagen (opcional)"
                  value={form.imagen_url}
                  onChange={(e) =>
                    setForm({ ...form, imagen_url: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                {form.imagen_url.trim() && (
                  <img
                    src={form.imagen_url.trim()}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.visibility = "visible";
                    }}
                  />
                )}
              </div>

              {errorForm && <p className="text-sm text-rose-500">{errorForm}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cerrarModalForm}
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
    </div>
  );
}

export default Productos;

import { useEffect, useState } from "react";
import { Tags, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { esAdministrador } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import EmptyState from "../components/EmptyState";

const COLORES = [
  "bg-teal-50 text-teal-600",
  "bg-orange-50 text-orange-500",
  "bg-indigo-50 text-indigo-500",
  "bg-pink-50 text-pink-500",
  "bg-amber-50 text-amber-600",
  "bg-sky-50 text-sky-600",
];

function colorDe(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORES[hash % COLORES.length];
}

function Categorias() {
  const { rol } = useAuth();
  const esAdmin = esAdministrador(rol);
  const toast = useToast();

  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal crear/editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState(null); // null = creando
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  // Menú de acciones por tarjeta (solo una abierta a la vez)
  const [menuAbierto, setMenuAbierto] = useState(null);

  useEffect(() => {
    fetchCategorias();
  }, []);

  async function fetchCategorias() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("store_categorias")
      .select("id, nombre, store_productos(count)")
      .order("nombre", { ascending: true });

    if (error) {
      console.error("Error al cargar categorías:", error);
      setError("No se pudieron cargar las categorías.");
    } else {
      setCategorias(data);
    }
    setLoading(false);
  }

  function abrirCrear() {
    setCategoriaEditando(null);
    setNombre("");
    setErrorForm("");
    setModalAbierto(true);
  }

  function abrirEditar(cat) {
    setMenuAbierto(null);
    setCategoriaEditando(cat);
    setNombre(cat.nombre);
    setErrorForm("");
    setModalAbierto(true);
  }

  function cerrarModal() {
    setModalAbierto(false);
    setCategoriaEditando(null);
  }

  async function handleGuardar(e) {
    e.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      setErrorForm("El nombre es obligatorio.");
      return;
    }

    setGuardando(true);
    setErrorForm("");

    const query = categoriaEditando
      ? supabase
          .from("store_categorias")
          .update({ nombre: nombreLimpio })
          .eq("id", categoriaEditando.id)
      : supabase.from("store_categorias").insert({ nombre: nombreLimpio });

    const { error } = await query;
    setGuardando(false);

    if (error) {
      console.error(error);
      setErrorForm(
        error.code === "23505"
          ? "Ya existe una categoría con ese nombre."
          : "No se pudo guardar la categoría.",
      );
      return;
    }

    toast.exito(categoriaEditando ? "Categoría actualizada." : "Categoría creada.");
    cerrarModal();
    fetchCategorias();
  }

  async function handleEliminar(cat) {
    setMenuAbierto(null);
    const enUso = cat.store_productos?.[0]?.count > 0;
    if (enUso) {
      toast.error(
        `No se puede eliminar "${cat.nombre}": todavía tiene productos asignados.`,
      );
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;

    const { error } = await supabase
      .from("store_categorias")
      .delete()
      .eq("id", cat.id);

    if (error) {
      console.error(error);
      toast.error("No se pudo eliminar la categoría.");
      return;
    }
    toast.exito("Categoría eliminada.");
    fetchCategorias();
  }

  if (loading)
    return <div className="p-6 text-slate-400">Cargando categorías...</div>;
  if (error) return <div className="p-6 text-rose-500">{error}</div>;

  return (
    <div>
      <SectionHeader
        title="Categorías"
        subtitle="Organiza los productos de tu tienda por categoría."
        actionLabel={esAdmin ? "Nueva categoría" : undefined}
        onAction={abrirCrear}
      />

      {categorias.length === 0 ? (
        <EmptyState message="Aún no hay categorías. Crea la primera para poder clasificar tus productos." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((cat) => (
            <div
              key={cat.id}
              className="relative flex items-center justify-between rounded-xl border border-slate-100 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorDe(cat.id)}`}
                >
                  <Tags size={18} />
                </div>
                <div>
                  <p className="font-medium text-slate-700">{cat.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {cat.store_productos?.[0]?.count ?? 0} productos
                  </p>
                </div>
              </div>

              {esAdmin && (
                <div className="relative">
                  <button
                    className="rounded-md p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                    onClick={() =>
                      setMenuAbierto(menuAbierto === cat.id ? null : cat.id)
                    }
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuAbierto === cat.id && (
                    <div className="absolute right-0 top-9 z-10 w-36 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-lg">
                      <button
                        onClick={() => abrirEditar(cat)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(cat)}
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

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              {categoriaEditando ? "Editar categoría" : "Nueva categoría"}
            </h3>
            <form onSubmit={handleGuardar} className="space-y-3">
              <input
                type="text"
                autoFocus
                placeholder="Nombre de la categoría"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              {errorForm && (
                <p className="text-sm text-rose-500">{errorForm}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cerrarModal}
                  className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Categorias;

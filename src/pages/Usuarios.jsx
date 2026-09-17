import { useEffect, useMemo, useState } from "react";
import { Search, Copy, Eye, EyeOff, Users as UsersIcon } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ROLES, ETIQUETA_ROL } from "../utils/permisos";
import SectionHeader from "../components/SectionHeader";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import EmptyState from "../components/EmptyState";

function initials(nombre = "") {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Usuarios() {
  const { usuario: yo } = useAuth();
  const toast = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [guardandoId, setGuardandoId] = useState(null);
  const [tienda, setTienda] = useState(null);
  const [mostrarCodigo, setMostrarCodigo] = useState(false);

  useEffect(() => {
    fetchUsuarios();
    fetchTienda();
  }, []);

  async function fetchTienda() {
    const { data, error } = await supabase
      .from("store_tiendas")
      .select("nombre, codigo_invitacion")
      .single();
    if (!error) setTienda(data);
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(tienda.codigo_invitacion);
      toast.exito("Código copiado.");
    } catch {
      toast.error("No se pudo copiar. Copia el código manualmente.");
    }
  }

  async function fetchUsuarios() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("store_usuarios")
      .select("id, nombre, nombre_usuario, email, rol, created_at")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error al cargar usuarios:", error);
      setError("No se pudieron cargar los usuarios.");
    } else {
      setUsuarios(data);
    }
    setLoading(false);
  }

  async function cambiarRol(usuarioId, nuevoRol) {
    setGuardandoId(usuarioId);
    const { error } = await supabase
      .from("store_usuarios")
      .update({ rol: nuevoRol })
      .eq("id", usuarioId);
    setGuardandoId(null);

    if (error) {
      console.error(error);
      toast.error("No se pudo cambiar el rol de este usuario.");
      return;
    }
    setUsuarios((prev) =>
      prev.map((u) => (u.id === usuarioId ? { ...u, rol: nuevoRol } : u)),
    );
    toast.exito("Rol actualizado.");
  }

  const lista = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nombre?.toLowerCase().includes(texto) ||
        u.nombre_usuario?.toLowerCase().includes(texto) ||
        u.email?.toLowerCase().includes(texto),
    );
  }, [usuarios, busqueda]);

  const administradores = usuarios.filter(
    (u) => u.rol === ROLES.ADMINISTRADOR,
  ).length;

  if (loading)
    return <div className="p-6 text-slate-400">Cargando usuarios...</div>;
  if (error) return <div className="p-6 text-rose-500">{error}</div>;

  return (
    <div>
      <SectionHeader
        title="Usuarios"
        subtitle="Administra quién tiene acceso al panel y con qué rol."
      />

      {tienda && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <UsersIcon size={18} />
            </div>
            <div>
              <p className="font-medium text-slate-700">{tienda.nombre}</p>
              <p className="text-xs text-slate-400">
                Comparte este código para que alguien más se una a tu tienda
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <button
              onClick={copiarCodigo}
              title="Copiar código"
              className="flex items-center gap-2 font-mono text-sm font-semibold tracking-widest text-slate-700 hover:text-teal-600"
            >
              {mostrarCodigo
                ? tienda.codigo_invitacion
                : "•".repeat(tienda.codigo_invitacion.length)}
              <Copy size={14} className="text-slate-400" />
            </button>
            <button
              onClick={() => setMostrarCodigo((v) => !v)}
              title={mostrarCodigo ? "Ocultar código" : "Mostrar código"}
              className="text-slate-400 hover:text-slate-600"
            >
              {mostrarCodigo ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total usuarios" value={usuarios.length} />
        <StatCard label="Administradores" value={administradores} />
        <StatCard
          label="Trabajadores"
          value={usuarios.length - administradores}
        />
      </div>

      <div className="rounded-xl border border-slate-100 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <div className="flex flex-1 min-w-45 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              placeholder="Buscar por nombre, usuario o correo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full text-sm text-slate-600 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <EmptyState message="Nadie coincide con esa búsqueda." />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Registro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lista.map((u) => {
                const esUnoMismo = u.id === yo?.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-xs font-semibold text-white">
                          {initials(u.nombre)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-700">
                            {u.nombre}{" "}
                            {esUnoMismo && (
                              <span className="text-xs font-normal text-slate-400">
                                (tú)
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            @{u.nombre_usuario} · {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {esUnoMismo ? (
                        <StatusBadge status={ETIQUETA_ROL[u.rol]} />
                      ) : (
                        <select
                          value={u.rol}
                          disabled={guardandoId === u.id}
                          onChange={(e) => cambiarRol(u.id, e.target.value)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 disabled:opacity-50"
                        >
                          <option value={ROLES.TRABAJADOR}>Trabajador</option>
                          <option value={ROLES.ADMINISTRADOR}>
                            Administrador
                          </option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatoFecha(u.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Usuarios;

import { Bell, Mail, LogOut, Menu } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { ETIQUETA_ROL } from "../utils/permisos";

/**
 * Barra superior del panel.
 * Props:
 *  - usuario: { nombre, nombre_usuario, rol } | null   (viene de store_usuarios)
 *  - onLogout: () => void                               (cerrar sesión)
 *  - onMenuClick: () => void                             (abre el sidebar en móvil)
 */
export default function Navbar({ usuario, onLogout, onMenuClick }) {
  const nombreMostrado = usuario?.nombre_usuario || usuario?.nombre || "Usuario";
  const iniciales = nombreMostrado.slice(0, 2).toUpperCase();
  const etiquetaRol = ETIQUETA_ROL[usuario?.rol];

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 md:justify-end md:px-6">
      {/* Botón hamburguesa, solo visible en móvil */}
      <button
        className="text-slate-500 md:hidden"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      <div className="flex items-center gap-3 md:gap-4">
        <button className="relative text-slate-400 hover:text-slate-600">
          <Bell size={19} />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white">
            3
          </span>
        </button>
        <button className="hidden text-slate-400 hover:text-slate-600 sm:block">
          <Mail size={19} />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-sm font-semibold text-white">
            {iniciales}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-700">{nombreMostrado}</p>
            {etiquetaRol && <StatusBadge status={etiquetaRol} />}
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}

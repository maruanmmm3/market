import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Package,
  Archive,
  Tags,
  ShoppingCart,
  Truck,
  FileBarChart,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Navbar from "./Navbar";
import Resumen from "../pages/Resumen";
import Ventas from "../pages/Ventas";
import Usuarios from "../pages/Usuarios";
import Productos from "../pages/Productos";
import Categorias from "../pages/Categorias";
import Movimientos from "../pages/Movimientos";
import Proveedores from "../pages/Proveedores";
import Reportes from "../pages/Reportes";
import { esAdministrador } from "../utils/permisos";

const NAV_ITEMS = [
  { key: "dashboard", label: "Resumen", icon: LayoutDashboard },
  { key: "ventas", label: "Ventas", icon: ShoppingCart },
  { key: "productos", label: "Productos", icon: Package },
  { key: "categorias", label: "Categorías", icon: Tags },
  { key: "inventario", label: "Movimientos", icon: Archive },
  { key: "proveedores", label: "Proveedores", icon: Truck },
  { key: "reportes", label: "Reportes", icon: FileBarChart },
  { key: "usuarios", label: "Usuarios", icon: Users, soloAdmin: true },
];

/* ------------------------------------------------------------------ */
/*  Sidebar                                                             */
/* ------------------------------------------------------------------ */

function Sidebar({ active, onSelect, isOpen, onClose, items }) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-64 shrink-0 transform bg-slate-900 transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-7">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-400 text-xl font-bold text-slate-900">
              M
            </div>
            <div className="leading-tight">
              <p className="text-xl font-bold text-white">Market</p>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Panel de control
              </p>
            </div>
          </div>
          <button
            className="text-slate-400 md:hidden"
            onClick={onClose}
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-2 space-y-1 px-3">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "border-teal-400 bg-slate-800 text-white"
                    : "border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 z-10 bg-slate-900/40 md:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard principal (sidebar de altura completa + navbar + contenido) */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const esAdmin = esAdministrador(usuario?.rol);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.soloAdmin || esAdmin),
    [esAdmin],
  );

  async function handleLogout() {
    await cerrarSesion();
    navigate("/");
  }

  const renderView = () => {
    // Un trabajador no ve "Usuarios" en el menú, pero por si queda
    // seleccionado (p. ej. cambia de rol en otra pestaña) no se
    // renderiza igual sin permiso.
    switch (active) {
      case "usuarios":
        return esAdmin ? <Usuarios /> : <Resumen />;
      case "ventas":
        return <Ventas />;
      case "productos":
        return <Productos />;
      case "categorias":
        return <Categorias />;
      case "inventario":
        return <Movimientos />;
      case "proveedores":
        return <Proveedores />;
      case "reportes":
        return <Reportes />;
      default:
        return <Resumen />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar
        active={active}
        onSelect={setActive}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={navItems}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar
          usuario={usuario}
          onLogout={handleLogout}
          onMenuClick={() => setSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{renderView()}</main>
      </div>
    </div>
  );
}

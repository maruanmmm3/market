/**
 * Matriz de permisos por rol.
 *
 * Refleja exactamente lo que ya exige la base de datos (políticas RLS
 * en Supabase): solo un administrador puede gestionar productos,
 * categorías y usuarios; ambos roles pueden ver el catálogo y
 * registrar movimientos de inventario. Esta lista es para adaptar
 * la interfaz (ocultar botones que igual la base rechazaría), no
 * reemplaza la seguridad real, que vive en las políticas RLS.
 */
export const ROLES = {
  ADMINISTRADOR: "administrador",
  TRABAJADOR: "trabajador",
};

const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: [
    "productos.crear",
    "productos.editar",
    "productos.eliminar",
    "categorias.gestionar",
    "usuarios.gestionar",
    "movimientos.registrar",
    "movimientos.ver",
  ],
  [ROLES.TRABAJADOR]: ["movimientos.registrar", "movimientos.ver"],
};

/** ¿El rol dado tiene este permiso? */
export function tienePermiso(rol, permiso) {
  return PERMISOS_POR_ROL[rol]?.includes(permiso) ?? false;
}

export function esAdministrador(rol) {
  return rol === ROLES.ADMINISTRADOR;
}

export const ETIQUETA_ROL = {
  [ROLES.ADMINISTRADOR]: "Administrador",
  [ROLES.TRABAJADOR]: "Trabajador",
};

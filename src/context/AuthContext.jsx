import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const AuthContext = createContext(undefined);

/**
 * Fuente única de la sesión y del perfil (store_usuarios, con su
 * rol incluido). Antes cada pantalla pedía la sesión y el perfil
 * por su cuenta (Home, ProtectedRoute); ahora todas leen de acá,
 * así el rol está disponible en un solo lugar apenas cambia el
 * login/logout.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = aún no se sabe
  const [usuario, setUsuario] = useState(null); // fila de store_usuarios
  const [perfilCargando, setPerfilCargando] = useState(true);

  useEffect(() => {
    let activo = true;

    async function cargarPerfil(sesionActual) {
      if (!sesionActual) {
        if (activo) {
          setUsuario(null);
          setPerfilCargando(false);
        }
        return;
      }

      if (activo) setPerfilCargando(true);

      const { data, error } = await supabase
        .from("store_usuarios")
        .select("id, nombre, nombre_usuario, email, rol")
        .eq("id", sesionActual.user.id)
        .single();

      if (!activo) return;
      if (error) {
        console.error("Error al cargar el perfil del usuario:", error);
        setUsuario(null);
      } else {
        setUsuario(data);
      }
      setPerfilCargando(false);
    }

    supabase.auth.getSession().then(({ data: { session: sesionInicial } }) => {
      if (!activo) return;
      setSession(sesionInicial);
      cargarPerfil(sesionInicial);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, sesionNueva) => {
        setSession(sesionNueva);
        cargarPerfil(sesionNueva);
      },
    );

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  const value = {
    session,
    usuario,
    rol: usuario?.rol ?? null,
    // "cargando" cubre tanto no saber aún si hay sesión, como saber
    // que hay sesión pero no haber terminado de traer el rol.
    cargando: session === undefined || (!!session && perfilCargando),
    cerrarSesion,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}

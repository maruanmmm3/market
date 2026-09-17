import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

function Login() {
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [tipoRegistro, setTipoRegistro] = useState("crear"); // "crear" | "unirse"

  const [nombre, setNombre] = useState("");
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombreTienda, setNombreTienda] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState("");

  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function limpiarMensajes() {
    setError("");
    setMensaje("");
  }

  // ---------- LOGIN ----------
  async function handleLogin(e) {
    e.preventDefault();
    limpiarMensajes();
    setLoading(true);

    // 1. Buscamos el email asociado a ese nombre_usuario
    const { data: usuario, error: usuarioError } = await supabase
      .from("store_usuarios")
      .select("email")
      .eq("nombre_usuario", nombreUsuario)
      .single();

    if (usuarioError || !usuario) {
      setError("Usuario o contraseña incorrectos");
      setLoading(false);
      return;
    }

    // 2. Iniciamos sesión con el email real
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: usuario.email,
      password,
    });

    setLoading(false);

    if (loginError) {
      setError("Usuario o contraseña incorrectos");
      return;
    }

    navigate("/home");
  }

  // ---------- REGISTRO ----------
  async function handleRegistro(e) {
    e.preventDefault();
    limpiarMensajes();
    setLoading(true);

    if (!nombre || !nombreUsuario || !email || !password) {
      setError("Completa todos los campos");
      setLoading(false);
      return;
    }
    if (tipoRegistro === "crear" && !nombreTienda.trim()) {
      setError("Ponle un nombre a tu tienda");
      setLoading(false);
      return;
    }
    if (tipoRegistro === "unirse" && !codigoInvitacion.trim()) {
      setError("Ingresa el código de invitación de tu tienda");
      setLoading(false);
      return;
    }

    // Verifica que el nombre_usuario no exista ya
    const { data: existente } = await supabase
      .from("store_usuarios")
      .select("nombre_usuario")
      .eq("nombre_usuario", nombreUsuario)
      .maybeSingle();

    if (existente) {
      setError("Ese nombre de usuario ya está en uso");
      setLoading(false);
      return;
    }

    // Crea el usuario en Supabase Auth, pasando nombre, nombre_usuario y
    // los datos de la tienda como metadata. El trigger de la base de
    // datos crea (o busca) la tienda y la fila en store_usuarios.
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          nombre_usuario: nombreUsuario,
          ...(tipoRegistro === "crear"
            ? { nombre_tienda: nombreTienda.trim() }
            : { codigo_invitacion: codigoInvitacion.trim() }),
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message.includes("Database error")
          ? "No se pudo crear la cuenta. Revisa el código de invitación."
          : signUpError.message,
      );
      return;
    }

    setMensaje(
      "Cuenta creada. Revisa tu correo para confirmar antes de iniciar sesión.",
    );
    setModo("login");
  }

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo);
    limpiarMensajes();
    setNombre("");
    setNombreUsuario("");
    setEmail("");
    setPassword("");
    setNombreTienda("");
    setCodigoInvitacion("");
    setTipoRegistro("crear");
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/home");
    });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-cyan-200 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-sky-500 rounded-full flex items-center justify-center mx-auto shadow-lg">
            <span className="text-3xl text-white">🛒</span>
          </div>
          <h2 className="text-3xl font-bold text-sky-700 mt-4">
            Market System
          </h2>
          <p className="text-gray-500 mt-2">
            {modo === "login"
              ? "Inicia sesión para continuar"
              : "Crea tu cuenta"}
          </p>
        </div>

        <div className="flex mb-6 bg-sky-50 rounded-xl p-1">
          <button
            type="button"
            onClick={() => cambiarModo("login")}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              modo === "login" ? "bg-sky-500 text-white shadow" : "text-sky-600"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => cambiarModo("registro")}
            className={`flex-1 py-2 rounded-lg font-medium transition ${
              modo === "registro"
                ? "bg-sky-500 text-white shadow"
                : "text-sky-600"
            }`}
          >
            Registrarse
          </button>
        </div>

        {modo === "registro" && (
          <div className="flex mb-5 gap-2 text-sm">
            <button
              type="button"
              onClick={() => setTipoRegistro("crear")}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-center font-medium transition ${
                tipoRegistro === "crear"
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              Crear una tienda nueva
            </button>
            <button
              type="button"
              onClick={() => setTipoRegistro("unirse")}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-center font-medium transition ${
                tipoRegistro === "unirse"
                  ? "border-sky-500 bg-sky-50 text-sky-700"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              Unirme con un código
            </button>
          </div>
        )}

        <form
          onSubmit={modo === "login" ? handleLogin : handleRegistro}
          className="space-y-5"
        >
          {modo === "registro" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                placeholder="Ingrese su nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuario
            </label>
            <input
              type="text"
              placeholder="Ingrese su usuario"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
          </div>

          {modo === "registro" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="Ingrese su correo"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          )}

          {modo === "registro" && tipoRegistro === "crear" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de tu tienda
              </label>
              <input
                type="text"
                placeholder="Ej. Bodega Don José"
                value={nombreTienda}
                onChange={(e) => setNombreTienda(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          )}

          {modo === "registro" && tipoRegistro === "unirse" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de invitación
              </label>
              <input
                type="text"
                placeholder="Te lo comparte el administrador de tu tienda"
                value={codigoInvitacion}
                onChange={(e) => setCodigoInvitacion(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl border border-sky-200 uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="Ingrese su contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition"
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-2 rounded-lg">
              {mensaje}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl shadow-lg transition duration-300 disabled:opacity-60"
          >
            {loading
              ? "Procesando..."
              : modo === "login"
                ? "Iniciar Sesión"
                : "Crear Cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;

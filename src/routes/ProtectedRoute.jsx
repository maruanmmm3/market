import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { esAdministrador } from "../utils/permisos";

/**
 * Protege una ruta: exige sesión iniciada y, si se pasa
 * `soloAdmin`, exige además que el rol sea "administrador".
 */
function ProtectedRoute({ children, soloAdmin = false }) {
  const { session, rol, cargando } = useAuth();

  if (cargando) {
    // Aún verificando sesión/rol, evita parpadeo/redirección prematura
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/" replace />;
  }

  if (soloAdmin && !esAdministrador(rol)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

export default ProtectedRoute;

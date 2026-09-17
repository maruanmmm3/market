import { Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import Login from "../pages/Login";
import ProtectedRoute from "../routes/ProtectedRoute";

// Toda la navegación dentro del panel (Resumen, Ventas, Productos,
// Categorías, Movimientos, Usuarios) ocurre dentro de Home/Dashboard
// mediante el menú lateral, no con rutas propias — es el único
// mecanismo de navegación de la app, para no mantener dos en paralelo.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default AppRoutes;

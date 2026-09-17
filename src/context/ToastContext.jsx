import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

const ToastContext = createContext(undefined);

const DURACION_MS = 3500;
const SALIDA_MS = 180;

let idSeq = 0;

/**
 * Notificaciones chicas y animadas (reemplazan al alert() del navegador
 * para confirmaciones y errores). Uso: const toast = useToast();
 * toast.exito("Producto creado."); toast.error("No se pudo guardar.");
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const quitar = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  const iniciarSalida = useCallback(
    (id) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, saliendo: true } : t)));
      setTimeout(() => quitar(id), SALIDA_MS);
    },
    [quitar],
  );

  const mostrar = useCallback(
    (mensaje, tipo) => {
      const id = ++idSeq;
      setToasts((prev) => [...prev, { id, mensaje, tipo, saliendo: false }]);
      timers.current[id] = setTimeout(() => iniciarSalida(id), DURACION_MS);
      return id;
    },
    [iniciarSalida],
  );

  const toast = useRef({
    exito: (mensaje) => mostrar(mensaje, "exito"),
    error: (mensaje) => mostrar(mensaje, "error"),
  }).current;

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border bg-white p-3.5 shadow-lg ${
              t.saliendo ? "toast-exit" : "toast-enter"
            } ${t.tipo === "error" ? "border-rose-200" : "border-teal-200"}`}
          >
            {t.tipo === "error" ? (
              <XCircle size={18} className="mt-0.5 shrink-0 text-rose-500" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-600" />
            )}
            <p className="flex-1 text-sm text-slate-700">{t.mensaje}</p>
            <button
              onClick={() => iniciarSalida(t.id)}
              className="text-slate-300 hover:text-slate-500"
              aria-label="Cerrar notificación"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}

import { Package } from "lucide-react";

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
      <Package className="mb-3 text-slate-300" size={28} />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

export default EmptyState;

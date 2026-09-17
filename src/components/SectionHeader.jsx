import { Plus } from "lucide-react";

function SectionHeader({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-base font-medium text-white shadow-sm transition hover:bg-slate-700 active:bg-slate-800 sm:w-auto"
        >
          <Plus size={20} />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default SectionHeader;

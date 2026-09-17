function StatCard({ label, value, delta, positive = true }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-semibold text-slate-800">{value}</span>
        {delta && (
          <span
            className={`text-xs font-medium ${positive ? "text-teal-500" : "text-rose-500"}`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;

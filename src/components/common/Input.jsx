export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-[#8E8878] uppercase tracking-wider">{label}</label>
      )}
      <input
        className={`
          input-elegant w-full rounded-lg px-3 py-2.5 text-sm text-[#1C1C1E]
          placeholder:text-[#C4B9A8] ${error ? 'border-red-400' : ''} ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}

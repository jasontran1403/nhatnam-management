const variants = {
  gold: 'bg-gradient-to-br from-[#C9A84C] to-[#A07830] text-white hover:from-[#E8C96E] hover:to-[#C9A84C] shadow-md hover:shadow-[0_4px_15px_rgba(201,168,76,0.4)]',
  outline: 'border-2 border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white',
  ghost: 'text-[#8E8878] hover:text-[#1C1C1E] hover:bg-[#F0EBE3]',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  secondary: 'bg-[#F0EBE3] text-[#1C1C1E] hover:bg-[#E8DDD0]',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  children, variant = 'gold', size = 'md', className = '', loading = false, disabled, ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold rounded-lg
        transition-all duration-200 ease-in-out cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  );
}

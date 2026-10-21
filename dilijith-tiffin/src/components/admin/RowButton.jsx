const TONES = {
  default: 'border-ink/25 text-ink hover:border-ink',
  success: 'border-brand text-leaf hover:bg-white',
  danger: 'border-danger/60 text-danger hover:bg-white',
};

/** Compact pill button for table actions. */
export default function RowButton({ tone = 'default', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full border px-3 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

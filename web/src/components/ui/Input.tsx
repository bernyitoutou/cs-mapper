import { InputHTMLAttributes, forwardRef } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, hint, error, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      )}
      <input
        ref={ref}
        {...props}
        className={[
          "w-full border rounded px-3 py-2 text-sm transition-colors",
          "focus:outline-none focus:border-dec-blue",
          error ? "border-red-400" : "border-border",
          className,
        ].join(" ")}
      />
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);

Input.displayName = "Input";

import { SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export function Select({ className = "", label, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      )}
      <select
        className={[
          "w-full border border-border rounded px-3 py-2 text-sm bg-white",
          "focus:outline-none focus:border-dec-blue",
          className,
        ].join(" ")}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

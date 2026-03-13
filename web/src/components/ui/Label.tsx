import { LabelHTMLAttributes } from "react";

export function Label({ className = "", children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={[
        "block text-xs font-medium text-gray-500 uppercase tracking-wide",
        className,
      ].join(" ")}
    >
      {children}
    </label>
  );
}

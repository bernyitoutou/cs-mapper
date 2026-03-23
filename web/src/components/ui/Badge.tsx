import { ReactNode } from "react";

type Variant = "default" | "blue" | "green" | "red" | "orange" | "purple" | "teal" | "gray";

const variants: Record<Variant, string> = {
  default: "bg-gray-100 text-gray-600",
  blue: "bg-dec-blue-light text-dec-blue",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  purple: "bg-purple-100 text-purple-700",
  teal: "bg-teal-100 text-teal-700",
  gray: "bg-gray-100 text-gray-500",
};

type BadgeProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full",
        variants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

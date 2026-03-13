import { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: boolean;
};

export function Card({ className = "", padding = true, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={[
        "bg-white rounded-lg border border-border",
        padding ? "p-4" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

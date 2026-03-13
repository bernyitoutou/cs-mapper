import { ReactNode } from "react";
import { getOperationMeta } from "../lib/operations";

type OperationRunSectionProps = {
  operationId: string;
  danger?: boolean;
  children: ReactNode;
};

export function OperationRunSection({
  operationId,
  danger = false,
  children,
}: OperationRunSectionProps) {
  const operation = getOperationMeta(operationId);

  return (
    <section
      className={[
        "rounded-xl border p-4 md:p-5 space-y-4",
        danger
          ? "border-red-200 bg-red-50/70"
          : "border-dec-blue/20 bg-dec-blue-light/45",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg",
            danger ? "bg-red-100 text-red-700" : "bg-white text-dec-blue",
          ].join(" ")}
        >
          {danger ? "!" : "▶"}
        </div>
        <div>
          <p
            className={[
              "text-xs font-semibold uppercase tracking-wide",
              danger ? "text-red-700" : "text-dec-blue",
            ].join(" ")}
          >
            Run Operation
          </p>
          <h2 className="text-lg font-semibold text-gray-900 mt-0.5">
            {operation ? `Run ${operation.name}` : "Run this operation"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure the inputs below, then launch the operation from this block.
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}
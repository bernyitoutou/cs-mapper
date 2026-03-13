import { useState } from "react";
import { getOperationMeta } from "../lib/operations";

type OperationOverviewProps = {
  operationId: string;
  titleClassName?: string;
};

export function OperationOverview({
  operationId,
  titleClassName = "text-gray-800",
}: OperationOverviewProps) {
  const operation = getOperationMeta(operationId);
  const [showDetails, setShowDetails] = useState(false);

  if (!operation) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{operation.icon}</span>
        <div>
          <h1 className={["text-xl font-bold", titleClassName].join(" ")}>{operation.name}</h1>
          <p className="text-sm text-gray-500">{operation.description}</p>
        </div>
      </div>

      {(operation.howItWorks?.length || operation.dataSources?.length) && (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <button
            onClick={() => setShowDetails((value) => !value)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface transition-colors cursor-pointer"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">Operation Details</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Precise behavior, execution flow, and underlying data sources.
              </p>
            </div>
            <span className="text-xs text-gray-400">{showDetails ? "Hide" : "Show"}</span>
          </button>

          {showDetails && (
            <div className="grid gap-3 border-t border-border p-4 lg:grid-cols-2 bg-surface/30">
              {operation.howItWorks && operation.howItWorks.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    How It Works
                  </h2>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
                    {operation.howItWorks.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {operation.dataSources && operation.dataSources.length > 0 && (
                <div className="rounded-lg border border-border bg-white p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Based On
                  </h2>
                  <ul className="mt-2 space-y-2 text-sm text-gray-600 list-disc pl-5">
                    {operation.dataSources.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
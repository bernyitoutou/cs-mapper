import { useState } from "react";
import type { ParamMeta } from "../lib/operations";

type ParamGuideProps = {
  params: ParamMeta[];
  danger?: boolean;
};

export function ParamGuide({ params, danger = false }: ParamGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface transition-colors cursor-pointer"
      >
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
          <span>ℹ️</span> Param guide
        </span>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="divide-y divide-border border-t border-border">
          {params.map((p) => (
            <div key={p.name} className="px-4 py-3">
              <div className="flex items-start gap-2 mb-1">
                <span
                  className={[
                    "text-xs font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                    danger
                      ? "bg-red-50 text-red-500"
                      : "bg-dec-blue-light text-dec-blue",
                  ].join(" ")}
                >
                  {p.name}
                </span>
                <span className="text-xs text-gray-600 leading-relaxed">
                  {p.desc}
                </span>
              </div>
              {p.values && (
                <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                  {p.values.map((v) => (
                    <span
                      key={v}
                      className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

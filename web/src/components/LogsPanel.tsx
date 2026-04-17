import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";

const TYPE_COLORS: Record<string, string> = {
  sync_check: "bg-blue-100 text-blue-700",
  seed_sport_categories: "bg-lime-100 text-lime-700",
  generate_sport_group_mapping: "bg-cyan-100 text-cyan-700",
  sphere_import: "bg-purple-100 text-purple-700",
  mass_import: "bg-orange-100 text-orange-700",
  publish: "bg-green-100 text-green-700",
  unpublish: "bg-yellow-100 text-yellow-700",
  update: "bg-gray-100 text-gray-700",
  bulk_publish: "bg-teal-100 text-teal-700",
  massFieldUpdate: "bg-teal-100 text-teal-700",
  syncUKCategoryTaxonomies: "bg-teal-100 text-teal-700",
  enrich_sport_categories: "bg-emerald-100 text-emerald-700",
  clean_entries: "bg-slate-100 text-slate-700",
  deleteEntries: "bg-red-100 text-red-700",
  generate_report: "bg-blue-100 text-blue-700",
  generate_obsolete_image_report: "bg-amber-100 text-amber-700",
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export default function LogsPanel({ filterType }: { filterType?: string } = {}) {
  const allLogs = useQuery(api.services.logs.getLogs);
  const logs = filterType ? allLogs?.filter((l: { type: string }) => l.type === filterType) : allLogs;
  const clearLogs = useMutation(api.services.logs.clearLogs);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mt-6 bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e0e0e0] bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">
          {filterType ? `${filterType} logs` : "Operation Logs"}
          {logs && logs.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">{logs.length} entries</span>
          )}
        </span>
        <button
          onClick={() => clearLogs()}
          className="text-xs text-red-500 hover:text-red-700 cursor-pointer transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="divide-y divide-[#f0f0f0] max-h-64 overflow-y-auto">
        {!logs || logs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">No logs yet.</p>
        ) : (
          logs.map((log: { _id: string; type: string; status: string; timestamp: number; params?: unknown; result?: unknown; error?: string }) => {
            const id = log._id as string;
            const isOpen = expanded.has(id);
            return (
              <div key={id} className="px-4 py-2">
                <button
                  className="w-full flex items-center gap-2 text-left cursor-pointer"
                  onClick={() => toggle(id)}
                >
                  <span className="text-sm">{log.status === "success" ? "✅" : "❌"}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLORS[log.type] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {log.type}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{timeAgo(log.timestamp)}</span>
                  <span className="text-gray-300 text-xs">{isOpen ? "▲" : "▼"}</span>
                </button>
                {isOpen && (
                  <pre className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-700 max-h-40">
                    {JSON.stringify({ params: log.params, result: log.result, error: log.error }, null, 2)}
                  </pre>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Badge } from "./ui/Badge";
import { operations } from "../lib/operations";

const TYPE_COLORS: Record<string, "blue" | "purple" | "orange" | "green" | "red" | "gray" | "teal"> = {
  sync_check: "blue",
  sphere_import: "purple",
  mass_import: "orange",
  massFieldUpdate: "teal",
  syncUKCategoryTaxonomies: "teal",
  generate_report: "blue",
  deleteEntries: "red",
};

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function RecentLogs() {
  const navigate = useNavigate();
  const logs = useQuery(api.services.logs.getLogs);

  const recent = logs?.slice(0, 10) ?? [];

  const routeForType = (type: string) => {
    const op = operations.find((o) => o.logType === type);
    return op?.route ?? null;
  };

  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Recent Activity
      </h2>
      <div className="space-y-1">
        {recent.length === 0 && (
          <p className="text-xs text-gray-400 py-2">No activity yet.</p>
        )}
        {recent.map((log: { _id: string; type: string; status: string; timestamp: number }) => {
          const route = routeForType(log.type);
          return (
            <button
              key={log._id}
              onClick={() => route && navigate(route)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-surface transition-colors cursor-pointer"
            >
              <span className="text-xs">{log.status === "success" ? "✅" : "❌"}</span>
              <Badge variant={TYPE_COLORS[log.type] ?? "gray"} className="text-xs shrink-0">
                {log.type}
              </Badge>
              <span className="text-xs text-gray-400 ml-auto shrink-0">{timeAgo(log.timestamp)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

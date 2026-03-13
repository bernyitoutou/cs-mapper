import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

export function RecentReports() {
  const navigate = useNavigate();
  const reports = useQuery(api.services.reports.listReports);

  const recent = reports?.slice(0, 3) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Recent Reports
        </h2>
        <button
          onClick={() => navigate("/operations/generate-migration-report")}
          className="text-xs text-dec-blue hover:underline cursor-pointer"
        >
          Open →
        </button>
      </div>
      <div className="space-y-1.5">
        {recent.length === 0 && (
          <p className="text-xs text-gray-400 py-2">No reports yet.</p>
        )}
        {recent.map((r: { _id: string; name: string; generatedAt: number; locale: string }) => (
          <button
            key={r._id}
            onClick={() => navigate(`/operations/generate-migration-report?reportId=${r._id}`)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-surface transition-colors cursor-pointer"
          >
            <span className="text-xs">📄</span>
            <span className="text-xs text-gray-700 truncate flex-1">{r.name}</span>
            <span className="text-xs text-gray-400 shrink-0">{new Date(r.generatedAt).toLocaleDateString()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

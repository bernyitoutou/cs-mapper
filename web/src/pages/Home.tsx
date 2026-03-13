import { operations } from "../lib/operations";
import { OperationCard } from "../components/OperationCard";
import { RecentLogs } from "../components/RecentLogs";
import { RecentReports } from "../components/RecentReports";

export default function Home() {
  return (
    <div className="flex gap-6 h-full">
      {/* ── Left sidebar (1/3) ── */}
      <aside className="w-72 shrink-0 space-y-6">
        <div className="bg-white rounded-lg border border-border p-4">
          <RecentReports />
        </div>
        <div className="bg-white rounded-lg border border-border p-4">
          <RecentLogs />
        </div>
      </aside>

      {/* ── Main area (2/3) ── */}
      <main className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-gray-800 mb-4">Operations</h1>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
          {operations.map((op) => (
            <OperationCard key={op.id} op={op} />
          ))}
        </div>
      </main>
    </div>
  );
}

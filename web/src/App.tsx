import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import SyncDashboard from "./pages/SyncDashboard";
import EntryManager from "./pages/EntryManager";
import MassImport from "./pages/MassImport";
import Reports from "./pages/Reports";
import { Branch, Environment } from "@convex/lib/contentstack/types";

type Tab = "sync" | "entries" | "import" | "reports";

const tabs: { id: Tab; label: string }[] = [
  { id: "sync", label: "Sync" },
  { id: "entries", label: "Entries" },
  { id: "import", label: "Import" },
  { id: "reports", label: "Reports" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("sync");
  const settings = useQuery(api.settings.getSettings);
  const updateSettings = useMutation(api.settings.updateSettings);

  const isProd =
    settings?.csEnvironment === Environment.Production &&
    settings?.csBranch === Branch.Main;

  function toggleEnv() {
    if (isProd) {
      updateSettings({ csEnvironment: Environment.Staging, csBranch: Branch.Dev });
    } else {
      updateSettings({ csEnvironment: Environment.Production, csBranch: Branch.Main });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ background: "#0082c3" }} className="text-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">cs-mapper</span>
          <span className="text-blue-200 text-sm">Content Migration Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {settings && (
            <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
              {settings.csEnvironment} · {settings.csBranch}
            </span>
          )}
          <button
            onClick={toggleEnv}
            className="text-sm font-medium px-4 py-1.5 rounded-full border border-white/40 hover:bg-white/20 transition-colors cursor-pointer"
          >
            {isProd ? "→ Dev + Staging" : "→ Main + Production"}
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-[#e0e0e0] px-6 flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={[
              "px-5 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer",
              activeTab === t.id
                ? "border-[#0082c3] text-[#0082c3]"
                : "border-transparent text-gray-500 hover:text-gray-800",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Page content */}
      <main className="flex-1 p-6">
        {activeTab === "sync" && <SyncDashboard settings={settings} />}
        {activeTab === "entries" && <EntryManager settings={settings} />}
        {activeTab === "import" && <MassImport settings={settings} />}
        {activeTab === "reports" && <Reports />}
      </main>
    </div>
  );
}

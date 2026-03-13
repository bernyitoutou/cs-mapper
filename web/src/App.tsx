import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Routes, Route, NavLink } from "react-router-dom";
import { Branch, Environment } from "@convex/lib/contentstack/types";

import Home from "./pages/Home";
import EntryManager from "./pages/EntryManager";
import Reports from "./pages/Reports";
import CheckSyncStatus from "./pages/operations/CheckSyncStatus";
import SphereImport from "./pages/operations/SphereImport";
import MassImport from "./pages/operations/MassImport";
import DeleteEntries from "./pages/operations/DeleteEntries";
import MassFieldUpdate from "./pages/operations/MassFieldUpdate";
import SyncUKCategoryTaxonomies from "./pages/operations/SyncUKCategoryTaxonomies";
import GenerateMigrationReport from "./pages/operations/GenerateMigrationReport";

export default function App() {
  const settings = useQuery(api.services.settings.getSettings);
  const updateSettings = useMutation(api.services.settings.updateSettings);

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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
      isActive
        ? "border-dec-blue text-dec-blue"
        : "border-transparent text-gray-500 hover:text-gray-800",
    ].join(" ");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ background: "#0082c3" }} className="text-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="font-bold text-lg tracking-tight text-white hover:opacity-80">
            cs-mapper
          </NavLink>
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

      {/* Nav */}
      <nav className="bg-white border-b border-border px-6 flex gap-0">
        <NavLink to="/" end className={navLinkClass}>Home</NavLink>
        <NavLink to="/entries" className={navLinkClass}>Entries</NavLink>
        <NavLink to="/reports" className={navLinkClass}>Reports</NavLink>
      </nav>

      {/* Routes */}
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entries" element={<EntryManager settings={settings} />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/operations/check-sync-status" element={<CheckSyncStatus />} />
          <Route path="/operations/sphere-import" element={<SphereImport />} />
          <Route path="/operations/mass-import" element={<MassImport />} />
          <Route path="/operations/delete-entries" element={<DeleteEntries />} />
          <Route path="/operations/mass-field-update" element={<MassFieldUpdate />} />
          <Route path="/operations/sync-uk-category-taxonomies" element={<SyncUKCategoryTaxonomies />} />
          <Route path="/operations/generate-migration-report" element={<GenerateMigrationReport />} />
        </Routes>
      </main>
    </div>
  );
}

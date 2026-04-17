import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Routes, Route, NavLink } from "react-router-dom";

import Home from "./pages/Home";
import SphereImport from "./pages/operations/SphereImport";
import MassImport from "./pages/operations/MassImport";
import DeleteEntries from "./pages/operations/DeleteEntries";
import MassFieldUpdate from "./pages/operations/MassFieldUpdate";
import SyncUKCategoryTaxonomies from "./pages/operations/SyncUKCategoryTaxonomies";
import GenerateMigrationReport from "./pages/operations/GenerateMigrationReport";
import GenerateObsoleteImageReport from "./pages/operations/GenerateObsoleteImageReport";
import CleanEntries from "./pages/operations/CleanEntries";
import EnrichSportCategories from "./pages/operations/EnrichSportCategories";
import GenerateSportGroupMapping from "./pages/operations/GenerateSportGroupMapping";
import MigrateBlogSportCategorySportsField from "./pages/operations/MigrateBlogSportCategorySportsField";
import SeedSportCategories from "./pages/operations/SeedSportCategories";
import Schedules from "./pages/Schedules";

export default function App() {
  const settings = useQuery(api.services.settings.getSettings);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header style={{ background: "#3643BA" }} className="text-white px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <NavLink to="/" className="font-bold text-lg tracking-tight text-white hover:opacity-80">
            Content Mapper
          </NavLink>
          <NavLink
            to="/schedules"
            className={({ isActive }) =>
              `text-sm px-3 py-1 rounded-full transition-colors ${
                isActive ? "bg-white/30 text-white" : "text-blue-200 hover:text-white hover:bg-white/20"
              }`
            }
          >
            Schedules
          </NavLink>
        </div>
        <div className="flex items-center gap-3">
          {settings && (
            <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
              {settings.csEnvironment} · {settings.csBranch}
            </span>
          )}
        </div>
      </header>

      {/* Routes */}
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/operations/sphere-import" element={<SphereImport />} />
          <Route path="/operations/mass-import" element={<MassImport />} />
          <Route path="/operations/delete-entries" element={<DeleteEntries />} />
          <Route path="/operations/mass-field-update" element={<MassFieldUpdate />} />
          <Route path="/operations/sync-uk-category-taxonomies" element={<SyncUKCategoryTaxonomies />} />
          <Route path="/operations/generate-migration-report" element={<GenerateMigrationReport />} />
          <Route path="/operations/generate-obsolete-image-report" element={<GenerateObsoleteImageReport />} />
          <Route path="/operations/seed-sport-categories" element={<SeedSportCategories />} />
          <Route path="/operations/generate-sport-group-mapping" element={<GenerateSportGroupMapping />} />
          <Route path="/operations/migrate-blog-sport-category-sports-field" element={<MigrateBlogSportCategorySportsField />} />
          <Route path="/operations/enrich-sport-categories" element={<EnrichSportCategories />} />
          <Route path="/operations/clean-entries" element={<CleanEntries />} />
          <Route path="/schedules" element={<Schedules />} />
        </Routes>
      </main>
    </div>
  );
}

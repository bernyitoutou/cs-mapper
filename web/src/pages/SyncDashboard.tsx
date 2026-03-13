import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../components/LogsPanel";
import { Branch, ContentType, Environment } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";
import { SphereContentTypes } from "@convex/lib/sphere/types";

type Settings = { csEnvironment: Environment; csBranch: Branch } | undefined;

export default function SyncDashboard({ settings }: { settings: Settings }) {
  // ── Check Sync Status ──────────────────────────────────────────────────────
  const [syncForm, setSyncForm] = useState<{
    sphereContentTypeId: string;
    sphereMatchField: string;
    csContentTypeUid: ContentType;
    csMatchField: string;
    locale: Locale;
  }>({
    sphereContentTypeId: SphereContentTypes.HowToUse,
    sphereMatchField: "id",
    csContentTypeUid: ContentType.BlogPost,
    csMatchField: "sphere_id",
    locale: Locale.EnGb,
  });
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const checkSync = useAction(api.sync.checkSyncStatus);
  const writelog = useMutation(api.logs.writelog);

  async function runCheckSync() {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const result = await checkSync(syncForm);
      setSyncResult(result as unknown as Record<string, unknown>);
      await writelog({ type: "sync_check", status: "success", params: syncForm, result });
    } catch (err) {
      await writelog({ type: "sync_check", status: "error", params: syncForm, error: String(err) });
    } finally {
      setSyncLoading(false);
    }
  }

  // ── Sphere Import ──────────────────────────────────────────────────────────
  const [importForm, setImportForm] = useState<{
    sphereContentTypeId: string;
    csContentTypeUid: ContentType;
    locale: Locale;
    dryRun: boolean;
  }>({
    sphereContentTypeId: SphereContentTypes.HowToUse,
    csContentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
    dryRun: true,
  });
  const [importResult, setImportResult] = useState<Record<string, unknown> | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const sphereImport = useAction(api.sync.sphereImport);

  async function runSphereImport() {
    if (!importForm.dryRun && !confirm(`Run live Sphere import into ContentStack?\nLocale: ${importForm.locale}\nContent type: ${importForm.csContentTypeUid}\n\nThis will create/update/publish entries. Continue?`)) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await sphereImport(importForm);
      setImportResult(result as unknown as Record<string, unknown>);
      await writelog({ type: "sphere_import", status: "success", params: importForm, result });
    } catch (err) {
      await writelog({ type: "sphere_import", status: "error", params: importForm, error: String(err) });
    } finally {
      setImportLoading(false);
    }
  }

  const syncReport = syncResult as {
    summary?: {
      sphere?: { total: number; withMatchField: number };
      contentstack?: { total: number; withMatchField: number };
      sync?: { synced: number; syncRate: string; onlyInSphere: number; onlyInContentStack: number };
    };
    details?: { onlyInSphere: string[]; onlyInContentStack: string[] };
  } | null;

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Sync Dashboard</h1>

      {/* ── Check Sync Status ── */}
      <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Check Sync Status</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sphere Content Type</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={syncForm.sphereContentTypeId}
              onChange={(e) => setSyncForm((f) => ({ ...f, sphereContentTypeId: e.target.value }))}
            >
              {Object.entries(SphereContentTypes).map(([name, id]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CS Content Type</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={syncForm.csContentTypeUid}
              onChange={(e) => setSyncForm((f) => ({ ...f, csContentTypeUid: e.target.value as ContentType }))}
            >
              {Object.entries(ContentType).map(([name, uid]) => (
                <option key={uid} value={uid}>{name} ({uid})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sphere Match Field</span>
            <input
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={syncForm.sphereMatchField}
              onChange={(e) => setSyncForm((f) => ({ ...f, sphereMatchField: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CS Match Field</span>
            <input
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={syncForm.csMatchField}
              onChange={(e) => setSyncForm((f) => ({ ...f, csMatchField: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locale</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={syncForm.locale}
              onChange={(e) => setSyncForm((f) => ({ ...f, locale: e.target.value as Locale }))}
            >
              {Object.entries(Locale).map(([name, val]) => (
                <option key={val} value={val}>{name} ({val})</option>
              ))}
            </select>
          </label>
        </div>
        <button
          onClick={runCheckSync}
          disabled={syncLoading}
          className="mt-4 px-5 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50 transition-colors"
          style={{ background: syncLoading ? "#999" : "#0082c3" }}
        >
          {syncLoading ? "Checking…" : "Check Sync Status"}
        </button>

        {syncReport?.summary && (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Sphere", value: syncReport.summary.sphere?.total ?? 0, sub: `${syncReport.summary.sphere?.withMatchField} with match field` },
                { label: "ContentStack", value: syncReport.summary.contentstack?.total ?? 0, sub: `${syncReport.summary.contentstack?.withMatchField} with match field` },
                { label: "Sync Rate", value: syncReport.summary.sync?.syncRate ?? "—", sub: `${syncReport.summary.sync?.synced} synced` },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-[#f5f5f5] rounded p-4 text-center">
                  <div className="text-2xl font-bold text-[#0082c3]">{value}</div>
                  <div className="text-xs font-semibold text-gray-700 mt-1">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <CollapsibleList
                label={`Only in Sphere (${syncReport.summary.sync?.onlyInSphere ?? 0})`}
                items={syncReport.details?.onlyInSphere ?? []}
              />
              <CollapsibleList
                label={`Only in ContentStack (${syncReport.summary.sync?.onlyInContentStack ?? 0})`}
                items={syncReport.details?.onlyInContentStack ?? []}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Sphere Import ── */}
      <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Sphere Import</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sphere Content Type</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={importForm.sphereContentTypeId}
              onChange={(e) => setImportForm((f) => ({ ...f, sphereContentTypeId: e.target.value }))}
            >
              {Object.entries(SphereContentTypes).map(([name, id]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">CS Content Type</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={importForm.csContentTypeUid}
              onChange={(e) => setImportForm((f) => ({ ...f, csContentTypeUid: e.target.value as ContentType }))}
            >
              {Object.entries(ContentType).map(([name, uid]) => (
                <option key={uid} value={uid}>{name} ({uid})</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locale</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={importForm.locale}
              onChange={(e) => setImportForm((f) => ({ ...f, locale: e.target.value as Locale }))}
            >
              {Object.entries(Locale).map(([name, val]) => (
                <option key={val} value={val}>{name} ({val})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 mt-5">
            <input
              type="checkbox"
              checked={importForm.dryRun}
              onChange={(e) => setImportForm((f) => ({ ...f, dryRun: e.target.checked }))}
              className="w-4 h-4 accent-[#0082c3]"
            />
            <span className="text-sm text-gray-700">Dry run (no writes)</span>
          </label>
        </div>
        <button
          onClick={runSphereImport}
          disabled={importLoading}
          className="mt-4 px-5 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50 transition-colors"
          style={{ background: importLoading ? "#999" : importForm.dryRun ? "#6b7280" : "#0082c3" }}
        >
          {importLoading ? "Running…" : importForm.dryRun ? "Dry Run Import" : "Run Import"}
        </button>

        {importResult && (
          <div className="mt-4">
            <pre className="text-xs bg-gray-50 rounded p-3 overflow-x-auto">
              {JSON.stringify(importResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Active settings info */}
      {settings && (
        <p className="text-xs text-gray-400">
          Active profile: <span className="font-mono">{settings.csEnvironment} · {settings.csBranch}</span>
        </p>
      )}

      <LogsPanel />
    </div>
  );
}

function CollapsibleList({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[#e0e0e0] rounded">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
      >
        {label}
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 max-h-48 overflow-y-auto divide-y divide-gray-100">
          {items.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">None</p>
          ) : (
            items.map((item) => (
              <p key={item} className="text-xs font-mono py-1 text-gray-600">{item}</p>
            ))
          )}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../components/LogsPanel";
import { ContentType, Environment } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";

type Settings = { csEnvironment: string; csBranch: string } | undefined;

type CSEntry = {
  uid: string;
  title: string;
  locale: Locale;
  _version: number;
  publish_details?: unknown;
  [key: string]: unknown;
};

type BulkJobResult = { job_status?: string; [key: string]: unknown };

export default function EntryManager({ settings }: { settings: Settings }) {
  // ── Search ────────────────────────────────────────────────────────────────
  const [search, setSearch] = useState<{
    contentTypeUid: ContentType;
    locale: Locale | "";
    query: string;
    limit: number;
    skip: number;
  }>({  
    contentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
    query: "",
    limit: 25,
    skip: 0,
  });
  const [entries, setEntries] = useState<CSEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const getEntries = useAction(api.contentstack.csGetManagedEntries);
  const publishEntry = useAction(api.contentstack.csPublishEntry);
  const unpublishEntry = useAction(api.contentstack.csUnpublishEntry);
  const updateEntry = useAction(api.contentstack.csUpdateEntry);
  const bulkPublish = useAction(api.contentstack.csBulkPublish);
  const getBulkJobStatus = useAction(api.contentstack.csGetBulkJobStatus);
  const writelog = useMutation(api.logs.writelog);

  async function runSearch() {
    setSearchLoading(true);
    try {
      const result = await getEntries({
        contentTypeUid: search.contentTypeUid,
        locale: search.locale ? search.locale : undefined,
        query: search.query || undefined,
        limit: search.limit,
        skip: search.skip,
      });
      const r = result as { entries: CSEntry[]; count?: number };
      setEntries(r.entries ?? []);
      setTotalCount(r.count ?? r.entries?.length ?? 0);
    } catch (err) {
      alert(`Search failed: ${String(err)}`);
    } finally {
      setSearchLoading(false);
    }
  }

  // ── Selection for bulk ────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  function toggleSelect(uid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(uid) ? next.delete(uid) : next.add(uid);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(entries.map((e) => e.uid)));
  }

  // ── Per-entry action modal ─────────────────────────────────────────────────
  const [modal, setModal] = useState<{
    type: "publish" | "unpublish" | "edit";
    entry: CSEntry;
  } | null>(null);
  const defaultEnv = settings?.csEnvironment ?? Environment.Staging;
  const [pubEnvs, setPubEnvs] = useState([defaultEnv]);
  const [pubLocale, setPubLocale] = useState<Locale>(Locale.EnGb);
  const [editJson, setEditJson] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function openModal(type: "publish" | "unpublish" | "edit", entry: CSEntry) {
    setModal({ type, entry });
    setPubEnvs([settings?.csEnvironment ?? Environment.Staging]);
    setPubLocale(entry.locale ?? Locale.EnGb);
    if (type === "edit") setEditJson(JSON.stringify(entry, null, 2));
  }

  async function executeAction() {
    if (!modal) return;
    setActionLoading(true);
    try {
      if (modal.type === "publish") {
        await publishEntry({
          contentTypeUid: search.contentTypeUid,
          entryUid: modal.entry.uid,
          environments: pubEnvs,
          locales: [pubLocale],
        });
        await writelog({ type: "publish", status: "success", params: { uid: modal.entry.uid, envs: pubEnvs, locale: pubLocale } });
      } else if (modal.type === "unpublish") {
        await unpublishEntry({
          contentTypeUid: search.contentTypeUid,
          entryUid: modal.entry.uid,
          environments: pubEnvs,
          locales: [pubLocale],
        });
        await writelog({ type: "unpublish", status: "success", params: { uid: modal.entry.uid } });
      } else if (modal.type === "edit") {
        const parsed = JSON.parse(editJson);
        await updateEntry({
          contentTypeUid: search.contentTypeUid,
          entryUid: modal.entry.uid,
          entry: parsed,
        });
        await writelog({ type: "update", status: "success", params: { uid: modal.entry.uid } });
      }
      setModal(null);
      await runSearch();
    } catch (err) {
      await writelog({ type: modal.type, status: "error", error: String(err) });
      alert(`Action failed: ${String(err)}`);
    } finally {
      setActionLoading(false);
    }
  }

  // ── Bulk Publish ──────────────────────────────────────────────────────────
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"publish" | "unpublish">("publish");
  const [bulkEnvs, setBulkEnvs] = useState([defaultEnv]);
  const [bulkLocale, setBulkLocale] = useState<Locale>(Locale.EnGb);
  const [bulkJobStatus, setBulkJobStatus] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function executeBulk() {
    setBulkLoading(true);
    setBulkJobStatus("Starting…");
    try {
      const selectedEntries = entries
        .filter((e) => selected.has(e.uid))
        .map((e) => ({ content_type: search.contentTypeUid, uid: e.uid, locale: bulkLocale }));

      const result = await bulkPublish({
        entries: selectedEntries,
        environments: bulkEnvs,
        locales: [bulkLocale],
        action: bulkAction,
      });

      const jobId = (result as { job_id?: string })?.job_id;
      if (!jobId) {
        setBulkJobStatus("Done (no job ID returned)");
        await writelog({ type: "bulk_publish", status: "success" });
        setBulkLoading(false);
        return;
      }

      // Poll job
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 2000));
        const status = (await getBulkJobStatus({ jobId })) as BulkJobResult;
        const jobStatus = status?.job_status ?? "unknown";
        setBulkJobStatus(`Job: ${jobStatus}`);
        if (jobStatus === "complete" || jobStatus === "failed") {
          done = true;
          await writelog({ type: "bulk_publish", status: jobStatus === "complete" ? "success" : "error", result: status });
        }
      }
      setBulkModal(false);
    } catch (err) {
      setBulkJobStatus(`Error: ${String(err)}`);
      await writelog({ type: "bulk_publish", status: "error", error: String(err) });
    } finally {
      setBulkLoading(false);
    }
  }

  function isPublished(entry: CSEntry): boolean {
    const pd = entry.publish_details;
    if (!pd) return false;
    if (Array.isArray(pd)) return pd.length > 0;
    return true;
  }

  const currentEnvs = Object.values(Environment);
  const currentLocales = Object.values(Locale);

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-xl font-bold text-gray-800">Entry Manager</h1>

      {/* Search bar */}
      <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Content Type</span>
            <select
              className="border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={search.contentTypeUid}
              onChange={(e) => setSearch((s) => ({ ...s, contentTypeUid: e.target.value as ContentType }))}
            >
              {Object.entries(ContentType).map(([name, uid]) => (
                <option key={uid} value={uid}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locale</span>
            <select
              className="border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={search.locale}
              onChange={(e) => setSearch((s) => ({ ...s, locale: e.target.value as Locale | "" }))}
            >
              <option value="">All</option>
              {Object.entries(Locale).map(([name, val]) => (
                <option key={val} value={val}>{name}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Query (JSON)</span>
            <input
              className="border border-[#e0e0e0] rounded px-3 py-2 text-sm w-52"
              placeholder='{"title":{"$regex":"sport"}}'
              value={search.query}
              onChange={(e) => setSearch((s) => ({ ...s, query: e.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Limit</span>
            <input
              type="number"
              className="border border-[#e0e0e0] rounded px-3 py-2 text-sm w-20"
              value={search.limit}
              onChange={(e) => setSearch((s) => ({ ...s, limit: Number(e.target.value) }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Skip</span>
            <input
              type="number"
              className="border border-[#e0e0e0] rounded px-3 py-2 text-sm w-20"
              value={search.skip}
              onChange={(e) => setSearch((s) => ({ ...s, skip: Number(e.target.value) }))}
            />
          </label>
          <button
            onClick={runSearch}
            disabled={searchLoading}
            className="px-5 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50"
            style={{ background: "#0082c3" }}
          >
            {searchLoading ? "Loading…" : "Search"}
          </button>
        </div>
      </section>

      {/* Bulk toolbar */}
      {selected.size > 0 && (
        <div className="bg-[#e6f4fb] border border-[#b3ddf2] rounded px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-[#005f8e]">{selected.size} selected</span>
          <button
            onClick={() => { setBulkAction("publish"); setBulkModal(true); }}
            className="px-3 py-1 text-xs font-medium text-white rounded cursor-pointer"
            style={{ background: "#0082c3" }}
          >Bulk Publish</button>
          <button
            onClick={() => { setBulkAction("unpublish"); setBulkModal(true); }}
            className="px-3 py-1 text-xs font-medium text-white bg-gray-500 rounded cursor-pointer"
          >Bulk Unpublish</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 cursor-pointer">Clear</button>
        </div>
      )}

      {/* Results table */}
      {entries.length > 0 && (
        <section className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e0e0e0] bg-gray-50">
            <span className="text-sm text-gray-600">
              Showing {entries.length}{totalCount !== null ? ` of ${totalCount}` : ""} entries
            </span>
            <button onClick={selectAll} className="text-xs text-[#0082c3] cursor-pointer">Select all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-[#e0e0e0]">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">UID</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Locale</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">v</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f0f0f0]">
                {entries.map((entry) => (
                  <tr key={entry.uid} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(entry.uid)}
                        onChange={() => toggleSelect(entry.uid)}
                        className="accent-[#0082c3]"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-500 max-w-32 truncate">{entry.uid}</td>
                    <td className="px-3 py-2 font-medium text-gray-800 max-w-64 truncate">{entry.title}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{entry.locale}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{entry._version}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isPublished(entry) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {isPublished(entry) ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-3 py-2 flex gap-1">
                      <button onClick={() => openModal("publish", entry)} className="text-xs px-2 py-1 bg-[#e6f4fb] text-[#0082c3] rounded cursor-pointer hover:bg-[#b3ddf2]">Publish</button>
                      <button onClick={() => openModal("unpublish", entry)} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded cursor-pointer hover:bg-gray-200">Unpublish</button>
                      <button onClick={() => openModal("edit", entry)} className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded cursor-pointer hover:bg-orange-100">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#e0e0e0] bg-gray-50">
            <button
              onClick={() => { setSearch((s) => ({ ...s, skip: Math.max(0, s.skip - s.limit) })); runSearch(); }}
              disabled={search.skip === 0}
              className="text-xs px-3 py-1 border border-[#e0e0e0] rounded cursor-pointer disabled:opacity-40"
            >← Prev</button>
            <span className="text-xs text-gray-500">Page {Math.floor(search.skip / search.limit) + 1}</span>
            <button
              onClick={() => { setSearch((s) => ({ ...s, skip: s.skip + s.limit })); runSearch(); }}
              className="text-xs px-3 py-1 border border-[#e0e0e0] rounded cursor-pointer"
            >Next →</button>
          </div>
        </section>
      )}

      <LogsPanel />

      {/* Per-entry action modal */}
      {modal && (
        <Modal title={modal.type === "edit" ? `Edit: ${modal.entry.title}` : `${modal.type === "publish" ? "Publish" : "Unpublish"}: ${modal.entry.title}`} onClose={() => setModal(null)}>
          {(modal.type === "publish" || modal.type === "unpublish") && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Environments</p>
                <div className="flex gap-3">
                  {currentEnvs.map((env) => (
                    <label key={env} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pubEnvs.includes(env)}
                        onChange={(e) => setPubEnvs((prev) => e.target.checked ? [...prev, env] : prev.filter((x) => x !== env))}
                        className="accent-[#0082c3]"
                      />
                      {env}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Locale</p>
                <select
                  className="border border-[#e0e0e0] rounded px-3 py-2 text-sm w-full"
                  value={pubLocale}
                  onChange={(e) => setPubLocale(e.target.value as Locale)}
                >
                  {currentLocales.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          )}
          {modal.type === "edit" && (
            <textarea
              className="w-full font-mono text-xs border border-[#e0e0e0] rounded p-3 h-64 resize-y"
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
            />
          )}
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm border border-[#e0e0e0] rounded cursor-pointer">Cancel</button>
            <button
              onClick={executeAction}
              disabled={actionLoading}
              className="px-4 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50"
              style={{ background: "#0082c3" }}
            >
              {actionLoading ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}

      {/* Bulk publish modal */}
      {bulkModal && (
        <Modal title={`Bulk ${bulkAction} — ${selected.size} entries`} onClose={() => setBulkModal(false)}>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Environments</p>
              <div className="flex gap-3">
                {currentEnvs.map((env) => (
                  <label key={env} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bulkEnvs.includes(env)}
                      onChange={(e) => setBulkEnvs((prev) => e.target.checked ? [...prev, env] : prev.filter((x) => x !== env))}
                      className="accent-[#0082c3]"
                    />
                    {env}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Locale</p>
              <select
                className="border border-[#e0e0e0] rounded px-3 py-2 text-sm w-full"
                value={bulkLocale}
                onChange={(e) => setBulkLocale(e.target.value as Locale)}
              >
                {currentLocales.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            {bulkJobStatus && (
              <p className="text-sm text-[#0082c3] font-medium">{bulkJobStatus}</p>
            )}
          </div>
          <div className="mt-4 flex gap-2 justify-end">
            <button onClick={() => setBulkModal(false)} className="px-4 py-2 text-sm border border-[#e0e0e0] rounded cursor-pointer">Cancel</button>
            <button
              onClick={executeBulk}
              disabled={bulkLoading}
              className="px-4 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50"
              style={{ background: "#0082c3" }}
            >
              {bulkLoading ? "Running…" : `Bulk ${bulkAction}`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e0e0e0]">
          <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

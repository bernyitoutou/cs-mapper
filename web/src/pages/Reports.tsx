import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { marked } from "marked";
import { Locale } from "@convex/lib/contentstack/types";

export default function Reports() {
  const reports = useQuery(api.reports.listReports);
  const [selectedId, setSelectedId] = useState<Id<"reports"> | null>(null);
  const selectedReport = useQuery(api.reports.getReport, selectedId ? { id: selectedId } : "skip");
  const deleteReport = useMutation(api.reports.deleteReport);
  const saveReport = useMutation(api.reports.saveReport);
  const generateReport = useAction(api.reportActions.generateMigrationReport);
  const writelog = useMutation(api.logs.writelog);

  // ── Generate ─────────────────────────────────────────────────────────────
  const [genLocale, setGenLocale] = useState<Locale>(Locale.EnGb);
  const [genLoading, setGenLoading] = useState(false);
  const [genProgress, setGenProgress] = useState("");

  async function runGenerate() {
    setGenLoading(true);
    setGenProgress("Fetching categories from Sphere & ContentStack…");
    try {
      const result = await generateReport({ locale: genLocale });
      const r = result as { categories: unknown[]; quickReport: string; detailedReport: string };
      setGenProgress(`Done — ${(r.categories as unknown[]).length} categories processed`);
      await writelog({ type: "generate_report", status: "success", params: { locale: genLocale }, result: { categories: (r.categories as unknown[]).length } });
      // Auto-select the latest report
      setTimeout(() => setGenProgress(""), 3000);
    } catch (err) {
      setGenProgress(`Error: ${String(err)}`);
      await writelog({ type: "generate_report", status: "error", error: String(err) });
    } finally {
      setGenLoading(false);
    }
  }

  // ── Manual upload ─────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLocale, setUploadLocale] = useState<Locale>(Locale.EnGb);
  const [uploadLoading, setUploadLoading] = useState(false);

  async function handleUpload() {
    if (!uploadFile) return;
    setUploadLoading(true);
    try {
      const content = await uploadFile.text();
      const name = uploadFile.name.replace(/\.md$/, "");
      await saveReport({ name, content, locale: uploadLocale, generatedAt: Date.now() });
    } catch (err) {
      alert(`Upload failed: ${String(err)}`);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleDelete(id: Id<"reports">) {
    if (selectedId === id) setSelectedId(null);
    await deleteReport({ id });
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const renderedHtml = selectedReport?.content
    ? (marked(selectedReport.content) as string)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Migration Reports</h1>

      <div className="grid grid-cols-3 gap-5">
        {/* Left column: controls + list */}
        <div className="space-y-4">
          {/* Generate section */}
          <section className="bg-white rounded-lg border border-[#e0e0e0] p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Generate New Report</h2>
            <label className="space-y-1 block mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locale</span>
              <select
                className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
                value={genLocale}
                onChange={(e) => setGenLocale(e.target.value as Locale)}
              >
                {Object.entries(Locale).map(([name, val]) => (
                  <option key={val} value={val}>{name} ({val})</option>
                ))}
              </select>
            </label>
            <button
              onClick={runGenerate}
              disabled={genLoading}
              className="w-full px-4 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50 transition-colors"
              style={{ background: genLoading ? "#999" : "#0082c3" }}
            >
              {genLoading ? "Generating…" : "Generate"}
            </button>
            {genProgress && (
              <p className={`mt-2 text-xs ${genProgress.startsWith("Error") ? "text-red-500" : "text-[#0082c3]"}`}>
                {genProgress}
              </p>
            )}
          </section>

          {/* Manual upload */}
          <section className="bg-white rounded-lg border border-[#e0e0e0] p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload .md Report</h2>
            <label className="block mb-2">
              <span className="px-3 py-1.5 text-sm border border-[#e0e0e0] rounded cursor-pointer hover:bg-gray-50 inline-block">
                Choose .md file
              </span>
              <input
                type="file"
                accept=".md"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {uploadFile && <p className="text-xs text-gray-500 mb-2 font-mono">{uploadFile.name}</p>}
            <label className="space-y-1 block mb-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Locale</span>
              <select
                className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
                value={uploadLocale}
                onChange={(e) => setUploadLocale(e.target.value as Locale)}
              >
                {Object.entries(Locale).map(([name, val]) => (
                  <option key={val} value={val}>{name} ({val})</option>
                ))}
              </select>
            </label>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploadLoading}
              className="w-full px-4 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50"
              style={{ background: "#6b7280" }}
            >
              {uploadLoading ? "Uploading…" : "Upload"}
            </button>
          </section>

          {/* Reports list */}
          <section className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#e0e0e0] bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">Saved Reports</span>
              {reports && <span className="ml-2 text-xs text-gray-400">{reports.length}</span>}
            </div>
            <div className="divide-y divide-[#f0f0f0] max-h-80 overflow-y-auto">
              {!reports || reports.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No reports yet.</p>
              ) : (
                reports.map((r: { _id: Id<"reports">; name: string; locale: string; generatedAt: number }) => (
                  <div
                    key={r._id as string}
                    className={`px-3 py-2.5 cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-2 ${selectedId === r._id ? "bg-[#e6f4fb]" : ""}`}
                    onClick={() => setSelectedId(r._id as Id<"reports">)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                      <p className="text-xs text-gray-400">{r.locale} · {formatDate(r.generatedAt)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(r._id as Id<"reports">); }}
                      className="text-xs text-red-400 hover:text-red-600 cursor-pointer shrink-0 mt-0.5"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Right column: viewer (spans 2 cols) */}
        <div className="col-span-2">
          {selectedReport ? (
            <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#e0e0e0] bg-gray-50">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selectedReport.name}</h2>
                  <p className="text-xs text-gray-400">{selectedReport.locale} · {formatDate(selectedReport.generatedAt)}</p>
                </div>
              </div>
              <div
                className="report-content p-6 overflow-y-auto max-h-[70vh]"
                dangerouslySetInnerHTML={{ __html: renderedHtml ?? "" }}
              />
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#e0e0e0] flex items-center justify-center h-64">
              <p className="text-sm text-gray-400">Select a report to view it</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

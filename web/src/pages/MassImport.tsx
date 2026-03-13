import { useState, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../components/LogsPanel";
import { ContentType, Locale } from "@convex/lib/contentstack/types";

type Settings = { csEnvironment: string; csBranch: string } | undefined;

export default function MassImport({ settings: _settings }: { settings: Settings }) {
  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");

  const [options, setOptions] = useState<{
    contentTypeUid: ContentType;
    locale: Locale;
    createMasterFirst: boolean;
    publishAfterCreate: boolean;
  }>({
    contentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
    createMasterFirst: false,
    publishAfterCreate: false,
  });

  const [result, setResult] = useState<{
    created: number;
    failed: number;
    failures?: { item: Record<string, unknown>; step: string; error: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedFailures, setExpandedFailures] = useState(false);

  const massImport = useAction(api.import.massImport);
  const writelog = useMutation(api.logs.writelog);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError("");
    setItems(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) throw new Error("File must be a JSON array");
        setItems(parsed as Record<string, unknown>[]);
      } catch (err) {
        setParseError(String(err));
      }
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!items) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await massImport({
        contentTypeUid: options.contentTypeUid,
        locale: options.locale,
        items,
        createMasterFirst: options.createMasterFirst,
        publishAfterCreate: options.publishAfterCreate,
      });
      const r = res as { created: unknown[]; failed: unknown[] };
      const summary = {
        created: r.created?.length ?? 0,
        failed: r.failed?.length ?? 0,
        failures: r.failed as { item: Record<string, unknown>; step: string; error: string }[],
      };
      setResult(summary);
      await writelog({
        type: "mass_import",
        status: summary.failed > 0 ? "error" : "success",
        params: { contentTypeUid: options.contentTypeUid, locale: options.locale, total: items.length },
        result: { created: summary.created, failed: summary.failed },
      });
    } catch (err) {
      await writelog({ type: "mass_import", status: "error", error: String(err) });
      alert(`Import failed: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setItems(null);
    setFileName("");
    setResult(null);
    setParseError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const previewItems = items?.slice(0, 5) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Mass Import</h1>

      {/* Upload */}
      <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Upload JSON file</h2>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 text-sm font-medium border border-[#0082c3] text-[#0082c3] rounded cursor-pointer hover:bg-[#e6f4fb] transition-colors">
            Choose file
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
          {fileName && <span className="text-sm text-gray-600 font-mono">{fileName}</span>}
          {items && (
            <span className="text-sm text-green-700 font-medium">{items.length} items loaded</span>
          )}
          {items && (
            <button onClick={reset} className="ml-auto text-xs text-red-400 hover:text-red-600 cursor-pointer">Reset</button>
          )}
        </div>
        {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}

        {/* Preview */}
        {previewItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Preview (first {previewItems.length} items)</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {previewItems.map((item, i) => (
                <div key={i} className="bg-gray-50 rounded p-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Item {i + 1}</p>
                  <div className="grid grid-cols-2 gap-x-3 text-xs text-gray-500">
                    {Object.entries(item).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="flex gap-1 truncate">
                        <span className="font-mono font-medium text-gray-700 shrink-0">{k}:</span>
                        <span className="truncate">{JSON.stringify(v)}</span>
                      </div>
                    ))}
                    {Object.keys(item).length > 6 && (
                      <span className="text-gray-400">+{Object.keys(item).length - 6} more fields</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Options */}
      <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Import options</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Content Type</span>
            <select
              className="w-full border border-[#e0e0e0] rounded px-3 py-2 text-sm"
              value={options.contentTypeUid}
              onChange={(e) => setOptions((o) => ({ ...o, contentTypeUid: e.target.value as ContentType }))}
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
              value={options.locale}
              onChange={(e) => setOptions((o) => ({ ...o, locale: e.target.value as Locale }))}
            >
              {Object.entries(Locale).map(([name, val]) => (
                <option key={val} value={val}>{name} ({val})</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.createMasterFirst}
              onChange={(e) => setOptions((o) => ({ ...o, createMasterFirst: e.target.checked }))}
              className="accent-[#0082c3]"
            />
            <span className="text-sm text-gray-700">Create master first</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.publishAfterCreate}
              onChange={(e) => setOptions((o) => ({ ...o, publishAfterCreate: e.target.checked }))}
              className="accent-[#0082c3]"
            />
            <span className="text-sm text-gray-700">Publish after create</span>
          </label>
        </div>

        <button
          onClick={runImport}
          disabled={!items || loading}
          className="mt-5 px-6 py-2 text-sm font-medium text-white rounded cursor-pointer disabled:opacity-50 transition-colors"
          style={{ background: (!items || loading) ? "#999" : "#0082c3" }}
        >
          {loading ? `Importing ${items?.length ?? 0} items…` : `Import ${items?.length ?? 0} items`}
        </button>
      </section>

      {/* Result */}
      {result && (
        <section className="bg-white rounded-lg border border-[#e0e0e0] p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{result.created}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">Created</div>
            </div>
            <div className={`${result.failed > 0 ? "bg-red-50" : "bg-gray-50"} rounded p-4 text-center`}>
              <div className={`text-2xl font-bold ${result.failed > 0 ? "text-red-600" : "text-gray-400"}`}>{result.failed}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">Failed</div>
            </div>
            <div className="bg-gray-50 rounded p-4 text-center">
              <div className="text-2xl font-bold text-gray-600">{result.created + result.failed}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">Total</div>
            </div>
          </div>

          {result.failures && result.failures.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedFailures((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-red-600 cursor-pointer"
              >
                ⚠️ {result.failures.length} failure{result.failures.length > 1 ? "s" : ""}
                <span className="text-gray-400">{expandedFailures ? "▲" : "▼"}</span>
              </button>
              {expandedFailures && (
                <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                  {result.failures.map((f, i) => (
                    <div key={i} className="bg-red-50 rounded p-3 text-xs">
                      <div className="font-medium text-red-700 mb-1">Step: {f.step}</div>
                      <div className="text-red-600 mb-1">{f.error}</div>
                      <pre className="text-gray-500 overflow-x-auto">
                        {JSON.stringify(f.item, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <LogsPanel />
    </div>
  );
}

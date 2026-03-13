import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { ContentType } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";

type ImportResult = {
  created: number;
  failed: number;
  failures?: { item: Record<string, unknown>; step: string; error: string }[];
};

export default function MassImport() {
  const navigate = useNavigate();
  const massImport = useAction(api.operations.massImport.massImport);
  const writelog = useMutation(api.services.logs.writelog);
  const fileRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [options, setOptions] = useState({
    contentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
    createMasterFirst: false,
    publishAfterCreate: false,
  });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedFailures, setExpandedFailures] = useState(false);

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

  async function run() {
    if (!items) return;
    const verb = options.publishAfterCreate ? "create and publish" : "create";
    if (
      !confirm(
        `About to ${verb} ${items.length} entries in "${options.contentTypeUid}" (${options.locale}).\n\nThis cannot be undone. Continue?`
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await massImport({ ...options, items });
      const r = res as { created: unknown[]; failed: unknown[] };
      const summary: ImportResult = {
        created: r.created?.length ?? 0,
        failed: r.failed?.length ?? 0,
        failures: r.failed as ImportResult["failures"],
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
      <button onClick={() => navigate("/")} className="text-sm text-dec-blue hover:underline cursor-pointer">
        ← Back
      </button>
      <div className="flex items-center gap-3">
        <span className="text-2xl">📥</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Mass Import</h1>
          <p className="text-sm text-gray-500">Bulk-create entries from a JSON file upload.</p>
        </div>
      </div>

      {/* Upload */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">1. Upload JSON file</h2>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 text-sm font-medium border border-dec-blue text-dec-blue rounded cursor-pointer hover:bg-dec-blue-light transition-colors">
            Choose file
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
          </label>
          {fileName && <span className="text-sm text-gray-600 font-mono">{fileName}</span>}
          {items && <span className="text-sm text-green-700 font-medium">{items.length} items loaded</span>}
          {items && (
            <button onClick={reset} className="ml-auto text-xs text-red-400 hover:text-red-600 cursor-pointer">
              Reset
            </button>
          )}
        </div>
        {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
        {previewItems.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-500 uppercase mb-2">Preview (first {previewItems.length} items)</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {previewItems.map((item, i) => (
                <div key={i} className="bg-surface rounded p-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Item {i + 1}</p>
                  <div className="grid grid-cols-2 gap-x-3 text-xs text-gray-500">
                    {Object.entries(item).slice(0, 6).map(([k, v]) => (
                      <div key={k} className="flex gap-1 truncate">
                        <span className="font-mono font-medium text-gray-700 shrink-0">{k}:</span>
                        <span className="truncate">{JSON.stringify(v)}</span>
                      </div>
                    ))}
                    {Object.keys(item).length > 6 && (
                      <span className="text-gray-400">+{Object.keys(item).length - 6} more</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Options */}
      <Card>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">2. Import options</h2>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Content Type"
            value={options.contentTypeUid}
            onChange={(e) => setOptions((o) => ({ ...o, contentTypeUid: e.target.value as ContentType }))}
          >
            {Object.entries(ContentType).map(([name, uid]) => (
              <option key={uid} value={uid}>{name} ({uid})</option>
            ))}
          </Select>
          <Select
            label="Locale"
            value={options.locale}
            onChange={(e) => setOptions((o) => ({ ...o, locale: e.target.value as Locale }))}
          >
            {Object.entries(Locale).map(([name, val]) => (
              <option key={val} value={val}>{name} ({val})</option>
            ))}
          </Select>
          <label className="flex items-center gap-2 col-span-2">
            <input
              type="checkbox"
              checked={options.createMasterFirst}
              onChange={(e) => setOptions((o) => ({ ...o, createMasterFirst: e.target.checked }))}
              className="w-4 h-4 accent-dec-blue"
            />
            <span className="text-sm text-gray-700">Create master first</span>
          </label>
          <label className="flex items-center gap-2 col-span-2">
            <input
              type="checkbox"
              checked={options.publishAfterCreate}
              onChange={(e) => setOptions((o) => ({ ...o, publishAfterCreate: e.target.checked }))}
              className="w-4 h-4 accent-dec-blue"
            />
            <span className="text-sm text-gray-700">Publish after create</span>
          </label>
        </div>
        <div className="mt-4">
          <Button onClick={run} disabled={!items} loading={loading}>
            {loading ? `Importing ${items?.length ?? 0} items…` : `Import ${items?.length ?? 0} items`}
          </Button>
        </div>
      </Card>

      {/* Result */}
      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 rounded p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{result.created}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">Created</div>
            </div>
            <div className={[result.failed > 0 ? "bg-red-50" : "bg-surface", "rounded p-4 text-center"].join(" ")}>
              <div className={["text-2xl font-bold", result.failed > 0 ? "text-red-600" : "text-gray-400"].join(" ")}>{result.failed}</div>
              <div className="text-xs font-medium text-gray-600 mt-1">Failed</div>
            </div>
            <div className="bg-surface rounded p-4 text-center">
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
                      <pre className="text-gray-500 overflow-x-auto">{JSON.stringify(f.item, null, 2)}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      <LogsPanel filterType="mass_import" />
    </div>
  );
}

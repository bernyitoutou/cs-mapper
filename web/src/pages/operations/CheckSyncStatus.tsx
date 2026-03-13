import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Input } from "../../components/ui/Input";
import { ContentType } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";
import { SphereContentTypes } from "@convex/lib/sphere/types";

type SyncSummary = {
  sphere?: { total: number; withMatchField: number };
  contentstack?: { total: number; withMatchField: number };
  sync?: { synced: number; syncRate: string; onlyInSphere: number; onlyInContentStack: number };
};

export default function CheckSyncStatus() {
  const navigate = useNavigate();
  const checkSync = useAction(api.operations.checkSyncStatus.checkSyncStatus);
  const writelog = useMutation(api.services.logs.writelog);

  const [form, setForm] = useState({
    sphereContentTypeId: SphereContentTypes.HowToUse as string,
    sphereMatchField: "id",
    csContentTypeUid: ContentType.BlogPost,
    csMatchField: "sphere_id",
    locale: Locale.EnGb,
  });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const report = result as {
    summary?: SyncSummary;
    details?: { onlyInSphere: string[]; onlyInContentStack: string[] };
  } | null;

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await checkSync(form);
      setResult(res as Record<string, unknown>);
      await writelog({ type: "sync_check", status: "success", params: form, result: res });
    } catch (err) {
      await writelog({ type: "sync_check", status: "error", params: form, error: String(err) });
      alert(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <button onClick={() => navigate("/")} className="text-sm text-dec-blue hover:underline cursor-pointer">
        ← Back
      </button>
      <div className="flex items-center gap-3">
        <span className="text-2xl">🔍</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Check Sync Status</h1>
          <p className="text-sm text-gray-500">Compare Sphere and ContentStack entries — shows sync rate and mismatches.</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Sphere Content Type"
            value={form.sphereContentTypeId}
            onChange={(e) => setForm((f) => ({ ...f, sphereContentTypeId: e.target.value }))}
          >
            {Object.entries(SphereContentTypes).map(([name, id]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <Select
            label="CS Content Type"
            value={form.csContentTypeUid}
            onChange={(e) => setForm((f) => ({ ...f, csContentTypeUid: e.target.value as ContentType }))}
          >
            {Object.entries(ContentType).map(([name, uid]) => (
              <option key={uid} value={uid}>{name} ({uid})</option>
            ))}
          </Select>
          <Input
            label="Sphere Match Field"
            value={form.sphereMatchField}
            onChange={(e) => setForm((f) => ({ ...f, sphereMatchField: e.target.value }))}
          />
          <Input
            label="CS Match Field"
            value={form.csMatchField}
            onChange={(e) => setForm((f) => ({ ...f, csMatchField: e.target.value }))}
          />
          <Select
            label="Locale"
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as Locale }))}
          >
            {Object.entries(Locale).map(([name, val]) => (
              <option key={val} value={val}>{name} ({val})</option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
          <Button onClick={run} loading={loading}>Check Sync Status</Button>
        </div>
      </Card>

      {/* Result */}
      {report?.summary && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Sphere", value: report.summary.sphere?.total ?? 0, sub: `${report.summary.sphere?.withMatchField} with match field` },
              { label: "ContentStack", value: report.summary.contentstack?.total ?? 0, sub: `${report.summary.contentstack?.withMatchField} with match field` },
              { label: "Sync Rate", value: report.summary.sync?.syncRate ?? "—", sub: `${report.summary.sync?.synced} synced` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-surface rounded p-4 text-center">
                <div className="text-2xl font-bold text-dec-blue">{value}</div>
                <div className="text-xs font-semibold text-gray-700 mt-1">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CollapsibleList
              label={`Only in Sphere (${report.summary.sync?.onlyInSphere ?? 0})`}
              items={report.details?.onlyInSphere ?? []}
            />
            <CollapsibleList
              label={`Only in ContentStack (${report.summary.sync?.onlyInContentStack ?? 0})`}
              items={report.details?.onlyInContentStack ?? []}
            />
          </div>
        </Card>
      )}

      <LogsPanel filterType="sync_check" />
    </div>
  );
}

function CollapsibleList({ label, items }: { label: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded">
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

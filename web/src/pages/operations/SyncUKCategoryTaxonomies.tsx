import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { Locale } from "@convex/lib/locales";
import { ParamGuide } from "../../components/ParamGuide";
import { operations } from "../../lib/operations";

export default function SyncUKCategoryTaxonomies() {
  const navigate = useNavigate();
  const syncUKCategoryTaxonomies = useAction(api.operations.syncUKCategoryTaxonomies.syncUKCategoryTaxonomies);
  const writelog = useMutation(api.services.logs.writelog);

  const [form, setForm] = useState({ locale: Locale.EnGb, dryRun: true });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (
      !form.dryRun &&
      !confirm(`Sync UK category taxonomies to ContentStack (${form.locale})?\nThis will create/update and publish entries. Continue?`)
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await syncUKCategoryTaxonomies(form);
      setResult(res as Record<string, unknown>);
      await writelog({ type: "syncUKCategoryTaxonomies", status: "success", params: form, result: res });
    } catch (err) {
      await writelog({ type: "syncUKCategoryTaxonomies", status: "error", params: form, error: String(err) });
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
        <span className="text-2xl">🏷️</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">UK Category Taxonomies</h1>
          <p className="text-sm text-gray-500">Sync UK sports article taxonomies from Sphere to ContentStack.</p>
        </div>
      </div>

      <ParamGuide params={operations.find((o) => o.id === "sync-uk-category-taxonomies")!.paramsMeta} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="locale"
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as Locale }))}
          >
            {Object.entries(Locale).map(([name, val]) => (
              <option key={val} value={val}>{name} ({val})</option>
            ))}
          </Select>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.dryRun}
                onChange={(e) => setForm((f) => ({ ...f, dryRun: e.target.checked }))}
                className="w-4 h-4 accent-dec-blue"
              />
              <span className="text-sm text-gray-700">Dry run (no writes)</span>
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={run}
            loading={loading}
            variant={form.dryRun ? "secondary" : "primary"}
          >
            {form.dryRun ? "Dry Run" : "Run Sync"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="text-xs bg-surface rounded p-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      )}

      <LogsPanel filterType="syncUKCategoryTaxonomies" />
    </div>
  );
}

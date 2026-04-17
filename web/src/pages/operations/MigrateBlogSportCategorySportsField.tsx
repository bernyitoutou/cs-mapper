import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Locale } from "@convex/lib/locales";
import LogsPanel from "../../components/LogsPanel";
import { OperationOverview } from "../../components/OperationOverview";
import { OperationRunSection } from "../../components/OperationRunSection";
import { ParamGuide } from "../../components/ParamGuide";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { getOperationMeta } from "../../lib/operations";

export default function MigrateBlogSportCategorySportsField() {
  const navigate = useNavigate();
  const migrateBlogSportCategorySportsField = useAction(
    api.operations.migrateBlogSportCategorySportsField.migrateBlogSportCategorySportsField
  );
  const operation = getOperationMeta("migrate-blog-sport-category-sports-field");

  const [form, setForm] = useState({
    locale: Locale.EnGb,
    dryRun: true,
    publishAfterUpdate: false,
    clearLegacyFields: false,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function run() {
    if (
      !form.dryRun &&
      !confirm(
        `Migrate blog_sport_category.sports for ${form.locale}?${form.publishAfterUpdate ? "\nUpdated entries will be published." : ""}${form.clearLegacyFields ? "\nLegacy sport_ddfs_id and is_sport_group fields will be cleared." : ""}\n\nContinue?`
      )
    ) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await migrateBlogSportCategorySportsField(form);
      setResult(response as Record<string, unknown>);
    } catch (error) {
      alert(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-limit-1440 space-y-6">
      <button
        onClick={() => navigate("/")}
        className="text-sm text-dec-blue hover:underline cursor-pointer"
      >
        ← Back
      </button>

      <OperationOverview operationId="migrate-blog-sport-category-sports-field" />

      <OperationRunSection operationId="migrate-blog-sport-category-sports-field">
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="locale"
              value={form.locale}
              onChange={(event) => setForm((current) => ({ ...current, locale: event.target.value as Locale }))}
            >
              {Object.entries(Locale).map(([name, value]) => (
                <option key={value} value={value}>
                  {name} ({value})
                </option>
              ))}
            </Select>

            <div className="flex flex-col gap-3 justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.dryRun}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dryRun: event.target.checked }))
                  }
                  className="w-4 h-4 accent-dec-blue"
                />
                <span className="text-sm text-gray-700">Dry run (no writes)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.publishAfterUpdate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publishAfterUpdate: event.target.checked }))
                  }
                  className="w-4 h-4 accent-dec-blue"
                  disabled={form.dryRun}
                />
                <span className="text-sm text-gray-700">Publish after update</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.clearLegacyFields}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, clearLegacyFields: event.target.checked }))
                  }
                  className="w-4 h-4 accent-dec-blue"
                  disabled={form.dryRun}
                />
                <span className="text-sm text-gray-700">Clear legacy fields after copy</span>
              </label>
            </div>
          </div>

          <div className="mt-4">
            <Button onClick={run} loading={loading} variant={form.dryRun ? "secondary" : "primary"}>
              {form.dryRun ? "Dry Run Migration" : "Run Migration"}
            </Button>
          </div>
        </Card>
      </OperationRunSection>

      <ParamGuide params={operation?.paramsMeta ?? []} />

      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="text-xs bg-surface rounded p-3 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}

      <LogsPanel filterType="migrateBlogSportCategorySportsField" />
    </div>
  );
}
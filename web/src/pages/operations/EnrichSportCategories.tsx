import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Locale } from "@convex/lib/locales";
import LogsPanel from "../../components/LogsPanel";
import { ParamGuide } from "../../components/ParamGuide";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { getOperationMeta } from "../../lib/operations";

type SportCategoryOption = {
  name: string;
  sphereId: string;
  taxonomy: string;
};

export default function EnrichSportCategories() {
  const navigate = useNavigate();
  const categories = useQuery(api.services.sportCategories.listSportCategories, {});
  const enrichSportCategories = useAction(
    api.operations.enrichSportCategories.enrichSportCategories
  );
  const operation = getOperationMeta("enrich-sport-categories");

  const [locale, setLocale] = useState<Locale>(Locale.EnGb);
  const [sphereId, setSphereId] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const sortedCategories = ((categories ?? []) as SportCategoryOption[])
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const response = await enrichSportCategories({
        locale,
        sphereId: sphereId === "all" ? undefined : sphereId,
      });
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
      <div className="flex items-center gap-3">
        <span className="text-2xl">🏃</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Enrich Sport Categories</h1>
          <p className="text-sm text-gray-500">
            Extract dd_sports and article IDs from Sphere and store them in Convex.
          </p>
        </div>
      </div>

      <ParamGuide params={operation?.paramsMeta ?? []} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            {Object.entries(Locale).map(([name, value]) => (
              <option key={value} value={value}>
                {name} ({value})
              </option>
            ))}
          </Select>
          <Select
            label="category"
            value={sphereId}
            onChange={(event) => setSphereId(event.target.value)}
          >
            <option value="all">All categories</option>
            {sortedCategories.map((category) => (
              <option key={category.sphereId} value={category.sphereId}>
                {category.name} ({category.taxonomy})
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
          <Button onClick={run} loading={loading} disabled={!categories}>
            Enrich Categories
          </Button>
        </div>
      </Card>

      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="text-xs bg-surface rounded p-3 overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </Card>
      )}

      <LogsPanel filterType="enrich_sport_categories" />
    </div>
  );
}
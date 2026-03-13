import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { ParamGuide } from "../../components/ParamGuide";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { getOperationMeta } from "../../lib/operations";

type SeedResult = {
  total: number;
  inserted: number;
  updated: number;
};

export default function SeedSportCategories() {
  const navigate = useNavigate();
  const seedSportCategories = useAction(
    api.operations.seedSportCategories.seedSportCategories
  );
  const operation = getOperationMeta("seed-sport-categories");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);

  async function run() {
    if (!confirm("Seed sportCategories from the legacy JSON into Convex DB?")) {
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const response = await seedSportCategories({});
      setResult(response as SeedResult);
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
        <span className="text-2xl">🌱</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Seed Sport Categories</h1>
          <p className="text-sm text-gray-500">
            Bootstrap the sport categories table from the legacy JSON seed.
          </p>
        </div>
      </div>

      <ParamGuide params={operation?.paramsMeta ?? []} />

      <Card>
        <p className="text-sm text-gray-600 leading-relaxed">
          This is the one-time bridge from the legacy JSON file to Convex DB.
          Re-running it will upsert existing rows.
        </p>
        <div className="mt-4">
          <Button onClick={run} loading={loading}>Seed Categories</Button>
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

      <LogsPanel filterType="seed_sport_categories" />
    </div>
  );
}
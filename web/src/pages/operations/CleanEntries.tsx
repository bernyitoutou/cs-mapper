import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { OperationOverview } from "../../components/OperationOverview";
import { OperationRunSection } from "../../components/OperationRunSection";
import { ParamGuide } from "../../components/ParamGuide";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { getOperationMeta } from "../../lib/operations";

type CleanEntriesResult = {
  total: number;
  cleaned: unknown[];
};

function parseEntries(raw: string): unknown[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { entries?: unknown[] }).entries)
  ) {
    return (parsed as { entries: unknown[] }).entries;
  }
  throw new Error("Expected a JSON array or an object containing an entries array.");
}

export default function CleanEntries() {
  const navigate = useNavigate();
  const cleanEntries = useAction(api.operations.cleanEntries.cleanEntries);
  const operation = getOperationMeta("clean-entries");

  const [value, setValue] = useState(
    '[\n  {\n    "title": "Example",\n    "_version": 3,\n    "updated_at": "2026-03-13T10:00:00.000Z"\n  }\n]'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CleanEntriesResult | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const entries = parseEntries(value);
      const response = await cleanEntries({ entries });
      setResult(response as CleanEntriesResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
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
      <OperationOverview operationId="clean-entries" />

      <OperationRunSection operationId="clean-entries">
        <Card>
          <div className="space-y-2">
            <span className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
              entries json
            </span>
            <textarea
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className="w-full min-h-72 border border-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-dec-blue"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          <div className="mt-4">
            <Button onClick={run} loading={loading}>Clean Entries</Button>
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

      <LogsPanel filterType="clean_entries" />
    </div>
  );
}
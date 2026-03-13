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

export default function GenerateMigrationReport() {
  const navigate = useNavigate();
  const generateReport = useAction(api.operations.generateMigrationReport.generateMigrationReport);
  const writelog = useMutation(api.services.logs.writelog);

  const [locale, setLocale] = useState<Locale>(Locale.EnGb);
  const [result, setResult] = useState<{ categories: unknown[]; quickReport: string; detailedReport: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  async function run() {
    setLoading(true);
    setProgress("Fetching categories from Sphere & ContentStack…");
    setResult(null);
    try {
      const res = await generateReport({ locale });
      const r = res as { categories: unknown[]; quickReport: string; detailedReport: string };
      setResult(r);
      setProgress(`Done — ${r.categories.length} categories processed`);
      await writelog({
        type: "generate_report",
        status: "success",
        params: { locale },
        result: { categories: r.categories.length },
      });
    } catch (err) {
      setProgress(`Error: ${String(err)}`);
      await writelog({ type: "generate_report", status: "error", error: String(err) });
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
        <span className="text-2xl">📊</span>
        <div>
          <h1 className="text-xl font-bold text-gray-800">Migration Report</h1>
          <p className="text-sm text-gray-500">Scrape Sphere pages and generate a markdown migration status report.</p>
        </div>
      </div>

      <ParamGuide params={operations.find((o) => o.id === "generate-migration-report")!.paramsMeta} />

      <Card>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {Object.entries(Locale).map(([name, val]) => (
              <option key={val} value={val}>{name} ({val})</option>
            ))}
          </Select>
        </div>
        <div className="mt-4 flex items-center gap-4">
          <Button onClick={run} loading={loading}>Generate Report</Button>
          {progress && (
            <p className={["text-xs", progress.startsWith("Error") ? "text-red-500" : "text-dec-blue"].join(" ")}>
              {progress}
            </p>
          )}
        </div>
      </Card>

      {result && (
        <>
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Quick Summary</h2>
              <button
                onClick={() => navigate("/reports")}
                className="text-xs text-dec-blue hover:underline cursor-pointer"
              >
                View all reports →
              </button>
            </div>
            <pre className="text-xs bg-surface rounded p-3 overflow-x-auto max-h-64 whitespace-pre-wrap">
              {result.quickReport}
            </pre>
          </Card>
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Detailed Report</h2>
            <pre className="text-xs bg-surface rounded p-3 overflow-x-auto max-h-96 whitespace-pre-wrap">
              {result.detailedReport}
            </pre>
          </Card>
        </>
      )}

      <LogsPanel filterType="generate_report" />
    </div>
  );
}

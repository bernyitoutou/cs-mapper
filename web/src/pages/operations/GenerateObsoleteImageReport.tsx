import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { marked } from "marked";
import DOMPurify from "dompurify";
import LogsPanel from "../../components/LogsPanel";
import { OperationDependencies } from "../../components/OperationDependencies";
import { OperationOverview } from "../../components/OperationOverview";
import { OperationRunSection } from "../../components/OperationRunSection";
import { ParamGuide } from "../../components/ParamGuide";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { getOperationMeta } from "../../lib/operations";

type SportCategoryOption = {
  name: string;
  url: string;
  taxonomy: string;
};

type ReportResult = {
  summary: Record<string, unknown>;
  quickReport: string;
  detailedReport: string;
  categories: unknown[];
};

export default function GenerateObsoleteImageReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categories = useQuery(api.services.sportCategories.listSportCategories, {});
  const reports = useQuery(api.services.reports.listReports);
  const deleteReport = useMutation(api.services.reports.deleteReport);
  const generateReport = useAction(
    api.operations.generateObsoleteImageReport.generateObsoleteImageReport
  );
  const operation = getOperationMeta("generate-obsolete-image-report");

  const [categoryUrl, setCategoryUrl] = useState("all");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [selectedId, setSelectedId] = useState<Id<"reports"> | null>(null);

  const selectedReport = useQuery(
    api.services.reports.getReport,
    selectedId ? { id: selectedId } : "skip"
  );

  useEffect(() => {
    const reportId = searchParams.get("reportId");
    setSelectedId(reportId ? (reportId as Id<"reports">) : null);
  }, [searchParams]);

  const sortedCategories = ((categories ?? []) as SportCategoryOption[])
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));

  async function run() {
    setLoading(true);
    setProgress("Scanning category URLs and probing Pixl images…");
    setResult(null);
    try {
      const response = (await generateReport({
        categoryUrl: categoryUrl === "all" ? undefined : categoryUrl,
      })) as ReportResult;
      setResult(response);
      const categoriesCount = Array.isArray(response.categories) ? response.categories.length : 0;
      setProgress(`Done — ${categoriesCount} category URL(s) scanned`);
    } catch (error) {
      setProgress(`Error: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: Id<"reports">) {
    if (selectedId === id) {
      setSelectedId(null);
      setSearchParams({});
    }
    await deleteReport({ id });
  }

  function openReport(id: Id<"reports">) {
    setSelectedId(id);
    setSearchParams({ reportId: id });
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const renderedHtml = selectedReport?.content
    ? DOMPurify.sanitize(marked(selectedReport.content) as string)
    : null;

  return (
    <div className="page-limit-1440 space-y-6">
      <button
        onClick={() => navigate("/")}
        className="text-sm text-dec-blue hover:underline cursor-pointer"
      >
        ← Back
      </button>
      <OperationOverview operationId="generate-obsolete-image-report" />

      <OperationRunSection operationId="generate-obsolete-image-report">
        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="category url"
              value={categoryUrl}
              onChange={(event) => setCategoryUrl(event.target.value)}
            >
              <option value="all">All categories</option>
              {sortedCategories.map((category) => (
                <option key={category.url} value={category.url}>
                  {category.name} ({category.taxonomy})
                </option>
              ))}
            </Select>
          </div>
          <div className="mt-4 flex items-center gap-4">
            <Button onClick={run} loading={loading} disabled={!categories}>
              Generate Report
            </Button>
            {progress && (
              <p className={[
                "text-xs",
                progress.startsWith("Error") ? "text-red-500" : "text-dec-blue",
              ].join(" ")}>
                {progress}
              </p>
            )}
          </div>
        </Card>
      </OperationRunSection>

      <OperationDependencies operationId="generate-obsolete-image-report" />

      <ParamGuide params={operation?.paramsMeta ?? []} />

      {result && (
        <>
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Summary</h2>
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

      <div className="grid grid-cols-3 gap-5">
        <div>
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-gray-50">
              <span className="text-sm font-semibold text-gray-700">Saved Reports</span>
              {reports && <span className="ml-2 text-xs text-gray-400">{reports.length}</span>}
            </div>
            <div className="divide-y divide-[#f0f0f0] max-h-96 overflow-y-auto">
              {!reports || reports.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-400 text-center">No reports yet.</p>
              ) : (
                reports.map((report: { _id: Id<"reports">; name: string; locale: string; generatedAt: number }) => (
                  <div
                    key={report._id as string}
                    className={`px-3 py-2.5 cursor-pointer hover:bg-gray-50 flex items-start justify-between gap-2 ${selectedId === report._id ? "bg-dec-blue-light" : ""}`}
                    onClick={() => openReport(report._id as Id<"reports">)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{report.name}</p>
                      <p className="text-xs text-gray-400">
                        {report.locale} · {formatDate(report.generatedAt)}
                      </p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleDelete(report._id as Id<"reports">);
                      }}
                      className="text-xs text-red-400 hover:text-red-600 cursor-pointer shrink-0 mt-0.5"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="col-span-2">
          {selectedReport ? (
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-gray-50">
                <div>
                  <h2 className="text-sm font-semibold text-gray-800">{selectedReport.name}</h2>
                  <p className="text-xs text-gray-400">
                    {selectedReport.locale} · {formatDate(selectedReport.generatedAt)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedId(null);
                    setSearchParams({});
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div
                className="report-content p-6 overflow-y-auto max-h-[70vh]"
                dangerouslySetInnerHTML={{ __html: renderedHtml ?? "" }}
              />
            </div>
          ) : null}
        </div>
      </div>

      <LogsPanel filterType="generate_obsolete_image_report" />
    </div>
  );
}
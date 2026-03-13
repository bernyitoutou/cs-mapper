import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import LogsPanel from "../../components/LogsPanel";
import { OperationOverview } from "../../components/OperationOverview";
import { OperationRunSection } from "../../components/OperationRunSection";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Select";
import { ContentType } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";
import { ParamGuide } from "../../components/ParamGuide";
import { operations } from "../../lib/operations";

export default function DeleteEntries() {
  const navigate = useNavigate();
  const deleteEntries = useAction(api.operations.deleteEntries.deleteEntries);
  const writelog = useMutation(api.services.logs.writelog);

  const [form, setForm] = useState({
    csContentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
  });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    if (
      !confirm(
        `⚠️ This will PERMANENTLY delete all "${form.csContentTypeUid}" entries for locale "${form.locale}".\n\nThis action cannot be undone. Proceed?`
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const res = await deleteEntries(form);
      setResult(res as Record<string, unknown>);
      await writelog({ type: "deleteEntries", status: "success", params: form, result: res });
    } catch (err) {
      await writelog({ type: "deleteEntries", status: "error", params: form, error: String(err) });
      alert(`Error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-limit-1440 space-y-6">
      <button onClick={() => navigate("/")} className="text-sm text-dec-blue hover:underline cursor-pointer">
        ← Back
      </button>
      <OperationOverview operationId="delete-entries" titleClassName="text-red-700" />

      <OperationRunSection operationId="delete-entries" danger>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          ⚠️ <strong>Destructive operation.</strong> All entries of the selected content type for the given locale will be unpublished and permanently deleted.
        </div>

        <Card>
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="content type"
              value={form.csContentTypeUid}
              onChange={(e) => setForm((f) => ({ ...f, csContentTypeUid: e.target.value as ContentType }))}
            >
              {Object.entries(ContentType).map(([name, uid]) => (
                <option key={uid} value={uid}>{name} ({uid})</option>
              ))}
            </Select>
            <Select
              label="locale"
              value={form.locale}
              onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value as Locale }))}
            >
              {Object.entries(Locale).map(([name, val]) => (
                <option key={val} value={val}>{name} ({val})</option>
              ))}
            </Select>
          </div>
          <div className="mt-4">
            <Button variant="danger" onClick={run} loading={loading}>
              Delete All Entries
            </Button>
          </div>
        </Card>
      </OperationRunSection>

      <ParamGuide params={operations.find((o) => o.id === "delete-entries")!.paramsMeta} danger />

      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="text-xs bg-surface rounded p-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      )}

      <LogsPanel filterType="deleteEntries" />
    </div>
  );
}

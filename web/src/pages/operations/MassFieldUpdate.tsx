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
import { Input } from "../../components/ui/Input";
import { ContentType } from "@convex/lib/contentstack/types";
import { Locale } from "@convex/lib/locales";
import { ParamGuide } from "../../components/ParamGuide";
import { operations } from "../../lib/operations";

export default function MassFieldUpdate() {
  const navigate = useNavigate();
  const massFieldUpdate = useAction(api.operations.massFieldUpdate.massFieldUpdate);
  const writelog = useMutation(api.services.logs.writelog);

  const [form, setForm] = useState({
    csContentTypeUid: ContentType.BlogPost,
    locale: Locale.EnGb,
    field: "",
    valueRaw: "false",
    publishAfterUpdate: false,
  });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [parseError, setParseError] = useState("");

  function parseValue(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  async function run() {
    if (!form.field.trim()) {
      alert("Field path is required.");
      return;
    }
    const value = parseValue(form.valueRaw);
    if (
      !confirm(
        `Set field "${form.field}" = ${JSON.stringify(value)} on all "${form.csContentTypeUid}" entries (${form.locale})${form.publishAfterUpdate ? ", then publish" : ""}.\n\nContinue?`
      )
    )
      return;
    setLoading(true);
    setResult(null);
    try {
      const params = { csContentTypeUid: form.csContentTypeUid, locale: form.locale, field: form.field, value, publishAfterUpdate: form.publishAfterUpdate };
      const res = await massFieldUpdate(params);
      setResult(res as Record<string, unknown>);
      await writelog({ type: "massFieldUpdate", status: "success", params, result: res });
    } catch (err) {
      await writelog({ type: "massFieldUpdate", status: "error", params: { ...form }, error: String(err) });
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
      <OperationOverview operationId="mass-field-update" />

      <OperationRunSection operationId="mass-field-update">
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
            <Input
              label="field path"
              placeholder="e.g. is_active or metadata.robot_no_follow"
              value={form.field}
              onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
              hint="Supports dot notation for nested fields"
            />
            <Input
              label="value"
              placeholder='e.g. false, "hello", 42'
              value={form.valueRaw}
              onChange={(e) => {
                setForm((f) => ({ ...f, valueRaw: e.target.value }));
                try { JSON.parse(e.target.value); setParseError(""); } catch { setParseError("Invalid JSON"); }
              }}
              error={parseError || undefined}
              hint="Parsed as JSON; falls back to string"
            />
            <label className="flex items-center gap-2 col-span-2">
              <input
                type="checkbox"
                checked={form.publishAfterUpdate}
                onChange={(e) => setForm((f) => ({ ...f, publishAfterUpdate: e.target.checked }))}
                className="w-4 h-4 accent-dec-blue"
              />
              <span className="text-sm text-gray-700">Publish after update</span>
            </label>
          </div>
          <div className="mt-4">
            <Button onClick={run} loading={loading} disabled={!form.field.trim()}>
              Run Update
            </Button>
          </div>
        </Card>
      </OperationRunSection>

      <ParamGuide params={operations.find((o) => o.id === "mass-field-update")!.paramsMeta} />

      {result && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Result</h2>
          <pre className="text-xs bg-surface rounded p-3 overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        </Card>
      )}

      <LogsPanel filterType="massFieldUpdate" />
    </div>
  );
}

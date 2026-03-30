import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Locale } from "@convex/lib/locales";
import { ContentType } from "@convex/lib/contentstack/types";
import { SphereContentTypes } from "@convex/lib/sphere/types";
import type { CronInfo } from "@convex-dev/crons";
import { operations } from "../lib/operations";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { Input } from "../components/ui/Input";

// ---------------------------------------------------------------------------
// UI field definitions per schedulable operation (arg keys + form field types)
// ---------------------------------------------------------------------------

const LOCALES = Object.values(Locale);
const CS_TYPES = Object.values(ContentType);
const SPHERE_TYPE_OPTIONS = Object.entries(SphereContentTypes).map(([label, value]) => ({
  label,
  value,
}));

type FieldType = "select" | "sphere-type" | "text" | "boolean";

type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  values?: string[];
  default: string;
  optional?: boolean;
};

/** Maps operation id → the Convex arg fields needed to schedule it. */
const SCHEDULE_FIELDS: Record<string, FieldDef[]> = {
  "sphere-import": [
    { key: "locale", label: "Locale", type: "select", values: LOCALES, default: Locale.EnGb },
    { key: "sphereContentTypeId", label: "Sphere Type", type: "sphere-type", default: SphereContentTypes.HowToUse },
    { key: "csContentTypeUid", label: "CS Type", type: "select", values: CS_TYPES, default: ContentType.BlogPost },
    { key: "dryRun", label: "Dry Run", type: "boolean", default: "false" },
  ],
  "generate-migration-report": [
    { key: "locale", label: "Locale", type: "select", values: LOCALES, default: Locale.EnGb },
  ],
  "generate-sport-group-mapping": [
    { key: "locale", label: "Locale", type: "select", values: LOCALES, default: Locale.EnGb },
  ],
  "sync-uk-category-taxonomies": [
    { key: "locale", label: "Locale", type: "select", values: LOCALES, default: Locale.EnGb },
    { key: "dryRun", label: "Dry Run", type: "boolean", default: "true" },
  ],
  "seed-sport-categories": [],
  "enrich-sport-categories": [
    { key: "locale", label: "Locale", type: "select", values: LOCALES, default: Locale.EnGb },
    { key: "sphereId", label: "Category Sphere ID", type: "text", default: "", optional: true },
  ],
};

/** Operations that can be scheduled (marked schedulable: true in operations.ts). */
const SCHEDULABLE_OPS = operations.filter((op) => op.schedulable);

function getFields(opId: string): FieldDef[] {
  return SCHEDULE_FIELDS[opId] ?? [];
}



// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaultParams(opId: string): Record<string, string> {
  return Object.fromEntries(getFields(opId).map((f) => [f.key, f.default]));
}

function coerceParams(opId: string, raw: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of getFields(opId)) {
    const val = raw[field.key] ?? "";
    if (field.optional && val === "") continue;
    if (field.type === "boolean") {
      out[field.key] = val === "true";
    } else {
      out[field.key] = val;
    }
  }
  return out;
}

const TIMES_PER_DAY_OPTIONS = [
  { label: "1× per day (pick a time)", value: 1 },
  { label: "2× per day (every 12h)", value: 2 },
  { label: "3× per day (every 8h)", value: 3 },
  { label: "4× per day (every 6h)", value: 4 },
  { label: "6× per day (every 4h)", value: 6 },
  { label: "8× per day (every 3h)", value: 8 },
  { label: "12× per day (every 2h)", value: 12 },
  { label: "24× per day (every 1h)", value: 24 },
];

type Schedule =
  | { kind: "interval"; ms: number }
  | { kind: "cron"; cronspec: string };

function buildSchedule(
  scheduleMode: "preset" | "custom",
  timesPerDay: number,
  dailyHour: number,
  dailyMinute: number,
  customCron: string,
): Schedule {
  if (scheduleMode === "custom") {
    return { kind: "cron", cronspec: customCron.trim() };
  }
  if (timesPerDay === 1) {
    const mm = String(dailyMinute).padStart(2, "0");
    return { kind: "cron", cronspec: `${mm} ${dailyHour} * * *` };
  }
  const ms = (24 * 60 * 60 * 1000) / timesPerDay;
  return { kind: "interval", ms };
}

function displaySchedule(schedule: Schedule): string {
  if (schedule.kind === "interval") {
    const h = schedule.ms / (1000 * 60 * 60);
    if (Number.isInteger(h)) return `Every ${h}h`;
    const m = schedule.ms / (1000 * 60);
    return `Every ${m}m`;
  }
  return `Cron: ${schedule.cronspec}`;
}

function opLabel(id: string): string {
  const op = SCHEDULABLE_OPS.find((o) => o.id === id);
  return op ? `${op.icon} ${op.name}` : id;
}

function paramsSummary(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

/** Generates a unique, readable job name from operationId + coerced params. */
function buildJobName(opId: string, coercedParams: Record<string, unknown>): string {
  const parts = [opId];
  for (const [k, v] of Object.entries(coercedParams)) {
    if (v !== undefined && v !== null && v !== "") {
      // shorten known verbose keys
      if (k === "sphereContentTypeId") continue;
      parts.push(String(v));
    }
  }
  return parts.join(":").replace(/\s+/g, "-").toLowerCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Schedules() {
  const jobs = useQuery(api.services.scheduledJobs.listJobs) ?? [];
  const scheduledLogs = useQuery(api.services.logs.getRecentScheduledLogs) ?? [];
  const registerJob = useMutation(api.services.scheduledJobs.registerJob);
  const deleteJob = useMutation(api.services.scheduledJobs.deleteJob);

  // Build a map: jobName → last log entry
  const lastRunByName = new Map(
    [...scheduledLogs]
      .reduce<Map<string, { timestamp: number; status: "success" | "error" }>>(
        (acc, log) => {
          const jobName = log.type.replace(/^scheduled:/, "");
          if (!acc.has(jobName) || log.timestamp > acc.get(jobName)!.timestamp) {
            acc.set(jobName, { timestamp: log.timestamp, status: log.status as "success" | "error" });
          }
          return acc;
        },
        new Map()
      )
      .entries()
  );

  // Form state
  const [opId, setOpId] = useState(SCHEDULABLE_OPS[0]?.id ?? "");
  const [params, setParams] = useState<Record<string, string>>(makeDefaultParams(SCHEDULABLE_OPS[0]?.id ?? ""));
  const [scheduleMode, setScheduleMode] = useState<"preset" | "custom">("preset");
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [dailyHour, setDailyHour] = useState(8);
  const [dailyMinute, setDailyMinute] = useState(0);
  const [customCron, setCustomCron] = useState("0 8 * * *");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const selectedFields = getFields(opId);

  function handleOpChange(newOpId: string) {
    setOpId(newOpId);
    setParams(makeDefaultParams(newOpId));
    setFormError("");
  }

  function setParam(key: string, value: string) {
    setParams((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (scheduleMode === "custom" && !customCron.trim()) { setFormError("Cron expression is required."); return; }

    const schedule = buildSchedule(scheduleMode, timesPerDay, dailyHour, dailyMinute, customCron);
    const coercedParams = coerceParams(opId, params);
    const jobName = buildJobName(opId, coercedParams);
    setSaving(true);
    try {
      await registerJob({ name: jobName, operationId: opId, params: coercedParams, schedule });
      setParams(makeDefaultParams(opId));
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, jobName: string | undefined) {
    if (!confirm(`Delete scheduled job "${jobName ?? id}"?`)) return;
    await deleteJob({ id });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Scheduled Jobs</h1>
        <p className="text-sm text-gray-500 mt-1">
          Operations run automatically in the background on the configured schedule.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ── Left: Active schedules ── */}
        <div className="flex-1 min-w-0">
          <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Active Schedules</h2>
            {jobs.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No scheduled jobs yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {jobs.map((job: CronInfo) => {
                  const jobParams = (job.args as { params?: Record<string, unknown> })?.params ?? {};
                  const jobOpId = (job.args as { operationId?: string })?.operationId ?? "";
                  const lastRun = job.name ? lastRunByName.get(job.name) : undefined;
                  return (
                    <div key={job.id} className="py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        {/* Name + badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-sm text-gray-800">
                            {job.name ?? <span className="text-gray-400 italic">unnamed</span>}
                          </span>
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {opLabel(jobOpId)}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">
                            {displaySchedule(job.schedule as Schedule)}
                          </span>
                        </div>
                        {/* Params */}
                        {Object.keys(jobParams).length > 0 && (
                          <p className="text-xs text-gray-400 truncate">
                            {paramsSummary(jobParams)}
                          </p>
                        )}
                        {/* Last run */}
                        {lastRun ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${
                                lastRun.status === "success" ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span className="text-xs text-gray-400">
                              Last run:{" "}
                              <span className={lastRun.status === "error" ? "text-red-500" : "text-gray-500"}>
                                {new Date(lastRun.timestamp).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                              {lastRun.status === "error" && (
                                <span className="ml-1 text-red-400">(error)</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Never run yet</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(job.id, job.name)}
                        className="shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: New schedule form ── */}
        <Card>
            <h2 className="text-sm font-semibold text-gray-700 mb-4">New Schedule</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Select
                label="Operation"
                value={opId}
                onChange={(e) => handleOpChange(e.target.value)}
              >
                {SCHEDULABLE_OPS.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.icon} {op.name}
                  </option>
                ))}
              </Select>

              {/* Operation description */}
              {(() => {
                const op = SCHEDULABLE_OPS.find((o) => o.id === opId);
                return op ? (
                  <p className="text-xs text-gray-500 bg-gray-50 rounded px-3 py-2 border border-border leading-relaxed">
                    {op.description}
                  </p>
                ) : null;
              })()}

              {/* Dynamic params */}
              {selectedFields.length > 0 && (
                <div className="space-y-3 pl-3 border-l-2 border-blue-100">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Parameters
                  </p>
                  {selectedFields.map((field) => {
                    if (field.type === "select") {
                      return (
                        <Select
                          key={field.key}
                          label={field.label}
                          value={params[field.key] ?? field.default}
                          onChange={(e) => setParam(field.key, e.target.value)}
                        >
                          {(field.values ?? []).map((v) => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </Select>
                      );
                    }
                    if (field.type === "sphere-type") {
                      return (
                        <Select
                          key={field.key}
                          label={field.label}
                          value={params[field.key] ?? field.default}
                          onChange={(e) => setParam(field.key, e.target.value)}
                        >
                          {SPHERE_TYPE_OPTIONS.map(({ label, value }) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </Select>
                      );
                    }
                    if (field.type === "boolean") {
                      return (
                        <Select
                          key={field.key}
                          label={field.label}
                          value={params[field.key] ?? field.default}
                          onChange={(e) => setParam(field.key, e.target.value)}
                        >
                          <option value="false">off (live write)</option>
                          <option value="true">on (dry run)</option>
                        </Select>
                      );
                    }
                    return (
                      <Input
                        key={field.key}
                        label={field.label + (field.optional ? " (optional)" : "")}
                        value={params[field.key] ?? ""}
                        onChange={(e) => setParam(field.key, e.target.value)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Schedule */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Schedule</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === "preset"} onChange={() => setScheduleMode("preset")} />
                    Times per day
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="scheduleMode" checked={scheduleMode === "custom"} onChange={() => setScheduleMode("custom")} />
                    Custom cron
                  </label>
                </div>

                {scheduleMode === "preset" && (
                  <div className="space-y-3 pl-3 border-l-2 border-blue-100">
                    <Select
                      label="Frequency"
                      value={String(timesPerDay)}
                      onChange={(e) => setTimesPerDay(Number(e.target.value))}
                    >
                      {TIMES_PER_DAY_OPTIONS.map(({ label, value }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                    {timesPerDay === 1 && (
                      <div className="flex gap-2 items-end">
                        <div className="w-20">
                          <Input label="Hour (UTC)" type="number" min={0} max={23} value={dailyHour} onChange={(e) => setDailyHour(Number(e.target.value))} />
                        </div>
                        <div className="w-20">
                          <Input label="Minute" type="number" min={0} max={59} value={dailyMinute} onChange={(e) => setDailyMinute(Number(e.target.value))} />
                        </div>
                        <p className="text-xs text-gray-400 pb-2 font-mono">
                          {String(dailyMinute).padStart(2, "0")} {dailyHour} * * *
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {scheduleMode === "custom" && (
                  <div className="pl-3 border-l-2 border-blue-100">
                    <Input
                      label="Cron Expression (UTC)"
                      placeholder="0 8 * * *"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                      hint="minute hour day month weekday — use crontab.guru"
                    />
                  </div>
                )}
              </div>

              {formError && <p className="text-sm text-red-500">{formError}</p>}

              <div className="pt-1">
                <Button type="submit" disabled={saving}>
                  {saving ? "Scheduling…" : "Schedule"}
                </Button>
              </div>
            </form>
          </Card>
      </div>
    </div>
  );
}

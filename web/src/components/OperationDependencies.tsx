import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Locale } from "@convex/lib/locales";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { getOperationMeta } from "../lib/operations";

type OperationDependenciesProps = {
  operationId: string;
  locale?: Locale;
};

export function OperationDependencies({ operationId, locale = Locale.EnGb }: OperationDependenciesProps) {
  const navigate = useNavigate();
  const seedSportCategories = useAction(api.operations.seedSportCategories.seedSportCategories);
  const generateSportGroupMapping = useAction(
    api.operations.generateSportGroupMapping.generateSportGroupMapping
  );
  const [runningId, setRunningId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const operation = getOperationMeta(operationId);
  const dependencies = (operation?.dependencies ?? [])
    .map((dependency) => ({
      ...dependency,
      operation: getOperationMeta(dependency.id),
    }))
    .filter((dependency) => dependency.operation);

  if (dependencies.length === 0) {
    return null;
  }

  async function runDependency(dependencyId: string) {
    setRunningId(dependencyId);
    setMessage(null);

    try {
      if (dependencyId === "seed-sport-categories") {
        const confirmed = confirm(
          "Seed sportCategories from the legacy JSON into Convex DB now?"
        );
        if (!confirmed) {
          return;
        }
        await seedSportCategories({});
        setMessage("Seed Sport Categories completed.");
        return;
      }

      if (dependencyId === "generate-sport-group-mapping") {
        await generateSportGroupMapping({ locale });
        setMessage(`Sport Group Mapping completed for ${locale}.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunningId(null);
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50/60">
      <div className="flex items-start gap-3">
        <span className="text-xl">🔗</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-amber-900">Prerequisites</h2>
              <p className="text-sm text-amber-800 mt-1">
                This workflow depends on {dependencies.map((dependency) => dependency.operation?.name).join(", ")}. Run them first if needed.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
              {open ? "Hide" : "Show"}
            </Button>
          </div>

          {open && (
            <div className="mt-4 space-y-3">
              {dependencies.map((dependency) => (
                <div
                  key={dependency.id}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">
                        {dependency.operation?.icon} {dependency.operation?.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {dependency.reason}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(dependency.operation!.route)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        loading={runningId === dependency.id}
                        onClick={() => runDependency(dependency.id)}
                      >
                        Run now
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {message && (
            <p className="mt-3 text-xs text-amber-900">{message}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
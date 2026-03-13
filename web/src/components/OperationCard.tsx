import { useNavigate } from "react-router-dom";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import type { OperationMeta } from "../lib/operations";

export function OperationCard({ op }: { op: OperationMeta }) {
  const navigate = useNavigate();

  return (
    <Card
      padding={false}
      className={[
        "cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5",
        op.danger ? "border-red-200 hover:border-red-400" : "hover:border-dec-blue",
      ].join(" ")}
      onClick={() => navigate(op.route)}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-2xl">{op.icon}</span>
          {op.danger && (
            <Badge variant="red" className="text-xs">Destructive</Badge>
          )}
        </div>
        <h3 className={[
          "font-semibold text-sm mb-1",
          op.danger ? "text-red-700" : "text-gray-800",
        ].join(" ")}>
          {op.name}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{op.description}</p>
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-gray-400 font-medium mr-0.5">Params :</span>
          {op.params.map((p) => (
            <span
              key={p}
              className={[
                "text-xs px-1.5 py-0.5 rounded font-medium",
                op.danger
                  ? "bg-red-50 text-red-500"
                  : "bg-dec-blue-light text-dec-blue",
              ].join(" ")}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

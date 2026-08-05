import { useState } from "react";
import { ChevronRight, ChevronDown, MapPin } from "lucide-react";

// Flatten the tree once into rows with depth, so JSX has no recursion —
// this keeps the visual-edits babel traversal happy.
function flatten(nodes, depth, openMap, out) {
  for (const n of nodes) {
    out.push({ node: n, depth });
    if (n.children && openMap[n.id]) {
      flatten(n.children, depth + 1, openMap, out);
    }
  }
}

export default function RegionTree({ regions, activeId, onPick }) {
  const [openMap, setOpenMap] = useState(() => {
    const m = {};
    for (const r of regions) m[r.id] = true;
    return m;
  });

  const rows = [];
  flatten(regions, 0, openMap, rows);

  return (
    <div className="border border-border bg-white" data-testid="region-tree">
      <div className="px-3 py-2 border-b border-border text-[0.7rem] uppercase tracking-[0.15em] text-slate-500 font-semibold">
        UK Regions
      </div>
      <div className="max-h-[420px] overflow-y-auto py-1">
        {rows.map(({ node, depth }) => {
          const hasChildren = node.children && node.children.length > 0;
          const selectable = !!node.location;
          const isOpen = !!openMap[node.id];
          return (
            <div
              key={node.id}
              className={`tree-row flex items-center gap-2 ${activeId === node.id ? "active" : ""}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              data-testid={`region-node-${node.id}`}
              onClick={() => {
                if (hasChildren) {
                  setOpenMap((m) => ({ ...m, [node.id]: !m[node.id] }));
                }
                if (selectable) onPick(node);
              }}
            >
              {hasChildren ? (
                isOpen
                  ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={selectable ? "" : "font-semibold"}>{node.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

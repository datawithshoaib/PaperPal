"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import type { GraphData, RelatedPaper } from "@/lib/types";
import { cn } from "@/lib/utils";

export const RELATION_STYLE: Record<RelatedPaper["relation"], { label: string; color: string; dashed: boolean }> = {
  cites: { label: "Cites (verified)", color: "var(--aurora-1)", dashed: false },
  cited_by: { label: "Cited by (verified)", color: "var(--aurora-2)", dashed: false },
  similar_to: { label: "Similar topic", color: "var(--muted-foreground)", dashed: true },
};

type PaperNodeData = { title: string; year: number | null; root: boolean; relation: RelatedPaper["relation"] | null; selected: boolean };

function PaperNode({ data }: NodeProps<Node<PaperNodeData>>) {
  const style = data.relation ? RELATION_STYLE[data.relation] : null;
  return (
    <div
      className={cn(
        "glass w-52 rounded-2xl p-3 text-left shadow-lg transition-all",
        data.root && "bg-gradient-brand w-64 border-0 p-4 text-white shadow-primary/40",
        data.selected && !data.root && "ring-primary ring-2",
      )}
      style={style && !data.root ? { borderColor: style.color, borderStyle: style.dashed ? "dashed" : "solid" } : undefined}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0, top: "50%", left: "50%" }} />
      <Handle type="source" position={Position.Top} style={{ opacity: 0, top: "50%", left: "50%" }} />
      <div className={cn("line-clamp-3 text-xs leading-snug font-medium", data.root && "text-sm font-semibold")}>{data.title}</div>
      <div className={cn("mt-1.5 text-[10px]", data.root ? "text-white/80" : "text-muted-foreground")}>
        {data.root ? "This paper" : `${data.year ?? "n.d."} · ${style?.label}`}
      </div>
    </div>
  );
}

const nodeTypes = { paper: PaperNode };

export function CitationGraph({
  graph,
  visible,
  selectedId,
  onSelect,
}: {
  graph: GraphData;
  visible: Set<RelatedPaper["relation"]>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    const shown = graph.nodes.filter((n) => n.kind === "root" || (n.relation && visible.has(n.relation)));
    const others = shown.filter((n) => n.kind !== "root");
    const radius = Math.max(250, others.length * 26);
    const flowNodes: Node<PaperNodeData>[] = shown.map((n) => {
      const index = others.findIndex((o) => o.id === n.id);
      const angle = (index / Math.max(others.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: n.id,
        type: "paper",
        position: n.kind === "root" ? { x: -128, y: -40 } : { x: Math.cos(angle) * radius * 1.5 - 104, y: Math.sin(angle) * radius - 36 },
        data: { title: n.title, year: n.year, root: n.kind === "root", relation: n.relation, selected: n.id === selectedId },
      };
    });
    const ids = new Set(shown.map((n) => n.id));
    const flowEdges: Edge[] = graph.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => {
        const style = RELATION_STYLE[e.relation];
        return {
          id: `${e.source}->${e.target}`,
          source: e.source,
          target: e.target,
          animated: e.verified,
          markerEnd: e.verified ? { type: MarkerType.ArrowClosed, color: style.color } : undefined,
          style: { stroke: style.color, strokeWidth: e.verified ? 2 : 1.25, strokeDasharray: style.dashed ? "6 5" : undefined },
        };
      });
    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, visible, selectedId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      nodesConnectable={false}
      onNodeClick={(_, node) => onSelect(node.id)}
      onPaneClick={() => onSelect(null)}
      colorMode="system"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

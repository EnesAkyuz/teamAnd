"use client";

import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect } from "react";
import type { AgentSpec, AgentStatus, BucketCategory } from "@/lib/types";
import { AgentNodeComponent } from "./agent-node";

interface AgentCanvasProps {
  agents: Map<
    string,
    { spec: AgentSpec; status: AgentStatus; thinking: string; output: string }
  >;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  onDropBucketItem?: (agentId: string, category: BucketCategory, label: string) => void;
}

const nodeTypes = { agent: AgentNodeComponent };

export function AgentCanvas({
  agents,
  selectedAgentId,
  onSelectAgent,
  onDropBucketItem,
}: AgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    const agentArray = Array.from(agents.entries());
    const SPACING_X = 300;
    const SPACING_Y = 180;

    const depths: Record<string, number> = {};
    function getDepth(id: string): number {
      if (depths[id] !== undefined) return depths[id];
      const agent = agents.get(id);
      if (!agent || agent.spec.dependsOn.length === 0) {
        depths[id] = 0;
        return 0;
      }
      depths[id] = 1 + Math.max(...agent.spec.dependsOn.map(getDepth));
      return depths[id];
    }
    for (const [id] of agentArray) getDepth(id);

    const byDepth: Record<number, string[]> = {};
    for (const [id] of agentArray) {
      const d = depths[id] ?? 0;
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(id);
    }

    const newNodes: Node[] = agentArray.map(([id, data]) => {
      const depth = depths[id] ?? 0;
      const col = byDepth[depth] ?? [];
      const idx = col.indexOf(id);
      const colHeight = col.length * SPACING_Y;
      return {
        id,
        type: "agent",
        position: {
          x: depth * SPACING_X + 60,
          y: idx * SPACING_Y - colHeight / 2 + SPACING_Y / 2 + 200,
        },
        data: { ...data, selected: id === selectedAgentId, onDropBucketItem },
      };
    });

    const newEdges: Edge[] = [];
    for (const [id, data] of agentArray) {
      for (const dep of data.spec.dependsOn) {
        newEdges.push({
          id: `${dep}-${id}`,
          source: dep,
          target: id,
          animated: data.status === "active",
          style: {
            stroke:
              data.status === "active"
                ? "var(--status-active)"
                : "var(--line-strong)",
            strokeWidth: 1.5,
            strokeDasharray: data.status === "pending" ? "4 4" : undefined,
          },
        });
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [agents, selectedAgentId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectAgent(node.id === selectedAgentId ? null : node.id);
    },
    [selectedAgentId, onSelectAgent],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--line)" gap={28} size={0.5} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

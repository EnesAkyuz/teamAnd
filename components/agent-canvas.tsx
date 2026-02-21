"use client";

import {
  ReactFlow,
  type Node,
  type Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { useCallback, useEffect, useRef } from "react";
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

const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;

function layoutWithDagre(
  agents: Map<string, { spec: AgentSpec; status: AgentStatus; thinking: string; output: string }>,
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", nodesep: 80, ranksep: 200, marginx: 60, marginy: 60 });

  for (const [id] of agents) {
    g.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  for (const [id, data] of agents) {
    for (const dep of data.spec.dependsOn) {
      if (agents.has(dep)) {
        g.setEdge(dep, id);
      }
    }
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const [id] of agents) {
    const node = g.node(id);
    if (node) {
      positions.set(id, { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 });
    }
  }
  return positions;
}

function AgentCanvasInner({
  agents,
  selectedAgentId,
  onSelectAgent,
  onDropBucketItem,
}: AgentCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();

  // Track which agent IDs we've already laid out
  const layoutedIdsRef = useRef<Set<string>>(new Set());
  // Track user-dragged positions
  const userPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Structural changes: new/removed agents → re-layout only new ones
  useEffect(() => {
    const currentIds = new Set(agents.keys());
    const newIds = [...currentIds].filter((id) => !layoutedIdsRef.current.has(id));

    if (newIds.length === 0 && layoutedIdsRef.current.size === currentIds.size) {
      // No structural change — just update data on existing nodes
      setNodes((prev) =>
        prev.map((node) => {
          const data = agents.get(node.id);
          if (!data) return node;
          return {
            ...node,
            data: { ...data, selected: node.id === selectedAgentId, onDropBucketItem },
          };
        }),
      );

      // Update edge styles
      setEdges((prev) =>
        prev.map((edge) => {
          const targetData = agents.get(edge.target);
          if (!targetData) return edge;
          return {
            ...edge,
            animated: targetData.status === "active",
            style: {
              stroke: targetData.status === "active" ? "var(--status-active)" : "var(--line-strong)",
              strokeWidth: 1.5,
              strokeDasharray: targetData.status === "pending" ? "4 4" : undefined,
            },
          };
        }),
      );
      return;
    }

    // Structural change — layout with dagre
    const positions = layoutWithDagre(agents);

    const newNodes: Node[] = [];
    for (const [id, data] of agents) {
      // Use user-dragged position if available, otherwise dagre position
      const pos = userPositionsRef.current.get(id) ?? positions.get(id) ?? { x: 0, y: 0 };
      newNodes.push({
        id,
        type: "agent",
        position: pos,
        data: { ...data, selected: id === selectedAgentId, onDropBucketItem },
      });
    }

    const newEdges: Edge[] = [];
    for (const [id, data] of agents) {
      for (const dep of data.spec.dependsOn) {
        if (agents.has(dep)) {
          newEdges.push({
            id: `${dep}-${id}`,
            source: dep,
            target: id,
            animated: data.status === "active",
            style: {
              stroke: data.status === "active" ? "var(--status-active)" : "var(--line-strong)",
              strokeWidth: 1.5,
              strokeDasharray: data.status === "pending" ? "4 4" : undefined,
            },
          });
        }
      }
    }

    setNodes(newNodes);
    setEdges(newEdges);
    layoutedIdsRef.current = currentIds;

    // Fit view after layout with a small delay
    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [agents, selectedAgentId, onDropBucketItem, setNodes, setEdges, fitView]);

  // Track user drag positions
  const handleNodesChange = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes);
      // Save position changes from dragging
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          userPositionsRef.current.set(change.id, change.position);
        }
      }
    },
    [onNodesChange],
  );

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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background color="var(--line)" gap={28} size={0.5} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

// Wrap with ReactFlowProvider for useReactFlow hook
export function AgentCanvas(props: AgentCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

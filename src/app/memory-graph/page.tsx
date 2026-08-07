"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Zap, BookOpen, Layout, Minimize2, Maximize2 } from "lucide-react";
import { Panel, Button, Pill, Eyebrow, Skeleton } from "@/components/ui/kit";

import * as d3 from "d3";
import { D3DragEvent } from "d3";

interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: number;
  size: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  links: string[];
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

const TYPE_COLORS: Record<string, string> = {
  fact: "#10b981",
  decision: "#f59e0b",
  preference: "#8b5cf6",
  event: "#3b82f6",
  project: "#ec4899",
  contact: "#06b6d4",
  lesson: "#ef4444",
  metric: "#6366f1",
  note: "#64748b",
};

const TYPE_GROUPS: Record<string, number> = {
  fact: 0,
  decision: 1,
  preference: 2,
  event: 3,
  project: 4,
  contact: 5,
  lesson: 6,
  metric: 7,
  note: 8,
};

function useDrag(simulation: any) {
  return useCallback(
    (event: any, d: GraphNode) => {
      if (event.active) simulation.alphaTarget(0.3).restart();
      d.fx = event.x;
      d.fy = event.y;
    },
    [simulation]
  );
}

function useDragEnd(simulation: any) {
  return useCallback(
    (event: any, d: GraphNode) => {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    },
    [simulation]
  );
}

export default function MemoryGraph() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [searchQuery, setSearchQuery] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/hermes/memory-graph");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load memory graph", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = svgRef.current;
    const width = containerRef.current?.clientWidth || 800;
    const height = 600;

    const nodes = [...data.nodes];
    const links = [...data.links];

    const color = (type: string) => TYPE_COLORS[type] || "#64748b";

    const sim = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120).strength(0.7))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.size + 10))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    simulationRef.current = sim;

    const linkSelection = d3.select(svg)
      .selectAll<SVGLineElement, GraphLink>(".link")
      .data(links, (d) => `${(d.source as GraphNode).id}-${(d.target as GraphNode).id}`);

    linkSelection.join("line")
      .attr("class", "link")
      .attr("stroke", "var(--line)")
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.4);

    const nodeSelection = d3.select(svg)
      .selectAll<SVGGElement, GraphNode>(".node")
      .data(nodes, (d) => d.id);

    const drag = d3.drag<SVGGElement, GraphNode>()
      .on("start", (event) => {
        if (!event.active) sim.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on("drag", (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", (event) => {
        if (!event.active) sim.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });

    const nodeEnter = nodeSelection.join("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .call(drag as any);

    nodeEnter.append("circle")
      .attr("r", (d) => d.size)
      .attr("fill", (d) => color(d.type))
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 2)
      .attr("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.3))");

    nodeEnter.append("text")
      .attr("dy", (d) => d.size + 16)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("fill", "var(--text-2)")
      .attr("class", "num")
      .text((d) => d.label.length > 18 ? d.label.slice(0, 16) + "…" : d.label);

    nodeEnter.on("click", (event: any, d: GraphNode) => {
      event.stopPropagation();
      setSelectedNode(d);
    });

    sim.on("tick", () => {
      d3.select(svg).selectAll<SVGLineElement, GraphLink>(".link")
        .attr("x1", (d: any) => (d.source as GraphNode).x!)
        .attr("y1", (d: any) => (d.source as GraphNode).y!)
        .attr("x2", (d: any) => (d.target as GraphNode).x!)
        .attr("y2", (d: any) => (d.target as GraphNode).y!);

      d3.select(svg).selectAll<SVGGElement, GraphNode>(".node")
        .attr("transform", (d: GraphNode) => `translate(${d.x},${d.y})`);
    });

    return () => {
      sim.stop();
    };
  }, [data]);

  if (loading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  const filteredNodes = data?.nodes.filter((n) =>
    n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.type.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const typeCounts = data?.nodes.reduce((acc: Record<string, number>, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {}) || {};

  return (
    <Panel className="flex flex-col h-[700px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <Layout className="w-5 h-5 text-[var(--text-3)]" />
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text)]">Memory Knowledge Graph</h2>
            <p className="text-[11px] text-[var(--text-3)]">
              {data?.nodes.length || 0} entries, {data?.links.length || 0} connections
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
            <input
              type="text"
              placeholder="Search memories…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-[var(--surface-2)] text-[var(--text)] rounded-[8px] border border-[var(--line)] outline-none focus:border-[var(--accent)] text-[12.5px]"
            />
          </div>

          <div className="flex items-center gap-2 border-l border-[var(--line)] pl-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("graph")}
              className={viewMode === "graph" ? "bg-[var(--accent)] text-white" : ""}
            >
              <Layout className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-[var(--accent)] text-white" : ""}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Type Legend */}
      <div className="px-4 py-2 border-b border-[var(--line)] flex flex-wrap gap-2">
        {Object.entries(TYPE_GROUPS)
          .sort(([, a], [, b]) => a - b)
          .map(([type, group]) => (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
              style={{
                background: `color-mix(in srgb, ${TYPE_COLORS[type]} 18%, transparent)`,
                border: `1px solid ${TYPE_COLORS[type]}`,
                color: TYPE_COLORS[type],
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[type] }} />
              {type} ({typeCounts[type] || 0})
            </span>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === "graph" ? (
          <div ref={containerRef} className="w-full h-full" style={{ position: "relative" }}>
            <svg
              ref={svgRef}
              className="w-full h-full"
              style={{ background: "var(--bg)" }}
            />
          </div>
        ) : (
          <div className="w-full h-full overflow-y-auto p-4">
            <div className="space-y-2 max-h-full">
              {filteredNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className="panel-hover flex items-center gap-3 p-3 cursor-pointer group"
                  style={{ borderLeft: `3px solid ${TYPE_COLORS[node.type]}` }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: TYPE_COLORS[node.type] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text)] truncate">{node.label}</p>
                    <p className="text-[11px] text-[var(--text-3)] capitalize">{node.type}</p>
                  </div>
                  <Zap className="w-4 h-4 text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Node Detail Panel */}
        {selectedNode && (
          <div className="fixed inset-0 z-50 flex items-end">
            <button
              onClick={() => setSelectedNode(null)}
              className="absolute inset-0 bg-black/50"
              aria-label="Close detail"
            />
            <div className="elevated w-full max-w-md h-[70vh] animate-[hq-rise_0.3s_ease] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: TYPE_COLORS[selectedNode.type] }}
                  >
                    <BookOpen className="w-5 h-5 text-white" />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[var(--text)]">{selectedNode.label}</p>
                    <span className="text-[11px] text-[var(--text-3)] capitalize">{selectedNode.type}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedNode(null)} className="btn-ghost" aria-label="Close">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedNode.links.map((l) => (
                    <span
                      key={l}
                      className="px-2.5 py-1 text-[10.5px] rounded-full border text-[var(--text-2)]"
                      style={{ borderColor: "var(--line)" }}
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
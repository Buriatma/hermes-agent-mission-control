import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Graph node/edge types for visualization
interface GraphNode {
  id: string;
  label: string;
  type: string;
  group: number;
  size: number;
  tags: string[];
  links: string[];
  body: string;
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
}

// Type to group mapping for coloring
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

// Type to color mapping
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

// Extract links from body (markdown links and wikilinks)
function extractLinks(body: string): string[] {
  const markdownLinks = body.match(/\]\(([^)]+)\)/g)?.map(m => m.slice(2, -1)) || [];
  const wikilinks = body.match(/\[\[([^\]]+)\]\]/g)?.map(m => m.slice(2, -2)) || [];
  return [...new Set([...markdownLinks, ...wikilinks])];
}

// Create connections between nodes based on links
function createConnections(nodes: GraphNode[]): GraphLink[] {
  const links: GraphLink[] = [];
  const nodeMap = new Map<string, GraphNode>(nodes.map(n => [n.id, n]));

  for (const node of nodes) {
    for (const link of node.links) {
      // Try to find a matching node by label or ID
      const targetNode = nodes.find(n => 
        n.id === link || 
        n.label.toLowerCase() === link.toLowerCase() ||
        n.label.toLowerCase().includes(link.toLowerCase())
      );

      if (targetNode && targetNode.id !== node.id) {
        // Check if this link already exists
        const exists = links.some(l => 
          (l.source === node.id && l.target === targetNode.id) ||
          (l.source === targetNode.id && l.target === node.id)
        );

        if (!exists) {
          links.push({
            source: node.id,
            target: targetNode.id,
            value: 1
          });
        }
      }
    }
  }

  return links;
}

// Get all memory entries and convert to graph format
export async function GET() {
  try {
    const memories = await prisma.hermesMemory.findMany({
      where: { status: "active" },
      orderBy: { updatedAt: "desc" }
    });

    // Convert to graph nodes
    const nodes: GraphNode[] = memories.map(mem => ({
      id: mem.id,
      label: mem.title,
      type: mem.type,
      group: TYPE_GROUPS[mem.type] || 0,
      size: Math.max(8, Math.min(24, 8 + mem.body.split("\n").length * 2)),
      tags: mem.tags || [],
      links: extractLinks(mem.body || ""),
      body: mem.body || ""
    }));

    // Create connections
    const links = createConnections(nodes);

    return NextResponse.json({
      nodes,
      links,
      typeCounts: Object.entries(TYPE_GROUPS).reduce((acc, [type]) => {
        acc[type] = nodes.filter(n => n.type === type).length;
        return acc;
      }, {} as Record<string, number>)
    });
  } catch (error) {
    console.error("Memory graph error:", error);
    return NextResponse.json({ nodes: [], links: [], typeCounts: {} }, { status: 500 });
  }
}

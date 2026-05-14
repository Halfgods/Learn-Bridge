import { useEffect, useRef } from "react";
import * as d3 from "d3";

export type GraphNode = {
  chapterName: string;
  concepts?: string[];
  prerequisites?: string[];
  difficulty?: number;
};

export type ConceptMapCanvasProps = {
  nodes: GraphNode[];
  progressMap: Record<string, number>;
  onNodeClick?: (node: GraphNode & { score: number; isWeak: boolean }) => void;
  weakChapters?: string[];
};

const ConceptMapCanvas = ({ nodes, progressMap, onNodeClick, weakChapters = [] }: ConceptMapCanvasProps) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;
    const svgEl = svgRef.current;
    const sim = renderGraph(nodes, progressMap, onNodeClick, weakChapters, svgEl);
    return () => {
      sim?.stop();
      svgEl.innerHTML = "";
    };
  }, [nodes, progressMap, onNodeClick, weakChapters]);

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

function renderGraph(
  rawNodes: GraphNode[],
  progressMap: Record<string, number>,
  onNodeClick: ConceptMapCanvasProps["onNodeClick"],
  weakChapters: string[],
  svgEl: SVGSVGElement,
) {
  d3.select(svgEl).selectAll("*").remove();

  const width = svgEl.parentElement?.clientWidth || 900;
  const height = svgEl.parentElement?.clientHeight || 600;

  const svg = d3.select(svgEl).attr("viewBox", `0 0 ${width} ${height}`).attr("preserveAspectRatio", "xMidYMid meet");

  const container = svg.append("g");

  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.2, 5])
    .on("zoom", (event) => {
      container.attr("transform", event.transform);
    });

  svg.call(zoom);
  svg.on("dblclick.zoom", () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });

  const nodeData = rawNodes.map((n, i) => ({
    id: n.chapterName,
    ...n,
    score: progressMap[n.chapterName] ?? -1,
    isWeak: weakChapters.includes(n.chapterName),
    index: i,
  }));

  const nodeMap: Record<string, (typeof nodeData)[0]> = {};
  nodeData.forEach((n) => {
    nodeMap[n.id] = n;
  });

  const links: { source: string; target: string }[] = [];
  rawNodes.forEach((n) => {
    (n.prerequisites || []).forEach((prereq) => {
      if (nodeMap[prereq]) {
        links.push({ source: prereq, target: n.chapterName });
      }
    });
  });

  const getColor = (d: (typeof nodeData)[0]) => {
    if (d.isWeak) return "#F87171";
    if (d.score === -1) return "#E5E7EB";
    if (d.score >= 70) return "#4ADE80";
    if (d.score >= 40) return "#FBBF24";
    return "#FB7185";
  };

  const getStroke = (d: (typeof nodeData)[0]) => {
    if (d.isWeak) return "#B91C1C";
    return "#374151";
  };

  svg
    .append("defs")
    .append("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 25)
    .attr("refY", 5)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 Z")
    .attr("fill", "#9CA3AF");

  const simulation = d3
    .forceSimulation(nodeData)
    .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
    .force("charge", d3.forceManyBody().strength(-400))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide(45));

  const link = container
    .append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", "#9CA3AF")
    .attr("stroke-width", 2)
    .attr("stroke-opacity", 0.6)
    .attr("marker-end", "url(#arrowhead)");

  const node = container
    .append("g")
    .selectAll("g")
    .data(nodeData)
    .join("g")
    .style("cursor", "pointer")
    .call(
      d3
        .drag<SVGGElement, (typeof nodeData)[0]>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

  node
    .append("circle")
    .attr("r", (d) => 15 + (d.difficulty ?? 0) * 3)
    .attr("fill", getColor)
    .attr("stroke", getStroke)
    .attr("stroke-width", (d) => (d.isWeak ? 4 : 3));

  node
    .append("text")
    .text((d) => {
      const name = d.chapterName;
      return name.length > 18 ? name.slice(0, 16) + "\u2026" : name;
    })
    .attr("text-anchor", "middle")
    .attr("dy", (d) => -(20 + (d.difficulty ?? 0) * 3))
    .attr("font-size", "11px")
    .attr("font-weight", "900")
    .attr("fill", "#1F2937")
    .attr("font-family", "inherit");

  node
    .append("text")
    .text((d) => (d.score >= 0 ? `${d.score}%` : "\u2014"))
    .attr("text-anchor", "middle")
    .attr("dy", 5)
    .attr("font-size", "10px")
    .attr("font-weight", "900")
    .attr("fill", (d) => (d.score >= 0 ? "#1F2937" : "#9CA3AF"))
    .attr("font-family", "inherit");

  node.on("click", (_event, d) => {
    if (onNodeClick) onNodeClick(d);
  });

  node
    .append("title")
    .text(
      (d) =>
        `${d.chapterName}\n${d.score >= 0 ? `Score: ${d.score}%` : "Not attempted"}\nDifficulty: ${"\u2605".repeat(Math.max(0, Math.min(5, Number(d.difficulty) || 0)))}\nPrerequisites: ${(d.prerequisites || []).join(", ") || "None"}`,
    );

  simulation.on("tick", () => {
    link
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);
    node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
  });

  return simulation;
}

export default ConceptMapCanvas;

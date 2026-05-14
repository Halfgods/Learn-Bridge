import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * ConceptMapCanvas — D3.js force-directed graph for knowledge graph visualization
 * Renders chapters as nodes with prerequisite edges, colored by mastery level.
 * 
 * Props:
 *   nodes: [{ chapterName, concepts, prerequisites, difficulty }]
 *   progressMap: { chapterName: scorePercentage }
 *   onNodeClick: (node) => void
 *   weakChapters: [chapterName] — highlighted in red
 */
const ConceptMapCanvas = ({ nodes = [], progressMap = {}, onNodeClick, weakChapters = [] }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current) return;

    const svgElement = svgRef.current;
    const simulation = renderGraph(d3, nodes, progressMap, onNodeClick, weakChapters, svgElement);

    return () => {
      if (simulation) simulation.stop();
      svgElement.innerHTML = '';
    };
  }, [nodes, progressMap, onNodeClick, weakChapters]);

  return (
    <div className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};

function renderGraph(d3, rawNodes, progressMap, onNodeClick, weakChapters, svgElement) {
  // Clear previous
  d3.select(svgElement).selectAll('*').remove();

  const width = svgElement.parentElement?.clientWidth || 900;
  const height = svgElement.parentElement?.clientHeight || 600;

  const svg = d3.select(svgElement)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Zoom container — all elements go inside this <g>
  const container = svg.append('g');

  // Zoom behavior (scroll to zoom, drag to pan)
  const zoom = d3.zoom()
    .scaleExtent([0.2, 5])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
    });

  svg.call(zoom);

  // Double-click to reset zoom
  svg.on('dblclick.zoom', () => {
    svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
  });

  // Build D3 data
  const nodeData = rawNodes.map((n, i) => ({
    id: n.chapterName,
    ...n,
    score: progressMap[n.chapterName] ?? -1, // -1 = unattempted
    isWeak: weakChapters.includes(n.chapterName),
    index: i
  }));

  const nodeMap = {};
  nodeData.forEach(n => { nodeMap[n.id] = n; });

  const links = [];
  rawNodes.forEach(n => {
    (n.prerequisites || []).forEach(prereq => {
      if (nodeMap[prereq]) {
        links.push({ source: prereq, target: n.chapterName });
      }
    });
  });

  // Color based on mastery
  function getNodeColor(d) {
    if (d.isWeak) return '#FF4444';
    if (d.score === -1) return '#E5E7EB'; // gray — unattempted
    if (d.score >= 70) return '#4ADE80'; // green — mastered
    if (d.score >= 40) return '#FFD500'; // yellow — learning
    return '#FF66A1'; // pink — needs work
  }

  function getNodeStroke(d) {
    if (d.isWeak) return '#AA0000';
    return '#000000';
  }

  // Arrow marker definition
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 0 10 10')
    .attr('refX', 25)
    .attr('refY', 5)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M 0 0 L 10 5 L 0 10 Z')
    .attr('fill', '#666');

  // Simulation
  const simulation = d3.forceSimulation(nodeData)
    .force('link', d3.forceLink(links).id(d => d.id).distance(150))
    .force('charge', d3.forceManyBody().strength(-400))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(45));

  // Draw links
  const link = container.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', '#999')
    .attr('stroke-width', 2)
    .attr('stroke-opacity', 0.6)
    .attr('marker-end', 'url(#arrowhead)');

  // Draw nodes
  const node = container.append('g')
    .selectAll('g')
    .data(nodeData)
    .join('g')
    .style('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      })
    );

  // Node circles
  node.append('circle')
    .attr('r', d => 15 + (d.difficulty ?? 0) * 3)
    .attr('fill', getNodeColor)
    .attr('stroke', getNodeStroke)
    .attr('stroke-width', d => d.isWeak ? 4 : 3);

  // Node labels
  node.append('text')
    .text(d => {
      const name = d.chapterName;
      return name.length > 18 ? name.slice(0, 16) + '…' : name;
    })
    .attr('text-anchor', 'middle')
    .attr('dy', d => -(20 + (d.difficulty ?? 0) * 3))
    .attr('font-size', '11px')
    .attr('font-weight', '900')
    .attr('fill', '#000')
    .attr('font-family', 'inherit');

  // Score badges
  node.append('text')
    .text(d => d.score >= 0 ? `${d.score}%` : '—')
    .attr('text-anchor', 'middle')
    .attr('dy', 5)
    .attr('font-size', '10px')
    .attr('font-weight', '900')
    .attr('fill', d => d.score >= 0 ? '#000' : '#999')
    .attr('font-family', 'inherit');

  // Click handler
  node.on('click', (event, d) => {
    if (onNodeClick) onNodeClick(d);
  });

  // Tooltip on hover
  node.append('title').text(d => {
    const status = d.score >= 0 ? `Score: ${d.score}%` : 'Not attempted';
    const prereqs = (d.prerequisites || []).join(', ') || 'None';
    const diff = Math.max(0, Math.min(5, Number(d.difficulty) || 0));
    return `${d.chapterName}\n${status}\nDifficulty: ${'★'.repeat(diff)}\nPrerequisites: ${prereqs}`;
  });

  // Simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node.attr('transform', d => `translate(${d.x},${d.y})`);
  });

  return simulation;
}

export default ConceptMapCanvas;

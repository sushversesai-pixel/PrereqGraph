import { useMemo, useState, useEffect } from "react";
import { classifyStatus, statusLabel, statusIcon } from "../status";

const NODE_W = 248;
const NODE_H = 134;
const COL_GAP = 96;
const ROW_GAP = 26;
const PAD = 34;

const COLORS = {
    strong: "#57a876",
    weak: "#d8a844",
    gap: "#d96262",
    target: "#6576ed"
};

function computeLayout(nodes, edges) {
    const byDepth = {};
    nodes.forEach((n) => {
        (byDepth[n.depth] = byDepth[n.depth] || []).push(n);
    });

    const depths = Object.keys(byDepth)
        .map(Number)
        .sort((a, b) => a - b);

    const order = {};
    const parentOf = new Map();
    edges.forEach((e) => {
        if (!parentOf.has(e.to)) parentOf.set(e.to, []);
        parentOf.get(e.to).push(e.from);
    });

    // Order nodes within each depth by the average position of their
    // parents (barycenter heuristic) to minimise edge crossings.
    const positionOf = new Map();
    depths.forEach((d, di) => {
        const list = byDepth[d].slice();
        if (di > 0) {
            const parentPos = (id) => {
                const parents = parentOf.get(id) || [];
                if (!parents.length) return null;
                const positions = parents
                    .map((p) => positionOf.get(p))
                    .filter((p) => typeof p === "number");
                if (!positions.length) return null;
                return positions.reduce((s, p) => s + p, 0) / positions.length;
            };
            list.sort((a, b) => {
                const pa = parentPos(a.id);
                const pb = parentPos(b.id);
                if (pa === null && pb === null) return 0;
                if (pa === null) return 1;
                if (pb === null) return -1;
                return pa - pb;
            });
        }
        order[d] = list;
        list.forEach((n, i) => positionOf.set(n.id, i));
    });

    const maxNodes = Math.max(1, ...Object.values(order).map((l) => l.length));
    const maxDepth = depths.length ? depths[depths.length - 1] : 0;

    const canvasW = PAD * 2 + maxDepth * (NODE_W + COL_GAP) + NODE_W;
    const canvasH = PAD * 2 + maxNodes * NODE_H + (maxNodes - 1) * ROW_GAP;

    const pos = {};
    depths.forEach((d) => {
        const list = order[d];
        const totalH = list.length * NODE_H + (list.length - 1) * ROW_GAP;
        const startY = PAD + (canvasH - 2 * PAD - totalH) / 2;
        const x = PAD + d * (NODE_W + COL_GAP);
        list.forEach((n, i) => {
            pos[n.id] = { x, y: startY + i * (NODE_H + ROW_GAP), depth: d };
        });
    });

    return { pos, depths, canvasW, canvasH, maxDepth };
}

function edgePath(from, to) {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const bend = Math.max(28, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export default function KnowledgeMap({ data }) {
    const [statusFilter, setStatusFilter] = useState("all");
    const [depthFilter, setDepthFilter] = useState(null); // null = all
    const [selected, setSelected] = useState(null);
    const [hovered, setHovered] = useState(null);

    const graphNodes = useMemo(() => data?.graph?.nodes || [], [data]);
    const graphEdges = useMemo(() => data?.graph?.edges || [], [data]);
    const edges = useMemo(() => {
        const ids = new Set(graphNodes.map((n) => String(n.id)));
        return graphEdges.filter(
            (e) => ids.has(String(e.from)) && ids.has(String(e.to))
        );
    }, [graphNodes, graphEdges]);
    const nodes = graphNodes;

    const { pos, depths, canvasW, canvasH, maxDepth } = useMemo(
        () => computeLayout(nodes, edges),
        [nodes, edges]
    );

    const nodeMap = useMemo(() => {
        const m = new Map();
        nodes.forEach((n) => m.set(String(n.id), n));
        return m;
    }, [nodes]);

    const visible = useMemo(() => {
        const set = new Set();
        nodes.forEach((n) => {
            const depthOk = depthFilter === null || n.depth === depthFilter;
            const statusOk = statusFilter === "all" || classifyStatus(n.status) === statusFilter;
            if (depthOk && statusOk) set.add(String(n.id));
        });
        return set;
    }, [nodes, depthFilter, statusFilter]);

    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    const closeModal = () => setSelected(null);

    if (!nodes.length) {
        return (
            <div className="empty map-empty">
                No knowledge graph data available yet — run an analysis first.
            </div>
        );
    }

    const counts = {
        strong: nodes.filter((n) => classifyStatus(n.status) === "strong").length,
        weak: nodes.filter((n) => classifyStatus(n.status) === "weak").length,
        gap: nodes.filter((n) => classifyStatus(n.status) === "gap").length,
        total: nodes.length
    };

    const selectedNode = selected ? nodeMap.get(String(selected)) : null;
    const selectedInfo = selectedNode
        ? (() => {
              const children = new Map();
              const parents = new Map();
              edges.forEach((e) => {
                  if (!children.has(e.from)) children.set(e.from, []);
                  children.get(e.from).push(e.to);
                  if (!parents.has(e.to)) parents.set(e.to, []);
                  parents.get(e.to).push(e.from);
              });
              // descendant count (BFS)
              const seen = new Set();
              const stack = [...(children.get(String(selected)) || [])];
              while (stack.length) {
                  const id = stack.pop();
                  if (seen.has(id)) continue;
                  seen.add(id);
                  (children.get(id) || []).forEach((c) => stack.push(c));
              }
              return {
                  unlocks: seen.size,
                  requires: (parents.get(String(selected)) || []).length
              };
          })()
        : null;

    const searchUrl = (q) =>
        `https://www.khanacademy.org/search?page_search_query=${encodeURIComponent(q)}`;

    const renderNode = (n) => {
        const p = pos[String(n.id)];
        if (!p) return null;
        const cls = classifyStatus(n.status);
        const isVisible = visible.has(String(n.id));
        const isTarget = n.depth === 0;
        const isSelected = selected === String(n.id);
        const isHovered = hovered === String(n.id);

        return (
            <div
                key={n.id}
                className={`map-node ${isVisible ? "" : "map-node-dim"} ${
                    isSelected ? "map-node-selected" : ""
                }`}
                style={{
                    left: p.x,
                    top: p.y,
                    width: NODE_W,
                    height: NODE_H,
                    borderTopColor: isTarget ? COLORS.target : COLORS[cls]
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setSelected(isSelected ? null : String(n.id));
                }}
                onMouseEnter={() => setHovered(String(n.id))}
                onMouseLeave={() => setHovered(null)}
                title="Click to inspect"
            >
                <div className="map-node-top">
                    <span className="map-depth-badge">
                        {isTarget ? "TARGET" : `D${n.depth}`}
                    </span>
                    <span className={`map-chip ${cls}`}>
                        <i>{statusIcon(n.status)}</i>
                        {statusLabel(n.status)}
                    </span>
                </div>

                <div className="map-node-name">{n.name}</div>

                <div className="map-node-meta">
                    <span>Diff {n.difficulty}/5</span>
                    <span>{Math.round((n.confidence || 0) * 100)}% confident</span>
                </div>

                <div className="map-confidence">
                    <div
                        style={{
                            width: `${Math.round((n.confidence || 0) * 100)}%`,
                            background: isTarget ? COLORS.target : COLORS[cls]
                        }}
                    ></div>
                </div>

                {isHovered && !isSelected && (
                    <span className="map-hint">Click for details</span>
                )}
            </div>
        );
    };

    return (
        <div className="map-wrap">
            <div className="map-toolbar">
                <div className="map-toolbar-left">
                    <div className="map-legend">
                        <span>
                            <i className="legend-dot strong-dot"></i>Strong ({counts.strong})
                        </span>
                        <span>
                            <i className="legend-dot weak-dot"></i>Weak ({counts.weak})
                        </span>
                        <span>
                            <i className="legend-dot gap-dot"></i>Gap ({counts.gap})
                        </span>
                        <span>
                            <i className="legend-dot target-dot"></i>Target
                        </span>
                    </div>
                </div>

                <div className="map-filters">
                    <span className="map-filter-label">Status</span>
                    {["all", "strong", "weak", "gap"].map((f) => (
                        <button
                            key={f}
                            className={`map-pill ${statusFilter === f ? "active" : ""}`}
                            onClick={() => setStatusFilter(f)}
                        >
                            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}

                    <span className="map-filter-label">Depth</span>
                    <button
                        className={`map-pill ${depthFilter === null ? "active" : ""}`}
                        onClick={() => setDepthFilter(null)}
                    >
                        All
                    </button>
                    {Array.from({ length: maxDepth + 1 }, (_, d) => (
                        <button
                            key={d}
                            className={`map-pill ${depthFilter === d ? "active" : ""}`}
                            onClick={() => setDepthFilter(depthFilter === d ? null : d)}
                        >
                            {d === 0 ? "T" : `D${d}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="map-canvas" onClick={closeModal}>
                <div
                    className="map-inner"
                    style={{ width: canvasW, height: canvasH }}
                >
                    <svg
                        width={canvasW}
                        height={canvasH}
                        className="map-svg"
                        aria-hidden="true"
                    >
                        {edges.map((e, i) => {
                            const a = pos[String(e.from)];
                            const b = pos[String(e.to)];
                            if (!a || !b) return null;
                            const aVisible = visible.has(String(e.from));
                            const bVisible = visible.has(String(e.to));
                            const connectedToHover =
                                hovered === String(e.from) || hovered === String(e.to);
                            const opacity = !(aVisible && bVisible)
                                ? 0.05
                                : connectedToHover
                                    ? 0.9
                                    : 0.28;
                            return (
                                <path
                                    key={i}
                                    d={edgePath(a, b)}
                                    fill="none"
                                    stroke="#8a94c4"
                                    strokeWidth={connectedToHover ? 2 : 1.4}
                                    opacity={opacity}
                                />
                            );
                        })}
                    </svg>

                    {nodes.map(renderNode)}

                    {depths.length > 1 && (
                        <div className="map-depth-labels">
                            {depths.map((d) => (
                                <span
                                    key={d}
                                    style={{ left: PAD + d * (NODE_W + COL_GAP) }}
                                >
                                    {d === 0 ? "TARGET" : `DEPTH ${d}`}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="map-footnote">
                <strong>{counts.total}</strong> concepts · dependency arrows flow from a
                concept down to its prerequisites · click any node to inspect it
            </div>

            {selectedNode && selectedInfo && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <div
                        className="modal-card"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="modal-top">
                            <span className={`map-chip ${classifyStatus(selectedNode.status)}`}>
                                <i>{statusIcon(selectedNode.status)}</i>
                                {statusLabel(selectedNode.status)}
                            </span>
                            {selectedNode.depth === 0 && (
                                <span className="map-chip target">Target concept</span>
                            )}
                            <button className="modal-close" onClick={closeModal} aria-label="Close">
                                ✕
                            </button>
                        </div>

                        <h3>{selectedNode.name}</h3>
                        <p className="modal-desc">{selectedNode.description}</p>

                        <div className="modal-stats">
                            <div>
                                <strong>{selectedNode.difficulty}/5</strong>
                                <span>Difficulty</span>
                            </div>
                            <div>
                                <strong>{Math.round((selectedNode.confidence || 0) * 100)}%</strong>
                                <span>Confidence</span>
                            </div>
                            <div>
                                <strong>{selectedInfo.requires}</strong>
                                <span>Prerequisites</span>
                            </div>
                            <div>
                                <strong>{selectedInfo.unlocks}</strong>
                                <span>Unlocks</span>
                            </div>
                        </div>

                        <div className="modal-confidence">
                            <div
                                className="confidence-bar"
                                style={{ marginTop: 0 }}
                            >
                                <div
                                    style={{
                                        width: `${Math.round((selectedNode.confidence || 0) * 100)}%`,
                                        background: COLORS[classifyStatus(selectedNode.status)]
                                    }}
                                ></div>
                            </div>
                            <span>
                                {selectedNode.isGap
                                    ? "Gap — needs revision before proceeding"
                                    : "Mastered — safe to build on"}
                            </span>
                        </div>

                        {selectedNode.isGap && (
                            <a
                                className="modal-remediation"
                                href={searchUrl(selectedNode.name)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Find remediation resources for “{selectedNode.name}” →
                            </a>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// FACULTY MAP — Interactive Class Concept Map
// Overlays class-wide average mastery onto the prerequisite
// graph. Green = high class mastery, yellow/red = class gaps.
// ============================================================

import { useEffect, useMemo, useState } from "react";

const NODE_W = 232;
const NODE_H = 116;
const COL_GAP = 84;
const ROW_GAP = 24;
const PAD = 30;

function masteryColor(mastery) {
    if (mastery >= 0.65) return "#57a876";
    if (mastery >= 0.4) return "#d8a844";
    return "#d96262";
}

function computeLayout(nodes, edges) {
    const byDepth = {};
    nodes.forEach((n) => {
        (byDepth[n.depth] = byDepth[n.depth] || []).push(n);
    });
    const depths = Object.keys(byDepth).map(Number).sort((a, b) => a - b);

    const maxNodes = Math.max(1, ...depths.map((d) => byDepth[d].length));
    const maxDepth = depths.length ? depths[depths.length - 1] : 0;
    const canvasW = PAD * 2 + maxDepth * (NODE_W + COL_GAP) + NODE_W;
    const canvasH = PAD * 2 + maxNodes * NODE_H + (maxNodes - 1) * ROW_GAP;

    const pos = {};
    depths.forEach((d) => {
        const list = byDepth[d];
        const totalH = list.length * NODE_H + (list.length - 1) * ROW_GAP;
        const startY = PAD + (canvasH - 2 * PAD - totalH) / 2;
        const x = PAD + d * (NODE_W + COL_GAP);
        list.forEach((n, i) => {
            pos[String(n.id)] = { x, y: startY + i * (NODE_H + ROW_GAP), depth: d };
        });
    });
    return { pos, canvasW, canvasH, maxDepth };
}

function edgePath(from, to) {
    const x1 = from.x + NODE_W;
    const y1 = from.y + NODE_H / 2;
    const x2 = to.x;
    const y2 = to.y + NODE_H / 2;
    const bend = Math.max(28, (x2 - x1) / 2);
    return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

export default function FacultyMap({ cohort }) {
    const nodes = useMemo(() => cohort.concept_map?.nodes || [], [cohort]);
    const edges = useMemo(() => cohort.concept_map?.edges || [], [cohort]);
    const [selected, setSelected] = useState(null);
    const [hovered, setHovered] = useState(null);

    const validEdges = useMemo(() => {
        const ids = new Set(nodes.map((n) => String(n.id)));
        return edges.filter((e) => ids.has(String(e.from)) && ids.has(String(e.to)));
    }, [nodes, edges]);

    const { pos, canvasW, canvasH } = useMemo(
        () => computeLayout(nodes, validEdges),
        [nodes, validEdges]
    );

    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    if (!nodes.length) {
        return (
            <div className="empty map-empty">
                No class concept map yet — run a cohort analysis for a concept first.
            </div>
        );
    }

    const selectedNode = selected ? nodes.find((n) => String(n.id) === selected) : null;
    const totalStudents = Math.max(cohort.student_count || 1, 1);

    return (
        <div className="map-wrap">
            <div className="map-toolbar">
                <div className="map-legend">
                    <span><i className="legend-dot" style={{ background: "#57a876" }}></i>High mastery (≥65%)</span>
                    <span><i className="legend-dot" style={{ background: "#d8a844" }}></i>Partial (40–65%)</span>
                    <span><i className="legend-dot" style={{ background: "#d96262" }}></i>Class gap (&lt;40%)</span>
                </div>
                <div className="fov-legend">
                    <span><i style={{ background: "#6576ed" }}></i>Class-average mastery</span>
                </div>
            </div>

            <div className="map-canvas" onClick={() => setSelected(null)}>
                <div className="map-inner" style={{ width: canvasW, height: canvasH }}>
                    <svg width={canvasW} height={canvasH} className="map-svg">
                        {validEdges.map((e, i) => {
                            const from = pos[String(e.from)];
                            const to = pos[String(e.to)];
                            if (!from || !to) return null;
                            const active = hovered === String(e.from) || hovered === String(e.to);
                            return (
                                <path
                                    key={i}
                                    d={edgePath(from, to)}
                                    fill="none"
                                    stroke={active ? "#6576ed" : "#d3d8e5"}
                                    strokeWidth={active ? 2 : 1.2}
                                    strokeDasharray={active ? "none" : "4 3"}
                                    opacity={active ? 0.9 : 0.7}
                                />
                            );
                        })}
                    </svg>

                    {nodes.map((n) => {
                        const p = pos[String(n.id)];
                        if (!p) return null;
                        const color = masteryColor(n.class_mastery);
                        const isTarget = n.depth === 0;
                        const isSelected = selected === String(n.id);
                        const isHovered = hovered === String(n.id);
                        const masteryPct = Math.round((n.class_mastery || 0) * 100);
                        return (
                            <div
                                key={n.id}
                                className={`map-node ${isSelected ? "map-node-selected" : ""}`}
                                style={{
                                    left: p.x,
                                    top: p.y,
                                    width: NODE_W,
                                    height: NODE_H,
                                    borderTopColor: isTarget ? "#6576ed" : color
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
                                    <span className="map-chip" style={{ background: `${color}1c`, color }}>
                                        <i>{n.affected_students}</i> of {cohort.student_count} gapped
                                    </span>
                                </div>
                                <div className="map-node-name">{n.name}</div>
                                <div className="map-node-meta">
                                    <span>Diff {n.difficulty}/5</span>
                                    <span>{masteryPct}% class mastery</span>
                                </div>
                                <div className="map-confidence">
                                    <div style={{ width: `${masteryPct}%`, background: color }}></div>
                                </div>
                                {isHovered && !isSelected && (
                                    <span className="map-hint">Click for class details</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="map-footnote">
                <strong>{cohort.student_count} students</strong> · node mastery = class average confidence · colored by
                class-wide readiness
            </div>

            {selectedNode && (
                <div className="modal-backdrop" onClick={() => setSelected(null)}>
                    <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-top">
                            <span className="map-depth-badge">
                                {selectedNode.depth === 0 ? "TARGET" : `DEPTH ${selectedNode.depth}`}
                            </span>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <h3>{selectedNode.name}</h3>
                        <p className="modal-desc">
                            {selectedNode.description || "Foundational knowledge for this concept."}
                        </p>

                        <div className="modal-stats">
                            <div>
                                <strong style={{ color: masteryColor(selectedNode.class_mastery) }}>
                                    {Math.round((selectedNode.class_mastery || 0) * 100)}%
                                </strong>
                                <span>Class mastery</span>
                            </div>
                            <div>
                                <strong>{selectedNode.affected_students}</strong>
                                <span>Students gapped</span>
                            </div>
                            <div>
                                <strong>{Math.round((selectedNode.affected_students / totalStudents) * 100)}%</strong>
                                <span>Of class</span>
                            </div>
                            <div>
                                <strong>{selectedNode.downstream_impact}</strong>
                                <span>Downstream topics</span>
                            </div>
                        </div>

                        <div className="modal-confidence">
                            <span>Class mastery level</span>
                            <div className="map-confidence" style={{ height: 8 }}>
                                <div
                                    style={{
                                        width: `${Math.round((selectedNode.class_mastery || 0) * 100)}%`,
                                        background: masteryColor(selectedNode.class_mastery)
                                    }}
                                ></div>
                            </div>
                        </div>

                        <p className="modal-desc" style={{ marginTop: 14 }}>
                            {selectedNode.affected_students > 0
                                ? `${selectedNode.affected_students} student(s) have a gap here — ${
                                      selectedNode.downstream_impact > 0
                                          ? `and it gates ${selectedNode.downstream_impact} downstream topic(s), so it is worth a pre-lecture review.`
                                          : "no downstream topics depend on it."
                                  }`
                                : "No students currently have a gap on this concept."}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

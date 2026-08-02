import React from "react";
import { classifyStatus, statusIcon } from "../status";

export default function AnalysisResults({ data }) {
    if (!data) return null;

    return (
        <div className="results">
            {data.target && (
                <section className="target-hero">
                    <div className="target-main">
                        <div className="target-label">
                            <span className="target-label-dot"></span>
                            TARGET CONCEPT
                        </div>

                        <h2>{data.target.name}</h2>

                        <p>{data.target.description}</p>

                        <div className="target-tags">
                            <span className="difficulty-tag">
                                Difficulty
                                <strong>{data.target.difficulty}/5</strong>
                            </span>

                            <span
                                className={`status ${classifyStatus(data.target.status)}`}
                            >
                                <span className="status-icon">
                                    {statusIcon(data.target.status)}
                                </span>
                                {data.target.status}
                            </span>
                        </div>
                    </div>

                    <div className="target-visual">
                        <div className="orbit orbit-one"></div>
                        <div className="orbit orbit-two"></div>

                        <div className="target-core">
                            <span>
                                {data.target.name
                                    .split(" ")
                                    .map((word) => word[0])
                                    .join("")
                                    .slice(0, 3)}
                            </span>
                        </div>

                        <div className="orbit-node node-a"></div>
                        <div className="orbit-node node-b"></div>
                        <div className="orbit-node node-c"></div>
                    </div>
                </section>
            )}

            {data.statistics && (
                <section className="stats-grid">
                    <div className="stat-card stat-blue">
                        <div className="stat-icon">⛓</div>
                        <div className="stat-content">
                            <span>Prerequisites</span>
                            <strong>{data.statistics.total_prerequisites}</strong>
                            <small>Concepts in dependency chain</small>
                        </div>
                    </div>

                    <div className="stat-card stat-red">
                        <div className="stat-icon">!</div>
                        <div className="stat-content">
                            <span>Knowledge Gaps</span>
                            <strong>{data.statistics.identified_gaps}</strong>
                            <small>Concepts requiring attention</small>
                        </div>
                    </div>

                    <div className="stat-card stat-green">
                        <div className="stat-icon">✓</div>
                        <div className="stat-content">
                            <span>Strong Concepts</span>
                            <strong>{data.statistics.strong_concepts}</strong>
                            <small>Concepts already mastered</small>
                        </div>
                    </div>

                    <div className="stat-card stat-yellow">
                        <div className="stat-icon">~</div>
                        <div className="stat-content">
                            <span>Weak Concepts</span>
                            <strong>{data.statistics.weak_concepts}</strong>
                            <small>Concepts needing reinforcement</small>
                        </div>
                    </div>
                </section>
            )}

            {data.root_cause && (
                <section className="section">
                    <div className="section-header">
                        <div>
                            <div className="section-kicker">ROOT-CAUSE INTELLIGENCE</div>
                            <h2>Critical Learning Bottleneck</h2>
                            <p>
                                The earliest unresolved prerequisite with the greatest
                                downstream impact.
                            </p>
                        </div>

                        <div className="path-count">
                            {data.root_cause.downstream_impact}
                            <span>affected</span>
                        </div>
                    </div>

                    <div className="revision-item">
                        <div className="revision-number">
                            <span>!</span>
                        </div>

                        <div className="revision-content">
                            <span className="revision-label">ROOT GAP</span>
                            <h3>{data.root_cause.concept_name}</h3>
                            <p>{data.root_cause.description}</p>

                            <div className="revision-meta">
                                <span>
                                    <b>Status</b> {data.root_cause.status}
                                </span>
                                <span>
                                    <b>Confidence</b>{" "}
                                    {Math.round((data.root_cause.confidence || 0) * 100)}%
                                </span>
                                <span>
                                    <b>Downstream impact</b>{" "}
                                    {data.root_cause.downstream_impact} concepts
                                </span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {data.knowledge_debt && (
                <section className="stats-grid">
                    <div className="stat-card stat-red">
                        <div className="stat-icon">∆</div>
                        <div className="stat-content">
                            <span>Knowledge Debt</span>
                            <strong>{Math.round(data.knowledge_debt.score || 0)}</strong>
                            <small>{data.knowledge_debt.level}</small>
                        </div>
                    </div>

                    <div className="stat-card stat-yellow">
                        <div className="stat-icon">!</div>
                        <div className="stat-content">
                            <span>Critical Gaps</span>
                            <strong>{data.knowledge_debt.critical_gaps}</strong>
                            <small>High-impact unresolved concepts</small>
                        </div>
                    </div>

                    <div className="stat-card stat-blue">
                        <div className="stat-icon">↗</div>
                        <div className="stat-content">
                            <span>Affected Concepts</span>
                            <strong>{data.knowledge_debt.affected_concepts}</strong>
                            <small>Downstream learning impact</small>
                        </div>
                    </div>

                    <div className="stat-card stat-green">
                        <div className="stat-icon">✓</div>
                        <div className="stat-content">
                            <span>Gap Count</span>
                            <strong>{data.knowledge_debt.total_gaps}</strong>
                            <small>Total unresolved concepts</small>
                        </div>
                    </div>
                </section>
            )}

            <section className="section">
                <div className="section-header">
                    <div>
                        <div className="section-kicker">KNOWLEDGE GRAPH</div>
                        <h2>Prerequisite Concepts</h2>
                        <p>
                            Follow the dependency chain from foundational knowledge to
                            the target concept.
                        </p>
                    </div>

                    <div className="legend">
                        <span>
                            <i className="legend-dot strong-dot"></i>Strong
                        </span>
                        <span>
                            <i className="legend-dot weak-dot"></i>Weak
                        </span>
                        <span>
                            <i className="legend-dot gap-dot"></i>Gap
                        </span>
                    </div>
                </div>

                {data.graph?.nodes?.length > 0 ? (
                    <div className="graph-container">
                        <div className="graph-line"></div>

                        <div className="nodes">
                            {data.graph.nodes.map((node, index) => (
                                <React.Fragment key={node.id}>
                                    <div
                                        className={`node-card ${
                                            node.isGap ? "node-gap" : "node-strong"
                                        } ${node.depth === 0 ? "target-node" : ""}`}
                                    >
                                        <div className="node-top">
                                            <div className="depth-badge">D{node.depth}</div>
                                            <span
                                                className={`status ${classifyStatus(node.status)}`}
                                            >
                                                <span className="status-icon">
                                                    {statusIcon(node.status)}
                                                </span>
                                                {node.status}
                                            </span>
                                        </div>

                                        <div className="node-title-row">
                                            <div
                                                className={`node-status-marker ${
                                                    node.isGap
                                                        ? "marker-gap"
                                                        : "marker-strong"
                                                }`}
                                            ></div>
                                            <h3>{node.name}</h3>
                                        </div>

                                        <p>{node.description}</p>

                                        <div className="node-footer">
                                            <span>
                                                Difficulty
                                                <strong>{node.difficulty}</strong>
                                            </span>
                                            <span>
                                                Confidence
                                                <strong>
                                                    {Math.round(
                                                        (node.confidence || 0) * 100
                                                    )}
                                                    %
                                                </strong>
                                            </span>
                                        </div>

                                        <div className="confidence-bar">
                                            <div
                                                style={{
                                                    width: `${Math.min(
                                                        Math.max(
                                                            (node.confidence || 0) * 100,
                                                            0
                                                        ),
                                                        100
                                                    )}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    {index < data.graph.nodes.length - 1 && (
                                        <div className="graph-connector">
                                            <span>↓</span>
                                        </div>
                                    )}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="empty">No prerequisite concepts found.</div>
                )}
            </section>

            <section className="section revision-section">
                <div className="section-header">
                    <div>
                        <div className="section-kicker">RECOMMENDED ORDER</div>
                        <h2>Revision Path</h2>
                        <p>
                            Work through these knowledge gaps in order before returning
                            to the target concept.
                        </p>
                    </div>

                    {data.revision_path?.length > 0 && (
                        <div className="path-count">
                            {data.revision_path.length}
                            <span>topics</span>
                        </div>
                    )}
                </div>

                {data.revision_path?.length > 0 ? (
                    <div className="revision-list">
                        {data.revision_path.map((item, index) => (
                            <div className="revision-item" key={item.concept_id}>
                                <div className="revision-number">
                                    <span>{String(index + 1).padStart(2, "0")}</span>
                                </div>

                                <div className="revision-connector"></div>

                                <div className="revision-content">
                                    <div className="revision-heading">
                                        <div>
                                            <span className="revision-label">
                                                PRIORITY {index + 1}
                                            </span>
                                            <h3>{item.concept_name}</h3>
                                        </div>

                                        <span className={`status ${classifyStatus(item.status)}`}>
                                            <span className="status-icon">
                                                {statusIcon(item.status)}
                                            </span>
                                            {item.status}
                                        </span>
                                    </div>

                                    <p>{item.description}</p>

                                    <div className="revision-meta">
                                        <span>
                                            <b>Difficulty</b> {item.difficulty}/5
                                        </span>
                                        <span>
                                            <b>Graph depth</b> {item.depth}
                                        </span>
                                        <span>
                                            <b>Confidence</b>{" "}
                                            {Math.round((item.confidence || 0) * 100)}%
                                        </span>
                                    </div>
                                </div>

                                <div className="revision-arrow">→</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="success-box">
                        <div className="success-icon">✓</div>
                        <div>
                            <strong>You're ready to go</strong>
                            <p>
                                No prerequisite gaps were identified. You can approach
                                this concept directly.
                            </p>
                        </div>
                    </div>
                )}
            </section>

            <div className="analysis-footer">
                <div className="footer-insight-icon">✦</div>
                <div>
                    <strong>Learning recommendation</strong>
                    <p>
                        Resolve the identified prerequisite gaps first. Mastering
                        foundational concepts should make{" "}
                        <strong>{data.target?.name || "the target concept"}</strong>{" "}
                        significantly easier to learn.
                    </p>
                </div>
            </div>
        </div>
    );
}

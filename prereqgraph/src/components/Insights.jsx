import { classifyStatus, statusIcon, statusLabel } from "../status";

export default function Insights({ data, onGoAnalyze }) {
    if (!data) {
        return (
            <div className="empty">
                No insights yet — run a knowledge analysis first.
                {onGoAnalyze && (
                    <button className="empty-action" onClick={onGoAnalyze}>
                        Analyze a concept →
                    </button>
                )}
            </div>
        );
    }

    const rootCause = data.root_cause;
    const debt = data.knowledge_debt || {};
    const stats = data.statistics || {};
    const target = data.target || {};

    const debtColor =
        (debt.score || 0) >= 70 ? "#d96262" : (debt.score || 0) >= 40 ? "#d8a844" : "#57a876";

    return (
        <div className="insights-view">
            <div className="insights-head">
                <div className="page-kicker">DEEP-DIVE INTELLIGENCE</div>
                <h2>Insights for “{target.name}”</h2>
                <p>
                    {stats.identified_gaps === 0
                        ? "This concept has no prerequisite gaps — you're fully ready."
                        : `${stats.identified_gaps} of ${stats.total_prerequisites} prerequisites need attention. ${rootCause ? `The critical bottleneck is ${rootCause.concept_name}.` : ""}`}
                </p>
            </div>

            <div className="insights-grid">
                <section className="insight-card insight-root">
                    <div className="insight-card-head">
                        <div className="insight-icon">!</div>
                        <div>
                            <span className="insight-kicker">ROOT CAUSE</span>
                            <h3>Critical learning bottleneck</h3>
                        </div>
                    </div>

                    {rootCause ? (
                        <>
                            <div className="insight-root-name">
                                <span className={`status ${classifyStatus(rootCause.status)}`}>
                                    <span className="status-icon">
                                        {statusIcon(rootCause.status)}
                                    </span>
                                    {statusLabel(rootCause.status)}
                                </span>
                                <h4>{rootCause.concept_name}</h4>
                            </div>
                            <p className="insight-desc">{rootCause.description}</p>
                            <div className="revision-meta">
                                <span>
                                    <b>Depth</b> {rootCause.depth}
                                </span>
                                <span>
                                    <b>Confidence</b>{" "}
                                    {Math.round((rootCause.confidence || 0) * 100)}%
                                </span>
                                <span>
                                    <b>Downstream impact</b>{" "}
                                    {rootCause.downstream_impact} concepts
                                </span>
                            </div>
                            <p className="insight-explain">
                                This is the earliest unresolved prerequisite. Until it is
                                revised, every concept built on top of it stays blocked —
                                fixing it first gives the fastest overall progress.
                            </p>
                        </>
                    ) : (
                        <p className="insight-desc">
                            No unresolved prerequisites found in the dependency chain.
                        </p>
                    )}
                </section>

                <section className="insight-card">
                    <div className="insight-card-head">
                        <div className="insight-icon">∆</div>
                        <div>
                            <span className="insight-kicker">KNOWLEDGE DEBT</span>
                            <h3>Severity rating</h3>
                        </div>
                    </div>

                    <div className="debt-meter">
                        <div
                            className="debt-meter-fill"
                            style={{
                                width: `${Math.min(100, debt.score || 0)}%`,
                                background: debtColor
                            }}
                        ></div>
                        <div className="debt-meter-label">
                            <strong style={{ color: debtColor }}>{debt.score || 0}</strong>
                            <span>{debt.level || "LOW"}</span>
                        </div>
                    </div>

                    <div className="insight-stats">
                        <div>
                            <strong>{debt.total_gaps || 0}</strong>
                            <span>Total gaps</span>
                        </div>
                        <div>
                            <strong>{debt.critical_gaps || 0}</strong>
                            <span>Critical gaps</span>
                        </div>
                        <div>
                            <strong>{debt.affected_concepts || 0}</strong>
                            <span>Affected</span>
                        </div>
                    </div>
                </section>
            </div>

            <div className="stats-grid">
                <div className="stat-card stat-blue">
                    <div className="stat-icon">⛓</div>
                    <div className="stat-content">
                        <span>Prerequisites</span>
                        <strong>{stats.total_prerequisites || 0}</strong>
                        <small>Concepts in dependency chain</small>
                    </div>
                </div>
                <div className="stat-card stat-red">
                    <div className="stat-icon">!</div>
                    <div className="stat-content">
                        <span>Knowledge Gaps</span>
                        <strong>{stats.identified_gaps || 0}</strong>
                        <small>Concepts requiring attention</small>
                    </div>
                </div>
                <div className="stat-card stat-green">
                    <div className="stat-icon">✓</div>
                    <div className="stat-content">
                        <span>Strong Concepts</span>
                        <strong>{stats.strong_concepts || 0}</strong>
                        <small>Concepts already mastered</small>
                    </div>
                </div>
                <div className="stat-card stat-yellow">
                    <div className="stat-icon">~</div>
                    <div className="stat-content">
                        <span>Weak Concepts</span>
                        <strong>{stats.weak_concepts || 0}</strong>
                        <small>Concepts needing reinforcement</small>
                    </div>
                </div>
            </div>
        </div>
    );
}

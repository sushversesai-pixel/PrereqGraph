// ============================================================
// FACULTY DIAGNOSTICS — Root-Cause & Bottleneck Diagnostics
// Class-wide bottleneck, impact-to-student ranking, and the
// 2x2 prerequisite risk matrix.
// ============================================================

const RISK_QUADRANTS = [
    {
        key: "high_impact_high_risk",
        title: "Prioritize now",
        desc: "Affects many students and gates many topics",
        color: "#d96262",
        bg: "#ffebeb"
    },
    {
        key: "high_impact_low_risk",
        title: "Quick win",
        desc: "Many students, few downstream topics",
        color: "#e08a3c",
        bg: "#fff5dc"
    },
    {
        key: "low_impact_high_risk",
        title: "Watch list",
        desc: "Few students, but unlocks many topics",
        color: "#d8a844",
        bg: "#fdf6e3"
    },
    {
        key: "low_impact_low_risk",
        title: "Monitor",
        desc: "Few students, minimal downstream impact",
        color: "#57a876",
        bg: "#e9f7ee"
    }
];

export default function FacultyDiagnostics({ cohort }) {
    const bottleneck = cohort.bottleneck;
    const ranking = cohort.impact_ranking || [];
    const maxScore = Math.max(1, ...ranking.map((r) => r.score));
    const risk = cohort.risk_matrix || {};

    return (
        <div className="faculty-view">
            {bottleneck ? (
                <section className="fdi-bottleneck">
                    <div className="rec-root-badge">CLASS-WIDE BOTTLENECK</div>
                    <div className="fdi-bottleneck-main">
                        <div className="fdi-bottleneck-text">
                            <h2>{bottleneck.concept_name}</h2>
                            <p>
                                {bottleneck.description ||
                                    `The most impactful unresolved prerequisite for ${cohort.target?.name}.`}
                            </p>
                            <div className="revision-meta">
                                <span>
                                    <b>{bottleneck.affected_students}</b> students affected
                                </span>
                                <span>
                                    <b>{bottleneck.affected_pct}%</b> of the class
                                </span>
                                <span>
                                    <b>{bottleneck.downstream_impact}</b> downstream topic
                                    {bottleneck.downstream_impact === 1 ? "" : "s"}
                                </span>
                            </div>
                        </div>
                        <div className="fdi-bottleneck-gauge">
                            <div
                                className="fdi-gauge-ring"
                                style={{ background: `conic-gradient(#d96262 ${bottleneck.affected_pct}%, #eef0f4 0)` }}
                            >
                                <div>
                                    <strong>{bottleneck.affected_pct}%</strong>
                                    <span>affected</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            ) : (
                <section className="success-box">
                    <div className="success-icon">✓</div>
                    <div>
                        <strong>No class-wide bottleneck</strong>
                        <p>No prerequisite is blocking more than one student — the class has no shared root gap.</p>
                    </div>
                </section>
            )}

            <section className="fdi-ranking">
                <div className="section-header">
                    <div>
                        <div className="section-kicker">IMPACT-TO-STUDENT RATIO</div>
                        <h2>Prerequisite gaps ranked by class impact</h2>
                        <p>Each gap's score combines how many students it affects with how many downstream topics it gates.</p>
                    </div>
                </div>

                {ranking.length === 0 ? (
                    <div className="empty">No prerequisite gaps detected across the class.</div>
                ) : (
                    <div className="fdi-rank-list">
                        {ranking.slice(0, 8).map((g, i) => (
                            <div className="fdi-rank-item" key={g.concept_id}>
                                <div className="fdi-rank-num">{i + 1}</div>
                                <div className="fdi-rank-body">
                                    <div className="fdi-rank-head">
                                        <strong>{g.concept_name}</strong>
                                        <span>
                                            {g.affected_students} students · {g.downstream_impact} downstream
                                        </span>
                                    </div>
                                    <div className="fdi-rank-bar">
                                        <div
                                            style={{
                                                width: `${Math.max(4, (g.score / maxScore) * 100)}%`,
                                                background: i === 0 ? "#d96262" : "#6576ed"
                                            }}
                                        ></div>
                                    </div>
                                    <div className="fdi-rank-meta">
                                        <span>Affects {g.affected_pct}% of class</span>
                                        <span>Depth {g.depth}</span>
                                        <span>Score {g.score}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="fdi-matrix">
                <div className="section-header">
                    <div>
                        <div className="section-kicker">PREREQUISITE RISK MATRIX</div>
                        <h2>Prioritize pre-lecture reviews</h2>
                        <p>
                            Number of affected students vs. downstream concept impact. Start with{" "}
                            <b>Prioritize now</b>.
                        </p>
                    </div>
                </div>

                <div className="risk-matrix">
                    {RISK_QUADRANTS.map((q) => {
                        const items = risk[q.key] || [];
                        return (
                            <div
                                className="risk-quadrant"
                                key={q.key}
                                style={{ borderTopColor: q.color, background: q.bg }}
                            >
                                <div className="risk-quad-head" style={{ color: q.color }}>
                                    <strong>{q.title}</strong>
                                    <span>{items.length}</span>
                                </div>
                                <p>{q.desc}</p>
                                {items.length === 0 ? (
                                    <div className="risk-quad-empty">No gaps here</div>
                                ) : (
                                    <div className="risk-quad-items">
                                        {items.map((g) => (
                                            <div className="risk-quad-item" key={g.concept_id}>
                                                <span>{g.concept_name}</span>
                                                <small>
                                                    {g.affected_students} stud · {g.downstream_impact} down
                                                </small>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

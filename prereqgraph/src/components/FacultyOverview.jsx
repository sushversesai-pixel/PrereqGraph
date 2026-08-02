// ============================================================
// FACULTY OVERVIEW — Class Readiness & Cohort Intelligence
// Readiness meter, cohort knowledge debt, mastery histogram,
// and the syllabus pacing advisor.
// ============================================================

const READINESS_META = {
    ready: { label: "Ready", color: "#57a876", bg: "#e9f7ee" },
    needs_review: { label: "Needs Review", color: "#d8a844", bg: "#fff5dc" },
    blocked: { label: "Blocked", color: "#d96262", bg: "#ffebeb" }
};

export default function FacultyOverview({ cohort }) {
    const readiness = cohort.readiness || {};
    const total = Math.max(readiness.ready + readiness.needs_review + readiness.blocked, 1);
    const segments = [
        { key: "ready", value: readiness.ready_pct || 0, ...READINESS_META.ready },
        { key: "needs_review", value: readiness.needs_review_pct || 0, ...READINESS_META.needs_review },
        { key: "blocked", value: readiness.blocked_pct || 0, ...READINESS_META.blocked }
    ];

    const histogram = cohort.mastery_histogram || [];
    const maxHist = Math.max(1, ...histogram.map((b) => b.count));

    const debt = cohort.knowledge_debt || {};
    const debtColor = debt.level === "HIGH" ? "#d96262" : debt.level === "MODERATE" ? "#d8a844" : "#57a876";

    const pacing = cohort.pacing || {};
    const pacingAction =
        pacing.action === "review_before_proceeding"
            ? { label: "Review before proceeding", color: "#d96262" }
            : pacing.action === "quick_warmup"
                ? { label: "Quick warm-up", color: "#d8a844" }
                : { label: "Proceed", color: "#57a876" };

    return (
        <div className="faculty-view">
            <section className="fov-top">
                <div className="stat-card stat-blue">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                        <span>Students analyzed</span>
                        <strong>{cohort.student_count}</strong>
                        <small>Enrolled in the target concept graph</small>
                    </div>
                </div>
                <div className="stat-card stat-green">
                    <div className="stat-icon">✓</div>
                    <div className="stat-content">
                        <span>Class ready</span>
                        <strong>{readiness.ready_pct || 0}%</strong>
                        <small>
                            {readiness.ready} of {cohort.student_count} students have no critical gaps
                        </small>
                    </div>
                </div>
                <div className="stat-card stat-red">
                    <div className="stat-icon">⚠</div>
                    <div className="stat-content">
                        <span>Cohort knowledge debt</span>
                        <strong style={{ color: debtColor }}>{debt.score || 0}</strong>
                        <small>
                            Level <b>{debt.level || "LOW"}</b> — average prerequisite deficit across the class
                        </small>
                    </div>
                </div>
            </section>

            <section className="fov-readiness">
                <div className="section-header">
                    <div>
                        <div className="section-kicker">TARGET CONCEPT READINESS</div>
                        <h2>Is your class ready for {cohort.target?.name}?</h2>
                        <p>
                            Share of students by readiness, derived from every student's prerequisite gaps.
                        </p>
                    </div>
                    <div className="fov-legend">
                        {segments.map((s) => (
                            <span key={s.key}>
                                <i style={{ background: s.color }}></i>
                                {s.label}: {readiness[s.key]}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="readiness-meter">
                    {segments.map((s) =>
                        s.value > 0 ? (
                            <div
                                key={s.key}
                                className="readiness-seg"
                                style={{
                                    width: `${s.value}%`,
                                    background: s.color
                                }}
                                title={`${s.label}: ${s.value}%`}
                            >
                                {s.value >= 12 && (
                                    <span className="readiness-seg-label">{s.value}%</span>
                                )}
                            </div>
                        ) : null
                    )}
                </div>

                <div className="fov-meter-stats">
                    {segments.map((s) => (
                        <div key={s.key}>
                            <i style={{ background: s.color }}></i>
                            <span>
                                <b>{s.label}</b> — {readiness[s.key]} student{readiness[s.key] === 1 ? "" : "s"}
                            </span>
                        </div>
                    ))}
                    <span className="fov-total">
                        <b>{total}</b> students
                    </span>
                </div>
            </section>

            <section className="fov-grid">
                <div className="chart-card">
                    <div className="chart-head">
                        <span>Mastery distribution</span>
                        <strong>class-wide</strong>
                    </div>
                    <p className="fov-sub">
                        How student mastery (0.0 – 1.0) is spread across foundational prerequisites.
                    </p>
                    <div className="histogram">
                        {histogram.map((bin) => (
                            <div className="hist-col" key={bin.label}>
                                <div className="hist-bar-wrap">
                                    <div
                                        className="hist-bar"
                                        style={{
                                            height: `${Math.max(4, (bin.count / maxHist) * 100)}%`,
                                            background: "#6576ed"
                                        }}
                                        title={`${bin.count} students (${bin.pct}%)`}
                                    ></div>
                                </div>
                                <span className="hist-count">{bin.count}</span>
                                <span className="hist-label">{bin.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="chart-card">
                    <div className="chart-head">
                        <span>Lecture pacing advisor</span>
                        <strong className="pacing-tag" style={{ color: pacingAction.color }}>
                            {pacingAction.label}
                        </strong>
                    </div>
                    <div className="pacing-body">
                        <div className="pacing-icon" style={{ background: `${pacingAction.color}18`, color: pacingAction.color }}>
                            {pacing.action === "proceed" ? "→" : "⏱"}
                        </div>
                        <p>{pacing.message || "Loading pacing advice…"}</p>
                    </div>
                    <div className="pacing-recs">
                        <div>
                            <b>{readiness.blocked || 0}</b>
                            <span>blocked</span>
                        </div>
                        <div>
                            <b>{readiness.needs_review || 0}</b>
                            <span>need review</span>
                        </div>
                        <div>
                            <b>{readiness.ready || 0}</b>
                            <span>ready</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

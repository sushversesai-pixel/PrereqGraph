// ============================================================
// FACULTY ROSTER — Student Roster & At-Risk Intervention
// Filterable roster table, per-student gap profile modal, and
// the confidence-vs-mastery audit (misconceptions / imposters).
// ============================================================

import { useEffect, useMemo, useState } from "react";

const READINESS_BADGE = {
    ready: { label: "Ready", cls: "strong" },
    needs_review: { label: "Needs review", cls: "weak" },
    blocked: { label: "Blocked", cls: "gap" }
};

const DEBT_BADGE = {
    HIGH: { label: "High debt", cls: "gap" },
    MODERATE: { label: "Moderate", cls: "weak" },
    LOW: { label: "Low", cls: "strong" }
};

export default function FacultyRoster({ cohort }) {
    const roster = useMemo(() => cohort.roster || [], [cohort]);

    const [query, setQuery] = useState("");
    const [debtFilter, setDebtFilter] = useState("all");
    const [readinessFilter, setReadinessFilter] = useState("all");
    const [flagFilter, setFlagFilter] = useState("all");
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        if (!selected) return;
        const onKey = (e) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [selected]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return roster.filter((s) => {
            if (q && !(s.name || "").toLowerCase().includes(q) && !s.student_id.toLowerCase().includes(q)) return false;
            if (debtFilter !== "all" && s.debt_level !== debtFilter) return false;
            if (readinessFilter !== "all" && s.readiness !== readinessFilter) return false;
            if (flagFilter === "misconception" && !s.flags.includes("misconception")) return false;
            if (flagFilter === "imposter" && !s.flags.includes("imposter")) return false;
            return true;
        });
    }, [roster, query, debtFilter, readinessFilter, flagFilter]);

    const misconceptions = roster.filter((s) => s.flags.includes("misconception"));
    const imposters = roster.filter((s) => s.flags.includes("imposter"));

    const counts = useMemo(
        () => ({
            blocked: roster.filter((s) => s.readiness === "blocked").length,
            misconception: misconceptions.length,
            imposter: imposters.length
        }),
        [roster, misconceptions.length, imposters.length]
    );

    const selectedStudent = selected
        ? roster.find((s) => s.student_id === selected)
        : null;

    return (
        <div className="faculty-view">
            <section className="fro-atrisk">
                <div className="atrisk-card atrisk-red">
                    <strong>{counts.blocked}</strong>
                    <span>Blocked students — need 1-on-1 support</span>
                </div>
                <div className="atrisk-card atrisk-orange">
                    <strong>{counts.misconception}</strong>
                    <span>High confidence, low mastery (misconceptions)</span>
                </div>
                <div className="atrisk-card atrisk-teal">
                    <strong>{counts.imposter}</strong>
                    <span>Low confidence, high mastery (imposter syndrome)</span>
                </div>
            </section>

            <section className="fro-toolbar">
                <div className="input-wrap fro-search">
                    <span className="input-prefix">⌕</span>
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by name or ID…"
                    />
                </div>
                <div className="map-filters">
                    <span className="map-filter-label">Debt</span>
                    {["all", "HIGH", "MODERATE", "LOW"].map((f) => (
                        <button
                            key={f}
                            className={`map-pill ${debtFilter === f ? "active" : ""}`}
                            onClick={() => setDebtFilter(f)}
                        >
                            {f === "all" ? "All" : f}
                        </button>
                    ))}
                    <span className="map-filter-label">Status</span>
                    {["all", "blocked", "needs_review", "ready"].map((f) => (
                        <button
                            key={f}
                            className={`map-pill ${readinessFilter === f ? "active" : ""}`}
                            onClick={() => setReadinessFilter(f)}
                        >
                            {f === "all" ? "All" : READINESS_BADGE[f].label}
                        </button>
                    ))}
                    <span className="map-filter-label">Flag</span>
                    {["all", "misconception", "imposter"].map((f) => (
                        <button
                            key={f}
                            className={`map-pill ${flagFilter === f ? "active" : ""}`}
                            onClick={() => setFlagFilter(f)}
                        >
                            {f === "all" ? "All" : f === "misconception" ? "Misconceptions" : "Imposters"}
                        </button>
                    ))}
                </div>
            </section>

            <section className="fro-table-wrap">
                {filtered.length === 0 ? (
                    <div className="empty">No students match the current filters.</div>
                ) : (
                    <table className="fro-table">
                        <thead>
                            <tr>
                                <th>Student</th>
                                <th>Status</th>
                                <th>Knowledge debt</th>
                                <th>Mastery</th>
                                <th>Confidence</th>
                                <th>Gaps</th>
                                <th>Flags</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((s) => {
                                const rb = READINESS_BADGE[s.readiness] || READINESS_BADGE.ready;
                                const db = DEBT_BADGE[s.debt_level] || DEBT_BADGE.LOW;
                                return (
                                    <tr key={s.student_id}>
                                        <td>
                                            <div className="fro-student">
                                                <div className="avatar">{s.name.charAt(0)}</div>
                                                <div>
                                                    <strong>{s.name}</strong>
                                                    <span>{s.student_id}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status ${rb.cls}`}>
                                                <span className="status-icon">{rb.cls === "strong" ? "✓" : "!"}</span>
                                                {rb.label}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`status ${db.cls}`}>{db.label}</span>
                                            <span className="fro-sub">{s.knowledge_debt}/100</span>
                                        </td>
                                        <td>
                                            <div className="fro-mini-bar">
                                                <div
                                                    style={{
                                                        width: `${Math.round(s.mastery * 100)}%`,
                                                        background: s.mastery >= 0.6 ? "#57a876" : s.mastery >= 0.4 ? "#d8a844" : "#d96262"
                                                    }}
                                                ></div>
                                            </div>
                                            <span className="fro-sub">{Math.round(s.mastery * 100)}%</span>
                                        </td>
                                        <td>
                                            <span className={`status ${s.confidence >= 0.6 ? "strong" : s.confidence >= 0.35 ? "weak" : "gap"}`}>
                                                {Math.round(s.confidence * 100)}%
                                            </span>
                                        </td>
                                        <td>
                                            <b className="fro-gapcount" style={{ color: s.gap_count > 0 ? "#d96262" : "#57a876" }}>
                                                {s.gap_count}
                                            </b>
                                            <span className="fro-sub">({s.critical_gaps} critical)</span>
                                        </td>
                                        <td>
                                            {s.flags.length === 0 ? (
                                                <span className="fro-none">—</span>
                                            ) : (
                                                s.flags.map((f) => (
                                                    <span
                                                        key={f}
                                                        className={`flag-chip ${f === "misconception" ? "flag-mis" : "flag-imp"}`}
                                                        title={
                                                            f === "misconception"
                                                                ? "High confidence but low mastery"
                                                                : "Low confidence but high mastery"
                                                        }
                                                    >
                                                        {f === "misconception" ? "🧠 Misconception" : "🎭 Imposter"}
                                                    </span>
                                                ))
                                            )}
                                        </td>
                                        <td>
                                            <button className="fro-profile-btn" onClick={() => setSelected(s.student_id)}>
                                                Profile →
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </section>

            {misconceptions.length > 0 || imposters.length > 0 ? (
                <section className="fro-audit">
                    <div className="section-header">
                        <div>
                            <div className="section-kicker">CONFIDENCE VS. MASTERY AUDIT</div>
                            <h2>Learning-barrier flags</h2>
                            <p>Separates psychological barriers from conceptual ones.</p>
                        </div>
                    </div>
                    <div className="fro-audit-grid">
                        <div className="fro-audit-card fro-audit-mis">
                            <div className="fro-audit-head">🧠 Misconceptions</div>
                            <p>High confidence, low mastery — students think they know it but don't.</p>
                            <div className="fro-audit-list">
                                {misconceptions.map((s) => (
                                    <div key={s.student_id} className="fro-audit-item">
                                        <span>{s.name}</span>
                                        <small>
                                            conf {Math.round(s.confidence * 100)}% · mastery {Math.round(s.mastery * 100)}%
                                        </small>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="fro-audit-card fro-audit-imp">
                            <div className="fro-audit-head">🎭 Imposter syndrome</div>
                            <p>Low confidence, high mastery — capable students who underestimate themselves.</p>
                            <div className="fro-audit-list">
                                {imposters.map((s) => (
                                    <div key={s.student_id} className="fro-audit-item">
                                        <span>{s.name}</span>
                                        <small>
                                            conf {Math.round(s.confidence * 100)}% · mastery {Math.round(s.mastery * 100)}%
                                        </small>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            ) : null}

            {selectedStudent && (
                <div className="modal-backdrop" onClick={() => setSelected(null)}>
                    <div className="modal-card fro-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-top">
                            <div className="avatar fro-modal-avatar">{selectedStudent.name.charAt(0)}</div>
                            <div>
                                <h3 style={{ margin: 0 }}>{selectedStudent.name}</h3>
                                <div className="modal-desc">{selectedStudent.student_id}</div>
                            </div>
                            <button className="modal-close" onClick={() => setSelected(null)}>✕</button>
                        </div>

                        <div className="modal-stats">
                            <div>
                                <strong style={{ color: READINESS_BADGE[selectedStudent.readiness]?.color }}>
                                    {READINESS_BADGE[selectedStudent.readiness]?.label}
                                </strong>
                                <span>Status</span>
                            </div>
                            <div>
                                <strong>{selectedStudent.knowledge_debt}</strong>
                                <span>Debt score</span>
                            </div>
                            <div>
                                <strong>{Math.round(selectedStudent.mastery * 100)}%</strong>
                                <span>Mastery</span>
                            </div>
                            <div>
                                <strong>{Math.round(selectedStudent.confidence * 100)}%</strong>
                                <span>Confidence</span>
                            </div>
                        </div>

                        <div className="fro-gap-profile">
                            <div className="fro-gap-profile-head">
                                <strong>Individual gap profile</strong>
                                <span>
                                    {selectedStudent.gap_count} gap{selectedStudent.gap_count === 1 ? "" : "s"} ·{" "}
                                    {selectedStudent.critical_gaps} critical
                                </span>
                            </div>
                            {selectedStudent.root_cause ? (
                                <div className="fro-rootcause">
                                    <div className="rec-root-badge">ROOT GAP</div>
                                    <div>
                                        <strong>{selectedStudent.root_cause.concept_name}</strong>
                                        <span>
                                            Depth {selectedStudent.root_cause.depth} — deepest unresolved prerequisite
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="fro-rootcause fro-root-none">
                                    <div>✓</div>
                                    <span>No root gap — all prerequisites are satisfied.</span>
                                </div>
                            )}
                            {selectedStudent.flags.length > 0 && (
                                <div className="fro-flag-note">
                                    {selectedStudent.flags.map((f) => (
                                        <span key={f} className={`flag-chip ${f === "misconception" ? "flag-mis" : "flag-imp"}`}>
                                            {f === "misconception" ? "🧠 Possible misconception" : "🎭 Possible imposter"}
                                        </span>
                                    ))}
                                    <p>
                                        Recommended:{" "}
                                        {selectedStudent.flags.includes("misconception")
                                            ? "verify understanding with a diagnostic retest before remediation."
                                            : "encourage participation and positive reinforcement; mastery is already high."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

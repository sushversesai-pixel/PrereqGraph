// ============================================================
// FACULTY ACTIONS — Remediation & Action Tools
// Group remediation dispatcher, pre-lecture quiz generator,
// and exportable health reports (CSV / print-to-PDF).
// ============================================================

import { useMemo, useState } from "react";

const READINESS_CLASS = {
    ready: "strong",
    needs_review: "weak",
    blocked: "gap"
};

function exportCsv(filename, rows) {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export default function FacultyActions({ cohort }) {
    const [copied, setCopied] = useState(null);
    const [revealed, setRevealed] = useState([]);
    const [quizVisible, setQuizVisible] = useState(false);

    const groups = useMemo(() => cohort.remediation_groups || [], [cohort]);
    const quiz = useMemo(() => cohort.quiz || [], [cohort]);
    const roster = useMemo(() => cohort.roster || [], [cohort]);

    const copyStudents = async (group, gi) => {
        const names = group.students.map((s) => s.name).join(", ");
        try {
            await navigator.clipboard.writeText(names);
            setCopied(gi);
            setTimeout(() => setCopied(null), 1600);
        } catch (err) {
            console.error("CLIPBOARD ERROR:", err);
        }
    };

    const toggleReveal = (qi) => {
        setRevealed((prev) =>
            prev.includes(qi) ? prev.filter((x) => x !== qi) : [...prev, qi]
        );
    };

    const exportRoster = () => {
        exportCsv(
            `prereqgraph-roster-${cohort.target?.name || "class"}.csv`,
            [
                ["Student", "Status", "Debt Level", "Debt Score", "Mastery %", "Confidence %", "Gaps", "Critical Gaps", "Flags"],
                ...roster.map((s) => [
                    s.name,
                    s.readiness,
                    s.debt_level,
                    s.knowledge_debt,
                    Math.round(s.mastery * 100),
                    Math.round(s.confidence * 100),
                    s.gap_count,
                    s.critical_gaps,
                    s.flags.join(" | ")
                ])
            ]
        );
    };

    const exportSummary = () => {
        const r = cohort.readiness || {};
        const d = cohort.knowledge_debt || {};
        const b = cohort.bottleneck;
        exportCsv(
            `prereqgraph-report-${cohort.target?.name || "class"}.csv`,
            [
                ["Metric", "Value"],
                ["Target concept", cohort.target?.name || ""],
                ["Students analyzed", cohort.student_count],
                ["Ready", `${r.ready} (${r.ready_pct}%)`],
                ["Needs review", `${r.needs_review} (${r.needs_review_pct}%)`],
                ["Blocked", `${r.blocked} (${r.blocked_pct}%)`],
                ["Cohort knowledge debt", `${d.score} (${d.level})`],
                ["Class bottleneck", b ? b.concept_name : "None"],
                ["Bottleneck affected", b ? `${b.affected_students} students (${b.affected_pct}%)` : "-"],
                ["Bottleneck downstream", b ? b.downstream_impact : "-"],
                ["Pacing advice", cohort.pacing?.message || ""]
            ]
        );
    };

    return (
        <div className="faculty-view">
            <section>
                <div className="section-header">
                    <div>
                        <div className="section-kicker">GROUP REMEDIATION DISPATCHER</div>
                        <h2>Group students by shared root cause</h2>
                        <p>
                            Each group shares the same foundational gap — send them a tailored revision path or
                            supplementary material in one action.
                        </p>
                    </div>
                </div>

                {groups.length === 0 ? (
                    <div className="empty">No shared root causes — the class has no remediation groups.</div>
                ) : (
                    <div className="fac-rem-groups">
                        {groups.map((g, gi) => (
                            <div className="fac-rem-group" key={g.concept_id}>
                                <div className="fac-rem-head">
                                    <div className="rec-root-badge">ROOT CAUSE</div>
                                    <span className="fac-rem-count">{g.count} students</span>
                                </div>
                                <h3>{g.concept_name}</h3>
                                <div className="fac-rem-students">
                                    {g.students.map((s) => (
                                        <span key={s.student_id} className="fac-rem-student">
                                            {s.name}
                                            <i className={`status ${READINESS_CLASS[s.readiness] || "weak"}`}></i>
                                        </span>
                                    ))}
                                </div>
                                <div className="fac-rem-actions">
                                    <button className="fac-btn" onClick={() => copyStudents(g, gi)}>
                                        {copied === gi ? "✓ Copied" : "Copy student list"}
                                    </button>
                                    <button className="fac-btn fac-btn-ghost">Email revision path ✉</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section>
                <div className="section-header">
                    <div>
                        <div className="section-kicker">TARGETED PRE-LECTURE QUIZ</div>
                        <h2>Diagnostic check before the chapter</h2>
                        <p>
                            A 3–5 question diagnostic focused on the identified class bottleneck — ready to project
                            or copy into your LMS.
                        </p>
                    </div>
                    <button className="fac-btn" onClick={() => setQuizVisible((v) => !v)}>
                        {quizVisible ? "Hide quiz" : "Generate quiz"}
                    </button>
                </div>

                {quizVisible && (
                    <div className="fac-quiz">
                        {quiz.length === 0 ? (
                            <div className="empty">Not enough class data to generate a quiz yet.</div>
                        ) : (
                            quiz.map((q, qi) => (
                                <div className="fac-question" key={qi}>
                                    <div className="fac-question-head">
                                        <span className="fac-question-num">Q{qi + 1}</span>
                                        <p>{q.question}</p>
                                    </div>
                                    <div className="fac-options">
                                        {q.options.map((opt, oi) => {
                                            const isAnswer = revealed.includes(qi) && opt === q.answer;
                                            const isWrong =
                                                revealed.includes(qi) && opt !== q.answer;
                                            return (
                                                <div
                                                    key={oi}
                                                    className={`fac-option ${
                                                        isAnswer ? "fac-option-correct" : ""
                                                    } ${isWrong ? "fac-option-wrong" : ""}`}
                                                >
                                                    <span className="fac-option-letter">
                                                        {String.fromCharCode(65 + oi)}
                                                    </span>
                                                    {opt}
                                                    {isAnswer && <i>✓</i>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {revealed.includes(qi) && (
                                        <div className="fac-rationale">
                                            <strong>Why:</strong> {q.rationale}
                                        </div>
                                    )}
                                    <button className="fac-btn fac-btn-ghost" onClick={() => toggleReveal(qi)}>
                                        {revealed.includes(qi) ? "Hide answer" : "Reveal answer"}
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </section>

            <section>
                <div className="section-header">
                    <div>
                        <div className="section-kicker">EXPORTABLE HEALTH REPORTS</div>
                        <h2>Share cohort readiness</h2>
                        <p>Export a CSV summary for departmental reporting or accreditation tracking.</p>
                    </div>
                </div>
                <div className="fac-export-row">
                    <div className="fac-export-card">
                        <div className="fac-export-icon">📄</div>
                        <div>
                            <strong>Full student roster</strong>
                            <span>Every student's readiness, debt, mastery, confidence and flags.</span>
                        </div>
                        <button className="fac-btn" onClick={exportRoster}>Export CSV</button>
                    </div>
                    <div className="fac-export-card">
                        <div className="fac-export-icon">📊</div>
                        <div>
                            <strong>Cohort summary report</strong>
                            <span>Readiness distribution, bottleneck and pacing advice in one file.</span>
                        </div>
                        <button className="fac-btn" onClick={exportSummary}>Export CSV</button>
                    </div>
                    <div className="fac-export-card">
                        <div className="fac-export-icon">🖨</div>
                        <div>
                            <strong>Print to PDF</strong>
                            <span>Use your browser's print dialog to save a snapshot of this view.</span>
                        </div>
                        <button className="fac-btn fac-btn-ghost" onClick={() => window.print()}>
                            Print view
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

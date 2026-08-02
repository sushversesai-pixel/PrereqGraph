import { useMemo, useState } from "react";
import { classifyStatus, statusIcon } from "../status";

function estimateHours(item) {
    const difficulty = Number(item.difficulty || 1);
    const confidence = Math.min(Math.max(Number(item.confidence || 0), 0), 1);
    return Math.max(1, Math.round(difficulty * 1.5 + (1 - confidence) * 3));
}

export default function LearningPaths({ data, learnerKey, onGoAnalyze }) {
    const conceptId = data?.target?.id || "concept";
    const storageKey = `pg:path:${learnerKey}:${conceptId}`;

    const [mastered, setMastered] = useState(() => {
        try {
            return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
        } catch {
            return new Set();
        }
    });

    const steps = useMemo(() => data?.revision_path || [], [data]);
    const stats = useMemo(() => data?.statistics || {}, [data]);
    const total = Number(stats.total_prerequisites || 0);

    const masteredCount = mastered.size;

    const { readiness, remainingHours, completedHours } = useMemo(() => {
        const base = Number(stats.strong_concepts || 0);
        const ready = Math.min(100, Math.round(((base + masteredCount) / Math.max(total, 1)) * 100));
        let remain = 0;
        let done = 0;
        steps.forEach((s) => {
            const h = estimateHours(s);
            if (mastered.has(String(s.concept_id))) done += h;
            else remain += h;
        });
        return { readiness: ready, remainingHours: remain, completedHours: done };
    }, [stats, mastered, masteredCount, steps, total]);

    const toggle = (id) => {
        setMastered((prev) => {
            const next = new Set(prev);
            if (next.has(String(id))) next.delete(String(id));
            else next.add(String(id));
            try {
                localStorage.setItem(storageKey, JSON.stringify([...next]));
            } catch {
                /* storage unavailable */
            }
            return next;
        });
    };

    const reset = () => {
        setMastered(new Set());
        try {
            localStorage.removeItem(storageKey);
        } catch {
            /* ignore */
        }
    };

    if (!data) {
        return (
            <div className="empty">
                No learning path yet — run a knowledge analysis first.
                {onGoAnalyze && (
                    <button className="empty-action" onClick={onGoAnalyze}>
                        Analyze a concept →
                    </button>
                )}
            </div>
        );
    }

    if (!steps.length) {
        return (
            <div className="success-box path-ready">
                <div className="success-icon">✓</div>
                <div>
                    <strong>You're ready to go</strong>
                    <p>
                        No prerequisite gaps were identified for “{data.target?.name}”.
                        You can approach this concept directly.
                    </p>
                </div>
            </div>
        );
    }

    const ringStyle = {
        background: `conic-gradient(#5969d7 ${readiness}%, #eef0f4 ${readiness}% 100%)`
    };

    return (
        <div className="learning-path">
            <div className="path-hero">
                <div className="path-hero-main">
                    <div className="page-kicker">PERSONAL LEARNING PATH</div>
                    <h2>Master “{data.target?.name}”</h2>
                    <p>
                        Work through the {steps.length} identified gaps in order. Check a
                        topic off as you revise it — your readiness score updates instantly.
                    </p>
                </div>

                <div className="path-summary">
                    <div className="readiness-ring" style={ringStyle}>
                        <div>
                            <strong>{readiness}%</strong>
                            <span>ready</span>
                        </div>
                    </div>

                    <div className="path-stats">
                        <div>
                            <strong>{steps.length - masteredCount}</strong>
                            <span>topics left</span>
                        </div>
                        <div>
                            <strong>≈ {remainingHours}h</strong>
                            <span>to mastery</span>
                        </div>
                        <div>
                            <strong>{completedHours}h</strong>
                            <span>revised</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="path-progress-row">
                <div className="path-progress-track">
                    <div style={{ width: `${readiness}%` }}></div>
                </div>
                <span>{readiness}% readiness</span>
                <button className="path-reset" onClick={reset}>
                    Reset progress
                </button>
            </div>

            <div className="revision-list path-timeline">
                {steps.map((item, index) => {
                    const isDone = mastered.has(String(item.concept_id));
                    return (
                        <div
                            className={`revision-item path-step ${isDone ? "path-step-done" : ""}`}
                            key={item.concept_id}
                        >
                            <div className="path-check">
                                <button
                                    type="button"
                                    className={`path-checkbox ${isDone ? "checked" : ""}`}
                                    onClick={() => toggle(item.concept_id)}
                                    aria-label={
                                        isDone
                                            ? `Mark ${item.concept_name} as not mastered`
                                            : `Mark ${item.concept_name} as mastered`
                                    }
                                >
                                    {isDone ? "✓" : ""}
                                </button>
                            </div>

                            <div className="revision-number">
                                <span>{String(index + 1).padStart(2, "0")}</span>
                            </div>

                            <div className="revision-connector"></div>

                            <div className="revision-content">
                                <div className="revision-heading">
                                    <div>
                                        <span className="revision-label">
                                            STEP {index + 1} · DEPTH {item.depth}
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
                                        <b>Confidence</b>{" "}
                                        {Math.round((item.confidence || 0) * 100)}%
                                    </span>
                                    <span>
                                        <b>Est. time</b> ≈ {estimateHours(item)}h
                                    </span>
                                </div>
                            </div>

                            <div className="revision-arrow">
                                {isDone ? "✓" : "→"}
                            </div>
                        </div>
                    );
                })}
            </div>

            {masteredCount === steps.length && (
                <div className="success-box">
                    <div className="success-icon">✓</div>
                    <div>
                        <strong>Path complete!</strong>
                        <p>
                            All prerequisite gaps are now marked as mastered. Re-analyze
                            “{data.target?.name}” to confirm your updated readiness.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

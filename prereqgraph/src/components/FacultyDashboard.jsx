// ============================================================
// FACULTY DASHBOARD — cohort-level diagnostic intelligence
// ------------------------------------------------------------
// A single concept selector drives five views:
//   overview     — Class readiness & cohort intelligence
//   diagnostics  — Root-cause & bottleneck diagnostics
//   roster       — Student roster & at-risk intervention
//   map          — Class concept map
//   actions      — Remediation & action tools
// ============================================================

import { useState } from "react";
import { getFacultyCohort } from "../api";
import { buildDemoCohort } from "../demo";
import FacultyOverview from "./FacultyOverview";
import FacultyDiagnostics from "./FacultyDiagnostics";
import FacultyRoster from "./FacultyRoster";
import FacultyMap from "./FacultyMap";
import FacultyActions from "./FacultyActions";

const TABS = [
    { key: "overview", label: "Class Overview", icon: "◈" },
    { key: "diagnostics", label: "Bottleneck", icon: "▣" },
    { key: "roster", label: "Student Roster", icon: "☰" },
    { key: "map", label: "Class Map", icon: "▦" },
    { key: "actions", label: "Actions", icon: "⚡" }
];

export default function FacultyDashboard({ demoMode, defaultConcept }) {
    const [conceptId, setConceptId] = useState(defaultConcept || "machine learning");
    const [tab, setTab] = useState("overview");
    const [cohort, setCohort] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const loadCohort = async () => {
        if (!conceptId.trim()) {
            setError("Please enter a concept ID or topic.");
            return;
        }
        setLoading(true);
        setError("");
        setCohort(null);

        try {
            const result = demoMode
                ? buildDemoCohort(conceptId.trim())
                : await getFacultyCohort(conceptId.trim());

            if (!result || result.success === false) {
                throw new Error((result && result.error) || "Cohort analysis failed.");
            }
            setCohort(result);
        } catch (err) {
            console.error("COHORT ERROR:", err);
            setError(err.message || "Something went wrong loading the class analytics.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !loading) loadCohort();
    };

    return (
        <div className="faculty-dashboard">
            <section className="analysis-panel">
                <div className="analysis-panel-heading">
                    <div className="analysis-icon">🎓</div>
                    <div>
                        <h2>Class readiness analyzer</h2>
                        <p>
                            Pick the concept you're about to teach. PrereqGraph aggregates every enrolled student's
                            prerequisite graph into class-level diagnostics.
                        </p>
                    </div>
                </div>

                <div className="analysis-form analysis-form-single">
                    <div className="field">
                        <label>Target concept</label>
                        <div className="input-wrap">
                            <span className="input-prefix">#</span>
                            <input
                                type="text"
                                value={conceptId}
                                onChange={(e) => setConceptId(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Concept ID or topic (e.g. machine learning)"
                            />
                        </div>
                    </div>
                    <button className="analyze-button" onClick={loadCohort} disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Analyzing class...
                            </>
                        ) : (
                            <>
                                Analyze Class
                                <span className="button-arrow">→</span>
                            </>
                        )}
                    </button>
                </div>

                <div className="session-chip">
                    <span className="status-dot"></span>
                    {demoMode
                        ? "Demo cohort — a synthetic class of 24 students generated locally."
                        : "Real cohort — aggregated from the StudentKnowledge Data Store."}
                </div>
            </section>

            {error && (
                <div className="error-box">
                    <div className="error-icon">!</div>
                    <div>
                        <strong>Class analysis failed</strong>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {cohort ? (
                <>
                    <div className="fac-tabs">
                        {TABS.map((t) => (
                            <button
                                key={t.key}
                                className={`fac-tab ${tab === t.key ? "active" : ""}`}
                                onClick={() => setTab(t.key)}
                            >
                                <span className="fac-tab-icon">{t.icon}</span>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="fac-tab-panel">
                        {tab === "overview" && <FacultyOverview cohort={cohort} />}
                        {tab === "diagnostics" && <FacultyDiagnostics cohort={cohort} />}
                        {tab === "roster" && <FacultyRoster cohort={cohort} />}
                        {tab === "map" && <FacultyMap cohort={cohort} />}
                        {tab === "actions" && <FacultyActions cohort={cohort} />}
                    </div>
                </>
            ) : (
                !loading &&
                !error && (
                    <section className="welcome-state">
                        <div className="welcome-graphic">
                            <div className="welcome-circle circle-one"></div>
                            <div className="welcome-circle circle-two"></div>
                            <div className="welcome-circle circle-three"></div>
                            <div className="welcome-core">CL</div>
                        </div>
                        <div className="welcome-content">
                            <span>FACULTY WORKSPACE</span>
                            <h2>Know if your class is ready before you teach.</h2>
                            <p>
                                Enter the concept you're about to cover. PrereqGraph will tell you what percentage of
                                the class is ready, what's blocking the rest, and exactly where to focus your review.
                            </p>
                        </div>
                    </section>
                )
            )}
        </div>
    );
}

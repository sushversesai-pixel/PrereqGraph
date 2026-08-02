import { useEffect, useState } from "react";
import "./App.css";
import { analyzePrerequisites, checkHealth, getProfile } from "./api";
import { buildDemoAnalysis, buildDemoProfile } from "./demo";
import AnalysisResults from "./components/AnalysisResults";
import KnowledgeMap from "./components/KnowledgeMap";
import LearningPaths from "./components/LearningPaths";
import Progress from "./components/Progress";
import Recommendations from "./components/Recommendations";
import Insights from "./components/Insights";
import FacultyDashboard from "./components/FacultyDashboard";
import ProfilePanel from "./components/ProfilePanel";

const CATALYST_SDK_URL =
    "https://static.zohocdn.com/catalyst/sdk/js/4.4.0/catalystWebSDK.js";

const CATALYST_INIT_URL = "/__catalyst/sdk/init.js";
const LOGIN_URL = "/__catalyst/auth/login";

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.async = false;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load Catalyst SDK: ${src}`));
        document.head.appendChild(script);
    });
}

// Catalyst serves its Web SDK and the /__catalyst/* auth routes ONLY on
// Catalyst-hosted domains. On any other host (local previews, sandboxes)
// we skip the SDK entirely so the browser never logs a 404 for
// /__catalyst/sdk/init.js. Custom production domains can opt in by
// building with REACT_APP_CATALYST=1.
function isCatalystHost() {
    const host = (window.location.hostname || "").toLowerCase();
    return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.endsWith("catalystserverless.com") ||
        host.endsWith("onslate.in") ||
        host.endsWith("zohosites.com") ||
        host.endsWith("zohosites.in") ||
        process.env.REACT_APP_CATALYST === "1" ||
        process.env.REACT_APP_CATALYST === "true"
    );
}

async function loadCatalystSDK() {
    if (window.catalyst) return window.catalyst;
    await loadScript(CATALYST_SDK_URL);
    await loadScript(CATALYST_INIT_URL);
    if (!window.catalyst) {
        throw new Error("Catalyst Web SDK could not be initialized.");
    }
    return window.catalyst;
}

const STUDENT_SECTIONS = {
    analysis: {
        label: "Knowledge Analysis",
        kicker: "KNOWLEDGE INTELLIGENCE",
        title: "Prerequisite Graph Analyzer",
        desc: "Discover the concepts a student needs to master before tackling a new topic."
    },
    learningPaths: {
        label: "Learning Paths",
        kicker: "PERSONAL LEARNING PATH",
        title: "Learning Paths",
        desc: "A step-by-step curriculum built from your prerequisite gaps — check topics off as you master them."
    },
    knowledgeMap: {
        label: "Knowledge Map",
        kicker: "INTERACTIVE KNOWLEDGE MAP",
        title: "Knowledge Map",
        desc: "Explore your prerequisite dependency graph — zoom through depths, filter gaps, and inspect every concept."
    },
    insights: {
        label: "Insights",
        kicker: "DEEP-DIVE INTELLIGENCE",
        title: "Insights",
        desc: "Root-cause bottlenecks, knowledge-debt severity, and gap analysis in plain language."
    },
    progress: {
        label: "Progress",
        kicker: "STUDENT PROGRESS",
        title: "Progress & Analytics",
        desc: "Mastery trends, knowledge-debt history, and a log of everything you've analyzed."
    },
    recommendations: {
        label: "Recommendations",
        kicker: "SMART RECOMMENDATIONS",
        title: "Recommendations",
        desc: "What to learn next, where you'll get the highest return, and resources to close your root gaps."
    }
};

const FACULTY_SECTIONS = {
    faculty: {
        label: "Faculty Dashboard",
        kicker: "COHORT INTELLIGENCE",
        title: "Faculty Dashboard",
        desc: "Class readiness, bottlenecks, at-risk students and remediation tools — before you teach."
    }
};

const STUDENT_NAV = [
    { key: "analysis", icon: "◈", label: "Knowledge Analysis" },
    { key: "learningPaths", icon: "◇", label: "Learning Paths" },
    { key: "knowledgeMap", icon: "▦", label: "Knowledge Map" },
    { key: "insights", icon: "ℹ️", label: "Insights" },
    { key: "progress", icon: "↗", label: "Progress" },
    { key: "recommendations", icon: "◎", label: "Recommendations" }
];

const FACULTY_NAV = [{ key: "faculty", icon: "🎓", label: "Faculty Dashboard" }];

export default function App() {
    const [activeSection, setActiveSection] = useState("analysis");
    const [menuOpen, setMenuOpen] = useState(false);
    const [bannerDismissed, setBannerDismissed] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const [authLoading, setAuthLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [demoMode, setDemoMode] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [authError, setAuthError] = useState("");

    const [health, setHealth] = useState(null);

    const [conceptId, setConceptId] = useState("58146000000020987");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const [history, setHistory] = useState([]);

    const role = profile?.role || "student";
    const isFaculty = role === "faculty";

    const learnerKey =
        (profile && (profile.user_id || currentUser?.user_id)) || "demo";

    // ------------------------------------------------------------
    // AUTHENTICATION — with a demo fallback for local previews
    // ------------------------------------------------------------
    useEffect(() => {
        let mounted = true;

        const initializeAuthentication = async () => {
            try {
                setAuthLoading(true);
                setAuthError("");

                if (!isCatalystHost()) {
                    throw new Error(
                        "Not a Catalyst-hosted domain — running in preview/demo mode."
                    );
                }

                const catalyst = await loadCatalystSDK();

                const authResult = await catalyst.auth.isUserAuthenticated();
                const user = authResult?.content || authResult;

                if (!user || !user.user_id) {
                    // Real Catalyst session missing -> hosted login flow.
                    if (mounted) window.location.href = LOGIN_URL;
                    return;
                }

                if (mounted) {
                    setCurrentUser(user);
                    setAuthenticated(true);
                    setDemoMode(false);
                }
            } catch (err) {
                // Catalyst SDK unavailable (e.g. local preview / offline).
                // Fall back to a demo learner so the product stays explorable.
                console.warn("Catalyst unreachable — demo mode enabled:", err && err.message);
                if (mounted) {
                    setDemoMode(true);
                    setAuthenticated(true);
                    setCurrentUser({
                        first_name: "Demo",
                        last_name: "Learner",
                        email_id: "demo@prereqgraph.local",
                        user_id: "demo-user",
                        role_details: { role_name: "Demo Student" }
                    });
                }
            } finally {
                if (mounted) setAuthLoading(false);
            }
        };

        initializeAuthentication();

        return () => {
            mounted = false;
        };
    }, []);

    // ------------------------------------------------------------
    // PROFILE — resolve role (real: Profiles table, demo: local)
    // ------------------------------------------------------------
    useEffect(() => {
        let mounted = true;

        const loadProfile = async () => {
            try {
                if (demoMode) {
                    const saved = (() => {
                        try {
                            return localStorage.getItem("pg:role") || "student";
                        } catch {
                            return "student";
                        }
                    })();
                    if (mounted) setProfile(buildDemoProfile(saved));
                    return;
                }

                const p = await getProfile();
                if (mounted) setProfile(p);
            } catch (err) {
                console.warn("PROFILE LOAD FAILED:", err && err.message);
                // Fall back to session-derived defaults.
                if (mounted) {
                    setProfile({
                        user_id: currentUser?.user_id || "",
                        first_name: currentUser?.first_name || currentUser?.firstName || "Student",
                        last_name: currentUser?.last_name || currentUser?.lastName || "",
                        email: currentUser?.email_id || currentUser?.email || "",
                        role: "student",
                        course: ""
                    });
                }
            }
        };

        loadProfile();

        return () => {
            mounted = false;
        };
    }, [demoMode, currentUser]);

    const switchRole = (newRole) => {
        if (!demoMode) return;
        try {
            localStorage.setItem("pg:role", newRole);
        } catch {
            /* storage unavailable */
        }
        setProfile(buildDemoProfile(newRole));
    };

    // ------------------------------------------------------------
    // SYSTEM HEALTH — live top-bar status indicator
    // ------------------------------------------------------------
    useEffect(() => {
        if (demoMode) {
            setHealth({ demo: true });
            return;
        }
        let alive = true;
        const poll = async () => {
            const h = await checkHealth();
            if (alive) setHealth(h);
        };
        poll();
        const timer = setInterval(poll, 30000);
        return () => {
            alive = false;
            clearInterval(timer);
        };
    }, [demoMode]);

    // ------------------------------------------------------------
    // HISTORY — activity log persisted per learner
    // ------------------------------------------------------------
    useEffect(() => {
        try {
            const raw = localStorage.getItem(`pg:history:${learnerKey}`);
            setHistory(raw ? JSON.parse(raw) : []);
        } catch {
            setHistory([]);
        }
    }, [learnerKey]);

    const recordHistory = (result) => {
        const stats = result.statistics || {};
        const total = stats.total_prerequisites || 0;
        const readiness = total
            ? Math.min(100, Math.round((stats.strong_concepts / total) * 100))
            : 100;

        const snapshot = {
            conceptId: result.target?.id || conceptId,
            conceptName: result.target?.name || conceptId,
            ts: Date.now(),
            readiness,
            debt: result.knowledge_debt?.score || 0,
            gaps: stats.identified_gaps || 0,
            strong: stats.strong_concepts || 0,
            weak: stats.weak_concepts || 0,
            total
        };

        setHistory((prev) => {
            const next = [snapshot, ...prev].slice(0, 40);
            try {
                localStorage.setItem(`pg:history:${learnerKey}`, JSON.stringify(next));
            } catch {
                /* storage unavailable */
            }
            return next;
        });
    };

    const logout = async () => {
        try {
            const catalyst = await loadCatalystSDK();
            catalyst.auth.signOut(window.location.origin + LOGIN_URL);
        } catch (err) {
            console.error("LOGOUT ERROR:", err);
            window.location.href = LOGIN_URL;
        }
    };

    const goAnalyze = () => setActiveSection("analysis");

    const analyzeConcept = async () => {
        if (!conceptId.trim()) {
            setError("Please enter a concept ID.");
            return;
        }
        setLoading(true);
        setError("");
        setData(null);

        try {
            const result = demoMode
                ? buildDemoAnalysis(conceptId.trim())
                : await analyzePrerequisites(conceptId.trim());

            if (!result || result.success === false) {
                throw new Error((result && result.error) || "Analysis failed.");
            }

            setData(result);
            recordHistory(result);
        } catch (err) {
            console.error("ANALYZE ERROR:", err);
            setError(
                err.message ||
                    "Something went wrong while analyzing the concept."
            );
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === "Enter" && !loading) analyzeConcept();
    };

    // ------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------

    if (authLoading) {
        return (
            <div className="app-shell">
                <div
                    style={{
                        width: "100%",
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: "16px"
                    }}
                >
                    <div className="spinner"></div>
                    <strong>Connecting to PrereqGraph</strong>
                    <span>Verifying your Catalyst session...</span>
                </div>
            </div>
        );
    }

    if (authError && !authenticated) {
        return (
            <div className="app-shell">
                <div
                    style={{
                        width: "100%",
                        minHeight: "100vh",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "column",
                        gap: "16px",
                        padding: "40px"
                    }}
                >
                    <h2>Authentication Error</h2>
                    <p>{authError}</p>
                    <button
                        className="analyze-button"
                        onClick={() => {
                            window.location.href = LOGIN_URL;
                        }}
                    >
                        Return to Login →
                    </button>
                </div>
            </div>
        );
    }

    const firstName = profile?.first_name || currentUser?.first_name || "Student";
    const lastName = profile?.last_name || currentUser?.last_name || "";
    const email = profile?.email || currentUser?.email_id || "";
    const catalystUserId = profile?.user_id || currentUser?.user_id || "";

    const sections = isFaculty ? FACULTY_SECTIONS : STUDENT_SECTIONS;
    const navItems = isFaculty ? FACULTY_NAV : STUDENT_NAV;
    const section = sections[activeSection] || sections[isFaculty ? "faculty" : "analysis"];

    const statusState = demoMode
        ? "demo"
        : health && health.ok
            ? "ok"
            : health && health.ok === false
                ? "down"
                : "checking";

    const statusLabelText =
        statusState === "demo"
            ? "Demo mode"
            : statusState === "ok"
                ? "System operational"
                : statusState === "down"
                    ? "API offline"
                    : "Checking…";

    const navigate = (key) => {
        setActiveSection(key);
        setMenuOpen(false);
    };

    const roleLabel = isFaculty ? "Faculty" : "Student";

    return (
        <div className="app-shell">
            {menuOpen && <div className="nav-backdrop" onClick={() => setMenuOpen(false)} />}

            <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
                <div className="brand">
                    <div className="brand-mark">PG</div>
                    <div>
                        <div className="brand-name">PrereqGraph</div>
                        <div className="brand-subtitle">Learning Intelligence</div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">{isFaculty ? "FACULTY" : "WORKSPACE"}</div>
                    {navItems.map((item) => (
                        <div
                            key={item.key}
                            className={`nav-item ${activeSection === item.key ? "active" : ""}`}
                            onClick={() => navigate(item.key)}
                        >
                            <span className="nav-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </nav>

                <div className="sidebar-bottom">
                    {demoMode && (
                        <div className="sidebar-tip" style={{ cursor: "pointer" }} onClick={() => setProfileOpen(true)}>
                            <div className="tip-icon">{isFaculty ? "🎓" : "✦"}</div>
                            <div>
                                <strong>{isFaculty ? "Faculty demo" : "Student demo"}</strong>
                                <p>
                                    {isFaculty
                                        ? "Class analytics on a synthetic cohort. Tap to switch views."
                                        : "Sample learner data. Tap to explore the faculty view."}
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="profile-mini" style={{ cursor: "pointer" }} onClick={() => setProfileOpen(true)}>
                        <div className="avatar">{firstName.charAt(0).toUpperCase()}</div>
                        <div className="profile-text">
                            <strong>{firstName} {lastName}</strong>
                            <span>{demoMode ? `Demo ${roleLabel}` : roleLabel}</span>
                        </div>
                        {demoMode ? (
                            <span className="demo-chip">DEMO</span>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    logout();
                                }}
                                title="Sign out"
                                className="logout-button"
                            >
                                ↪
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            <div className="main-area">
                <header className="topbar">
                    <div className="topbar-left">
                        <button
                            type="button"
                            className="menu-button"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-label="Toggle navigation"
                        >
                            ☰
                        </button>
                        <div className="breadcrumb">
                            {isFaculty ? "Faculty" : "Workspace"}
                            <span>/</span>
                            {section.label}
                        </div>
                    </div>

                    <div className="topbar-right">
                        <div className={`system-status status-${statusState}`}>
                            <span className="status-dot"></span>
                            {statusLabelText}
                        </div>
                        <div
                            className="topbar-avatar"
                            title={`${email} — ${roleLabel}`}
                            style={{ cursor: "pointer" }}
                            onClick={() => setProfileOpen(true)}
                        >
                            {firstName.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="page">
                    {demoMode && !bannerDismissed && (
                        <div className="demo-banner">
                            <span className="demo-banner-icon">◈</span>
                            <div>
                                <strong>Demo mode{isFaculty ? " — faculty view" : ""}</strong>
                                <p>
                                    Catalyst isn't reachable in this preview, so sample data is
                                    shown. Deploy to Catalyst for live authentication and your
                                    real student data.
                                </p>
                            </div>
                            <div className="demo-banner-actions">
                                {!isFaculty && (
                                    <button
                                        type="button"
                                        className="demo-banner-switch"
                                        onClick={() => switchRole("faculty")}
                                    >
                                        🎓 Try faculty dashboard
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setBannerDismissed(true)}
                                    aria-label="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )}

                    {!demoMode && statusState === "down" && (
                        <div className="backend-warning">
                            <span className="backend-warning-icon">⚠</span>
                            <div>
                                <strong>Backend function unreachable</strong>
                                <p>
                                    PrereqGraph's API at <code>/server/prereq_graph_function/</code> isn't
                                    responding — analysis, profiles and the faculty dashboard won't work until
                                    the function is deployed. Run <code>catalyst deploy</code> from the repo
                                    root (deploys client + function together), then reload.
                                </p>
                            </div>
                        </div>
                    )}

                    <section className="page-intro">
                        <div>
                            <div className="page-kicker">{section.kicker}</div>
                            <h1>
                                {isFaculty ? (
                                    <>
                                        Faculty<span> Dashboard</span>
                                    </>
                                ) : activeSection === "analysis" ? (
                                    <>
                                        Prerequisite
                                        <span> Graph Analyzer</span>
                                    </>
                                ) : (
                                    section.title
                                )}
                            </h1>
                            <p>{section.desc}</p>
                        </div>

                        {activeSection === "analysis" && !isFaculty && (
                            <div className="intro-badge">
                                <span>AI</span>
                                Personalized analysis
                            </div>
                        )}
                        {isFaculty && (
                            <div className="intro-badge">
                                <span>CL</span>
                                Cohort intelligence
                            </div>
                        )}
                    </section>

                    {isFaculty ? (
                        <FacultyDashboard demoMode={demoMode} defaultConcept={conceptId} />
                    ) : (
                        <>
                            {activeSection === "analysis" && (
                                <>
                                    <div
                                        style={{
                                            marginBottom: "20px",
                                            padding: "12px 16px",
                                            borderRadius: "12px",
                                            background: "rgba(255,255,255,0.7)",
                                            border: "1px solid rgba(0,0,0,0.08)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: "12px",
                                            flexWrap: "wrap"
                                        }}
                                    >
                                        <div>
                                            <strong>Signed in as {firstName}</strong>
                                            <div style={{ fontSize: "12px", opacity: 0.7 }}>
                                                {email}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <span className="status strong">✓ {roleLabel}</span>
                                            {catalystUserId && (
                                                <span style={{ fontSize: "11px", opacity: 0.6 }}>
                                                    Catalyst ID: {catalystUserId}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <section className="analysis-panel">
                                        <div className="analysis-panel-heading">
                                            <div className="analysis-icon">⌁</div>
                                            <div>
                                                <h2>Analyze a concept</h2>
                                                <p>
                                                    Enter a concept ID to generate your personalized
                                                    prerequisite map — your student profile is matched
                                                    automatically from your session.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="analysis-form analysis-form-single">
                                            <div className="field">
                                                <label>Concept ID</label>
                                                <div className="input-wrap">
                                                    <span className="input-prefix">#</span>
                                                    <input
                                                        type="text"
                                                        value={conceptId}
                                                        onChange={(e) => setConceptId(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        placeholder="Enter concept ID"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                className="analyze-button"
                                                onClick={analyzeConcept}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner"></span>
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    <>
                                                        Analyze Concept
                                                        <span className="button-arrow">→</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        <div className="session-chip">
                                            <span className="status-dot"></span>
                                            {demoMode
                                                ? "Demo learner profile (user_id: demo-user)"
                                                : `Analyzing as ${firstName} ${lastName} · student profile ${catalystUserId}`}
                                        </div>
                                    </section>

                                    {error && (
                                        <div className="error-box">
                                            <div className="error-icon">!</div>
                                            <div>
                                                <strong>Analysis failed</strong>
                                                <p>{error}</p>
                                            </div>
                                        </div>
                                    )}

                                    {data ? (
                                        <AnalysisResults data={data} />
                                    ) : (
                                        !loading &&
                                        !error && (
                                            <section className="welcome-state">
                                                <div className="welcome-graphic">
                                                    <div className="welcome-circle circle-one"></div>
                                                    <div className="welcome-circle circle-two"></div>
                                                    <div className="welcome-circle circle-three"></div>
                                                    <div className="welcome-core">PG</div>
                                                </div>
                                                <div className="welcome-content">
                                                    <span>READY TO ANALYZE</span>
                                                    <h2>Understand what comes before the concept.</h2>
                                                    <p>
                                                        Enter a concept ID above. PrereqGraph will trace the
                                                        prerequisite chain and identify exactly where
                                                        learning gaps exist.
                                                    </p>
                                                </div>
                                            </section>
                                        )
                                    )}
                                </>
                            )}

                            {activeSection === "learningPaths" && (
                                <LearningPaths
                                    key={`${learnerKey}:${data?.target?.id || "none"}`}
                                    data={data}
                                    learnerKey={learnerKey}
                                    onGoAnalyze={goAnalyze}
                                />
                            )}

                            {activeSection === "knowledgeMap" && <KnowledgeMap data={data} />}

                            {activeSection === "insights" && (
                                <Insights data={data} onGoAnalyze={goAnalyze} />
                            )}

                            {activeSection === "progress" && (
                                <Progress history={history} data={data} onGoAnalyze={goAnalyze} />
                            )}

                            {activeSection === "recommendations" && (
                                <Recommendations data={data} onGoAnalyze={goAnalyze} />
                            )}
                        </>
                    )}
                </main>
            </div>

            {profileOpen && (
                <ProfilePanel
                    profile={profile}
                    demoMode={demoMode}
                    onClose={() => setProfileOpen(false)}
                    onSwitchRole={switchRole}
                    onLogout={logout}
                />
            )}
        </div>
    );
}

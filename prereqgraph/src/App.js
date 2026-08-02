import React, { useEffect, useState } from "react";
import "./App.css";
import { analyzePrerequisites } from "./api";

// Learning Paths component – displays ordered prerequisite steps
function LearningPaths({ data }) {
  const steps = data?.prerequisites || [];
  return (
    <section className="learning-paths">
      <h2>Learning Paths</h2>
      {steps.length > 0 ? (
        <ol>
          {steps.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      ) : (
        <p>No learning path data available.</p>
      )}
    </section>
  );
}

// Knowledge Map component – renders prerequisite concepts as a list
function KnowledgeMap({ data }) {
  const nodes = data?.prerequisites || [];
  return (
    <section className="knowledge-map">
      <h2>Knowledge Map</h2>
      {nodes.length > 0 ? (
        <ul>
          {nodes.map((node, idx) => (
            <li key={idx}>{node}</li>
          ))}
        </ul>
      ) : (
        <p>No knowledge map data available.</p>
      )}
    </section>
  );
}

// Insights component – displays difficulty and status of target concept
function Insights({ data }) {
  const target = data?.target || { name: "Sample Concept", difficulty: 3, status: "Weak" };
  return (
    <section className="insights">
      <h2>Insights</h2>
      <p><strong>Name:</strong> {target.name}</p>
      <p><strong>Difficulty:</strong> {target.difficulty} / 5</p>
      <p><strong>Status:</strong> {target.status}</p>
    </section>
  );
}

// Progress component – shows a simple progress bar based on identified gaps
function Progress({ data }) {
  const gaps = data?.statistics?.identified_gaps || 2;
  const total = data?.statistics?.total_prerequisites || 5;
  const percent = Math.round(((total - gaps) / total) * 100);
  return (
    <section className="progress">
      <h2>Progress</h2>
      <div className="progress-bar" style={{ width: `${percent}%`, background: "linear-gradient(90deg, #4ade80, #22c55e)" }} />
      <p>{percent}% completed ({total - gaps} of {total} concepts mastered)</p>
    </section>
  );
}

// Recommendations component – lists sample learning recommendations
function Recommendations({ data }) {
  const recommendations = data?.recommendations || [
    "Review prerequisite concepts",
    "Practice with targeted quizzes",
    "Schedule a tutoring session"
  ];
  return (
    <section className="recommendations">
      <h2>Recommendations</h2>
      <ul>
        {recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </section>
  );
}



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

        script.onerror = () => {
            reject(
                new Error(`Failed to load Catalyst SDK: ${src}`)
            );
        };

        document.head.appendChild(script);
    });
}

async function loadCatalystSDK() {
    if (window.catalyst) {
        return window.catalyst;
    }

    await loadScript(CATALYST_SDK_URL);
    await loadScript(CATALYST_INIT_URL);

    if (!window.catalyst) {
        throw new Error(
            "Catalyst Web SDK could not be initialized."
        );
    }

    return window.catalyst;
}

function App() {
  const [activeSection, setActiveSection] = useState('analysis');
    const [authLoading, setAuthLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [authError, setAuthError] = useState("");

    const [conceptId, setConceptId] = useState(
        "58146000000020987"
    );

    const [studentId, setStudentId] = useState("1001");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let mounted = true;

        const initializeAuthentication = async () => {
            try {
                setAuthLoading(true);
                setAuthError("");

                const catalyst = await loadCatalystSDK();

                const authResult =
                    await catalyst.auth.isUserAuthenticated();

                console.log(
                    "CATALYST AUTH RESULT:",
                    authResult
                );

                const user =
                    authResult?.content || authResult;

                if (!user || !user.user_id) {
                    if (mounted) {
                        setAuthenticated(false);
                    }

                    window.location.href = LOGIN_URL;
                    return;
                }

                if (!mounted) {
                    return;
                }

                console.log(
                    "AUTHENTICATED CATALYST USER:",
                    user
                );

                setCurrentUser(user);
                setAuthenticated(true);
                setStudentId("1001");
            } catch (err) {
                console.error(
                    "CATALYST AUTH ERROR:",
                    err
                );

                if (!mounted) {
                    return;
                }

                setAuthError(
                    err.message ||
                        "Authentication could not be initialized."
                );
            } finally {
                if (mounted) {
                    setAuthLoading(false);
                }
            }
        };

        initializeAuthentication();

        return () => {
            mounted = false;
        };
    }, []);

    const logout = async () => {
        try {
            const catalyst = await loadCatalystSDK();

            catalyst.auth.signOut(
                window.location.origin + LOGIN_URL
            );
        } catch (err) {
            console.error("LOGOUT ERROR:", err);
            window.location.href = LOGIN_URL;
        }
    };

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

                    <strong>
                        Connecting to PrereqGraph
                    </strong>

                    <span>
                        Verifying your Catalyst session...
                    </span>
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

    const firstName =
        currentUser?.first_name ||
        currentUser?.firstName ||
        "Student";

    const lastName =
        currentUser?.last_name ||
        currentUser?.lastName ||
        "";

    const email =
        currentUser?.email_id ||
        currentUser?.email ||
        "";

    const role =
        currentUser?.role_details?.role_name ||
        currentUser?.role_name ||
        "App User";

    const catalystUserId =
        currentUser?.user_id || "";

    
    const getStatusClass = (status) => {
        const normalized = String(status || "").toLowerCase();

        if (normalized.includes("strong")) {
            return "strong";
        }

        if (normalized.includes("weak")) {
            return "weak";
        }

        return "gap";
    };

    const getStatusIcon = (status) => {
        const normalized = String(status || "").toLowerCase();

        if (normalized.includes("strong")) {
            return "✓";
        }

        if (normalized.includes("weak")) {
            return "!";
        }

        return "×";
    };

    const analyzeConcept = async () => {
        if (!conceptId.trim()) {
            setError("Please enter a concept ID.");
            return;
        }

        if (!studentId.trim()) {
            setError("Please enter a student ID.");
            return;
        }

        setLoading(true);
        setError("");
        setData(null);

        try {
            const result = await analyzePrerequisites(conceptId.trim(), studentId.trim());
            setData(result);
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
        if (event.key === "Enter" && !loading) {
            analyzeConcept();
        }
    };

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div className="brand">
                    <div className="brand-mark">PG</div>

                    <div>
                        <div className="brand-name">
                            PrereqGraph
                        </div>

                        <div className="brand-subtitle">
                            Learning Intelligence
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section-label">
                        WORKSPACE
                    </div>

                    <div className={activeSection === 'analysis' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('analysis')}>
                    <span className="nav-icon">
                        ◈
                    </span>
                    <span>
                        Knowledge Analysis
                    </span>
                  </div>

                  <div className={activeSection === 'learningPaths' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('learningPaths')}>
                    <span className="nav-icon">
                        ◇
                    </span>
                    <span>
                        Learning Paths
                    </span>
                  </div>

                  <div className={activeSection === 'knowledgeMap' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('knowledgeMap')}>
                    <span className="nav-icon">
                        ▦
                    </span>
                    <span>
                        Knowledge Map
                    </span>
                  </div>

                  <div className={activeSection === 'insights' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('insights')}>
                    <span className="nav-icon">ℹ️</span>
                    <span>Insights</span>
                  </div>

                  <div className={activeSection === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('progress')}>
                    <span className="nav-icon">
                        ↗
                    </span>
                    <span>
                        Progress
                    </span>
                  </div>

                  <div className={activeSection === 'recommendations' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveSection('recommendations')}>
                      <span className="nav-icon">
                          ◎
                      </span>
                      <span>Recommendations</span>
                  </div>
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-tip">
                        <div className="tip-icon">
                            ✦
                        </div>

                        <div>
                            <strong>
                                Smart learning
                            </strong>

                            <p>
                                Identify what to learn
                                before you begin.
                            </p>
                        </div>
                    </div>

                    <div className="profile-mini">
                        <div className="avatar">
                            {firstName
                                .charAt(0)
                                .toUpperCase()}
                        </div>

                        <div className="profile-text">
                            <strong>
                                {firstName} {lastName}
                            </strong>

                            <span>{role}</span>
                        </div>

                        <button
                            type="button"
                            onClick={logout}
                            title="Sign out"
                            style={{
                                border: "none",
                                background:
                                    "transparent",
                                cursor: "pointer",
                                fontSize: "18px"
                            }}
                        >
                            ↪
                        </button>
                    </div>
                </div>
            </aside>

            <div className="main-area">
                <header className="topbar">
                    <div className="breadcrumb">
                        Workspace
                        <span>/</span>
                        {activeSection === 'analysis' && 'Knowledge Analysis'}
                        {activeSection === 'learningPaths' && 'Learning Paths'}
                        {activeSection === 'knowledgeMap' && 'Knowledge Map'}
                        {activeSection === 'insights' && 'Insights'}
                        {activeSection === 'progress' && 'Progress'}
                        {activeSection === 'recommendations' && 'Recommendations'}
                    </div>

                    <div className="topbar-right">
                        <div className="system-status">
                            <span className="status-dot"></span>
                            System operational
                        </div>

                        <div
                            className="topbar-avatar"
                            title={`${email} — ${role}`}
                        >
                            {firstName
                                .charAt(0)
                                .toUpperCase()}
                        </div>
                    </div>
                </header>

                <main className="page">
                    <div
                        style={{
                            marginBottom: "20px",
                            padding: "12px 16px",
                            borderRadius: "12px",
                            background:
                                "rgba(255,255,255,0.7)",
                            border:
                                "1px solid rgba(0,0,0,0.08)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent:
                                "space-between",
                            gap: "12px"
                        }}
                    >
                        <div>
                            <strong>
                                Signed in as {firstName}
                            </strong>

                            <div
                                style={{
                                    fontSize: "12px",
                                    opacity: 0.7
                                }}
                            >
                                {email}
                            </div>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px"
                            }}
                        >
                            <span className="status strong">
                                ✓ {role}
                            </span>

                            {catalystUserId && (
                                <span
                                    style={{
                                        fontSize:
                                            "11px",
                                        opacity: 0.6
                                    }}
                                >
                                    Catalyst ID:{" "}
                                    {catalystUserId}
                                </span>
                            )}
                        </div>
                    </div>

                    <section className="page-intro">
                        <div>
                            <div className="page-kicker">
                                KNOWLEDGE INTELLIGENCE
                            </div>

                            <h1>
                                Prerequisite
                                <span>
                                    {" "}Graph Analyzer
                                </span>
                            </h1>

                            <p>
                                Discover the concepts a student
                                needs to master before tackling
                                a new topic.
                            </p>
                        </div>

                        <div className="intro-badge">
                            <span>AI</span>
                            Personalized analysis
                        </div>
                    </section>

                    {activeSection === 'analysis' && (
                <section className="analysis-panel">
                        <div className="analysis-panel-heading">
                          <div className="analysis-icon">
                              ⌁
                          </div>

                          <div>
                              <h2>
                                  Analyze a concept
                              </h2>

                              <p>
                                  Enter the concept and student
                                  identifiers to generate a
                                  personalized prerequisite map.
                              </p>
                          </div>
                        </div>

                        <div className="analysis-form">
                          <div className="field">
                            <label>
                                Concept ID
                            </label>

                            <div className="input-wrap">
                              <span className="input-prefix">
                                  #
                              </span>

                              <input
                                  type="text"
                                  value={conceptId}
                                  onChange={(e) =>
                                      setConceptId(
                                          e.target.value
                                      )
                                  }
                                  onKeyDown={
                                      handleKeyDown
                                  }
                                  placeholder="Enter concept ID"
                              />
                            </div>
                          </div>

                          <div className="field">
                            <label>
                                Student ID
                            </label>

                            <div className="input-wrap">
                              <span className="input-prefix">
                                  ◉
                              </span>

                              <input
                                  type="text"
                                  value={studentId}
                                  onChange={(e) =>
                                      setStudentId(
                                          e.target.value
                                      )
                                  }
                                  onKeyDown={
                                      handleKeyDown
                                  }
                                  placeholder="Enter student ID"
                              />
                            </div>
                          </div>

                          <button
                              className="analyze-button"
                              onClick={
                                  analyzeConcept
                              }
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

                                      <span className="button-arrow">
                                          →
                                      </span>
                                  </>
                              )}
                          </button>
                        </div>
                      </section>
                )}

                      {/* Conditional rendering for other sections */}
                      {activeSection === 'learningPaths' && (
                        <LearningPaths data={data} />
                      )}
                      {activeSection === 'knowledgeMap' && (
                        <KnowledgeMap data={data} />
                      )}
                      {activeSection === 'insights' && (
                        <section className="insights">
                          <h2>Insights</h2>
                          <p>Placeholder for insights content.</p>
                        </section>
                      )}
                      {activeSection === 'progress' && (
                        <section className="progress">
                          <h2>Progress</h2>
                          <p>Placeholder for progress tracking.</p>
                        </section>
                      )}
                      {activeSection === 'recommendations' && (
                        <section className="recommendations">
                          <h2>Recommendations</h2>
                          <p>Placeholder for recommendation engine output.</p>
                        </section>
                      )}

                    {error && (
                        <div className="error-box">
                            <div className="error-icon">
                                !
                            </div>

                            <div>
                                <strong>
                                    Analysis failed
                                </strong>

                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {data && (
                        <div className="results">
                            {data.target && (
                                <section className="target-hero">
                                    <div className="target-main">
                                        <div className="target-label">
                                            <span className="target-label-dot"></span>
                                            TARGET CONCEPT
                                        </div>

                                        <h2>
                                            {data.target.name}
                                        </h2>

                                        <p>
                                            {data.target.description}
                                        </p>

                                        <div className="target-tags">
                                            <span className="difficulty-tag">
                                                Difficulty

                                                <strong>
                                                    {
                                                        data.target
                                                            .difficulty
                                                    }
                                                    /5
                                                </strong>
                                            </span>

                                            <span
                                                className={`status ${getStatusClass(
                                                    data.target.status
                                                )}`}
                                            >
                                                <span className="status-icon">
                                                    {getStatusIcon(
                                                        data.target.status
                                                    )}
                                                </span>

                                                {
                                                    data.target
                                                        .status
                                                }
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
                                                    .map(
                                                        (word) =>
                                                            word[0]
                                                    )
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
                                        <div className="stat-icon">
                                            ⛓
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Prerequisites
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .statistics
                                                        .total_prerequisites
                                                }
                                            </strong>

                                            <small>
                                                Concepts in dependency chain
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-red">
                                        <div className="stat-icon">
                                            !
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Knowledge Gaps
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .statistics
                                                        .identified_gaps
                                                }
                                            </strong>

                                            <small>
                                                Concepts requiring attention
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-green">
                                        <div className="stat-icon">
                                            ✓
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Strong Concepts
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .statistics
                                                        .strong_concepts
                                                }
                                            </strong>

                                            <small>
                                                Concepts already mastered
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-yellow">
                                        <div className="stat-icon">
                                            ~
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Weak Concepts
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .statistics
                                                        .weak_concepts
                                                }
                                            </strong>

                                            <small>
                                                Concepts needing reinforcement
                                            </small>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {data.root_cause && (
                                <section className="section">
                                    <div className="section-header">
                                        <div>
                                            <div className="section-kicker">
                                                ROOT-CAUSE INTELLIGENCE
                                            </div>

                                            <h2>
                                                Critical Learning Bottleneck
                                            </h2>

                                            <p>
                                                The earliest unresolved prerequisite
                                                with the greatest downstream impact.
                                            </p>
                                        </div>

                                        <div className="path-count">
                                            {
                                                data.root_cause
                                                    .downstream_impact
                                            }

                                            <span>
                                                affected
                                            </span>
                                        </div>
                                    </div>

                                    <div className="revision-item">
                                        <div className="revision-number">
                                            <span>!</span>
                                        </div>

                                        <div className="revision-content">
                                            <span className="revision-label">
                                                ROOT GAP
                                            </span>

                                            <h3>
                                                {
                                                    data.root_cause
                                                        .concept_name
                                                }
                                            </h3>

                                            <p>
                                                {
                                                    data.root_cause
                                                        .description
                                                }
                                            </p>

                                            <div className="revision-meta">
                                                <span>
                                                    <b>Status</b>{" "}
                                                    {
                                                        data.root_cause
                                                            .status
                                                    }
                                                </span>

                                                <span>
                                                    <b>
                                                        Confidence
                                                    </b>{" "}
                                                    {Math.round(
                                                        (data.root_cause
                                                            .confidence ||
                                                            0) *
                                                            100
                                                    )}
                                                    %
                                                </span>

                                                <span>
                                                    <b>
                                                        Downstream impact
                                                    </b>{" "}
                                                    {
                                                        data.root_cause
                                                            .downstream_impact
                                                    }{" "}
                                                    concepts
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {data.knowledge_debt && (
                                <section className="stats-grid">
                                    <div className="stat-card stat-red">
                                        <div className="stat-icon">
                                            ∆
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Knowledge Debt
                                            </span>

                                            <strong>
                                                {Math.round(
                                                    data
                                                        .knowledge_debt
                                                        .score || 0
                                                )}
                                            </strong>

                                            <small>
                                                {
                                                    data
                                                        .knowledge_debt
                                                        .level
                                                }
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-yellow">
                                        <div className="stat-icon">
                                            !
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Critical Gaps
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .knowledge_debt
                                                        .critical_gaps
                                                }
                                            </strong>

                                            <small>
                                                High-impact unresolved concepts
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-blue">
                                        <div className="stat-icon">
                                            ↗
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Affected Concepts
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .knowledge_debt
                                                        .affected_concepts
                                                }
                                            </strong>

                                            <small>
                                                Downstream learning impact
                                            </small>
                                        </div>
                                    </div>

                                    <div className="stat-card stat-green">
                                        <div className="stat-icon">
                                            ✓
                                        </div>

                                        <div className="stat-content">
                                            <span>
                                                Gap Count
                                            </span>

                                            <strong>
                                                {
                                                    data
                                                        .knowledge_debt
                                                        .total_gaps
                                                }
                                            </strong>

                                            <small>
                                                Total unresolved concepts
                                            </small>
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section className="section">
                                <div className="section-header">
                                    <div>
                                        <div className="section-kicker">
                                            KNOWLEDGE GRAPH
                                        </div>

                                        <h2>
                                            Prerequisite Concepts
                                        </h2>

                                        <p>
                                            Follow the dependency chain
                                            from foundational knowledge
                                            to the target concept.
                                        </p>
                                    </div>

                                    <div className="legend">
                                        <span>
                                            <i className="legend-dot strong-dot"></i>
                                            Strong
                                        </span>

                                        <span>
                                            <i className="legend-dot weak-dot"></i>
                                            Weak
                                        </span>

                                        <span>
                                            <i className="legend-dot gap-dot"></i>
                                            Gap
                                        </span>
                                    </div>
                                </div>

                                {data.graph?.nodes?.length > 0 ? (
                                    <div className="graph-container">
                                        <div className="graph-line"></div>

                                        <div className="nodes">
                                            {data.graph.nodes.map(
                                                (node, index) => (
                                                    <React.Fragment
                                                        key={node.id}
                                                    >
                                                        <div
                                                            className={`node-card ${
                                                                node.isGap
                                                                    ? "node-gap"
                                                                    : "node-strong"
                                                            } ${
                                                                node.depth ===
                                                                0
                                                                    ? "target-node"
                                                                    : ""
                                                            }`}
                                                        >
                                                            <div className="node-top">
                                                                <div className="depth-badge">
                                                                    D
                                                                    {
                                                                        node.depth
                                                                    }
                                                                </div>

                                                                <span
                                                                    className={`status ${getStatusClass(
                                                                        node.status
                                                                    )}`}
                                                                >
                                                                    <span className="status-icon">
                                                                        {getStatusIcon(
                                                                            node.status
                                                                        )}
                                                                    </span>

                                                                    {
                                                                        node.status
                                                                    }
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

                                                                <h3>
                                                                    {
                                                                        node.name
                                                                    }
                                                                </h3>
                                                            </div>

                                                            <p>
                                                                {
                                                                    node.description
                                                                }
                                                            </p>

                                                            <div className="node-footer">
                                                                <span>
                                                                    Difficulty

                                                                    <strong>
                                                                        {
                                                                            node.difficulty
                                                                        }
                                                                    </strong>
                                                                </span>

                                                                <span>
                                                                    Confidence

                                                                    <strong>
                                                                        {Math.round(
                                                                            (node.confidence ||
                                                                                0) *
                                                                                100
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
                                                                                (node.confidence ||
                                                                                    0) *
                                                                                    100,
                                                                                0
                                                                            ),
                                                                            100
                                                                        )}%`
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>

                                                        {index <
                                                            data.graph.nodes
                                                                .length -
                                                                1 && (
                                                            <div className="graph-connector">
                                                                <span>
                                                                    ↓
                                                                </span>
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                )
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty">
                                        No prerequisite concepts found.
                                    </div>
                                )}
                            </section>

                            <section className="section revision-section">
                                <div className="section-header">
                                    <div>
                                        <div className="section-kicker">
                                            RECOMMENDED ORDER
                                        </div>

                                        <h2>
                                            Revision Path
                                        </h2>

                                        <p>
                                            Work through these knowledge
                                            gaps in order before returning
                                            to the target concept.
                                        </p>
                                    </div>

                                    {data.revision_path?.length > 0 && (
                                        <div className="path-count">
                                            {
                                                data
                                                    .revision_path
                                                    .length
                                            }

                                            <span>
                                                topics
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {data.revision_path?.length > 0 ? (
                                    <div className="revision-list">
                                        {data.revision_path.map(
                                            (item, index) => (
                                                <div
                                                    className="revision-item"
                                                    key={
                                                        item.concept_id
                                                    }
                                                >
                                                    <div className="revision-number">
                                                        <span>
                                                            {String(
                                                                index + 1
                                                            ).padStart(
                                                                2,
                                                                "0"
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="revision-connector"></div>

                                                    <div className="revision-content">
                                                        <div className="revision-heading">
                                                            <div>
                                                                <span className="revision-label">
                                                                    PRIORITY{" "}
                                                                    {index +
                                                                        1}
                                                                </span>

                                                                <h3>
                                                                    {
                                                                        item.concept_name
                                                                    }
                                                                </h3>
                                                            </div>

                                                            <span
                                                                className={`status ${getStatusClass(
                                                                    item.status
                                                                )}`}
                                                            >
                                                                <span className="status-icon">
                                                                    {getStatusIcon(
                                                                        item.status
                                                                    )}
                                                                </span>

                                                                {
                                                                    item.status
                                                                }
                                                            </span>
                                                        </div>

                                                        <p>
                                                            {
                                                                item.description
                                                            }
                                                        </p>

                                                        <div className="revision-meta">
                                                            <span>
                                                                <b>
                                                                    Difficulty
                                                                </b>{" "}
                                                                {
                                                                    item.difficulty
                                                                }
                                                                /5
                                                            </span>

                                                            <span>
                                                                <b>
                                                                    Graph depth
                                                                </b>{" "}
                                                                {
                                                                    item.depth
                                                                }
                                                            </span>

                                                            <span>
                                                                <b>
                                                                    Confidence
                                                                </b>{" "}
                                                                {Math.round(
                                                                    (item.confidence ||
                                                                        0) *
                                                                        100
                                                                )}
                                                                %
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="revision-arrow">
                                                        →
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                ) : (
                                    <div className="success-box">
                                        <div className="success-icon">
                                            ✓
                                        </div>

                                        <div>
                                            <strong>
                                                You're ready to go
                                            </strong>

                                            <p>
                                                No prerequisite gaps were
                                                identified. You can approach
                                                this concept directly.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            <div className="analysis-footer">
                                <div className="footer-insight-icon">
                                    ✦
                                </div>

                                <div>
                                    <strong>
                                        Learning recommendation
                                    </strong>

                                    <p>
                                        Resolve the identified prerequisite
                                        gaps first. Mastering foundational
                                        concepts should make{" "}
                                        <strong>
                                            {data.target?.name ||
                                                "the target concept"}
                                        </strong>{" "}
                                        significantly easier to learn.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!data &&
                        !loading &&
                        !error && (
                            <section className="welcome-state">
                                <div className="welcome-graphic">
                                    <div className="welcome-circle circle-one"></div>
                                    <div className="welcome-circle circle-two"></div>
                                    <div className="welcome-circle circle-three"></div>

                                    <div className="welcome-core">
                                        PG
                                    </div>
                                </div>

                                <div className="welcome-content">
                                    <span>
                                        READY TO ANALYZE
                                    </span>

                                    <h2>
                                        Understand what comes
                                        before the concept.
                                    </h2>

                                    <p>
                                        Enter a concept and student ID
                                        above. PrereqGraph will trace the
                                        prerequisite chain and identify
                                        exactly where learning gaps exist.
                                    </p>
                                </div>
                            </section>
                        )}
                </main>
            </div>
        </div>
    );
}

export default App;
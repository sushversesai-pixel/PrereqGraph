"use strict";

const express = require("express");
const catalyst = require("zcatalyst-sdk-node");

const app = express();

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================

app.use(express.json());

// ============================================================
// HEALTH CHECK — powers the UI system-status indicator.
// No Catalyst session required so the dashboard can probe it.
// ============================================================

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "prereq_graph_function",
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// SESSION-USER RESOLUTION
// ------------------------------------------------------------
// When the function is deployed with authentication enabled,
// Catalyst forwards the signed-in end user. We map that
// Catalyst user_id directly onto StudentKnowledge.student_id
// so a student can only ever see their own prerequisite graph.
//
// Resolution order:
//   1. req.user            — populated by Catalyst gateway when
//                            "Require authentication" is enabled
//   2. userManagement().getCurrentUser()
//                          — SDK user-scoped /project-user/current,
//                            reads the user credential Catalyst
//                            injected into the request headers
// ============================================================

async function resolveSessionUser(catalystApp, req) {
    if (req.user && (req.user.user_id || req.user.id)) {
        return req.user;
    }

    try {
        const user = await catalystApp.userManagement().getCurrentUser();
        if (user && (user.user_id || user.id)) {
            return user;
        }
    } catch (err) {
        // No end-user session attached to this request.
    }

    return null;
}

// ============================================================
// ROLE RESOLUTION — pure Catalyst user management (no Profiles
// table). The authenticated user's Catalyst roles drive the
// student/faculty split.
//
// Catalyst user objects carry `role_details` (array of
// { role_name, role_id, ... } or a single object). A user is
// treated as faculty when any role name matches
// faculty/teacher/instructor/professor, or when the user holds
// the Catalyst "Admin" role (project owners see the dashboard).
// ============================================================

function resolveRole(sessionUser) {
    if (!sessionUser) return "student";

    const roleNames = [];
    const details = sessionUser.role_details || sessionUser.roleDetails;

    if (Array.isArray(details)) {
        details.forEach((r) => {
            if (r && r.role_name) roleNames.push(String(r.role_name));
        });
    } else if (details && details.role_name) {
        roleNames.push(String(details.role_name));
    } else if (details && typeof details === "object") {
        Object.keys(details).forEach((k) => {
            const v = details[k];
            if (v && v.role_name) roleNames.push(String(v.role_name));
        });
    }

    if (sessionUser.role_name) roleNames.push(String(sessionUser.role_name));
    if (sessionUser.roles && Array.isArray(sessionUser.roles)) {
        sessionUser.roles.forEach((r) => {
            if (r && r.role_name) roleNames.push(String(r.role_name));
        });
    }

    const joined = roleNames.join(" ").toLowerCase();
    if (!joined) return "student";

    const facultyMatch =
        /faculty|teacher|instructor|professor|admin|administer/.test(joined);
    return facultyMatch ? "faculty" : "student";
}

// ============================================================
// SHARED GRAPH BUILDER (used by student + faculty routes)
// ============================================================

async function buildPrerequisiteGraph(executeZCQL, getConcept, conceptId) {
    const graphNodes = [];
    const edges = [];
    const visited = new Set();

    const traverse = async (currentConceptId, depth) => {
        const currentId = String(currentConceptId);
        if (visited.has(currentId)) return;
        visited.add(currentId);

        const concept = await getConcept(currentId);
        if (!concept) return;

        graphNodes.push({
            id: String(concept.ROWID || concept.rowid || currentId),
            name: concept.name || concept.concept_name || "Unknown Concept",
            description: concept.description || "",
            difficulty: Number(concept.difficulty || 0),
            depth
        });

        const prerequisiteRows = await executeZCQL(
            `SELECT * FROM Prerequisites WHERE concept_id = '${currentId}'`
        );

        for (const row of prerequisiteRows || []) {
            const prerequisite = row.Prerequisites || row;
            const prerequisiteId =
                prerequisite.prerequisite_id ||
                prerequisite.prereq_id ||
                prerequisite.prerequisite_concept_id;
            if (!prerequisiteId) continue;
            edges.push({ from: currentId, to: String(prerequisiteId) });
            await traverse(prerequisiteId, depth + 1);
        }
    };

    await traverse(conceptId, 0);
    return { graphNodes, edges };
}

function isGapStatus(status, confidence) {
    const normalized = String(status || "").toLowerCase().trim();
    if (normalized.includes("strong")) return false;
    if (normalized.includes("weak")) return true;
    if (normalized.includes("don't know") || normalized.includes("dont know") || normalized.includes("unknown")) return true;
    return Number(confidence || 0) < 0.6;
}

function computeStudentMetrics(targetNode, graphNodes, studentKnowledgeMap) {
    const prerequisiteNodes = graphNodes.filter(
        (node) => String(node.id) !== String(targetNode.id)
    );

    let strongConcepts = 0;
    let weakConcepts = 0;
    let identifiedGaps = 0;
    let criticalGaps = 0;
    let confidenceSum = 0;
    let debtScore = 0;

    const gapNodes = [];

    for (const node of prerequisiteNodes) {
        const knowledge = studentKnowledgeMap.get(String(node.id)) || {
            status: "Don't Know",
            confidence: 0
        };
        const status = knowledge.status || "Don't Know";
        const confidence = Math.min(Math.max(Number(knowledge.confidence || 0), 0), 1);
        const isGap = isGapStatus(status, confidence);

        confidenceSum += confidence;

        if (isGap) {
            identifiedGaps++;
            if (confidence < 0.4) criticalGaps++;
            gapNodes.push({ ...node, status, confidence });
        }

        const normalized = String(status).toLowerCase();
        if (normalized.includes("strong")) strongConcepts++;
        else if (normalized.includes("weak")) weakConcepts++;

        const difficulty = Math.min(Math.max(Number(node.difficulty || 1), 1), 5);
        debtScore += (1 - confidence) * (0.5 + difficulty / 5);
    }

    const total = Math.max(prerequisiteNodes.length, 1);
    const knowledgeDebt = Math.min(100, Math.round((debtScore / total) * 100));
    const mastery = Math.round((strongConcepts / total) * 100) / 100;
    const confidence = prerequisiteNodes.length
        ? Math.round((confidenceSum / prerequisiteNodes.length) * 100) / 100
        : 1;

    const rootCause =
        gapNodes.length > 0
            ? [...gapNodes].sort((a, b) => {
                  if (b.depth !== a.depth) return b.depth - a.depth;
                  return a.confidence - b.confidence;
              })[0]
            : null;

    let debtLevel = "LOW";
    if (knowledgeDebt >= 70) debtLevel = "HIGH";
    else if (knowledgeDebt >= 40) debtLevel = "MODERATE";

    let readiness = "ready";
    if (identifiedGaps === 0) readiness = "ready";
    else if (criticalGaps > 0) readiness = "blocked";
    else readiness = "needs_review";

    const flags = [];
    if (confidence >= 0.65 && mastery < 0.4) flags.push("misconception");
    if (confidence < 0.35 && mastery >= 0.6) flags.push("imposter");

    return {
        strong_concepts: strongConcepts,
        weak_concepts: weakConcepts,
        identified_gaps: identifiedGaps,
        critical_gaps: criticalGaps,
        knowledge_debt: knowledgeDebt,
        debt_level: debtLevel,
        mastery,
        confidence,
        readiness,
        flags,
        root_cause: rootCause
            ? {
                  concept_id: rootCause.id,
                  concept_name: rootCause.name,
                  depth: rootCause.depth
              }
            : null
    };
}

function buildCohortQuiz(targetNode, graphNodes, edges, bottleneck, topGaps) {
    const targetName = targetNode.name;
    const nodes = graphNodes.filter((n) => String(n.id) !== String(targetNode.id));
    const nameOf = (id) => {
        const n = graphNodes.find((g) => String(g.id) === String(id));
        return n ? n.name : "this topic";
    };
    const childrenOf = new Map();
    edges.forEach((e) => {
        if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
        childrenOf.get(e.from).push(e.to);
    });

    const questions = [];
    const randPick = (arr, n, exclude) => {
        const pool = arr.filter((x) => !exclude.includes(String(x.id))).slice(0, 12);
        const shuffled = pool.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    };

    if (bottleneck) {
        const decoys = randPick(nodes, 3, [bottleneck.concept_id]);
        const options = [bottleneck.concept_name, ...decoys.map((d) => d.name)].sort(
            () => Math.random() - 0.5
        );
        questions.push({
            question: `Which foundational concept blocks the most students before learning ${targetName}?`,
            options,
            answer: bottleneck.concept_name,
            rationale: `${bottleneck.affected_pct}% of the class is missing ${bottleneck.concept_name}.`
        });
    }

    if (topGaps.length >= 2) {
        const gap = topGaps[1];
        const downstream = childrenOf.get(String(gap.concept_id)) || [];
        const downstreamNames = downstream.map(nameOf).filter(Boolean);
        const decoys = randPick(nodes, 2, [gap.concept_id]);
        const options = [...downstreamNames, ...decoys.map((d) => d.name)]
            .slice(0, 4)
            .sort(() => Math.random() - 0.5);
        if (options.length >= 2) {
            questions.push({
                question: `A student struggling with ${gap.concept_name} will most likely struggle with:`,
                options,
                answer: downstreamNames[0],
                rationale: `${gap.concept_name} unlocks ${downstreamNames.join(", ")}.`
            });
        }
    }

    if (bottleneck) {
        questions.push({
            question: `True or false: ${bottleneck.concept_name} is a prerequisite of ${targetName}.`,
            options: ["True", "False"],
            answer: "True",
            rationale: `${bottleneck.concept_name} sits at depth ${bottleneck.depth} in the prerequisite chain.`
        });
    }

    if (topGaps.length > 0) {
        const top = topGaps[0];
        const decoys = randPick(nodes, 3, [top.concept_id]);
        const options = [top.concept_name, ...decoys.map((d) => d.name)].sort(
            () => Math.random() - 0.5
        );
        questions.push({
            question: `Which concept unlocks the most downstream topics for the class?`,
            options,
            answer: top.concept_name,
            rationale: `${top.concept_name} gates ${top.downstream_impact} downstream concept(s).`
        });
    }

    return questions.slice(0, 5);
}

// ============================================================
// MAIN ADVANCED I/O ROUTE
// ============================================================

app.get("/", async (req, res) => {

    let catalystApp = null;

    try {

        // ========================================================
        // 1. INITIALIZE CATALYST
        // ========================================================

        catalystApp = catalyst.initialize(req);

        // ========================================================
        // 2. AUTHENTICATED SESSION -> STUDENT MAPPING
        // ========================================================

        const sessionUser = await resolveSessionUser(catalystApp, req);

        const requestedStudentId =
            req.query.student_id || req.body?.student_id;

        const sessionStudentId = sessionUser
            ? String(sessionUser.user_id || sessionUser.id)
            : null;

        // A signed-in user may only analyze their own profile.
        if (
            sessionStudentId &&
            requestedStudentId &&
            String(requestedStudentId) !== sessionStudentId
        ) {
            return res.status(403).json({
                success: false,
                error:
                    "Access denied: you can only analyze your own student profile."
            });
        }

        // Derive the student identity: authenticated user_id first.
        let studentId = sessionStudentId;

        // Dev/CLI fallback — only when no authenticated session exists.
        if (!studentId && requestedStudentId) {
            studentId = String(requestedStudentId);
            console.warn(
                "NO AUTHENTICATED SESSION: using student_id from request " +
                "(development/testing only)."
            );
        }

        // No session and no explicit student -> reject unauthenticated calls.
        if (!studentId) {
            return res.status(401).json({
                success: false,
                error:
                    "Authentication required: sign in to analyze your " +
                    "prerequisite graph."
            });
        }

        // ========================================================
        // 3. GET INPUT ARGUMENTS
        // ========================================================

        const conceptId =
            req.query.concept_id || req.body?.concept_id;

        console.log(
            "CONCEPT ID:",
            conceptId
        );

        console.log(
            "STUDENT ID (resolved):",
            studentId,
            "| authenticated:",
            !!sessionUser
        );

        // ========================================================
        // 4. VALIDATE INPUT
        // ========================================================

        if (!conceptId) {
            return res.status(400).json({
                success: false,
                error: "concept_id is required"
            });
        }

        // ========================================================
        // 5. ZCQL HELPER
        // ========================================================

        const executeZCQL = async (query) => {

            console.log(
                "ZCQL:",
                query
            );

            const result =
                await catalystApp
                    .zcql()
                    .executeZCQLQuery(query);

            return result || [];
        };

        // ========================================================
        // 6. GET CONCEPT
        // ========================================================

        const getConcept = async (id) => {

            const query =
                `SELECT * FROM Concepts WHERE ROWID = '${id}'`;

            const result =
                await executeZCQL(query);

            if (
                !result ||
                result.length === 0
            ) {
                return null;
            }

            return (
                result[0].Concepts ||
                result[0]
            );
        };

        // ========================================================
        // 7. GET STUDENT KNOWLEDGE
        // ========================================================

        const getKnowledge = async (
            student,
            concept
        ) => {

            const query =
                `SELECT * FROM StudentKnowledge ` +
                `WHERE student_id = '${student}' ` +
                `AND concept_id = '${concept}'`;

            const result =
                await executeZCQL(query);

            if (
                !result ||
                result.length === 0
            ) {
                return {
                    status: "Don't Know",
                    confidence: 0
                };
            }

            const knowledge =
                result[0].StudentKnowledge ||
                result[0];

            const confidence =
                Number(
                    knowledge.confidence || 0
                );

            return {

                status:
                    knowledge.status ||
                    "Don't Know",

                confidence:
                    confidence
            };
        };

        // ========================================================
        // 8. CALCULATE KNOWLEDGE GAP
        // ========================================================

        const calculateGap = (
            status,
            confidence
        ) => {

            const normalized =
                String(
                    status || ""
                ).toLowerCase()
                .trim();

            // Strong concepts are considered ready
            if (
                normalized.includes("strong")
            ) {
                return false;
            }

            // Weak concepts are gaps
            if (
                normalized.includes("weak")
            ) {
                return true;
            }

            // Don't Know / Unknown concepts are gaps
            if (
                normalized.includes("don't know") ||
                normalized.includes("dont know") ||
                normalized.includes("unknown")
            ) {
                return true;
            }

            // Confidence-based fallback
            return (
                Number(
                    confidence || 0
                ) < 0.6
            );
        };

        // ========================================================
        // 9. TARGET CONCEPT
        // ========================================================

        const targetConcept =
            await getConcept(
                conceptId
            );

        if (!targetConcept) {

            throw new Error(
                `Concept not found: ${conceptId}`
            );
        }

        const targetKnowledge =
            await getKnowledge(
                studentId,
                conceptId
            );

        const targetIsGap =
            calculateGap(
                targetKnowledge.status,
                targetKnowledge.confidence
            );

        const target = {

            id: String(
                targetConcept.ROWID ||
                targetConcept.rowid ||
                conceptId
            ),

            name:
                targetConcept.name ||
                targetConcept.concept_name ||
                "Unknown Concept",

            description:
                targetConcept.description ||
                "",

            difficulty:
                Number(
                    targetConcept.difficulty || 0
                ),

            depth: 0,

            status:
                targetKnowledge.status,

            confidence:
                Number(
                    targetKnowledge.confidence || 0
                ),

            isGap:
                targetIsGap
        };

        // ========================================================
        // 10. GRAPH STORAGE
        // ========================================================

        const graphNodes = [];

        // Directed dependency edges: from -> to means
        // "to is a prerequisite of from". The target concept is
        // the root; every edge flows from a shallower node to a
        // deeper prerequisite node.
        const edges = [];

        const visited = new Set();

        // ========================================================
        // 11. RECURSIVELY BUILD PREREQUISITE GRAPH
        // ========================================================

        const traversePrerequisites = async (
            currentConceptId,
            depth
        ) => {

            const currentId =
                String(currentConceptId);

            // Prevent circular prerequisite graphs
            if (
                visited.has(currentId)
            ) {
                return;
            }

            visited.add(currentId);

            // ----------------------------------------------------
            // Get current concept
            // ----------------------------------------------------

            const concept =
                await getConcept(
                    currentId
                );

            if (!concept) {
                return;
            }

            // ----------------------------------------------------
            // Get student's knowledge
            // ----------------------------------------------------

            const knowledge =
                await getKnowledge(
                    studentId,
                    currentId
                );

            const isGap =
                calculateGap(
                    knowledge.status,
                    knowledge.confidence
                );

            // ----------------------------------------------------
            // Add node
            // ----------------------------------------------------

            graphNodes.push({

                id: String(
                    concept.ROWID ||
                    concept.rowid ||
                    currentId
                ),

                name:
                    concept.name ||
                    concept.concept_name ||
                    "Unknown Concept",

                description:
                    concept.description ||
                    "",

                difficulty:
                    Number(
                        concept.difficulty || 0
                    ),

                depth:
                    depth,

                status:
                    knowledge.status,

                confidence:
                    Number(
                        knowledge.confidence || 0
                    ),

                isGap:
                    isGap
            });

            // ----------------------------------------------------
            // Get prerequisites
            // ----------------------------------------------------

            const prerequisiteQuery =
                `SELECT * FROM Prerequisites ` +
                `WHERE concept_id = '${currentId}'`;

            const prerequisiteRows =
                await executeZCQL(
                    prerequisiteQuery
                );

            if (
                !prerequisiteRows ||
                prerequisiteRows.length === 0
            ) {
                return;
            }

            // ----------------------------------------------------
            // Traverse each prerequisite
            // ----------------------------------------------------

            for (
                const row of prerequisiteRows
            ) {

                const prerequisite =
                    row.Prerequisites ||
                    row;

                const prerequisiteId =
                    prerequisite.prerequisite_id ||
                    prerequisite.prereq_id ||
                    prerequisite.prerequisite_concept_id;

                if (!prerequisiteId) {
                    continue;
                }

                edges.push({
                    from: currentId,
                    to: String(prerequisiteId)
                });

                await traversePrerequisites(
                    prerequisiteId,
                    depth + 1
                );
            }
        };

        // ========================================================
        // 12. START GRAPH TRAVERSAL
        // ========================================================

        await traversePrerequisites(
            conceptId,
            0
        );

        // ========================================================
        // 13. REMOVE TARGET FROM PREREQUISITE COUNT
        // ========================================================

        const prerequisiteNodes =
            graphNodes.filter(
                (node) =>
                    String(node.id) !==
                    String(conceptId)
            );

        // ========================================================
        // 14. STATISTICS
        // ========================================================

        const identifiedGaps =
            prerequisiteNodes.filter(
                (node) =>
                    node.isGap
            ).length;

        const strongConcepts =
            prerequisiteNodes.filter(
                (node) => {

                    const status =
                        String(
                            node.status || ""
                        ).toLowerCase();

                    return status.includes(
                        "strong"
                    );
                }
            ).length;

        const weakConcepts =
            prerequisiteNodes.filter(
                (node) => {

                    const status =
                        String(
                            node.status || ""
                        ).toLowerCase();

                    return status.includes(
                        "weak"
                    );
                }
            ).length;

        // ========================================================
        // 15. ROOT-CAUSE DETECTION
        // ========================================================

        const gapNodes =
            prerequisiteNodes.filter(
                (node) => node.isGap
            );

        // The deepest unresolved prerequisite is treated
        // as the root cause because it represents the most
        // foundational unresolved dependency.
        const rootCause =
            gapNodes.length > 0
                ? [...gapNodes].sort((a, b) => {

                    if (b.depth !== a.depth) {
                        return b.depth - a.depth;
                    }

                    return (
                        a.confidence -
                        b.confidence
                    );

                })[0]
                : null;

        // ========================================================
        // 16. KNOWLEDGE DEBT ENGINE
        // ========================================================

        // Knowledge debt increases when:
        // - confidence is low
        // - concept difficulty is high
        // - multiple prerequisite gaps exist

        let debtScore = 0;

        for (
            const node of prerequisiteNodes
        ) {

            const confidence =
                Math.min(
                    Math.max(
                        Number(
                            node.confidence || 0
                        ),
                        0
                    ),
                    1
                );

            const difficulty =
                Math.min(
                    Math.max(
                        Number(
                            node.difficulty || 1
                        ),
                        1
                    ),
                    5
                );

            const confidenceDeficit =
                1 - confidence;

            const difficultyWeight =
                0.5 +
                (difficulty / 5);

            debtScore +=
                confidenceDeficit *
                difficultyWeight;
        }

        // Normalize to 0–100
        const knowledgeDebt =
            Math.min(
                100,
                Math.round(
                    (
                        debtScore /
                        Math.max(
                            prerequisiteNodes.length,
                            1
                        )
                    ) * 100
                )
            );

        // Critical gaps have confidence below 40%
        const criticalGaps =
            prerequisiteNodes.filter(
                (node) =>
                    node.isGap &&
                    Number(
                        node.confidence || 0
                    ) < 0.4
            );

        // Estimate downstream impact.
        // Since depth 0 is the target and larger depth
        // represents foundational prerequisites, every
        // shallower node is downstream of the root gap.
        let rootCauseImpact = 0;

        if (rootCause) {

            rootCauseImpact =
                prerequisiteNodes.filter(
                    (node) =>
                        node.depth <
                        rootCause.depth
                ).length + 1;
        }

        // Debt classification
        let debtLevel = "LOW";

        if (knowledgeDebt >= 70) {
            debtLevel = "HIGH";
        } else if (knowledgeDebt >= 40) {
            debtLevel = "MODERATE";
        }

        // ========================================================
        // 17. BUILD REVISION PATH
        // ========================================================

        const revisionPath =
            prerequisiteNodes
                .filter(
                    (node) =>
                        node.isGap
                )
                .map(
                    (node) => ({

                        concept_id:
                            node.id,

                        concept_name:
                            node.name,

                        description:
                            node.description,

                        difficulty:
                            node.difficulty,

                        depth:
                            node.depth,

                        status:
                            node.status,

                        confidence:
                            node.confidence
                    })
                )
                .sort(
                    (a, b) =>
                        b.depth - a.depth
                );

        // ========================================================
        // 18. FINAL RESPONSE
        // ========================================================

        const response = {

            success: true,

            student: {
                id: studentId,
                authenticated: !!sessionUser
            },

            target:
                target,

            graph: {
                nodes:
                    graphNodes,
                edges:
                    edges
            },

            root_cause:
                rootCause
                    ? {
                        concept_id:
                            rootCause.id,

                        concept_name:
                            rootCause.name,

                        description:
                            rootCause.description,

                        confidence:
                            rootCause.confidence,

                        status:
                            rootCause.status,

                        depth:
                            rootCause.depth,

                        downstream_impact:
                            rootCauseImpact
                    }
                    : null,

            knowledge_debt: {

                score:
                    knowledgeDebt,

                level:
                    debtLevel,

                total_gaps:
                    identifiedGaps,

                critical_gaps:
                    criticalGaps.length,

                affected_concepts:
                    rootCauseImpact
            },

            statistics: {
                total_prerequisites:
                    prerequisiteNodes.length,

                identified_gaps:
                    identifiedGaps,

                strong_concepts:
                    strongConcepts,

                weak_concepts:
                    weakConcepts
            }
        };

        // ========================================================
        // 19. DEBUG LOG
        // ========================================================

        console.log(
            "FINAL RESPONSE:"
        );

        console.log(
            JSON.stringify(
                response,
                null,
                2
            )
        );

        // ========================================================
        // 20. SEND COMPLETE JSON RESPONSE
        // ========================================================

        return res
            .status(200)
            .json(response);

    } catch (error) {

        // ========================================================
        // ERROR HANDLING
        // ========================================================

        console.error(
            "PREREQ GRAPH ERROR:",
            error.message
        );

        console.error(
            error.stack
        );

        return res
            .status(500)
            .json({

                success: false,

                error:
                    error.message ||
                    "Internal server error"
            });
    }
});

// ============================================================
// PROFILE — current authenticated user + role
// ------------------------------------------------------------
// Identity comes entirely from the Catalyst session user
// (userManagement().getCurrentUser()) — no Profiles table.
// The student/faculty role is derived from the user's Catalyst
// roles via resolveRole().
// ============================================================

app.get("/profile", async (req, res) => {
    let catalystApp = null;
    try {
        catalystApp = catalyst.initialize(req);
        const sessionUser = await resolveSessionUser(catalystApp, req);
        if (!sessionUser) {
            return res.status(401).json({
                success: false,
                error: "Authentication required: sign in to view your profile."
            });
        }

        const userId = String(sessionUser.user_id || sessionUser.id);

        const profile = {
            user_id: userId,
            first_name:
                sessionUser.first_name || sessionUser.firstName || "Student",
            last_name:
                sessionUser.last_name || sessionUser.lastName || "",
            email:
                sessionUser.email_id || sessionUser.email || "",
            role: resolveRole(sessionUser)
        };

        return res.status(200).json({ success: true, profile });
    } catch (error) {
        console.error("PROFILE ERROR:", error.message);
        return res.status(500).json({
            success: false,
            error: error.message || "Internal server error"
        });
    }
});

// ============================================================
// FACULTY COHORT — class-level diagnostic intelligence
// ------------------------------------------------------------
// Requires an authenticated session whose Catalyst role is
// faculty (resolveRole) — no Profiles table. Computes:
//   readiness distribution, cohort debt, mastery histogram,
//   class bottleneck + impact ranking, risk matrix, roster with
//   misconception/imposter flags, class concept map, remediation
//   groups, pacing advice and a pre-lecture quiz.
// ============================================================

app.get("/faculty/cohort", async (req, res) => {
    let catalystApp = null;
    try {
        catalystApp = catalyst.initialize(req);
        const sessionUser = await resolveSessionUser(catalystApp, req);
        if (!sessionUser) {
            return res.status(401).json({
                success: false,
                error: "Authentication required: sign in to view class analytics."
            });
        }

        const userId = String(sessionUser.user_id || sessionUser.id);
        const executeZCQL = async (query) =>
            (await catalystApp.zcql().executeZCQLQuery(query)) || [];

        // ---- faculty role gate (pure Catalyst roles) ------------
        if (resolveRole(sessionUser) !== "faculty") {
            return res.status(403).json({
                success: false,
                error:
                    "Faculty access required: assign a Faculty/Admin role to this user " +
                    "in Catalyst User Management."
            });
        }

        const conceptId = req.query.concept_id || req.body?.concept_id;
        if (!conceptId) {
            return res.status(400).json({ success: false, error: "concept_id is required" });
        }

        const getConcept = async (id) => {
            const result = await executeZCQL(`SELECT * FROM Concepts WHERE ROWID = '${id}'`);
            if (!result || result.length === 0) return null;
            return result[0].Concepts || result[0];
        };

        const targetConcept = await getConcept(conceptId);
        if (!targetConcept) {
            throw new Error(`Concept not found: ${conceptId}`);
        }

        const targetNode = {
            id: String(targetConcept.ROWID || targetConcept.rowid || conceptId),
            name: targetConcept.name || targetConcept.concept_name || "Unknown Concept",
            description: targetConcept.description || "",
            difficulty: Number(targetConcept.difficulty || 0),
            depth: 0
        };

        const { graphNodes, edges } = await buildPrerequisiteGraph(
            executeZCQL,
            getConcept,
            conceptId
        );

        // ---- load all student knowledge + user names -------------
        let knowledgeRows = [];
        try {
            knowledgeRows = await executeZCQL("SELECT * FROM StudentKnowledge");
        } catch (err) {
            console.warn("STUDENT KNOWLEDGE QUERY FAILED:", err.message);
        }

        // Roster names come straight from Catalyst User Management
        // (admin-scoped getAllUsers). Falls back to "Student <id>"
        // if the function lacks admin credentials.
        const nameByStudent = new Map();
        try {
            const allUsers = await catalystApp.userManagement().getAllUsers();
            for (const u of allUsers || []) {
                const uid = u.user_id || u.id;
                if (!uid) continue;
                const full =
                    `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                    `Student ${uid}`;
                nameByStudent.set(String(uid), full);
            }
        } catch (err) {
            console.warn("USER LIST QUERY FAILED (falling back to IDs):", err.message);
        }

        // knowledgeByStudent: student_id -> Map(concept_id -> {status, confidence})
        const knowledgeByStudent = new Map();
        for (const row of knowledgeRows || []) {
            const k = row.StudentKnowledge || row;
            const sid = String(k.student_id || "");
            const cid = String(k.concept_id || "");
            if (!sid || !cid) continue;
            if (!knowledgeByStudent.has(sid)) knowledgeByStudent.set(sid, new Map());
            knowledgeByStudent
                .get(sid)
                .set(cid, { status: k.status || "Don't Know", confidence: Number(k.confidence || 0) });
        }

        // Students = everyone with knowledge rows on this graph.
        const relevantStudentIds = new Set();
        for (const row of knowledgeRows || []) {
            const k = row.StudentKnowledge || row;
            const cid = String(k.concept_id || "");
            if (graphNodes.some((n) => String(n.id) === cid)) {
                relevantStudentIds.add(String(k.student_id || ""));
            }
        }
        const studentIds = Array.from(relevantStudentIds).filter(Boolean);

        // ---- per-student metrics + roster -------------------------
        const roster = studentIds.map((sid) => {
            const knowledgeMap = knowledgeByStudent.get(sid) || new Map();
            const metrics = computeStudentMetrics(targetNode, graphNodes, knowledgeMap);
            return {
                student_id: sid,
                name: nameByStudent.get(sid) || `Student ${sid}`,
                readiness: metrics.readiness,
                debt_level: metrics.debt_level,
                knowledge_debt: metrics.knowledge_debt,
                mastery: metrics.mastery,
                confidence: metrics.confidence,
                gap_count: metrics.identified_gaps,
                critical_gaps: metrics.critical_gaps,
                flags: metrics.flags,
                root_cause: metrics.root_cause
            };
        });

        const totalStudents = Math.max(studentIds.length, 1);

        // ---- readiness distribution -------------------------------
        const readyCount = roster.filter((r) => r.readiness === "ready").length;
        const needsCount = roster.filter((r) => r.readiness === "needs_review").length;
        const blockedCount = roster.filter((r) => r.readiness === "blocked").length;

        // ---- cohort debt -------------------------------------------
        const cohortDebt = roster.length
            ? Math.round(roster.reduce((s, r) => s + r.knowledge_debt, 0) / roster.length)
            : 0;
        let cohortDebtLevel = "LOW";
        if (cohortDebt >= 70) cohortDebtLevel = "HIGH";
        else if (cohortDebt >= 40) cohortDebtLevel = "MODERATE";

        // ---- mastery histogram (per-student mastery) ---------------
        const bins = [0.2, 0.4, 0.6, 0.8, 1.01];
        const histogram = bins.map((max, i) => {
            const min = i === 0 ? -0.01 : bins[i - 1];
            const count = roster.filter((r) => r.mastery > min && r.mastery <= max).length;
            return {
                label: `${Math.round((min + 0.01) * 100)}–${Math.round(max * 100)}%`,
                count,
                pct: Math.round((count / totalStudents) * 100)
            };
        });

        // ---- per-node class stats ----------------------------------
        const downstreamOf = new Map();
        const childrenOf = new Map();
        edges.forEach((e) => {
            if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
            childrenOf.get(e.from).push(e.to);
        });
        const countDownstream = (id) => {
            const seen = new Set();
            const stack = childrenOf.get(String(id)) || [];
            while (stack.length) {
                const cur = stack.pop();
                if (seen.has(cur)) continue;
                seen.add(cur);
                (childrenOf.get(cur) || []).forEach((c) => stack.push(c));
            }
            return seen.size;
        };

        const classNodeStats = graphNodes.map((node) => {
            let affected = 0;
            let masterySum = 0;
            for (const sid of studentIds) {
                const km = knowledgeByStudent.get(sid) || new Map();
                const k = km.get(String(node.id)) || { status: "Don't Know", confidence: 0 };
                masterySum += Math.min(Math.max(Number(k.confidence || 0), 0), 1);
                if (isGapStatus(k.status, k.confidence)) affected++;
            }
            return {
                id: node.id,
                name: node.name,
                description: node.description,
                difficulty: node.difficulty,
                depth: node.depth,
                affected_students: affected,
                class_mastery: studentIds.length
                    ? Math.round((masterySum / studentIds.length) * 100) / 100
                    : 0,
                downstream_impact: countDownstream(node.id)
            };
        });

        // ---- impact ranking + bottleneck ---------------------------
        const gapConcepts = classNodeStats.filter(
            (n) => String(n.id) !== String(conceptId) && n.affected_students > 0
        );
        const impactRanking = gapConcepts
            .map((n) => ({
                concept_id: n.id,
                concept_name: n.name,
                description: n.description,
                depth: n.depth,
                affected_students: n.affected_students,
                affected_pct: Math.round((n.affected_students / totalStudents) * 100),
                downstream_impact: n.downstream_impact,
                score: n.affected_students * Math.max(n.downstream_impact, 1)
            }))
            .sort((a, b) => b.score - a.score);

        const bottleneck = impactRanking.length ? impactRanking[0] : null;

        // ---- risk matrix (2x2) --------------------------------------
        const affectedHigh = studentIds.length >= 4 ? Math.ceil(totalStudents * 0.3) : 1;
        const riskMatrix = {
            high_impact_high_risk: [],
            high_impact_low_risk: [],
            low_impact_high_risk: [],
            low_impact_low_risk: []
        };
        for (const g of impactRanking) {
            const affected = g.affected_students >= affectedHigh;
            const impact = g.downstream_impact >= 2;
            if (affected && impact) riskMatrix.high_impact_high_risk.push(g);
            else if (affected && !impact) riskMatrix.high_impact_low_risk.push(g);
            else if (!affected && impact) riskMatrix.low_impact_high_risk.push(g);
            else riskMatrix.low_impact_low_risk.push(g);
        }

        // ---- remediation groups (by root cause) --------------------
        const groupsByRoot = new Map();
        for (const r of roster) {
            if (!r.root_cause) continue;
            if (!groupsByRoot.has(r.root_cause.concept_id)) {
                groupsByRoot.set(r.root_cause.concept_id, {
                    concept_id: r.root_cause.concept_id,
                    concept_name: r.root_cause.concept_name,
                    students: []
                });
            }
            groupsByRoot.get(r.root_cause.concept_id).students.push(r);
        }
        const remediationGroups = Array.from(groupsByRoot.values())
            .map((g) => ({ ...g, count: g.students.length }))
            .sort((a, b) => b.count - a.count);

        // ---- pacing advisor ------------------------------------------
        const blockedPct = Math.round((blockedCount / totalStudents) * 100);
        const needsPct = Math.round((needsCount / totalStudents) * 100);
        let pacing;
        if (blockedPct >= 30) {
            pacing = {
                action: "review_before_proceeding",
                message: `${blockedPct}% of the class is blocked. Dedicate 15 minutes to ${bottleneck ? bottleneck.concept_name : "the root gap"} before proceeding.`
            };
        } else if (blockedPct > 0 || needsPct >= 40) {
            pacing = {
                action: "quick_warmup",
                message: `${needsPct}% of the class needs a review. Run a quick warm-up on the top shared gaps before the lecture.`
            };
        } else {
            pacing = {
                action: "proceed",
                message: "Class readiness is strong — proceed to the next topic."
            };
        }

        // ---- quiz ------------------------------------------------------
        const quiz = buildCohortQuiz(targetNode, graphNodes, edges, bottleneck, impactRanking);

        const response = {
            success: true,
            faculty: { user_id: userId },
            target: targetNode,
            cohort: {
                student_count: studentIds.length,
                readiness: {
                    ready: readyCount,
                    needs_review: needsCount,
                    blocked: blockedCount,
                    ready_pct: Math.round((readyCount / totalStudents) * 100),
                    needs_review_pct: needsPct,
                    blocked_pct: blockedPct
                },
                knowledge_debt: {
                    score: cohortDebt,
                    level: cohortDebtLevel
                },
                mastery_histogram: histogram,
                bottleneck,
                impact_ranking: impactRanking,
                risk_matrix: riskMatrix,
                roster,
                concept_map: { nodes: classNodeStats, edges },
                remediation_groups: remediationGroups,
                pacing
            },
            quiz
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error("FACULTY COHORT ERROR:", error.message);
        console.error(error.stack);
        return res.status(500).json({
            success: false,
            error: error.message || "Internal server error"
        });
    }
});

// ============================================================
// EXPORT ADVANCED I/O EXPRESS APP
// ============================================================

module.exports = app;

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
// EXPORT ADVANCED I/O EXPRESS APP
// ============================================================

module.exports = app;

"use strict";

const express = require("express");
const catalyst = require("zcatalyst-sdk-node");

const app = express();

// ============================================================
// EXPRESS MIDDLEWARE
// ============================================================

app.use(express.json());

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
        // 2. GET INPUT ARGUMENTS
        // ========================================================

        const conceptId =
            req.query.concept_id ||
            req.body?.concept_id;

        const studentId =
            req.query.student_id ||
            req.body?.student_id;

        console.log(
            "RAW QUERY:",
            JSON.stringify(req.query)
        );

        console.log(
            "CONCEPT ID:",
            conceptId
        );

        console.log(
            "STUDENT ID:",
            studentId
        );

        // ========================================================
        // 3. VALIDATE INPUT
        // ========================================================

        if (!conceptId) {
            return res.status(400).json({
                success: false,
                error: "concept_id is required"
            });
        }

        if (!studentId) {
            return res.status(400).json({
                success: false,
                error: "student_id is required"
            });
        }

        // ========================================================
        // 4. ZCQL HELPER
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
        // 5. GET CONCEPT
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
        // 6. GET STUDENT KNOWLEDGE
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
        // 7. CALCULATE KNOWLEDGE GAP
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
        // 8. TARGET CONCEPT
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
        // 9. GRAPH STORAGE
        // ========================================================

        const graphNodes = [];

        const visited = new Set();

        // ========================================================
        // 10. RECURSIVELY BUILD PREREQUISITE GRAPH
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

                await traversePrerequisites(
                    prerequisiteId,
                    depth + 1
                );
            }
        };

        // ========================================================
        // 11. START GRAPH TRAVERSAL
        // ========================================================

        await traversePrerequisites(
            conceptId,
            0
        );

        // ========================================================
        // 12. REMOVE TARGET FROM PREREQUISITE COUNT
        // ========================================================

        const prerequisiteNodes =
            graphNodes.filter(
                (node) =>
                    String(node.id) !==
                    String(conceptId)
            );

        // ========================================================
        // 13. STATISTICS
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
// 14. ROOT-CAUSE DETECTION
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
// 15. KNOWLEDGE DEBT ENGINE
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
        // 14. BUILD REVISION PATH
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
        // 15. FINAL RESPONSE
        // ========================================================

        const response = {

    success: true,

    target:
        target,

    graph: {

        nodes:
            graphNodes
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
// 16. DEBUG LOG
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
// 17. SEND COMPLETE JSON RESPONSE
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
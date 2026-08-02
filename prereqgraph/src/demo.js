// ============================================================
// DEMO-MODE ANALYSIS GENERATOR
// ------------------------------------------------------------
// Used when the Catalyst runtime is unreachable (local preview,
// offline dev). It mirrors the exact response shape of the
// prereq_graph_function backend so every PrereqGraph module —
// Knowledge Map, Learning Paths, Progress, Recommendations,
// Insights — works end-to-end with realistic data.
// ============================================================

import { classifyStatus, isGapStatus } from "./status";

// ---- deterministic pseudo-random helpers -------------------------------

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---- curated knowledge graphs ------------------------------------------
// node 0 is the target; `prereqs` lists child node indices.
// `status` is the learner's status for that concept.

const CATALOG = [
    {
        match: /calculus/i,
        target: "Calculus",
        targetDesc:
            "The mathematical study of continuous change — derivatives, integrals, and their applications.",
        difficulty: 4,
        nodes: [
            { name: "Calculus", difficulty: 4, status: "Weak", confidence: 0.35, prereqs: [1, 2] },
            { name: "Limits & Continuity", difficulty: 3, status: "Weak", confidence: 0.42, prereqs: [4, 5] },
            { name: "Derivatives", difficulty: 3, status: "Don't Know", confidence: 0.18, prereqs: [3] },
            { name: "Trigonometry", difficulty: 2, status: "Weak", confidence: 0.5, prereqs: [4] },
            { name: "Algebra Basics", difficulty: 2, status: "Strong", confidence: 0.88, prereqs: [6] },
            { name: "Functions", difficulty: 1, status: "Strong", confidence: 0.84, prereqs: [] },
            { name: "Arithmetic & Fractions", difficulty: 1, status: "Strong", confidence: 0.96, prereqs: [] }
        ]
    },
    {
        match: /linear algebra/i,
        target: "Linear Algebra",
        targetDesc:
            "Vectors, matrices, and linear transformations — the foundation of modern computation.",
        difficulty: 4,
        nodes: [
            { name: "Linear Algebra", difficulty: 4, status: "Don't Know", confidence: 0.05, prereqs: [1, 2] },
            { name: "Matrices", difficulty: 3, status: "Weak", confidence: 0.4, prereqs: [3] },
            { name: "Systems of Equations", difficulty: 2, status: "Strong", confidence: 0.8, prereqs: [4] },
            { name: "Vectors", difficulty: 2, status: "Strong", confidence: 0.75, prereqs: [5] },
            { name: "Sets & Logic", difficulty: 1, status: "Strong", confidence: 0.9, prereqs: [] },
            { name: "Arithmetic", difficulty: 1, status: "Strong", confidence: 0.95, prereqs: [] }
        ]
    },
    {
        match: /machine learning|ml/i,
        target: "Machine Learning",
        targetDesc:
            "Building systems that learn from data — models, training, evaluation, and deployment.",
        difficulty: 5,
        nodes: [
            { name: "Machine Learning", difficulty: 5, status: "Weak", confidence: 0.25, prereqs: [1, 2, 4, 6] },
            { name: "Python Programming", difficulty: 2, status: "Strong", confidence: 0.85, prereqs: [] },
            { name: "Statistics", difficulty: 3, status: "Weak", confidence: 0.3, prereqs: [3] },
            { name: "Probability", difficulty: 3, status: "Strong", confidence: 0.7, prereqs: [5] },
            { name: "Linear Algebra", difficulty: 3, status: "Weak", confidence: 0.45, prereqs: [7] },
            { name: "Combinatorics Basics", difficulty: 2, status: "Strong", confidence: 0.78, prereqs: [] },
            { name: "Calculus", difficulty: 4, status: "Don't Know", confidence: 0.2, prereqs: [8, 9] },
            { name: "Matrices", difficulty: 2, status: "Weak", confidence: 0.48, prereqs: [10] },
            { name: "Limits", difficulty: 3, status: "Weak", confidence: 0.4, prereqs: [] },
            { name: "Derivatives", difficulty: 3, status: "Don't Know", confidence: 0.15, prereqs: [11] },
            { name: "Vectors", difficulty: 2, status: "Strong", confidence: 0.82, prereqs: [] },
            { name: "Functions", difficulty: 1, status: "Strong", confidence: 0.86, prereqs: [] }
        ]
    },
    {
        match: /probability/i,
        target: "Probability",
        targetDesc:
            "Quantifying uncertainty — random variables, distributions, and expectation.",
        difficulty: 3,
        nodes: [
            { name: "Probability", difficulty: 3, status: "Strong", confidence: 0.85, prereqs: [1, 2] },
            { name: "Sets & Events", difficulty: 1, status: "Strong", confidence: 0.92, prereqs: [] },
            { name: "Counting Methods", difficulty: 2, status: "Strong", confidence: 0.88, prereqs: [] }
        ]
    }
];

// ---- generic generation for unknown concept IDs -------------------------

const PREFIXES = [
    "Foundations of",
    "Fundamentals of",
    "Basics of",
    "Introduction to",
    "Core Concepts of",
    "Essentials of"
];

function generateGeneric(conceptId) {
    const rand = mulberry32(hashString(conceptId));
    const topic =
        TOPIC_WORDS[Math.floor(rand() * TOPIC_WORDS.length)];
    const targetName =
        rand() > 0.5 ? `${PREFIXES[Math.floor(rand() * PREFIXES.length)]} ${topic}` : topic;
    const depth = 4 + Math.floor(rand() * 3); // 4–6 prerequisite levels

    const nodes = [
        {
            name: targetName,
            difficulty: 4 + Math.floor(rand() * 2),
            status: rand() < 0.55 ? "Weak" : "Don't Know",
            confidence: rand() * 0.4,
            prereqs: [1]
        }
    ];

    const layerWords = [
        ["Core Terminology", "Key Principles", "Notation & Symbols"],
        ["Fundamental Theorems", "Basic Techniques", "Underlying Concepts"],
        ["Introductory Practice", "Applied Scenarios", "Worked Examples"],
        ["Elementary Prerequisites", "Foundational Skills", "Pre-requisite Basics"]
    ];

    for (let d = 1; d <= depth; d++) {
        const roll = rand();
        const status =
            roll < 0.4 ? "Strong" : roll < 0.65 ? "Weak" : "Don't Know";
        const confidence =
            status === "Strong"
                ? 0.75 + rand() * 0.2
                : status === "Weak"
                    ? 0.35 + rand() * 0.2
                    : rand() * 0.25;

        nodes.push({
            name:
                d <= layerWords.length
                    ? layerWords[d - 1][Math.floor(rand() * layerWords[d - 1].length)]
                    : `${PREFIXES[Math.floor(rand() * PREFIXES.length)]} ${topic} — Level ${d}`,
            difficulty: Math.max(1, 4 - d + Math.floor(rand() * 2)),
            status,
            confidence,
            prereqs: d < depth ? [d + 1] : []
        });
    }

    return { target: targetName, targetDesc: `Prerequisite graph generated for concept ID "${conceptId}".`, nodes };
}

const TOPIC_WORDS = [
    "Quantum Mechanics", "Organic Chemistry", "Microeconomics", "Algorithms",
    "Statistics", "Linear Algebra", "Discrete Math", "Thermodynamics",
    "Deep Learning", "Data Structures", "Operating Systems", "Networking",
    "Databases", "Web Development", "Differential Equations", "Graph Theory",
    "Cryptography", "Electromagnetism", "Computer Architecture", "Bayesian Inference"
];

// ---- backend-parity derived metrics --------------------------------------

function computeDerived(conceptId, targetNode, nodes, edges) {
    const graphNodes = nodes.map((n) => ({
        id: String(n.id),
        name: n.name,
        description: n.description || "",
        difficulty: Number(n.difficulty || 0),
        depth: Number(n.depth || 0),
        status: n.status || "Don't Know",
        confidence: Number(n.confidence || 0),
        isGap: !!n.isGap
    }));

    const prerequisiteNodes = graphNodes.filter((n) => String(n.id) !== String(targetNode.id));

    const identifiedGaps = prerequisiteNodes.filter((n) => n.isGap).length;
    const strongConcepts = prerequisiteNodes.filter((n) => classifyStatus(n.status) === "strong").length;
    const weakConcepts = prerequisiteNodes.filter((n) => classifyStatus(n.status) === "weak").length;

    const gapNodes = prerequisiteNodes.filter((n) => n.isGap);
    const rootCause =
        gapNodes.length > 0
            ? [...gapNodes].sort((a, b) => {
                  if (b.depth !== a.depth) return b.depth - a.depth;
                  return a.confidence - b.confidence;
              })[0]
            : null;

    let debtScore = 0;
    for (const node of prerequisiteNodes) {
        const confidence = Math.min(Math.max(Number(node.confidence || 0), 0), 1);
        const difficulty = Math.min(Math.max(Number(node.difficulty || 1), 1), 5);
        debtScore += (1 - confidence) * (0.5 + difficulty / 5);
    }
    const knowledgeDebt = Math.min(100, Math.round((debtScore / Math.max(prerequisiteNodes.length, 1)) * 100));
    const criticalGaps = prerequisiteNodes.filter((n) => n.isGap && Number(n.confidence || 0) < 0.4);

    let rootCauseImpact = 0;
    if (rootCause) {
        rootCauseImpact = prerequisiteNodes.filter((n) => n.depth < rootCause.depth).length + 1;
    }

    let debtLevel = "LOW";
    if (knowledgeDebt >= 70) debtLevel = "HIGH";
    else if (knowledgeDebt >= 40) debtLevel = "MODERATE";

    const revisionPath = prerequisiteNodes
        .filter((n) => n.isGap)
        .map((n) => ({
            concept_id: n.id,
            concept_name: n.name,
            description: n.description,
            difficulty: n.difficulty,
            depth: n.depth,
            status: n.status,
            confidence: n.confidence
        }))
        .sort((a, b) => b.depth - a.depth);

    return {
        success: true,
        demo: true,
        target: targetNode,
        graph: { nodes: graphNodes, edges },
        root_cause: rootCause
            ? {
                  concept_id: rootCause.id,
                  concept_name: rootCause.name,
                  description: rootCause.description,
                  confidence: rootCause.confidence,
                  status: rootCause.status,
                  depth: rootCause.depth,
                  downstream_impact: rootCauseImpact
              }
            : null,
        knowledge_debt: {
            score: knowledgeDebt,
            level: debtLevel,
            total_gaps: identifiedGaps,
            critical_gaps: criticalGaps.length,
            affected_concepts: rootCauseImpact
        },
        statistics: {
            total_prerequisites: prerequisiteNodes.length,
            identified_gaps: identifiedGaps,
            strong_concepts: strongConcepts,
            weak_concepts: weakConcepts
        },
        revision_path: revisionPath
    };
}

// ---- public entry point ---------------------------------------------------

export function buildDemoAnalysis(conceptId) {
    const id = String(conceptId || "").trim();
    const curated = CATALOG.find((c) => c.match.test(id));

    const source = curated
        ? { target: curated.target, targetDesc: curated.targetDesc, nodes: curated.nodes }
        : generateGeneric(id);

    const nodes = [];
    const edges = [];

    // Convert the curated/generic node list (with prereq indices) into
    // depth-labelled nodes with real dependency edges.
    const nodeById = new Map();
    source.nodes.forEach((n, idx) => {
        const idStr = curated ? `c${idx}` : `g${idx}`;
        nodeById.set(idx, idStr);
        nodes.push({
            id: idStr,
            name: n.name,
            description: n.description || n.targetDesc || `Foundational knowledge for ${source.target}.`,
            difficulty: n.difficulty,
            depth: 0, // filled below
            status: n.status,
            confidence: n.confidence,
            isGap: isGapStatus(n.status, n.confidence)
        });
    });

    // Depth = shortest path from the target via the prereq chain.
    nodes[0].depth = 0;
    const queue = [0];
    while (queue.length) {
        const cur = queue.shift();
        const curNode = nodes[cur];
        (source.nodes[cur].prereqs || []).forEach((pr) => {
            edges.push({ from: nodeById.get(cur), to: nodeById.get(pr) });
            const target = nodes[pr];
            if (target.depth === 0 && pr !== 0) target.depth = curNode.depth + 1;
            queue.push(pr);
        });
    }

    const targetNode = { ...nodes[0], depth: 0 };
    return computeDerived(id, targetNode, nodes, edges);
}

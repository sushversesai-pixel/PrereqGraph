// ============================================================
// DEMO-MODE DATA GENERATORS
// ------------------------------------------------------------
// Used when the Catalyst runtime is unreachable (local preview,
// offline dev). Mirrors the exact response shapes of the
// prereq_graph_function backend so every PrereqGraph module —
// student analysis AND the faculty cohort dashboard — works
// end-to-end with realistic data.
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
// `status` is the baseline learner's status for that concept.

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

const TOPIC_WORDS = [
    "Quantum Mechanics", "Organic Chemistry", "Microeconomics", "Algorithms",
    "Statistics", "Linear Algebra", "Discrete Math", "Thermodynamics",
    "Deep Learning", "Data Structures", "Operating Systems", "Networking",
    "Databases", "Web Development", "Differential Equations", "Graph Theory",
    "Cryptography", "Electromagnetism", "Computer Architecture", "Bayesian Inference"
];

function generateGeneric(conceptId) {
    const rand = mulberry32(hashString(conceptId));
    const topic = TOPIC_WORDS[Math.floor(rand() * TOPIC_WORDS.length)];
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

// ---- shared graph resolver ----------------------------------------------
// Converts a curated/generic node list (with prereq indices) into
// depth-labelled nodes with real dependency edges — used by both the
// student analysis and the faculty cohort generator.

function resolveDemoGraph(conceptId) {
    const id = String(conceptId || "").trim();
    const curated = CATALOG.find((c) => c.match.test(id));

    const source = curated
        ? { target: curated.target, targetDesc: curated.targetDesc, nodes: curated.nodes }
        : generateGeneric(id);

    const nodes = [];
    const edges = [];

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

    return { id, targetName: source.target, targetDesc: source.targetDesc, nodes, edges };
}

// ---- backend-parity derived metrics (student analysis) --------------------

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

// ---- demo student analysis entry point -------------------------------------

export function buildDemoAnalysis(conceptId) {
    const { id, nodes, edges } = resolveDemoGraph(conceptId);
    const targetNode = { ...nodes[0], depth: 0 };
    return computeDerived(id, targetNode, nodes, edges);
}

// ============================================================
// FACULTY COHORT GENERATOR
// ------------------------------------------------------------
// Builds a synthetic class of 24 students with deterministic
// archetypes (strong / average / struggling, plus one
// misconception and one imposter student) and mirrors the
// /faculty/cohort backend response shape.
// ============================================================

const DEMO_STUDENT_NAMES = [
    "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Sneha Iyer", "Arjun Nair",
    "Diya Reddy", "Kabir Singh", "Ananya Gupta", "Vihaan Joshi", "Ishaan Kulkarni",
    "Anika Rao", "Aditya Menon", "Sanya Kapoor", "Rahul Desai", "Meera Pillai",
    "Dev Bhatt", "Nisha Verma", "Karan Malhotra", "Tara Bose", "Siddharth Das",
    "Pooja Krishnan", "Varun Sethi", "Ritika Jain", "Aman Khanna"
];

function perStudentMetrics(targetNode, nodes, edges) {
    const prerequisiteNodes = nodes.filter((n) => String(n.id) !== String(targetNode.id));

    let strongConcepts = 0;
    let identifiedGaps = 0;
    let criticalGaps = 0;
    let confidenceSum = 0;
    let debtScore = 0;
    const gapNodes = [];

    for (const node of prerequisiteNodes) {
        const confidence = Math.min(Math.max(Number(node.confidence || 0), 0), 1);
        const difficulty = Math.min(Math.max(Number(node.difficulty || 1), 1), 5);
        confidenceSum += confidence;
        debtScore += (1 - confidence) * (0.5 + difficulty / 5);

        if (node.isGap) {
            identifiedGaps++;
            if (confidence < 0.4) criticalGaps++;
            gapNodes.push(node);
        }
        if (classifyStatus(node.status) === "strong") strongConcepts++;
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
        identified_gaps: identifiedGaps,
        critical_gaps: criticalGaps,
        knowledge_debt: knowledgeDebt,
        debt_level: debtLevel,
        mastery,
        confidence,
        readiness,
        flags,
        root_cause: rootCause
            ? { concept_id: rootCause.id, concept_name: rootCause.name, depth: rootCause.depth }
            : null
    };
}

function buildDemoQuiz(targetNode, nodes, edges, bottleneck, impactRanking) {
    const targetName = targetNode.name;
    const allNodes = nodes.filter((n) => String(n.id) !== String(targetNode.id));
    const nameOf = (id) => {
        const n = nodes.find((g) => String(g.id) === String(id));
        return n ? n.name : "this topic";
    };
    const childrenOf = new Map();
    edges.forEach((e) => {
        if (!childrenOf.has(e.from)) childrenOf.set(e.from, []);
        childrenOf.get(e.from).push(e.to);
    });

    const randPick = (arr, n, exclude) => {
        const pool = arr.filter((x) => !exclude.includes(String(x.id))).slice(0, 12);
        const shuffled = pool.sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    };

    const questions = [];

    if (bottleneck) {
        const decoys = randPick(allNodes, 3, [bottleneck.concept_id]);
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

    if (impactRanking.length >= 2) {
        const gap = impactRanking[1];
        const downstream = childrenOf.get(String(gap.concept_id)) || [];
        const downstreamNames = downstream.map(nameOf).filter(Boolean);
        const decoys = randPick(allNodes, 2, [gap.concept_id]);
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

    if (impactRanking.length > 0) {
        const top = impactRanking[0];
        const decoys = randPick(allNodes, 3, [top.concept_id]);
        const options = [top.concept_name, ...decoys.map((d) => d.name)].sort(
            () => Math.random() - 0.5
        );
        questions.push({
            question: "Which concept unlocks the most downstream topics for the class?",
            options,
            answer: top.concept_name,
            rationale: `${top.concept_name} gates ${top.downstream_impact} downstream concept(s).`
        });
    }

    return questions.slice(0, 5);
}

export function buildDemoCohort(conceptId) {
    const { id, nodes: baseNodes, edges } = resolveDemoGraph(conceptId);
    const targetNode = { ...baseNodes[0], depth: 0 };
    const seed = hashString(id + ":cohort");
    const rand = mulberry32(seed);

    const N = 24;
    const studentNodeLists = [];

    for (let i = 0; i < N; i++) {
        const archetype =
            i === N - 2 ? "misconception" : i === N - 1 ? "imposter" : i % 5 === 4 ? "struggling" : i % 3 === 0 ? "strong" : "average";

        const shift = archetype === "strong" ? 0.18 : archetype === "struggling" ? -0.22 : 0;

        const nodeList = baseNodes.map((n) => {
            let confidence = n.confidence + shift;
            if (archetype === "misconception") {
                confidence = Math.min(1, n.confidence * 0.55 + 0.55); // mid confidence
            } else if (archetype === "imposter") {
                confidence = Math.max(0.05, n.confidence * 0.45); // low confidence
            } else {
                const diffFactor = 1 - (Number(n.difficulty || 1) - 1) * 0.06;
                confidence += (rand() - 0.5) * 0.16 * diffFactor;
            }

            confidence = Math.round(Math.min(1, Math.max(0.02, confidence)) * 100) / 100;

            let status;
            if (archetype === "misconception") status = confidence >= 0.4 ? "Weak" : "Don't Know";
            else if (archetype === "imposter") status = "Strong";
            else if (confidence >= 0.7) status = "Strong";
            else if (confidence >= 0.4) status = "Weak";
            else status = "Don't Know";

            return { ...n, confidence, status, isGap: isGapStatus(status, confidence) };
        });

        studentNodeLists.push(nodeList);
    }

    const roster = studentNodeLists.map((nodeList, i) => {
        const metrics = perStudentMetrics(targetNode, nodeList, edges);
        return {
            student_id: `demo-student-${i + 1}`,
            name: DEMO_STUDENT_NAMES[i % DEMO_STUDENT_NAMES.length],
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

    const totalStudents = Math.max(roster.length, 1);

    const readyCount = roster.filter((r) => r.readiness === "ready").length;
    const needsCount = roster.filter((r) => r.readiness === "needs_review").length;
    const blockedCount = roster.filter((r) => r.readiness === "blocked").length;

    const cohortDebt = roster.length
        ? Math.round(roster.reduce((s, r) => s + r.knowledge_debt, 0) / roster.length)
        : 0;
    let cohortDebtLevel = "LOW";
    if (cohortDebt >= 70) cohortDebtLevel = "HIGH";
    else if (cohortDebt >= 40) cohortDebtLevel = "MODERATE";

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

    const classNodeStats = baseNodes.map((node) => {
        let affected = 0;
        let masterySum = 0;
        for (const nodeList of studentNodeLists) {
            const nn = nodeList.find((x) => String(x.id) === String(node.id));
            masterySum += nn ? Number(nn.confidence || 0) : 0;
            if (nn && nn.isGap) affected++;
        }
        return {
            id: node.id,
            name: node.name,
            description: node.description,
            difficulty: node.difficulty,
            depth: node.depth,
            affected_students: affected,
            class_mastery: studentNodeLists.length
                ? Math.round((masterySum / studentNodeLists.length) * 100) / 100
                : 0,
            downstream_impact: countDownstream(node.id)
        };
    });

    const gapConcepts = classNodeStats.filter(
        (n) => String(n.id) !== String(targetNode.id) && n.affected_students > 0
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

    const affectedHigh = roster.length >= 4 ? Math.ceil(totalStudents * 0.3) : 1;
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

    const quiz = buildDemoQuiz(targetNode, baseNodes, edges, bottleneck, impactRanking);

    return {
        success: true,
        demo: true,
        target: targetNode,
        cohort: {
            student_count: roster.length,
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
}

// ---- demo profile factory ---------------------------------------------------

export function buildDemoProfile(role) {
    const isFaculty = role === "faculty";
    return {
        user_id: "demo-user",
        first_name: "Demo",
        last_name: isFaculty ? "Faculty" : "Learner",
        email: isFaculty ? "faculty@prereqgraph.local" : "demo@prereqgraph.local",
        role: isFaculty ? "faculty" : "student",
        demo: true
    };
}

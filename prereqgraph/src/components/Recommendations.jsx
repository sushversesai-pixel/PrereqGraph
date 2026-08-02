import { useMemo } from "react";
import { classifyStatus, statusIcon } from "../status";

function buildGraph(nodes, edges) {
    const children = new Map();
    const parents = new Map();
    edges.forEach((e) => {
        const from = String(e.from);
        const to = String(e.to);
        if (!children.has(from)) children.set(from, []);
        children.get(from).push(to);
        if (!parents.has(to)) parents.set(to, []);
        parents.get(to).push(from);
    });
    return { children, parents };
}

function descendantCount(children, id, seen) {
    const stack = [...(children.get(id) || [])];
    let count = 0;
    while (stack.length) {
        const cur = stack.pop();
        if (seen.has(cur)) continue;
        seen.add(cur);
        count += 1;
        (children.get(cur) || []).forEach((c) => stack.push(c));
    }
    return count;
}

function searchLinks(topic) {
    const q = encodeURIComponent(topic);
    return [
        { label: "Khan Academy", href: `https://www.khanacademy.org/search?page_search_query=${q}` },
        { label: "YouTube", href: `https://www.youtube.com/results?search_query=${q}` },
        { label: "Google", href: `https://www.google.com/search?q=${q}+tutorial` }
    ];
}

export default function Recommendations({ data, onGoAnalyze }) {
    const nodes = useMemo(() => data?.graph?.nodes || [], [data]);
    const edges = useMemo(() => data?.graph?.edges || [], [data]);
    const nodeMap = useMemo(() => {
        const m = new Map();
        nodes.forEach((n) => m.set(String(n.id), n));
        return m;
    }, [nodes]);

    const { children, parents } = useMemo(() => buildGraph(nodes, edges), [nodes, edges]);

    const { learnNext, roiList } = useMemo(() => {
        const gaps = nodes.filter((n) => n.isGap);

        // Zero-gap prerequisites: gaps whose own prerequisites are all
        // strong/mastered — safe to start learning right now.
        const next = gaps
            .filter((n) => {
                const p = parents.get(String(n.id)) || [];
                if (!p.length) return true;
                return p.every((pid) => {
                    const pn = nodeMap.get(pid);
                    return pn && !pn.isGap;
                });
            })
            .sort((a, b) => b.depth - a.depth)
            .slice(0, 4);

        // High-ROI: gaps that unlock the most downstream concepts.
        const roi = gaps
            .map((n) => ({
                node: n,
                unlocks: descendantCount(children, String(n.id), new Set())
            }))
            .sort((a, b) => b.unlocks - a.unlocks)
            .slice(0, 5);

        return { learnNext: next, roiList: roi };
    }, [nodes, children, parents, nodeMap]);

    if (!data) {
        return (
            <div className="empty">
                No recommendations yet — run a knowledge analysis first.
                {onGoAnalyze && (
                    <button className="empty-action" onClick={onGoAnalyze}>
                        Analyze a concept →
                    </button>
                )}
            </div>
        );
    }

    const rootCause = data.root_cause;
    const totalGaps = data.knowledge_debt?.total_gaps || 0;

    return (
        <div className="recommendations">
            <div className="recommend-intro">
                <div className="page-kicker">SMART RECOMMENDATIONS</div>
                <h2>What to learn next</h2>
                <p>
                    {totalGaps === 0
                        ? "You have no open gaps — every prerequisite is ready."
                        : `You have ${totalGaps} open gap${totalGaps === 1 ? "" : "s"}. Start with the foundational topics below — each one unlocks the concepts that depend on it.`}
                </p>
            </div>

            {rootCause && (
                <section className="rec-root-cause">
                    <div className="rec-root-badge">START HERE</div>
                    <div className="rec-root-body">
                        <h3>{rootCause.concept_name}</h3>
                        <p>{rootCause.description}</p>
                        <div className="revision-meta">
                            <span>
                                <b>Root gap</b> — the deepest unresolved prerequisite
                            </span>
                            <span>
                                <b>Unlocks</b> {rootCause.downstream_impact} downstream
                                concept{rootCause.downstream_impact === 1 ? "" : "s"}
                            </span>
                            <span>
                                <b>Confidence</b>{" "}
                                {Math.round((rootCause.confidence || 0) * 100)}%
                            </span>
                        </div>
                    </div>
                    <div className="rec-root-links">
                        {searchLinks(rootCause.concept_name).map((l) => (
                            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer">
                                {l.label} ↗
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {learnNext.length > 0 && (
                <section className="rec-section">
                    <div className="section-header">
                        <div>
                            <div className="section-kicker">ZERO-GAP PREREQUISITES</div>
                            <h2>Ready to learn now</h2>
                            <p>
                                These gaps have no unresolved prerequisites of their own —
                                you can start studying them immediately.
                            </p>
                        </div>
                    </div>

                    <div className="rec-cards">
                        {learnNext.map((n) => (
                            <div className="rec-card" key={n.id}>
                                <span className={`map-chip ${classifyStatus(n.status)}`}>
                                    <i>{statusIcon(n.status)}</i>
                                    {classifyStatus(n.status) === "gap" ? "Gap" : "Weak"}
                                </span>
                                <h3>{n.name}</h3>
                                <p>{n.description}</p>
                                <div className="rec-card-meta">
                                    <span>Depth {n.depth}</span>
                                    <span>Diff {n.difficulty}/5</span>
                                    <span>
                                        {Math.round((n.confidence || 0) * 100)}% known
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {roiList.length > 0 && (
                <section className="rec-section">
                    <div className="section-header">
                        <div>
                            <div className="section-kicker">HIGH ROI CONCEPTS</div>
                            <h2>Biggest learning leverage</h2>
                            <p>
                                Master these gaps first — each one unlocks the most
                                downstream topics.
                            </p>
                        </div>
                    </div>

                    <div className="rec-roi-list">
                        {roiList.map(({ node, unlocks }, i) => (
                            <div className="rec-roi-item" key={node.id}>
                                <div className="rec-roi-rank">{i + 1}</div>
                                <div className="rec-roi-body">
                                    <h3>{node.name}</h3>
                                    <p>{node.description}</p>
                                    <div className="revision-meta">
                                        <span>
                                            <b>Unlocks</b> {unlocks} concept
                                            {unlocks === 1 ? "" : "s"}
                                        </span>
                                        <span>
                                            <b>Depth</b> {node.depth}
                                        </span>
                                        <span>
                                            <b>Difficulty</b> {node.difficulty}/5
                                        </span>
                                    </div>
                                </div>
                                <div className="rec-roi-links">
                                    {searchLinks(node.name).map((l) => (
                                        <a
                                            key={l.label}
                                            href={l.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            {l.label} ↗
                                        </a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {learnNext.length === 0 && roiList.length === 0 && totalGaps === 0 && (
                <div className="success-box">
                    <div className="success-icon">✓</div>
                    <div>
                        <strong>All clear</strong>
                        <p>
                            No gaps to recommend — you're ready to take on this concept.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

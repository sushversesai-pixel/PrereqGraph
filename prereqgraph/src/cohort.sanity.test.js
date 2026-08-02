import { buildDemoCohort, buildDemoProfile } from "./demo";

test("demo cohort produces realistic, well-formed class data", () => {
    const c = buildDemoCohort("machine learning");
    expect(c.success).toBe(true);
    expect(c.target.name).toBe("Machine Learning");
    expect(c.cohort.roster.length).toBe(24);

    const r = c.cohort.readiness;
    expect(r.ready + r.needs_review + r.blocked).toBe(24);
    expect(r.ready_pct + r.needs_review_pct + r.blocked_pct).toBeCloseTo(100, 0);

    expect(c.cohort.mastery_histogram.length).toBe(5);
    expect(c.cohort.mastery_histogram.reduce((s, b) => s + b.count, 0)).toBe(24);
    expect(c.cohort.knowledge_debt.score).toBeGreaterThanOrEqual(0);
    expect(c.cohort.knowledge_debt.score).toBeLessThanOrEqual(100);
    expect(c.cohort.concept_map.nodes.length).toBeGreaterThan(3);
    expect(c.cohort.remediation_groups.length).toBeGreaterThan(0);
    expect(c.quiz.length).toBeGreaterThanOrEqual(2);

    // misconception + imposter students should be flagged
    const flags = c.cohort.roster.flatMap((s) => s.flags);
    expect(flags).toContain("misconception");
    expect(flags).toContain("imposter");
});

test("demo profile reflects the requested role", () => {
    expect(buildDemoProfile("faculty").role).toBe("faculty");
    expect(buildDemoProfile("faculty").last_name).toBe("Faculty");
    expect(buildDemoProfile("student").role).toBe("student");
});

import { useMemo } from "react";

const INDIGO = "#5969d7";
const GREEN = "#57a876";
const YELLOW = "#d8a844";
const RED = "#d96262";

function shortTime(ts) {
    try {
        return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function shortDate(ts) {
    try {
        return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
        return "";
    }
}

// ---- hand-rolled SVG line/area chart --------------------------------------

function TrendChart({ label, values, labels, color, suffix = "" }) {
    const W = 560;
    const H = 170;
    const PAD = { top: 18, right: 14, bottom: 28, left: 36 };
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;

    const data = values.length ? values : [0];
    const maxV = Math.max(100, ...data.map((v) => Math.ceil(v)));
    const pts = data.map((v, i) => ({
        x: PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW),
        y: PAD.top + innerH - (v / maxV) * innerH,
        v
    }));

    const line = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${PAD.top + innerH} L ${pts[0].x.toFixed(1)} ${PAD.top + innerH} Z`;
    const gid = `grad-${label.replace(/\W+/g, "")}`;

    return (
        <div className="chart-card">
            <div className="chart-head">
                <span>{label}</span>
                <strong>
                    {values.length ? values[values.length - 1] : 0}
                    {suffix}
                </strong>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={label}>
                <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {[0, 0.5, 1].map((f) => {
                    const y = PAD.top + innerH - f * innerH;
                    const val = Math.round((maxV * f * 10) / 10);
                    return (
                        <g key={f}>
                            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#eef0f4" strokeWidth="1" />
                            <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="chart-axis">
                                {f === 0 ? 0 : val}
                            </text>
                        </g>
                    );
                })}

                <path d={area} fill={`url(#${gid})`} />
                <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                {pts.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />
                ))}

                {pts.map((p, i) => (
                    <text
                        key={`x${i}`}
                        x={p.x}
                        y={H - 8}
                        textAnchor="middle"
                        className="chart-axis"
                    >
                        {values.length > 1 ? (labels && labels[i]) || i + 1 : ""}
                    </text>
                ))}
            </svg>
        </div>
    );
}

// ---- radial gauge ----------------------------------------------------------

function Gauge({ value, color, label, sub }) {
    const r = 46;
    const C = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, value));
    const offset = C - (pct / 100) * C;
    return (
        <div className="gauge">
            <svg viewBox="0 0 120 120" className="gauge-svg">
                <circle cx="60" cy="60" r={r} fill="none" stroke="#eef0f4" strokeWidth="11" />
                <circle
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={offset}
                    transform="rotate(-90 60 60)"
                />
                <text x="60" y="58" textAnchor="middle" className="gauge-value">
                    {Math.round(pct)}
                    {sub}
                </text>
                <text x="60" y="74" textAnchor="middle" className="gauge-label">
                    {label}
                </text>
            </svg>
        </div>
    );
}

// ---- distribution donut ------------------------------------------------------

function DistributionDonut({ strong, weak, gap, total }) {
    const segs = [
        { value: strong, color: GREEN, label: "Strong" },
        { value: weak, color: YELLOW, label: "Weak" },
        { value: gap, color: RED, label: "Gap" }
    ].filter((s) => s.value > 0);

    const sum = Math.max(segs.reduce((a, s) => a + s.value, 0), 1);
    const r = 52;
    const C = 2 * Math.PI * r;
    let acc = 0;

    return (
        <div className="donut-card">
            <div className="donut-wrap">
                <svg viewBox="0 0 140 140" className="donut-svg">
                    <circle cx="70" cy="70" r={r} fill="none" stroke="#f1f2f6" strokeWidth="16" />
                    {segs.map((s) => {
                        const frac = s.value / sum;
                        const dash = frac * C;
                        const seg = (
                            <circle
                                key={s.label}
                                cx="70"
                                cy="70"
                                r={r}
                                fill="none"
                                stroke={s.color}
                                strokeWidth="16"
                                strokeDasharray={`${dash} ${C - dash}`}
                                strokeDashoffset={-acc * C}
                                transform="rotate(-90 70 70)"
                            />
                        );
                        acc += frac;
                        return seg;
                    })}
                    <text x="70" y="67" textAnchor="middle" className="donut-value">
                        {total}
                    </text>
                    <text x="70" y="82" textAnchor="middle" className="donut-label">
                        concepts
                    </text>
                </svg>
            </div>
            <div className="donut-legend">
                {segs.map((s) => (
                    <span key={s.label}>
                        <i style={{ background: s.color }}></i>
                        {s.label} · {s.value}
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---- main view ---------------------------------------------------------------

export default function Progress({ history, data, onGoAnalyze }) {
    const snapshots = useMemo(() => history || [], [history]);

    const latest = useMemo(() => {
        if (data) {
            const stats = data.statistics || {};
            return {
                conceptName: data.target?.name || "Unknown",
                readiness: Math.round(
                    (Number(stats.strong_concepts || 0) /
                        Math.max(stats.total_prerequisites || 1, 1)) *
                        100
                ),
                debt: data.knowledge_debt?.score || 0,
                gaps: stats.identified_gaps || 0,
                strong: stats.strong_concepts || 0,
                weak: stats.weak_concepts || 0,
                total: stats.total_prerequisites || 0
            };
        }
        if (snapshots.length) return snapshots[snapshots.length - 1];
        return null;
    }, [data, snapshots]);

    if (!snapshots.length && !data) {
        return (
            <div className="empty">
                No progress data yet — run a knowledge analysis to start tracking your
                mastery.
                {onGoAnalyze && (
                    <button className="empty-action" onClick={onGoAnalyze}>
                        Analyze a concept →
                    </button>
                )}
            </div>
        );
    }

    const trendData = snapshots.length ? snapshots : [latest];
    const readinessSeries = trendData.map((s) => Math.round(s.readiness || 0));
    const debtSeries = trendData.map((s) => Math.round(s.debt || 0));
    const trendLabels = trendData.map((s) => shortTime(s.ts));

    const latestStats = latest || { strong: 0, weak: 0, gaps: 0, total: 0 };

    return (
        <div className="progress-view">
            <div className="progress-top-grid">
                <Gauge value={latestStats.readiness || 0} color={INDIGO} label="Readiness" sub="%" />
                <Gauge value={latestStats.debt} color={latestStats.debt >= 70 ? RED : latestStats.debt >= 40 ? YELLOW : GREEN} label="Knowledge debt" sub="" />
                <Gauge
                    value={latestStats.total ? Math.round((latestStats.strong / latestStats.total) * 100) : 0}
                    color={GREEN}
                    label="Strong concepts"
                    sub="%"
                />
            </div>

            <div className="charts-grid">
                <TrendChart
                    label="Mastery readiness over time"
                    values={readinessSeries}
                    labels={trendLabels}
                    color={INDIGO}
                    suffix="%"
                />
                <TrendChart
                    label="Knowledge debt over time"
                    values={debtSeries}
                    labels={trendLabels}
                    color={RED}
                    suffix=""
                />
            </div>

            <div className="progress-bottom-grid">
                <div className="distro-card">
                    <div className="chart-head">
                        <span>Knowledge distribution</span>
                        <strong>latest analysis</strong>
                    </div>
                    <DistributionDonut
                        strong={latestStats.strong || 0}
                        weak={latestStats.weak || 0}
                        gap={latestStats.gaps || 0}
                        total={latestStats.total || 0}
                    />
                </div>

                <div className="activity-card">
                    <div className="chart-head">
                        <span>Activity log</span>
                        <strong>{snapshots.length} analyses</strong>
                    </div>
                    {snapshots.length === 0 ? (
                        <div className="activity-empty">
                            Completed analyses will appear here.
                        </div>
                    ) : (
                        <ul className="activity-list">
                            {[...snapshots].reverse().slice(0, 8).map((s, i) => (
                                <li key={`${s.ts}-${i}`}>
                                    <div className="activity-icon">
                                        {s.gaps === 0 ? "✓" : "!"}
                                    </div>
                                    <div className="activity-body">
                                        <strong>{s.conceptName}</strong>
                                        <span>
                                            {shortDate(s.ts)} · {shortTime(s.ts)} ·{" "}
                                            {s.gaps} gap{s.gaps === 1 ? "" : "s"} · debt{" "}
                                            {Math.round(s.debt || 0)}
                                        </span>
                                    </div>
                                    <span
                                        className={`activity-readiness ${
                                            s.readiness >= 70 ? "good" : s.readiness >= 40 ? "mid" : "low"
                                        }`}
                                    >
                                        {Math.round(s.readiness || 0)}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="map-footnote">
                Progress is tracked in your browser (localStorage). On Catalyst, add an
                analytics table to persist history across devices.
            </div>
        </div>
    );
}

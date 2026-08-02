// Shared status helpers used across PrereqGraph views.

export function classifyStatus(status) {
    const s = String(status || "").toLowerCase().trim();
    if (s.includes("strong")) return "strong";
    if (s.includes("weak")) return "weak";
    return "gap";
}

export function statusLabel(status) {
    const c = classifyStatus(status);
    return c === "strong" ? "Strong" : c === "weak" ? "Weak" : "Gap";
}

export function statusIcon(status) {
    const c = classifyStatus(status);
    return c === "strong" ? "✓" : c === "weak" ? "!" : "×";
}

export function isGapStatus(status, confidence) {
    const s = String(status || "").toLowerCase().trim();
    if (s.includes("strong")) return false;
    if (s.includes("weak")) return true;
    if (s.includes("don't know") || s.includes("dont know") || s.includes("unknown")) return true;
    return Number(confidence || 0) < 0.6;
}

export function pct(value) {
    const n = Number(value || 0);
    return Math.min(100, Math.max(0, Math.round(n * 100)));
}

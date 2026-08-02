const API_BASE = "/server/prereq_graph_function/";

// Analyze a concept for the *authenticated* student.
// The student identity is resolved server-side from the Catalyst
// session — the client no longer sends a student_id.
export async function analyzePrerequisites(conceptId) {
    const url = `${API_BASE}?concept_id=${encodeURIComponent(conceptId)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = (data && data.error) || `Request failed with status ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
}

// Lightweight health probe for the top-bar system status indicator.
export async function checkHealth(timeoutMs = 4000) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(`${API_BASE}health`, { signal: controller.signal });
        clearTimeout(timer);
        if (!response.ok) {
            return { ok: false, status: response.status };
        }
        const data = await response.json().catch(() => ({}));
        return { ok: true, ...data };
    } catch (err) {
        return { ok: false, error: err && err.message };
    }
}

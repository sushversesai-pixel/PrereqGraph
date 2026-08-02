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

// Fetch the current authenticated user's profile (name, email, role,
// course). Falls back to the session user data when the Profiles
// table has no row yet.
export async function getProfile() {
    const response = await fetch(`${API_BASE}profile`);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message = (data && data.error) || `Profile request failed with status ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data.profile || data;
}

// Class-level diagnostic intelligence for faculty: readiness
// distribution, bottleneck, impact ranking, risk matrix, roster,
// concept map, remediation groups and a pre-lecture quiz.
export async function getFacultyCohort(conceptId) {
    const url = `${API_BASE}faculty/cohort?concept_id=${encodeURIComponent(conceptId)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            (data && data.error) || `Cohort request failed with status ${response.status}`;
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

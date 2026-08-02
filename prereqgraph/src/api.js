const API_BASE = "/server/prereq_graph_function/";

// Catalyst serves the SPA (index.html) as a fallback for any path its
// backend does not handle. If the function is not deployed / reachable,
// our fetches come back as HTML instead of JSON. Detect that and raise
// a clear, actionable error instead of a cryptic JSON parse failure.
async function readJson(response, context) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (err) {
        const isHtml = /^\s*<!doctype|<html/i.test(text);
        const hint = isHtml
            ? "The backend function is not reachable — the app served its HTML fallback " +
              "instead of JSON. Deploy it with `catalyst deploy` from the repo root."
            : "The server returned a non-JSON response.";
        throw new Error(`${context}: ${hint}`);
    }
}

// Analyze a concept for the *authenticated* student.
// The student identity is resolved server-side from the Catalyst
// session — the client no longer sends a student_id.
export async function analyzePrerequisites(conceptId) {
    const url = `${API_BASE}?concept_id=${encodeURIComponent(conceptId)}`;
    const response = await fetch(url);
    const data = await readJson(response, "Analysis failed");
    if (!response.ok) {
        const message = (data && data.error) || `Request failed with status ${response.status}`;
        const err = new Error(message);
        err.status = response.status;
        throw err;
    }
    return data;
}

// Fetch the current authenticated user's profile (name, email, role).
// Identity comes entirely from the Catalyst session user.
export async function getProfile() {
    const response = await fetch(`${API_BASE}profile`);
    const data = await readJson(response, "Profile request failed");
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
    const data = await readJson(response, "Cohort request failed");
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
        const text = await response.text();
        if (/^\s*<!doctype|<html/i.test(text)) {
            return { ok: false, error: "Backend function unreachable (HTML fallback served)" };
        }
        let data = {};
        try {
            data = JSON.parse(text);
        } catch (err) {
            return { ok: false, error: "Backend returned a non-JSON response" };
        }
        return { ok: true, ...data };
    } catch (err) {
        return { ok: false, error: err && err.message };
    }
}

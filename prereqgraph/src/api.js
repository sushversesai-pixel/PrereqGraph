const API_BASE = "/server/prereq_graph_function/";

export async function analyzePrerequisites(conceptId, studentId) {
    const url = `${API_BASE}?concept_id=${encodeURIComponent(conceptId)}&student_id=${encodeURIComponent(studentId)}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data;
}
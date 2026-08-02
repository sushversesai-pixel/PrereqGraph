// ============================================================
// PROFILE PANEL — user profile + role management
// Shows name, email, role, course. In demo mode, allows
// switching between Student and Faculty views.
// ============================================================

import { useEffect } from "react";

export default function ProfilePanel({ profile, demoMode, onClose, onSwitchRole, onLogout }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    if (!profile) return null;

    const firstName = profile.first_name || "User";
    const lastName = profile.last_name || "";
    const email = profile.email || "";
    const role = profile.role || "student";
    const isFaculty = role === "faculty";

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-card profile-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-top">
                    <span className="page-kicker">USER PROFILE</span>
                    <button className="modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="profile-hero">
                    <div className="profile-big-avatar">
                        {firstName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3>
                            {firstName} {lastName}
                        </h3>
                        <span className="status" style={{
                            background: isFaculty ? "#ede9fe" : "#e9f7ee",
                            color: isFaculty ? "#6d4fd6" : "#28784a"
                        }}>
                            <span className="status-icon">{isFaculty ? "🎓" : "✓"}</span>
                            {isFaculty ? "Faculty" : "Student"}
                        </span>
                    </div>
                </div>

                <div className="profile-fields">
                    <div className="profile-field">
                        <span>Email</span>
                        <strong>{email || "—"}</strong>
                    </div>
                    <div className="profile-field">
                        <span>User ID</span>
                        <strong>{profile.user_id || "—"}</strong>
                    </div>
                    <div className="profile-field">
                        <span>Catalyst role</span>
                        <strong>{role === "faculty" ? "Faculty" : "Student"}</strong>
                    </div>
                    {profile.demo && (
                        <div className="profile-field">
                            <span>Mode</span>
                            <strong>Demo profile</strong>
                        </div>
                    )}
                </div>

                {demoMode && onSwitchRole && (
                    <div className="profile-role-switch">
                        <div className="profile-role-title">
                            <strong>Explore views</strong>
                            <span>In demo mode you can preview either experience.</span>
                        </div>
                        <div className="profile-role-buttons">
                            <button
                                className={`fac-btn ${!isFaculty ? "fac-btn-primary" : "fac-btn-ghost"}`}
                                onClick={() => onSwitchRole("student")}
                            >
                                ◈ Student workspace
                            </button>
                            <button
                                className={`fac-btn ${isFaculty ? "fac-btn-primary" : "fac-btn-ghost"}`}
                                onClick={() => onSwitchRole("faculty")}
                            >
                                🎓 Faculty dashboard
                            </button>
                        </div>
                        <p className="profile-role-note">
                            On Catalyst, the role comes from your <b>Catalyst user role</b> (User Management →
                            Roles, e.g. a “Faculty” custom role) — no manual switch is needed there.
                        </p>
                    </div>
                )}

                {!demoMode && (
                    <p className="profile-role-note">
                        Your role is derived from your <b>Catalyst user role</b> in User Management (Faculty,
                        Teacher, Instructor, Professor, or Admin ⇒ faculty view; otherwise student).
                    </p>
                )}

                {!demoMode && onLogout && (
                    <div className="profile-logout-row">
                        <button type="button" className="profile-logout" onClick={onLogout}>
                            ↪ Sign out
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

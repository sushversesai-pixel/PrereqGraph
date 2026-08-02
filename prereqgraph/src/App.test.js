import { act } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

test("renders the PrereqGraph app shell", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
        root.render(<App />);
    });

    // The auth-loading screen ("Connecting to PrereqGraph") renders while the
    // Catalyst session is verified, then the app shell. The brand is present
    // in both states.
    expect(container.textContent).toMatch(/PrereqGraph/i);

    act(() => {
        root.unmount();
    });
    document.body.removeChild(container);
});

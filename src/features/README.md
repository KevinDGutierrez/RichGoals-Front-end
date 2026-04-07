# Features Architecture

To ensure each functionality (tab) can be worked on by different agents at the same time without interfering with each other, we use a **Feature Module** architecture.

## Rules for Agents
1. **Isolation:** Everything related to a specific tab must be placed inside its own `src/features/<feature-name>/` directory.
2. **Subcomponents:** If you need to break down a large component, create a `components/` folder inside your feature directory (e.g., `src/features/income/components/`) and put your subcomponents there. DO NOT place them in the global `src/components/` folder.
3. **No global file modifications:** Avoid modifying `App.jsx` or files outside your feature folder unless explicitly necessary (like adding a completely new tab).
4. **Shared logic:** If multiple features truly need to share a component or hook, place it in a global `src/shared/` or `src/components/` folder, but be very cautious about modifying shared code to prevent merge conflicts with other agents.

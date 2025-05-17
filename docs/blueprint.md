# **App Name**: TestPilot

## Core Features:

- URL Input: Takes a URL as an input from the user using a CLI or Web UI.
- AI Test Case Generation: Uses an LLM as a tool to analyze the DOM (extracted by Playwright) and generate a set of test steps that will exercise the common features of the app.
- Test Execution: The AI generated tests will be executed in Playwright running in headed mode, visually displayed, and a confidence score for each step displayed
- Test Display: Display test execution results to user including URL, confidence score, snapshots of the UI after each step, pass/fail results.

## Style Guidelines:

- Primary color: Use a calming blue (#3498db) to convey trust and stability.
- Secondary color: Light gray (#f0f0f0) for backgrounds and subtle separators to maintain a clean look.
- Accent: Green (#2ecc71) for success states, highlighting stable locators, and positive actions.
- Use a clear, structured layout with distinct sections for input, test steps, and results.
- Incorporate recognizable icons for actions (play, pause, stop, edit) and results (pass, fail).
- Subtle transitions and loading animations to provide feedback during test execution.
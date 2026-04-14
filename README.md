# AgentFlow Studio MVP

A static PWA MVP that demonstrates:
- Multi-agent systems
- Orchestrator-led execution
- Different instruction execution modes
- Shared memory and live workflow feed

## Included modes
- Sequential
- Parallel
- Debate
- Planner First

## How to run locally
Because this uses a service worker, run it through a small local server instead of opening the HTML file directly.

### Option 1: Python
```bash
python -m http.server 8080
```
Then open `http://localhost:8080`

### Option 2: VS Code Live Server
Open the folder and run with Live Server.

## Deploy
This can be deployed directly to:
- GitHub Pages
- Vercel
- Netlify
- Railway static hosting

## Notes
This MVP simulates agent behavior in the browser and is designed to showcase orchestration UX first.
The next upgrade can replace the simulated agents with real LLM/API calls.

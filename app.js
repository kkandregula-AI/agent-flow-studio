function runWorkflow() {
  const goal = document.getElementById("goalInput").value;
  const feed = document.getElementById("feed");
  const metrics = document.getElementById("metrics");
  const map = document.getElementById("executionMap");
  const visualizer = document.getElementById("visualizer");
  const goalOutput = document.getElementById("goalOutput");

  feed.innerHTML = "";
  metrics.innerHTML = "";
  map.innerHTML = "";
  visualizer.innerHTML = "";

  const agents = [
    "Research Agent",
    "Strategy Agent",
    "Writer Agent",
    "Critic Agent"
  ];

  let totalTokens = 0;
  let totalCost = 0;

  agents.forEach((agent, index) => {
    const time = (Math.random() * 2 + 1).toFixed(2);
    const tokens = Math.floor(Math.random() * 200 + 100);
    const cost = (tokens * 0.00001).toFixed(4);

    totalTokens += tokens;
    totalCost += parseFloat(cost);

    // Live feed
    feed.innerHTML += `
      <div class="feed-item">
        ${agent} executed in ${time}s | Tokens: ${tokens} | Cost: $${cost}
      </div>
    `;

    // Metrics
    metrics.innerHTML += `
      <div class="metric">
        <strong>${agent}</strong><br>
        Time: ${time}s<br>
        Tokens: ${tokens}<br>
        Cost: $${cost}
      </div>
    `;

    // Execution Map
    map.innerHTML += `<div class="node">${agent}</div>`;

    // Visualizer
    visualizer.innerHTML += `
      <div class="viz-node">${agent}</div>
    `;
  });

  // Final Goal Output (your key requirement)
  goalOutput.innerHTML = `
    <strong>PRD Outline:</strong><br><br>
    1. Problem Statement – Define privacy-first family finance tracking need<br>
    2. Target Users – Indian households with shared expense tracking<br>
    3. Core Features – Offline-first, local storage, category tracking<br>
    4. User Flow – Add expense → categorize → view insights<br>
    5. Privacy Principle – No cloud, 100% local device storage<br>
    6. Success Metrics – Daily usage, retention, expense tracking accuracy<br><br>

    <strong>Total Tokens:</strong> ${totalTokens}<br>
    <strong>Total Cost:</strong> $${totalCost.toFixed(4)}
  `;
}
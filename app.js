const agents = [
  { id: 'orchestrator', name: 'Orchestrator', role: 'Routes work, manages execution, synthesizes output', color: 'blue' },
  { id: 'planner', name: 'Planner Agent', role: 'Breaks the goal into executable instructions', color: 'violet' },
  { id: 'research', name: 'Research Agent', role: 'Extracts context, assumptions, and user signals', color: 'green' },
  { id: 'writer', name: 'Writer Agent', role: 'Creates the deliverable from shared memory', color: 'cyan' },
  { id: 'critic', name: 'Reviewer Agent', role: 'Checks quality, gaps, and instruction fidelity', color: 'amber' },
];

const goalInput = document.getElementById('goalInput');
const modeSelect = document.getElementById('modeSelect');
const instructionSelect = document.getElementById('instructionSelect');
const runBtn = document.getElementById('runBtn');
const demoBtn = document.getElementById('demoBtn');
const replayBtn = document.getElementById('replayBtn');
const agentList = document.getElementById('agentList');
const workflowMap = document.getElementById('workflowMap');
const memoryPanel = document.getElementById('memoryPanel');
const metricsPanel = document.getElementById('metricsPanel');
const flowVisualizer = document.getElementById('flowVisualizer');
const goalOutcome = document.getElementById('goalOutcome');
const feed = document.getElementById('feed');
const finalOutput = document.getElementById('finalOutput');
const statusBadge = document.getElementById('statusBadge');

let executionLog = [];
let lastRun = null;
let runCounter = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function titleFromGoal(goal) {
  const clean = goal.replace(/[.?!]+$/, '');
  if (clean.length <= 70) return clean;
  return `${clean.slice(0, 67)}...`;
}

function estimateTokens(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(28, Math.round(words * 1.45));
}

function estimateCostUsd(tokens, agentId) {
  const rate = {
    orchestrator: 0.0000028,
    planner: 0.0000023,
    research: 0.0000022,
    writer: 0.0000025,
    critic: 0.0000024,
  }[agentId] || 0.0000023;
  return Number((tokens * rate).toFixed(4));
}

function formatUsd(value) {
  return `$${Number(value).toFixed(4)}`;
}

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function getInstructionFlavor(style) {
  return {
    strict: 'Follow instructions exactly, minimize assumptions, and surface missing details explicitly.',
    creative: 'Add richer examples, imaginative framing, and expressive articulation.',
    fast: 'Keep outputs concise, prioritize speed, and avoid over-analysis.',
    balanced: 'Be structured, practical, and moderately detailed.'
  }[style] || 'Be structured and practical.';
}

function renderAgents(activeId = null) {
  agentList.innerHTML = agents.map(agent => `
    <div class="agent-card ${activeId === agent.id ? 'active' : ''}">
      <div class="agent-top">
        <strong>${agent.name}</strong>
        <span class="tag ${agent.color}">${agent.id}</span>
      </div>
      <p>${agent.role}</p>
    </div>
  `).join('');
}

function renderWorkflow(steps = [], activeIndex = -1, doneSet = new Set()) {
  if (!steps.length) {
    workflowMap.className = 'workflow-map empty-state';
    workflowMap.textContent = 'Your execution graph will appear here.';
    return;
  }
  workflowMap.className = 'workflow-map';
  workflowMap.innerHTML = steps.map((step, index) => `
    <div class="workflow-step ${doneSet.has(index) ? 'done' : ''} ${activeIndex === index ? 'active' : ''}">
      <strong>${step.title}</strong>
      <p>${step.description}</p>
    </div>
  `).join('');
}

function pushFeed(agent, action, content, metrics = null, status = 'done') {
  executionLog.unshift({ agent, action, content, metrics, status, time: new Date().toLocaleTimeString() });
  feed.className = 'feed';
  feed.innerHTML = executionLog.map(item => `
    <div class="feed-item ${item.status}">
      <div class="feed-top">
        <small>${item.time} · ${item.agent}</small>
        <span class="feed-status ${item.status}">${item.action}</span>
      </div>
      ${item.metrics ? `
        <div class="feed-metrics">
          <span>${formatMs(item.metrics.ms)}</span>
          <span>${item.metrics.tokens} tokens</span>
          <span>${formatUsd(item.metrics.cost)} token cost</span>
        </div>` : ''}
      <pre>${escapeHtml(item.content)}</pre>
    </div>
  `).join('');
}

function renderMemory(memory) {
  const items = Object.entries(memory);
  if (!items.length) {
    memoryPanel.className = 'memory-panel empty-state';
    memoryPanel.textContent = 'Run a workflow to see task plans, intermediate outputs, and final synthesis.';
    return;
  }
  memoryPanel.className = 'memory-panel';
  memoryPanel.innerHTML = `<div class="memory-grid">${items.map(([key, value]) => `
    <div class="memory-card">
      <small>${escapeHtml(key)}</small>
      <div>${value}</div>
    </div>
  `).join('')}</div>`;
}

function renderMetrics(metricsByAgent = {}) {
  const items = Object.entries(metricsByAgent);
  if (!items.length) {
    metricsPanel.className = 'metrics-panel empty-state';
    metricsPanel.textContent = 'Run a workflow to see agent time, token count, and estimated token cost.';
    return;
  }

  const totals = items.reduce((acc, [, metric]) => {
    acc.ms += metric.ms;
    acc.tokens += metric.tokens;
    acc.cost += metric.cost;
    return acc;
  }, { ms: 0, tokens: 0, cost: 0 });

  metricsPanel.className = 'metrics-panel';
  metricsPanel.innerHTML = `
    <div class="metric-total-card">
      <div>
        <small>Workflow Totals</small>
        <strong>${formatMs(totals.ms)}</strong>
      </div>
      <div class="metric-total-inline">
        <span>${totals.tokens} tokens</span>
        <span>${formatUsd(totals.cost)} token cost</span>
      </div>
    </div>
    <div class="metric-grid">${items.map(([agentId, metric]) => {
      const agent = agents.find(item => item.id === agentId);
      return `
        <div class="metric-card ${agent?.color || ''}">
          <div class="metric-head">
            <strong>${agent?.name || agentId}</strong>
            <span class="tag ${agent?.color || ''}">${agentId}</span>
          </div>
          <div class="metric-stat"><span>Time Taken</span><strong>${formatMs(metric.ms)}</strong></div>
          <div class="metric-stat"><span>Tokens</span><strong>${metric.tokens}</strong></div>
          <div class="metric-stat"><span>Token Cost</span><strong>${formatUsd(metric.cost)}</strong></div>
        </div>`;
    }).join('')}</div>`;
}

function setStatus(state) {
  statusBadge.textContent = state === 'running' ? 'Running' : state === 'done' ? 'Complete' : 'Idle';
  statusBadge.className = `status-badge ${state}`;
}

function createPlan(goal, mode) {
  const common = [
    { title: 'Interpret Goal', description: 'Orchestrator reads the goal and sets execution boundaries.' },
    { title: 'Plan Tasks', description: 'Planner decomposes the goal into task-specific instructions.' },
  ];

  const variants = {
    sequential: [
      { title: 'Research', description: 'Research Agent gathers assumptions, context, and user signals.' },
      { title: 'Draft', description: 'Writer Agent converts memory into an initial deliverable.' },
      { title: 'Review', description: 'Reviewer Agent improves completeness and fidelity.' },
    ],
    parallel: [
      { title: 'Parallel Execution', description: 'Research and Writer agents process context in parallel.' },
      { title: 'Merge Results', description: 'Orchestrator merges specialist outputs into one narrative.' },
      { title: 'Review', description: 'Reviewer validates the merged result.' },
    ],
    debate: [
      { title: 'Position A', description: 'Research Agent argues the most analytical path.' },
      { title: 'Position B', description: 'Writer Agent argues the most user-friendly path.' },
      { title: 'Synthesize Debate', description: 'Orchestrator resolves trade-offs into one final answer.' },
      { title: 'Review', description: 'Reviewer checks clarity and decision quality.' },
    ],
    'planner-first': [
      { title: 'Expanded Plan', description: 'Planner creates a detailed execution sequence with handoffs.' },
      { title: 'Execute Steps', description: 'Specialist agents complete each assigned instruction.' },
      { title: 'Review', description: 'Reviewer validates that the plan was executed correctly.' },
    ]
  };

  return [...common, ...(variants[mode] || variants.sequential)].map((step, index) => ({
    ...step,
    id: `${mode}-${index}`,
    goal
  }));
}

function generateOutputs(goal, mode, style) {
  const flavor = getInstructionFlavor(style);
  const compactTitle = titleFromGoal(goal);

  const summary = [
    `Goal: ${goal}`,
    `Mode: ${mode}`,
    `Instruction policy: ${flavor}`,
    `Execution intent: route the goal through specialist agents and synthesize one coherent result.`
  ].join('\n');

  const research = [
    `User intent inferred: build a practical deliverable around "${goal}".`,
    `Primary user expectation: a visible end result, not only agent draft notes.`,
    `Execution risk: fragmented outputs without orchestration and synthesis.`,
    `Recommended pattern: keep the orchestrator in charge of task routing and final merge.`
  ].join('\n');

  const draft = [
    `Working draft for "${goal}":`,
    `1. Define the user problem and outcome`,
    `2. Structure the deliverable into logical sections`,
    `3. Ensure specialist outputs are handed off clearly`,
    `4. Produce a polished final response aligned to the original goal`
  ].join('\n');

  const review = [
    `Review verdict: output is aligned, structured, and agent responsibilities are distinct.`,
    `Improvement note: show the achieved goal output prominently for the user.`,
    `Validation note: per-agent time, tokens, and token cost improve transparency.`
  ].join(' ');

  const goalResult = [
    `Goal Achieved: ${compactTitle}`,
    '',
    `Delivered user-facing output:`,
    `• Clear interpretation of the original goal`,
    `• Task plan produced by the planner`,
    `• Context gathered by research`,
    `• Structured output written by the writer`,
    `• Final quality pass by the reviewer`,
    '',
    `Result: the system produced one completed response that matches the user's requested goal instead of leaving the workflow at an intermediate draft state.`
  ].join('\n');

  const final = [
    `Final Orchestrated Output`,
    '',
    `Objective`,
    `${goal}`,
    '',
    `Execution Design`,
    `- Orchestrator interpreted the goal and controlled handoffs`,
    `- Planner created the execution graph`,
    `- Research Agent extracted context and risks`,
    `- Writer Agent formed the deliverable structure`,
    `- Reviewer Agent validated completeness and clarity`,
    '',
    `Why orchestration matters`,
    `The orchestrator prevented duplication, sequenced specialist work, merged outputs, and ensured the final answer stayed aligned to the original user goal.`,
    '',
    `Final User Benefit`,
    `The user sees both the collaboration flow and the achieved goal output in a transparent multi-agent system.`
  ].join('\n');

  return { summary, research, draft, review, goalResult, final };
}

function buildGoalOutcome(goal, mode, metricsByAgent, outputs) {
  const total = Object.values(metricsByAgent).reduce((acc, metric) => {
    acc.ms += metric.ms;
    acc.tokens += metric.tokens;
    acc.cost += metric.cost;
    return acc;
  }, { ms: 0, tokens: 0, cost: 0 });

  goalOutcome.className = 'goal-outcome';
  goalOutcome.innerHTML = `
    <div class="goal-outcome-grid">
      <div class="goal-outcome-card highlight success-card wide">
        <small>Goal Status</small>
        <strong>Completed Successfully</strong>
        <p>${escapeHtml(goal)}</p>
      </div>
      <div class="goal-outcome-card wide">
        <small>Goal Output</small>
        <pre>${escapeHtml(outputs.goalResult)}</pre>
      </div>
      <div class="goal-outcome-card">
        <small>Mode Used</small>
        <strong>${escapeHtml(mode)}</strong>
        <p>The orchestrator used this execution pattern to complete the goal.</p>
      </div>
      <div class="goal-outcome-card">
        <small>Total Time Taken</small>
        <strong>${formatMs(total.ms)}</strong>
        <p>Sum of simulated per-agent execution time.</p>
      </div>
      <div class="goal-outcome-card">
        <small>Total Tokens</small>
        <strong>${total.tokens}</strong>
        <p>Estimated tokens consumed across all agent steps.</p>
      </div>
      <div class="goal-outcome-card">
        <small>Total Token Cost</small>
        <strong>${formatUsd(total.cost)}</strong>
        <p>Estimated token cost for the simulated workflow run.</p>
      </div>
      <div class="goal-outcome-card wide">
        <small>Why this is easy to understand</small>
        <div class="outcome-bullets">
          <span>Goal interpreted first</span>
          <span>Planner created the path</span>
          <span>Specialists did distinct work</span>
          <span>Reviewer validated output</span>
          <span>Orchestrator merged the result</span>
        </div>
        <p>${escapeHtml(outputs.review)}</p>
      </div>
    </div>`;
}

function flowTemplate(mode) {
  const debateMode = mode === 'debate';
  const parallelMode = mode === 'parallel';

  return `
    <div class="flow-stage ${debateMode ? 'debate-layout' : parallelMode ? 'parallel-layout' : 'linear-layout'}">
      <div class="flow-node goal-node" data-node="goal">
        <small>User Intent</small>
        <strong>Goal</strong>
      </div>
      <div class="flow-arrow a1"></div>
      <div class="flow-node blue" data-node="orchestrator">
        <small>Control Layer</small>
        <strong>Orchestrator</strong>
      </div>
      <div class="flow-arrow a2"></div>
      <div class="flow-node violet" data-node="planner">
        <small>Plan Layer</small>
        <strong>Planner</strong>
      </div>
      <div class="flow-branch ${parallelMode || debateMode ? 'visible' : ''}"></div>
      <div class="flow-node green specialist research-node" data-node="research">
        <small>Specialist</small>
        <strong>Research</strong>
      </div>
      <div class="flow-node cyan specialist writer-node" data-node="writer">
        <small>Specialist</small>
        <strong>Writer</strong>
      </div>
      <div class="flow-node amber specialist critic-node" data-node="critic">
        <small>Validation</small>
        <strong>Reviewer</strong>
      </div>
      <div class="flow-node final-node" data-node="final">
        <small>Delivered Result</small>
        <strong>Goal Output</strong>
      </div>
      <div id="flowPulse" class="flow-pulse goal"></div>
    </div>
    <div class="flow-caption">The pulse shows which part of the system is currently active. The orchestrator remains the decision-maker while specialist agents perform focused work.</div>`;
}

function renderFlow(mode = 'sequential', activeNode = null, state = 'idle') {
  flowVisualizer.className = 'flow-visualizer';
  flowVisualizer.innerHTML = flowTemplate(mode);
  if (!activeNode) return;

  const nodes = flowVisualizer.querySelectorAll('.flow-node');
  nodes.forEach(node => {
    if (node.dataset.node === activeNode) node.classList.add('active');
    if (state === 'done') node.classList.add('done');
  });

  const pulse = document.getElementById('flowPulse');
  if (pulse) pulse.className = `flow-pulse ${activeNode}`;
}

function updateFlow(mode, activeNode, completedNodes = []) {
  renderFlow(mode, activeNode, 'running');
  const completed = new Set(completedNodes);
  const nodes = flowVisualizer.querySelectorAll('.flow-node');
  nodes.forEach(node => {
    if (completed.has(node.dataset.node)) node.classList.add('done');
  });
}

async function runAgentStep(step, metricsByAgent, mode, completedNodes = []) {
  const { agentId, action, content, highlightNode, delay = 650 } = step;
  const tokens = estimateTokens(content);
  const runSeed = runCounter * 33;
  const ms = delay + (agentId.length * 29) + (tokens % 67) + runSeed;
  const cost = estimateCostUsd(tokens, agentId);

  metricsByAgent[agentId] = {
    ms: (metricsByAgent[agentId]?.ms || 0) + ms,
    tokens: (metricsByAgent[agentId]?.tokens || 0) + tokens,
    cost: Number(((metricsByAgent[agentId]?.cost || 0) + cost).toFixed(4)),
  };

  renderAgents(agentId);
  updateFlow(mode, highlightNode, completedNodes);
  pushFeed(agents.find(agent => agent.id === agentId)?.name || agentId, action, content, { ms, tokens, cost }, 'done');
  renderMetrics(metricsByAgent);
  await sleep(delay);
}

async function executeWorkflow() {
  const goal = goalInput.value.trim();
  const mode = modeSelect.value;
  const style = instructionSelect.value;

  if (!goal) {
    alert('Please enter a goal first.');
    return;
  }

  runCounter += 1;
  executionLog = [];
  replayBtn.disabled = true;
  setStatus('running');
  renderMetrics({});
  renderFlow(mode, 'goal');
  renderAgents('orchestrator');

  feed.className = 'feed empty-state';
  feed.textContent = 'Starting execution...';
  finalOutput.className = 'final-output empty-state';
  finalOutput.textContent = 'Workflow is running.';
  goalOutcome.className = 'goal-outcome empty-state';
  goalOutcome.textContent = 'Workflow is running. The final goal output will appear after completion.';

  const plan = createPlan(goal, mode);
  const outputs = generateOutputs(goal, mode, style);
  const memory = {};
  const metricsByAgent = {};
  const doneSet = new Set();

  renderWorkflow(plan, 0, doneSet);

  await runAgentStep({
    agentId: 'orchestrator',
    action: 'Goal Received',
    content: outputs.summary,
    highlightNode: 'orchestrator',
    delay: 520,
  }, metricsByAgent, mode, ['goal']);

  memory['Execution Context'] = `${escapeHtml(goal)}<br><br><strong>Mode:</strong> ${escapeHtml(mode)}<br><strong>Instruction style:</strong> ${escapeHtml(style)}`;
  renderMemory(memory);

  doneSet.add(0);
  renderWorkflow(plan, 1, doneSet);

  await runAgentStep({
    agentId: 'planner',
    action: 'Task Graph Built',
    content: plan.map((step, idx) => `${idx + 1}. ${step.title}`).join('\n'),
    highlightNode: 'planner',
    delay: 610,
  }, metricsByAgent, mode, ['goal', 'orchestrator']);

  memory['Task Graph'] = plan.map((step, idx) => `${idx + 1}. ${escapeHtml(step.title)}`).join('<br>');
  renderMemory(memory);

  if (mode === 'parallel') {
    doneSet.add(1);
    renderWorkflow(plan, 2, doneSet);

    await runAgentStep({
      agentId: 'research',
      action: 'Parallel Context Pass',
      content: outputs.research,
      highlightNode: 'research',
      delay: 600,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner']);
    memory['Research Output'] = escapeHtml(outputs.research).replaceAll('\n', '<br>');
    renderMemory(memory);

    await runAgentStep({
      agentId: 'writer',
      action: 'Parallel Draft Pass',
      content: outputs.draft,
      highlightNode: 'writer',
      delay: 620,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner', 'research']);
    memory['Draft Output'] = escapeHtml(outputs.draft).replaceAll('\n', '<br>');
    renderMemory(memory);

    doneSet.add(2);
    renderWorkflow(plan, 3, doneSet);

    await runAgentStep({
      agentId: 'orchestrator',
      action: 'Merged Parallel Results',
      content: 'Merged research context and writer structure into a unified deliverable.',
      highlightNode: 'orchestrator',
      delay: 660,
    }, metricsByAgent, mode, ['goal', 'planner', 'research', 'writer']);
    memory['Merged Output'] = 'Orchestrator reconciled both specialist outputs into one structured direction.';
    renderMemory(memory);
  } else if (mode === 'debate') {
    doneSet.add(1);
    renderWorkflow(plan, 2, doneSet);

    await runAgentStep({
      agentId: 'research',
      action: 'Debate Position A',
      content: 'Prioritize analytical depth, dependencies, and structured execution.',
      highlightNode: 'research',
      delay: 590,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner']);
    memory['Debate Position A'] = 'Prioritize analytical depth, dependencies, and structured execution.';
    renderMemory(memory);

    doneSet.add(2);
    renderWorkflow(plan, 3, doneSet);

    await runAgentStep({
      agentId: 'writer',
      action: 'Debate Position B',
      content: 'Prioritize usability, readability, and actionability for the end user.',
      highlightNode: 'writer',
      delay: 610,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner', 'research']);
    memory['Debate Position B'] = 'Prioritize usability, readability, and actionability for the end user.';
    renderMemory(memory);

    doneSet.add(3);
    renderWorkflow(plan, 4, doneSet);

    await runAgentStep({
      agentId: 'orchestrator',
      action: 'Synthesized Debate',
      content: 'Balanced analytical rigor with user-friendly presentation.',
      highlightNode: 'orchestrator',
      delay: 680,
    }, metricsByAgent, mode, ['goal', 'planner', 'research', 'writer']);
    memory['Debate Synthesis'] = 'The orchestrator resolved trade-offs and selected the best combined direction.';
    renderMemory(memory);
  } else {
    doneSet.add(1);
    renderWorkflow(plan, 2, doneSet);

    await runAgentStep({
      agentId: 'research',
      action: 'Context Analysis',
      content: outputs.research,
      highlightNode: 'research',
      delay: 640,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner']);
    memory['Research Output'] = escapeHtml(outputs.research).replaceAll('\n', '<br>');
    renderMemory(memory);

    doneSet.add(2);
    renderWorkflow(plan, 3, doneSet);

    await runAgentStep({
      agentId: 'writer',
      action: 'Draft Created',
      content: outputs.draft,
      highlightNode: 'writer',
      delay: 680,
    }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner', 'research']);
    memory['Draft Output'] = escapeHtml(outputs.draft).replaceAll('\n', '<br>');
    renderMemory(memory);
  }

  doneSet.add(plan.length - 1);
  renderWorkflow(plan, plan.length - 1, doneSet);

  await runAgentStep({
    agentId: 'critic',
    action: 'Quality Check',
    content: outputs.review,
    highlightNode: 'critic',
    delay: 730,
  }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner', 'research', 'writer']);
  memory['Review Notes'] = escapeHtml(outputs.review);
  renderMemory(memory);

  await runAgentStep({
    agentId: 'orchestrator',
    action: 'Goal Output Delivered',
    content: outputs.goalResult,
    highlightNode: 'final',
    delay: 770,
  }, metricsByAgent, mode, ['goal', 'orchestrator', 'planner', 'research', 'writer', 'critic']);
  memory['Goal Output'] = escapeHtml(outputs.goalResult).replaceAll('\n', '<br>');
  memory['Final Synthesis'] = 'The orchestrator consolidated all agent outputs and marked the workflow complete.';
  renderMemory(memory);

  finalOutput.className = 'final-output';
  finalOutput.innerHTML = `<pre>${escapeHtml(outputs.final)}</pre>`;
  buildGoalOutcome(goal, mode, metricsByAgent, outputs);

  setStatus('done');
  replayBtn.disabled = false;
  lastRun = { goal, mode, style };

  doneSet.clear();
  plan.forEach((_, idx) => doneSet.add(idx));
  renderWorkflow(plan, -1, doneSet);
  renderAgents('orchestrator');
  renderFlow(mode, 'final', 'done');
}

function loadDemo() {
  goalInput.value = 'Create a PRD outline for a privacy-first family expense tracker PWA for India.';
  modeSelect.value = 'planner-first';
  instructionSelect.value = 'balanced';

  feed.className = 'feed empty-state';
  feed.textContent = 'Demo loaded. Click Run Workflow to see the agents execute.';
  goalOutcome.className = 'goal-outcome empty-state';
  goalOutcome.textContent = 'Demo loaded. The goal output will appear here after execution.';
  finalOutput.className = 'final-output empty-state';
  finalOutput.textContent = 'Demo loaded. Run the workflow to generate the final orchestrated output.';
}

async function replayLastRun() {
  if (!lastRun) return;
  goalInput.value = lastRun.goal;
  modeSelect.value = lastRun.mode;
  instructionSelect.value = lastRun.style;
  await executeWorkflow();
}

runBtn.addEventListener('click', executeWorkflow);
demoBtn.addEventListener('click', loadDemo);
replayBtn.addEventListener('click', replayLastRun);

renderAgents();
renderWorkflow();
renderMemory({});
renderMetrics({});
renderFlow();
loadDemo();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

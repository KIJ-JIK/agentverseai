/* ════════════════════════════════════════════════════════════
   AGENTVERSE AI — CONTROL ROOM
   Vanilla JS: simulation engine, rendering, interactions
   ════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  // Supabase Auth Integration
  const SUPABASE_URL = "https://mlpmnmpkoaffvekznndu.supabase.co";
  const SUPABASE_KEY = "sb_publishable_HeAPELFd9_X-LbFgrEVNfQ_uQ1ToLuK";
  let supabase = null;
  let currentSession = null;
  let localBypassActive = false;
  let latestDocContent = "";
  let processedEventIds = new Set();

  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentSession = session;
      if (session) {
        setTimeout(() => {
          appendLog('tag-approved', 'AUTH', `Authenticated as ${session.user.email}`, false);
        }, 1000);
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     AGENT DEFINITIONS
     ────────────────────────────────────────────────────────── */
  const AGENTS = [
    { 
      id: 'architect',  
      name: 'Architect Agent',     
      role: 'AI/ML API · High Reasoning', 
      task: 'Awaiting feature request',
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-arc" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,20 25,15 35,45" fill="url(#g-arc)" opacity="0.95"/><polygon points="50,20 75,15 65,45" fill="url(#g-arc)" opacity="0.8"/><polygon points="50,20 35,45 50,50" fill="url(#g-arc)" opacity="0.7"/><polygon points="50,20 65,45 50,50" fill="url(#g-arc)" opacity="0.6"/><polygon points="25,15 20,40 35,45" fill="url(#g-arc)" opacity="0.5"/><polygon points="75,15 80,40 65,45" fill="url(#g-arc)" opacity="0.45"/><polygon points="42,50 58,50 50,70" fill="url(#g-arc)" opacity="0.9"/><polygon points="20,40 35,75 50,50" fill="url(#g-arc)" opacity="0.65"/><polygon points="80,40 65,75 50,50" fill="url(#g-arc)" opacity="0.55"/><polygon points="35,75 50,85 50,70" fill="url(#g-arc)" opacity="0.85"/><polygon points="65,75 50,85 50,70" fill="url(#g-arc)" opacity="0.75"/></svg>`
    },
    { 
      id: 'frontend',   
      name: 'Frontend Agent',      
      role: 'Featherless · React',         
      task: 'Idle — waiting on spec', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-frn" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,35 15,10 5,45" fill="url(#g-frn)" opacity="0.95"/><polygon points="50,35 15,10 50,20" fill="url(#g-frn)" opacity="0.75"/><polygon points="50,55 5,45 20,85" fill="url(#g-frn)" opacity="0.85"/><polygon points="50,55 20,85 50,80" fill="url(#g-frn)" opacity="0.6"/><polygon points="50,35 85,10 95,45" fill="url(#g-frn)" opacity="0.9"/><polygon points="50,35 85,10 50,20" fill="url(#g-frn)" opacity="0.7"/><polygon points="50,55 95,45 80,85" fill="url(#g-frn)" opacity="0.8"/><polygon points="50,55 80,85 50,80" fill="url(#g-frn)" opacity="0.5"/><polygon points="50,20 54,50 50,80 46,50" fill="url(#g-frn)" opacity="1"/></svg>`
    },
    { 
      id: 'backend',    
      name: 'Backend Agent',       
      role: 'Featherless · FastAPI',       
      task: 'Idle — waiting on spec', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-bck" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,25 35,30 50,60" fill="url(#g-bck)" opacity="0.95"/><polygon points="50,25 65,30 50,60" fill="url(#g-bck)" opacity="0.8"/><polygon points="35,30 44,65 50,60" fill="url(#g-bck)" opacity="0.7"/><polygon points="65,30 56,65 50,60" fill="url(#g-bck)" opacity="0.6"/><polygon points="44,65 45,80 50,85" fill="url(#g-bck)" opacity="0.85"/><polygon points="56,65 55,80 50,85" fill="url(#g-bck)" opacity="0.75"/><polygon points="35,30 10,20 20,45" fill="url(#g-bck)" opacity="0.5"/><polygon points="35,30 20,45 38,45" fill="url(#g-bck)" opacity="0.65"/><polygon points="65,30 90,20 80,45" fill="url(#g-bck)" opacity="0.45"/><polygon points="65,30 80,45 62,45" fill="url(#g-bck)" opacity="0.55"/></svg>`
    },
    { 
      id: 'reviewer',   
      name: 'Code Reviewer',       
      role: 'AI/ML API · Quality Gate',    
      task: 'Idle — waiting on code', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-rev" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,40 20,15 35,48" fill="url(#g-rev)" opacity="0.95"/><polygon points="50,40 80,15 65,48" fill="url(#g-rev)" opacity="0.8"/><polygon points="50,40 35,48 50,65" fill="url(#g-rev)" opacity="0.85"/><polygon points="50,40 65,48 50,65" fill="url(#g-rev)" opacity="0.7"/><polygon points="35,48 15,60 50,65" fill="url(#g-rev)" opacity="0.6"/><polygon points="65,48 85,60 50,65" fill="url(#g-rev)" opacity="0.5"/><polygon points="15,60 50,85 50,65" fill="url(#g-rev)" opacity="0.75"/><polygon points="85,60 50,85 50,65" fill="url(#g-rev)" opacity="0.65"/></svg>`
    },
    { 
      id: 'qa',         
      name: 'QA Tester',           
      role: 'Featherless · Test Suite',    
      task: 'Idle — waiting on approval', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-qas" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="20,50 30,20 40,42" fill="url(#g-qas)" opacity="0.95"/><polygon points="40,42 30,20 50,40" fill="url(#g-qas)" opacity="0.8"/><polygon points="80,50 70,20 60,42" fill="url(#g-qas)" opacity="0.9"/><polygon points="60,42 70,20 50,40" fill="url(#g-qas)" opacity="0.75"/><polygon points="20,50 50,40 50,65" fill="url(#g-qas)" opacity="0.7"/><polygon points="80,50 50,40 50,65" fill="url(#g-qas)" opacity="0.6"/><polygon points="20,50 50,80 50,65" fill="url(#g-qas)" opacity="0.85"/><polygon points="80,50 50,80 50,65" fill="url(#g-qas)" opacity="0.55"/></svg>`
    },
    { 
      id: 'writer',     
      name: 'Tech Writer',         
      role: 'Featherless · Docs Gen',      
      task: 'Idle — waiting on tests', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-wri" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,15 30,35 50,35" fill="url(#g-wri)" opacity="0.95"/><polygon points="50,15 70,35 50,35" fill="url(#g-wri)" opacity="0.8"/><polygon points="30,35 44,45 50,35" fill="url(#g-wri)" opacity="0.7"/><polygon points="70,35 56,45 50,35" fill="url(#g-wri)" opacity="0.6"/><polygon points="44,45 50,85 50,35" fill="url(#g-wri)" opacity="0.85"/><polygon points="56,45 50,85 50,35" fill="url(#g-wri)" opacity="0.75"/></svg>`
    },
    { 
      id: 'release',    
      name: 'Release Manager',     
      role: 'AI/ML API · Final Verdict',   
      task: 'Idle — awaiting docs', 
      icon: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-rel" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F3ECE7"/><stop offset="50%" stop-color="#C2B2A2"/><stop offset="100%" stop-color="#8E7D6F"/></linearGradient></defs><polygon points="50,15 25,38 50,48" fill="url(#g-rel)" opacity="0.95"/><polygon points="50,15 75,38 50,48" fill="url(#g-rel)" opacity="0.8"/><polygon points="25,38 20,55 40,52" fill="url(#g-rel)" opacity="0.7"/><polygon points="75,38 80,55 60,52" fill="url(#g-rel)" opacity="0.6"/><polygon points="40,52 20,55 50,60" fill="url(#g-rel)" opacity="0.85"/><polygon points="60,52 80,55 50,60" fill="url(#g-rel)" opacity="0.75"/><polygon points="40,52 50,82 50,60" fill="url(#g-rel)" opacity="0.9"/><polygon points="60,52 50,82 50,60" fill="url(#g-rel)" opacity="0.8"/></svg>`
    }
  ];

  const STATE = { IDLE: 'idle', PROCESSING: 'processing', COMPILING: 'compiling', COMPLETE: 'complete', REJECTED: 'rejected' };

  const STATE_LABELS = {
    idle: 'IDLE', processing: 'PROCESSING', compiling: 'COMPILING', complete: 'COMPLETE', rejected: 'REJECTED'
  };

  /* ──────────────────────────────────────────────────────────
     PIPELINE SCRIPT — drives both agent matrix + console + diagram
     Each step: { agent, state, task, progress, event, logTag, logMsg, nodeIds }
     ────────────────────────────────────────────────────────── */
  function buildPipelineScript(featureText) {
    const feat = featureText || 'Add a secure JWT-authenticated user profile dashboard';
    return [
      { agent: 'architect', state: STATE.PROCESSING, task: 'Parsing feature request into architecture spec', progress: 35,
        logTag: 'tag-info', logMsg: `New feature request received: "${feat}"`, nodes: ['n-input', 'n-architect'] },
      { agent: 'architect', state: STATE.PROCESSING, task: 'Drafting REST + SPA architecture pattern', progress: 80,
        logTag: 'tag-spec', logMsg: 'ArchitectAgent → generating frontend_spec + backend_spec', nodes: ['n-architect'] },
      { agent: 'architect', state: STATE.COMPLETE, task: 'Spec generated · architecture_pattern: REST + React SPA', progress: 100,
        logTag: 'tag-spec', logMsg: 'event: SPEC_GENERATED — sender: ArchitectAgent', nodes: ['n-architect'], event: 'SPEC_GENERATED' },

      { agent: ['frontend','backend'], state: STATE.COMPILING, task: 'Generating component tree from spec', progress: 30,
        logTag: 'tag-info', logMsg: 'Parallel dispatch → FrontendDevAgent + BackendDevAgent', nodes: ['n-frontend', 'n-backend'] },
      { agent: ['frontend','backend'], state: STATE.COMPILING, task: 'Writing implementation code', progress: 75,
        logTag: 'tag-code', logMsg: 'FrontendDevAgent + BackendDevAgent → drafting source files', nodes: ['n-frontend', 'n-backend'] },
      { agent: ['frontend','backend'], state: STATE.COMPLETE, task: 'CODE_EMITTED — implementation ready for review', progress: 100,
        logTag: 'tag-code', logMsg: 'event: CODE_EMITTED ×2 — ProfileDashboard.jsx, backend.py', nodes: ['n-frontend','n-backend','n-reviewer'], event: 'CODE_EMITTED' },

      { agent: 'reviewer', state: STATE.PROCESSING, task: 'Static analysis + diff review in progress', progress: 50,
        logTag: 'tag-info', logMsg: 'CodeReviewerAgent → analyzing diffs against spec', nodes: ['n-reviewer'] },
      { agent: 'reviewer', state: STATE.REJECTED, task: 'CODE_REJECTED — missing auth guard on PUT /profile', progress: 100,
        logTag: 'tag-rejected', logMsg: 'event: CODE_REJECTED — remediation ticket sent to BackendDevAgent', nodes: ['n-reviewer','n-backend'], event: 'CODE_REJECTED' },

      { agent: 'backend', state: STATE.COMPILING, task: 'Applying remediation — adding JWT guard dependency', progress: 60,
        logTag: 'tag-info', logMsg: 'BackendDevAgent → patching update_profile() with auth dependency', nodes: ['n-backend'] },
      { agent: 'backend', state: STATE.COMPLETE, task: 'Patch complete — resubmitted for review (iteration 2)', progress: 100,
        logTag: 'tag-code', logMsg: 'event: CODE_EMITTED — iteration 2 — backend.py', nodes: ['n-backend','n-reviewer'], event: 'CODE_EMITTED' },

      { agent: 'reviewer', state: STATE.PROCESSING, task: 'Re-reviewing patched backend module', progress: 70,
        logTag: 'tag-info', logMsg: 'CodeReviewerAgent → re-validating iteration 2', nodes: ['n-reviewer'] },
      { agent: 'reviewer', state: STATE.COMPLETE, task: 'CODE_APPROVED — all quality gates passed', progress: 100,
        logTag: 'tag-approved', logMsg: 'event: CODE_APPROVED — sender: CodeReviewerAgent', nodes: ['n-reviewer','n-qa'], event: 'CODE_APPROVED' },

      { agent: 'qa', state: STATE.PROCESSING, task: 'Generating pytest suite — test_profile_api.py', progress: 45,
        logTag: 'tag-info', logMsg: 'QATesterAgent → writing unit + integration tests', nodes: ['n-qa'] },
      { agent: 'qa', state: STATE.COMPLETE, task: 'TESTS_GENERATED — 94% estimated coverage', progress: 100,
        logTag: 'tag-tests', logMsg: 'event: TESTS_GENERATED — 7 tests, 94% coverage estimate', nodes: ['n-qa','n-writer'], event: 'TESTS_GENERATED' },

      { agent: 'writer', state: STATE.PROCESSING, task: 'Drafting README.md and endpoint docs', progress: 55,
        logTag: 'tag-info', logMsg: 'TechWriterAgent → compiling markdown documentation', nodes: ['n-writer'] },
      { agent: 'writer', state: STATE.COMPLETE, task: 'DOCS_GENERATED — README.md ready', progress: 100,
        logTag: 'tag-docs', logMsg: 'event: DOCS_GENERATED — sender: TechWriterAgent', nodes: ['n-writer','n-release'], event: 'DOCS_GENERATED' },

      { agent: 'release', state: STATE.PROCESSING, task: 'Running final merge-readiness checks', progress: 65,
        logTag: 'tag-info', logMsg: 'ReleaseManagerAgent → aggregating verdicts from all agents', nodes: ['n-release'] },
      { agent: 'release', state: STATE.COMPLETE, task: 'FINAL_VERDICT_MERGE_READY — pipeline complete', progress: 100,
        logTag: 'tag-release', logMsg: 'event: FINAL_VERDICT_MERGE_READY — feature ready to merge 🎉', nodes: ['n-release'], event: 'FINAL_VERDICT_MERGE_READY' },
    ];
  }

  /* ──────────────────────────────────────────────────────────
     STATE
     ────────────────────────────────────────────────────────── */
  let agentState = {};
  AGENTS.forEach(a => agentState[a.id] = { state: STATE.IDLE, task: a.task, progress: 0 });

  let totalEvents = 2417;
  let reviewCycle = 0;
  let pipelineRunning = false;

  /* ──────────────────────────────────────────────────────────
     RENDER: AGENT GRID
     ────────────────────────────────────────────────────────── */
  const agentGrid = document.getElementById('agent-grid');

  function renderAgentGrid() {
    agentGrid.innerHTML = AGENTS.map((a, i) => {
      const s = agentState[a.id];
      return `
        <div class="agent-card glass-card state-${s.state}" style="--float-delay:${(i * 0.4).toFixed(1)}s" data-agent="${a.id}">
          <div class="agent-card-top">
            <div class="agent-avatar">${a.icon}</div>
            <span class="agent-status-badge"><span class="badge-dot"></span>${STATE_LABELS[s.state]}</span>
          </div>
          <div>
            <div class="agent-name">${a.name}</div>
            <div class="agent-role">${a.role}</div>
          </div>
          <div class="agent-task">${s.task}</div>
          <div class="agent-progress-track"><div class="agent-progress-fill" style="width:${s.progress}%"></div></div>
        </div>`;
    }).join('');
  }

  function updateAgentCard(agentId) {
    const card = agentGrid.querySelector(`[data-agent="${agentId}"]`);
    if (!card) return;
    const s = agentState[agentId];
    card.className = `agent-card glass-card state-${s.state}`;
    card.style.setProperty('--float-delay', `${(AGENTS.findIndex(a=>a.id===agentId) * 0.4).toFixed(1)}s`);
    card.querySelector('.agent-status-badge').innerHTML = `<span class="badge-dot"></span>${STATE_LABELS[s.state]}`;
    card.querySelector('.agent-task').textContent = s.task;
    card.querySelector('.agent-progress-fill').style.width = `${s.progress}%`;
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: PIPELINE SVG DIAGRAM
     ────────────────────────────────────────────────────────── */
  const pipelineSvg = document.getElementById('pipeline-svg');

  // Node layout: id, x, y, w, h, label, sub
  const NODES = [
    { id: 'n-input',     x: 400, y: 10,  w: 200, h: 50, label: 'User Input',      sub: 'feature request' },
    { id: 'n-architect', x: 400, y: 95,  w: 200, h: 56, label: 'Architect Agent', sub: 'SPEC_GENERATED' },
    { id: 'n-frontend',  x: 130, y: 190, w: 200, h: 56, label: 'Frontend Agent',  sub: 'CODE_EMITTED · React' },
    { id: 'n-backend',   x: 670, y: 190, w: 200, h: 56, label: 'Backend Agent',   sub: 'CODE_EMITTED · FastAPI' },
    { id: 'n-reviewer',  x: 400, y: 285, w: 200, h: 56, label: 'Code Reviewer',   sub: 'APPROVE / REJECT loop' },
    { id: 'n-qa',        x: 400, y: 375, w: 200, h: 56, label: 'QA Tester',       sub: 'TESTS_GENERATED' },
    { id: 'n-writer',    x: 130, y: 375, w: 200, h: 56, label: 'Tech Writer',     sub: 'DOCS_GENERATED' },
    { id: 'n-release',   x: 670, y: 375, w: 200, h: 56, label: 'Release Manager', sub: 'MERGE_READY' },
  ];

  // Edges: from, to, path (for layout); reviewLoop = true marks the reject loop edge
  const EDGES = [
    { from: 'n-input', to: 'n-architect' },
    { from: 'n-architect', to: 'n-frontend' },
    { from: 'n-architect', to: 'n-backend' },
    { from: 'n-frontend', to: 'n-reviewer' },
    { from: 'n-backend', to: 'n-reviewer' },
    { from: 'n-reviewer', to: 'n-qa' },
    { from: 'n-reviewer', to: 'n-backend', loop: true },
    { from: 'n-qa', to: 'n-writer' },
    { from: 'n-qa', to: 'n-release' },
  ];

  function nodeCenter(n) { return { x: n.x + n.w/2, y: n.y + n.h/2 }; }
  function nodeById(id) { return NODES.find(n => n.id === id); }

  function edgePath(edge) {
    const a = nodeById(edge.from), b = nodeById(edge.to);
    if (edge.loop) {
      // Curve looping right side from reviewer down to backend
      const startX = a.x + a.w, startY = a.y + a.h/2;
      const endX = b.x + b.w, endY = b.y + b.h/2;
      const bow = 90;
      return `M ${startX} ${startY} C ${startX+bow} ${startY}, ${endX+bow} ${endY}, ${endX} ${endY}`;
    }
    const ac = nodeCenter(a), bc = nodeCenter(b);
    // vertical-ish connectors with smooth curve
    const startX = ac.x, startY = a.y + a.h;
    const endX = bc.x, endY = b.y;
    const midY = (startY + endY) / 2;
    return `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`;
  }

  function renderPipelineSvg() {
    const defs = `
      <defs>
        <filter id="glow-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>`;

    const edgesHtml = EDGES.map((e, i) => {
      const id = `edge-${e.from}-${e.to}`;
      return `<path id="${id}" class="pipe-edge" d="${edgePath(e)}" />`;
    }).join('');

    const nodesHtml = NODES.map(n => `
      <g class="pipe-node-group" id="${n.id}" tabindex="0">
        <rect class="pipe-node-glow" x="${n.x-3}" y="${n.y-3}" width="${n.w+6}" height="${n.h+6}" rx="14" />
        <rect class="pipe-node-rect" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" />
        <text class="pipe-node-label" x="${n.x + n.w/2}" y="${n.y + n.h/2 - 8}">${n.label}</text>
        <text class="pipe-node-sub" x="${n.x + n.w/2}" y="${n.y + n.h/2 + 14}">${n.sub}</text>
      </g>`).join('');

    pipelineSvg.innerHTML = defs + `<g class="pipe-edges">${edgesHtml}</g>` + `<g class="pipe-nodes">${nodesHtml}</g>`;
  }

  function setNodeActive(nodeId, mode) {
    const g = document.getElementById(nodeId);
    if (!g) return;
    g.classList.remove('active', 'done');
    if (mode) g.classList.add(mode);
  }

  function setEdgeFlow(fromId, toId, on) {
    const edge = document.getElementById(`edge-${fromId}-${toId}`);
    if (!edge) return;
    edge.classList.toggle('flowing', on);
  }

  function resetPipelineVisual() {
    NODES.forEach(n => setNodeActive(n.id, null));
    EDGES.forEach(e => setEdgeFlow(e.from, e.to, false));
  }

  /* ──────────────────────────────────────────────────────────
     RENDER: LIVE EVENT CONSOLE
     ────────────────────────────────────────────────────────── */
  const consoleBody = document.getElementById('console-body');

  function timestamp() {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  }

  function appendLog(tagClass, tagText, msg, typewriter = false) {
    const line = document.createElement('div');
    line.className = 'log-line';
    const time = document.createElement('span');
    time.className = 'log-time';
    time.textContent = `[${timestamp()}]`;
    const tag = document.createElement('span');
    tag.className = `log-tag ${tagClass}`;
    tag.textContent = tagText;
    const message = document.createElement('span');
    message.className = 'log-msg';

    line.appendChild(time);
    line.appendChild(tag);
    line.appendChild(message);
    consoleBody.appendChild(line);

    if (typewriter) {
      typewriterText(message, msg, () => {
        consoleBody.scrollTop = consoleBody.scrollHeight;
      });
    } else {
      message.textContent = msg;
    }

    consoleBody.scrollTop = consoleBody.scrollHeight;

    // cap log lines
    while (consoleBody.children.length > 60) {
      consoleBody.removeChild(consoleBody.firstChild);
    }

    totalEvents++;
  }

  function typewriterText(el, text, onDone) {
    let i = 0;
    const cursor = document.createElement('span');
    cursor.className = 'log-cursor';
    el.appendChild(document.createTextNode(''));
    el.appendChild(cursor);
    const speed = 8;
    function step() {
      if (i < text.length) {
        cursor.insertAdjacentText('beforebegin', text[i]);
        i++;
        consoleBody.scrollTop = consoleBody.scrollHeight;
        setTimeout(step, speed);
      } else {
        cursor.remove();
        if (onDone) onDone();
      }
    }
    step();
  }

  /* ──────────────────────────────────────────────────────────
     TOASTS
     ────────────────────────────────────────────────────────── */
  const toastContainer = document.getElementById('toast-container');
  const ICONS = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
  };

  function showToast(type, title, msg) {
    const notifEnabled = document.getElementById('notif-toggle')?.checked ?? true;
    if (!notifEnabled) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
      <div>
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${msg}</div>
      </div>`;
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 4400);
  }

  /* ──────────────────────────────────────────────────────────
     HERO HEADER: clock, token meter, pipeline state pill
     ────────────────────────────────────────────────────────── */
  function startClock() {
    const clockEl = document.getElementById('live-clock');
    function tick() {
      const d = new Date();
      clockEl.textContent = d.toLocaleTimeString();
    }
    tick();
    setInterval(tick, 1000);
  }

  function setPipelineStatePill(text, mode) {
    const pill = document.getElementById('pipeline-state-pill');
    const textEl = document.getElementById('pipeline-state-text');
    pill.className = 'pipeline-state-pill' + (mode ? ` ${mode}` : '');
    textEl.textContent = text;
  }

  let tokenCount = 0;
  const TOKEN_MAX = 128000;
  function bumpTokens(amount) {
    tokenCount = Math.min(TOKEN_MAX, tokenCount + amount);
    document.getElementById('token-count').textContent = tokenCount.toLocaleString();
    document.getElementById('token-bar-fill').style.width = `${(tokenCount / TOKEN_MAX * 100).toFixed(1)}%`;
  }

  /* ──────────────────────────────────────────────────────────
     ANALYTICS COUNTERS — animate on load
     ────────────────────────────────────────────────────────── */
  function animateCounters() {
    document.querySelectorAll('.stat-value').forEach(el => {
      const target = parseInt(el.dataset.target, 10);
      const duration = 1200;
      const start = performance.now();
      function frame(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(frame);
        else el.textContent = target.toLocaleString();
      }
      requestAnimationFrame(frame);
    });
  }

  function bumpStat(id, newValue) {
    const el = document.getElementById(id);
    el.textContent = newValue.toLocaleString();
  }

  /* ──────────────────────────────────────────────────────────
     PIPELINE EXECUTION
     ────────────────────────────────────────────────────────── */
  const triggerBtn = document.getElementById('trigger-btn');
  const featureInput = document.getElementById('feature-input');

  function resetAgents() {
    AGENTS.forEach(a => agentState[a.id] = { state: STATE.IDLE, task: 'Idle — standing by', progress: 0 });
    renderAgentGrid();
  }

  /* ──────────────────────────────────────────────────────────
     HTML ESCAPING & SYNTAX HIGHLIGHTING UTILITIES
     ────────────────────────────────────────────────────────── */
  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function highlightJSON(jsonStr) {
    if (!jsonStr) return '';
    return escapeHtml(jsonStr)
      .replace(/(&quot;.*?&quot;)(?=\s*:)/g, '<span class="tok-key">$1</span>')
      .replace(/:(\s*&quot;.*?&quot;)/g, ':<span class="tok-str">$1</span>')
      .replace(/\b(true|false|null)\b/g, '<span class="tok-key">$1</span>')
      .replace(/([\[\]\{\},:])/g, '<span class="tok-punc">$1</span>');
  }

  function highlightPython(code) {
    if (!code) return '';
    let html = escapeHtml(code);
    html = html.replace(/\b(def|class|return|import|from|async|await|try|except|if|elif|else|for|while|in|and|or|not|None|True|False)\b/g, '<span class="tok-key">$1</span>');
    html = html.replace(/(&quot;.*?&quot;)/g, '<span class="tok-str">$1</span>');
    html = html.replace(/(&#039;.*?&#039;)/g, '<span class="tok-str">$1</span>');
    html = html.replace(/(#.*)/g, '<span class="tok-comment">$1</span>');
    return html;
  }

  function highlightJSX(code) {
    if (!code) return '';
    let html = escapeHtml(code);
    html = html.replace(/\b(function|const|let|var|return|if|else|import|from|export|default|class|extends|new)\b/g, '<span class="tok-key">$1</span>');
    html = html.replace(/\b(useState|useEffect|useContext|useReducer|useCallback|useMemo|useRef)\b/g, '<span class="tok-fn">$1</span>');
    html = html.replace(/(&quot;.*?&quot;)/g, '<span class="tok-str">$1</span>');
    html = html.replace(/(&#039;.*?&#039;)/g, '<span class="tok-str">$1</span>');
    html = html.replace(/(&lt;[a-zA-Z]+.*?&gt;)/g, '<span class="tok-tag">$1</span>');
    html = html.replace(/(&lt;\/[a-zA-Z]+&gt;)/g, '<span class="tok-tag">$1</span>');
    return html;
  }

  function formatMarkdown(mdText) {
    if (!mdText) return '';
    let html = escapeHtml(mdText);
    
    // Format headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Format bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Format inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Format bullet lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/gim, '');
    
    // Paragraphs
    html = html.replace(/\n\n/g, '<p></p>');
    
    return html;
  }

  /* ──────────────────────────────────────────────────────────
     AUTHENTICATION MODAL
     ────────────────────────────────────────────────────────── */
  function showAuthModal(onSuccess) {
    let overlay = document.getElementById('auth-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'auth-overlay';
      overlay.className = 'auth-overlay';
      overlay.innerHTML = `
        <div class="auth-card">
          <div class="auth-header">
            <h2 id="auth-title">Sign In to Control Room</h2>
            <p id="auth-subtitle">Access the live multi-agent engineering pipeline</p>
          </div>
          <div id="auth-error" class="auth-error"></div>
          <div class="auth-form">
            <div class="auth-group">
              <label for="auth-email">Email Address</label>
              <input type="email" id="auth-email" class="auth-input" placeholder="you@example.com" required>
            </div>
            <div class="auth-group">
              <label for="auth-password">Password</label>
              <input type="password" id="auth-password" class="auth-input" placeholder="••••••••" required>
            </div>
            <button type="button" id="auth-submit-btn" class="auth-btn auth-btn-primary">Sign In</button>
            <button type="button" id="auth-bypass-btn" class="auth-btn auth-btn-secondary">Bypass Auth (Local Mock Mode)</button>
          </div>
          <div class="auth-switch">
            <span id="auth-switch-text">Don't have an account?</span>
            <span id="auth-switch-link" class="auth-switch-link">Sign Up</span>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      let isSignUp = false;
      const title = document.getElementById('auth-title');
      const subtitle = document.getElementById('auth-subtitle');
      const switchLink = document.getElementById('auth-switch-link');
      const switchText = document.getElementById('auth-switch-text');
      const submitBtn = document.getElementById('auth-submit-btn');
      const bypassBtn = document.getElementById('auth-bypass-btn');
      const errorDiv = document.getElementById('auth-error');
      const emailInput = document.getElementById('auth-email');
      const passwordInput = document.getElementById('auth-password');

      switchLink.addEventListener('click', () => {
        isSignUp = !isSignUp;
        errorDiv.style.display = 'none';
        if (isSignUp) {
          title.textContent = 'Create an Account';
          subtitle.textContent = 'Sign up for a new developer account';
          submitBtn.textContent = 'Sign Up';
          switchText.textContent = 'Already have an account?';
          switchLink.textContent = 'Sign In';
        } else {
          title.textContent = 'Sign In to Control Room';
          subtitle.textContent = 'Access the live multi-agent engineering pipeline';
          submitBtn.textContent = 'Sign In';
          switchText.textContent = "Don't have an account?";
          switchLink.textContent = 'Sign Up';
        }
      });

      submitBtn.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
          errorDiv.textContent = 'Please fill in all fields.';
          errorDiv.style.display = 'block';
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = isSignUp ? 'Signing Up...' : 'Signing In...';
        errorDiv.style.display = 'none';

        try {
          let res;
          if (isSignUp) {
            res = await supabase.auth.signUp({ email, password });
          } else {
            res = await supabase.auth.signInWithPassword({ email, password });
          }

          if (res.error) throw res.error;

          currentSession = res.data.session;
          localBypassActive = false;
          overlay.classList.remove('show');
          showToast('success', isSignUp ? 'Signed up!' : 'Signed in!', `Welcome, ${email}.`);
          if (onSuccess) onSuccess();
        } catch (err) {
          errorDiv.textContent = err.message || 'Authentication failed.';
          errorDiv.style.display = 'block';
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = isSignUp ? 'Sign Up' : 'Sign In';
        }
      });

      bypassBtn.addEventListener('click', () => {
        localBypassActive = true;
        currentSession = null;
        overlay.classList.remove('show');
        showToast('info', 'Local Bypass Active', 'Using local mock authorization.');
        if (onSuccess) onSuccess();
      });
    }

    document.getElementById('auth-email').value = '';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').style.display = 'none';
    overlay.classList.add('show');
  }

  /* ──────────────────────────────────────────────────────────
     LIVE BACKEND RUN & POLLING
     ────────────────────────────────────────────────────────── */
  const AGENT_MAP = {
    'ArchitectAgent': 'architect',
    'FrontendDevAgent': 'frontend',
    'BackendDevAgent': 'backend',
    'CodeReviewerAgent': 'reviewer',
    'QATesterAgent': 'qa',
    'TechWriterAgent': 'writer',
    'ReleaseManagerAgent': 'release'
  };

  const AGENT_DESC_TEMPLATES = {
    architect: {
      idle: 'Awaiting feature request',
      processing: 'Parsing request into architecture spec...',
      complete: 'Spec generated · architecture_pattern: REST + React SPA',
      rejected: 'Spec rejected'
    },
    frontend: {
      idle: 'Idle — waiting on spec',
      processing: 'Writing React JSX code tree...',
      compiling: 'Writing React JSX code tree...',
      complete: 'CODE_EMITTED — frontend implementation ready',
      rejected: 'CODE_REJECTED — applying reviewer fixes...'
    },
    backend: {
      idle: 'Idle — waiting on spec',
      processing: 'Writing FastAPI backend code...',
      compiling: 'Writing FastAPI backend code...',
      complete: 'CODE_EMITTED — backend implementation ready',
      rejected: 'CODE_REJECTED — applying reviewer fixes...'
    },
    reviewer: {
      idle: 'Idle — waiting on code',
      processing: 'Analyzing diffs for security and logic...',
      complete: 'CODE_APPROVED — all quality gates passed',
      rejected: 'CODE_REJECTED — security/logic issues flagged'
    },
    qa: {
      idle: 'Idle — waiting on approval',
      processing: 'Generating pytest/jest test suites...',
      complete: 'TESTS_GENERATED — unit tests ready'
    },
    writer: {
      idle: 'Idle — waiting on tests',
      processing: 'Compiling technical README and endpoints...',
      complete: 'DOCS_GENERATED — README.md ready'
    },
    release: {
      idle: 'Idle — awaiting docs',
      processing: 'Running final merge-readiness checks...',
      complete: 'FINAL_VERDICT_MERGE_READY — pipeline complete'
    }
  };

  function updateVisualizationFromStates(agents, review_cycle) {
    if (!agents) return;
    
    resetPipelineVisual();

    const archState = (agents['ArchitectAgent'] || 'IDLE').toLowerCase();
    const feState = (agents['FrontendDevAgent'] || 'IDLE').toLowerCase();
    const beState = (agents['BackendDevAgent'] || 'IDLE').toLowerCase();
    const revState = (agents['CodeReviewerAgent'] || 'IDLE').toLowerCase();
    const qaState = (agents['QATesterAgent'] || 'IDLE').toLowerCase();
    const writeState = (agents['TechWriterAgent'] || 'IDLE').toLowerCase();
    const relState = (agents['ReleaseManagerAgent'] || 'IDLE').toLowerCase();

    setNodeActive('n-input', 'done');

    if (archState === 'processing') {
      setNodeActive('n-architect', 'active');
      setEdgeFlow('n-input', 'n-architect', true);
    } else if (archState === 'complete') {
      setNodeActive('n-architect', 'done');
    }

    if (archState === 'complete') {
      if (feState === 'processing') {
        setNodeActive('n-frontend', 'active');
        setEdgeFlow('n-architect', 'n-frontend', true);
      } else if (feState === 'complete') {
        setNodeActive('n-frontend', 'done');
      }

      if (beState === 'processing') {
        setNodeActive('n-backend', 'active');
        setEdgeFlow('n-architect', 'n-backend', true);
      } else if (beState === 'complete') {
        setNodeActive('n-backend', 'done');
      }
    }

    if (feState === 'complete' && beState === 'complete') {
      if (revState === 'processing') {
        setNodeActive('n-reviewer', 'active');
        setEdgeFlow('n-frontend', 'n-reviewer', true);
        setEdgeFlow('n-backend', 'n-reviewer', true);
      } else if (revState === 'rejected') {
        setNodeActive('n-reviewer', 'active');
        setNodeActive('n-backend', 'active');
        setEdgeFlow('n-reviewer', 'n-backend', true);
      } else if (revState === 'complete') {
        setNodeActive('n-reviewer', 'done');
      }
    }

    if (revState === 'complete') {
      if (qaState === 'processing') {
        setNodeActive('n-qa', 'active');
        setEdgeFlow('n-reviewer', 'n-qa', true);
      } else if (qaState === 'complete') {
        setNodeActive('n-qa', 'done');
      }
    }

    if (qaState === 'complete') {
      if (writeState === 'processing') {
        setNodeActive('n-writer', 'active');
        setEdgeFlow('n-qa', 'n-writer', true);
      } else if (writeState === 'complete') {
        setNodeActive('n-writer', 'done');
      }

      if (relState === 'processing') {
        setNodeActive('n-release', 'active');
        setEdgeFlow('n-qa', 'n-release', true);
      } else if (relState === 'complete') {
        setNodeActive('n-release', 'done');
      }
    }
  }

  function updateDashboardFromLiveState(state) {
    if (!state) return;
    
    const status = state.status || 'IDLE';
    const cleanStatus = status === 'HOLD' ? 'HOLD' : status;
    const mode = status === 'RUNNING' ? 'processing' : (status === 'COMPLETE' ? 'complete' : (status === 'ERROR' || status === 'HOLD' ? 'rejected' : ''));
    setPipelineStatePill(STATE_LABELS[cleanStatus.toLowerCase()] || cleanStatus, mode);
    
    const sysStatus = document.getElementById('system-status');
    if (sysStatus) {
      const isRunning = status === 'RUNNING';
      sysStatus.querySelector('.status-text').textContent = isRunning ? 'PROCESSING' : 'OPERATIONAL';
      sysStatus.querySelector('.status-dot').style.background = isRunning ? 'var(--cyan)' : '';
      sysStatus.style.background = isRunning ? 'var(--cyan-soft)' : '';
      sysStatus.style.borderColor = isRunning ? 'rgba(6,182,212,0.3)' : '';
      sysStatus.style.color = isRunning ? 'var(--cyan)' : '';
    }

    const processingCount = AGENTS.filter(a => {
      const dbName = Object.keys(AGENT_MAP).find(k => AGENT_MAP[k] === a.id);
      return state.agents && state.agents[dbName] === 'PROCESSING';
    }).length;
    bumpStat('stat-active-agents', processingCount);

    if (state.agents) {
      for (const [dbName, dbState] of Object.entries(state.agents)) {
        const id = AGENT_MAP[dbName];
        if (!id) continue;
        let lowercaseState = dbState.toLowerCase();
        
        let progress = 0;
        if (lowercaseState === 'processing') {
          progress = 60;
          if (id === 'frontend' || id === 'backend') {
            lowercaseState = 'compiling';
          }
        }
        else if (lowercaseState === 'complete') progress = 100;
        else if (lowercaseState === 'rejected') progress = 100;

        const taskText = AGENT_DESC_TEMPLATES[id][lowercaseState] || lowercaseState;
        
        agentState[id] = { state: lowercaseState, task: taskText, progress: progress };
        updateAgentCard(id);
      }
    }

    // 🧪 Update verification checklist from live agent states
    const syntaxItem = document.getElementById('chk-syntax');
    const securityItem = document.getElementById('chk-security');
    const unitItem = document.getElementById('chk-unit');
    const integrationItem = document.getElementById('chk-integration');

    if (state.agents) {
      const fe = (state.agents['FrontendDevAgent'] || 'IDLE').toLowerCase();
      const be = (state.agents['BackendDevAgent'] || 'IDLE').toLowerCase();
      const rev = (state.agents['CodeReviewerAgent'] || 'IDLE').toLowerCase();
      const qa = (state.agents['QATesterAgent'] || 'IDLE').toLowerCase();
      const wr = (state.agents['TechWriterAgent'] || 'IDLE').toLowerCase();
      const rel = (state.agents['ReleaseManagerAgent'] || 'IDLE').toLowerCase();

      // Syntax check
      if (fe === 'processing' || be === 'processing' || fe === 'compiling' || be === 'compiling') {
        if (syntaxItem) syntaxItem.className = 'chk-item active';
      } else if (fe === 'complete' || be === 'complete' || fe === 'rejected' || be === 'rejected' || rev !== 'idle') {
        if (syntaxItem) syntaxItem.className = 'chk-item passed';
      }

      // Security scans
      if (rev === 'processing' || rev === 'rejected') {
        if (securityItem) securityItem.className = 'chk-item active';
      } else if (rev === 'complete' || qa !== 'idle') {
        if (securityItem) securityItem.className = 'chk-item passed';
      }

      // Unit assertions
      if (qa === 'processing') {
        if (unitItem) unitItem.className = 'chk-item active';
      } else if (qa === 'complete' || wr !== 'idle' || rel !== 'idle') {
        if (unitItem) unitItem.className = 'chk-item passed';
      }

      // Integration flows
      if (rel === 'processing' || wr === 'processing') {
        if (integrationItem) integrationItem.className = 'chk-item active';
      } else if (rel === 'complete') {
        if (integrationItem) integrationItem.className = 'chk-item passed';
      }
    }

    // 📊 Update credit resource pools from live events
    if (state.events) {
      const eventCount = state.events.length;
      const maxEvents = 13;
      const reasoningLeft = (10.00 - Math.min(1.0, eventCount / maxEvents) * 1.60).toFixed(2);
      const productionLeft = (25.00 - Math.min(1.0, eventCount / maxEvents) * 2.20).toFixed(2);
      
      const rValueEl = document.getElementById('reasoning-pool-value');
      const rFillEl = document.getElementById('reasoning-pool-fill');
      const pValueEl = document.getElementById('production-pool-value');
      const pFillEl = document.getElementById('production-pool-fill');

      if (rValueEl) rValueEl.textContent = `$${reasoningLeft} remaining`;
      if (rFillEl) rFillEl.style.width = `${(reasoningLeft / 10.00 * 100).toFixed(1)}%`;
      if (pValueEl) pValueEl.textContent = `$${productionLeft} remaining`;
      if (pFillEl) pFillEl.style.width = `${(productionLeft / 25.00 * 100).toFixed(1)}%`;
    }

    updateVisualizationFromStates(state.agents, state.review_cycle);

    if (state.events) {
      state.events.forEach(evt => {
        if (!processedEventIds.has(evt.event_id)) {
          processedEventIds.add(evt.event_id);
          
          let tagClass = 'tag-info';
          const type = evt.event_type || '';
          if (type.includes('SPEC_GENERATED')) tagClass = 'tag-spec';
          else if (type.includes('CODE_EMITTED')) tagClass = 'tag-code';
          else if (type.includes('CODE_REJECTED')) tagClass = 'tag-rejected';
          else if (type.includes('CODE_APPROVED')) tagClass = 'tag-approved';
          else if (type.includes('TESTS_GENERATED')) tagClass = 'tag-tests';
          else if (type.includes('DOCS_GENERATED')) tagClass = 'tag-docs';
          else if (type.includes('FINAL_VERDICT_MERGE_READY')) tagClass = 'tag-release';
          else if (type.includes('FINAL_VERDICT_HOLD')) tagClass = 'tag-rejected';
          else if (type.includes('PIPELINE_ERROR')) tagClass = 'tag-rejected';

          let msg = evt.payload_data?.message || '';
          if (!msg) {
            if (type === 'SPEC_GENERATED') {
              msg = `ArchitectAgent → generated Spec layout. Pattern: ${evt.payload_data.architecture_pattern || 'REST + React SPA'}`;
            } else if (type === 'CODE_EMITTED') {
              msg = `${evt.sender || 'Developer'} → Code Emitted (Iteration ${evt.payload_data.iteration_count || 1}) for ${evt.payload_data.file_target || 'source files'}`;
            } else if (type === 'CODE_REJECTED') {
              msg = `CodeReviewerAgent → Code Rejected. Remediation tickets sent.`;
            } else if (type === 'CODE_APPROVED') {
              msg = `CodeReviewerAgent → Code Approved. Passed all quality checks.`;
            } else if (type === 'TESTS_GENERATED') {
              msg = `QATesterAgent → generated tests in ${evt.payload_data.test_file || 'test suite'}. Estimate coverage: ${evt.payload_data.coverage_estimate || 'N/A'}`;
            } else if (type === 'DOCS_GENERATED') {
              msg = `TechWriterAgent → generated developer README documentation.`;
            } else if (type.includes('FINAL_VERDICT_MERGE_READY')) {
              msg = `ReleaseManagerAgent → FINAL_VERDICT: MERGE_READY. The feature branch is ready to merge! 🎉`;
            } else if (type.includes('FINAL_VERDICT_HOLD')) {
              msg = `ReleaseManagerAgent → FINAL_VERDICT: HOLD. Verification issues remain.`;
            } else if (type === 'PIPELINE_ERROR') {
              msg = `Orchestrator → Error: ${evt.payload_data.error || 'Pipeline execution failed'}`;
            } else {
              msg = `${type} event emitted by ${evt.sender}`;
            }
          }
          
          appendLog(tagClass, type.replace('FINAL_VERDICT_', ''), msg, false);
          
          if (type === 'CODE_REJECTED') {
            showToast('error', 'Code Rejected', 'Reviewer flagged security/logic issues. Looping back.');
          } else if (type === 'CODE_APPROVED') {
            showToast('success', 'Code Approved', 'All quality gates passed. Proceeding to QA.');
          } else if (type.includes('FINAL_VERDICT_MERGE_READY')) {
            showToast('success', 'Merge Ready', 'Feature pipeline complete — ready for deployment.');
          }
        }
      });
      bumpStat('stat-events', totalEvents);
    }

    if (state.artifacts) {
      const arts = state.artifacts;
      
      if (arts.architecture && Object.keys(arts.architecture).length > 0) {
        const archEl = document.querySelector('#architecture-tab pre code');
        if (archEl) {
          archEl.innerHTML = highlightJSON(JSON.stringify(arts.architecture, null, 2));
        }
      }
      
      if (arts.frontend_code && Object.keys(arts.frontend_code).length > 0) {
        const badge = document.getElementById('iter-badge-fe');
        if (badge) {
          badge.textContent = `Iteration ${arts.frontend_code.iteration_count || 1}`;
        }
        const feEl = document.querySelector('#code-tab .code-col:nth-child(1) pre code');
        if (feEl) {
          feEl.innerHTML = highlightJSX(arts.frontend_code.source_code);
        }
      }
      if (arts.backend_code && Object.keys(arts.backend_code).length > 0) {
        const badge = document.getElementById('iter-badge-be');
        if (badge) {
          badge.textContent = `Iteration ${arts.backend_code.iteration_count || 1}`;
        }
        const beEl = document.querySelector('#code-tab .code-col:nth-child(2) pre code');
        if (beEl) {
          beEl.innerHTML = highlightPython(arts.backend_code.source_code);
        }
      }
      
      if (arts.tests && Object.keys(arts.tests).length > 0) {
        const t = arts.tests;
        const fwVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(1) .test-stat-value');
        if (fwVal) fwVal.textContent = t.test_framework || 'pytest';
        
        const fileVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(2) .test-stat-value');
        if (fileVal) fileVal.textContent = t.test_file || 'test_suite.py';
        
        const covVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(3) .test-stat-value');
        if (covVal) covVal.textContent = t.coverage_estimate || 'N/A';
        
        const tCodeEl = document.querySelector('#tests-tab pre code');
        if (tCodeEl) {
          tCodeEl.innerHTML = highlightPython(t.source_code);
        }
      }
      
      if (arts.documentation && Object.keys(arts.documentation).length > 0) {
        const docText = arts.documentation.content || '';
        if (docText) {
          latestDocContent = docText;
          const mdRenderEl = document.querySelector('#docs-tab .markdown-render');
          if (mdRenderEl) {
            const buttonHtml = `
              <button type="button" class="btn-download" id="download-readme">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Download README.md
              </button>`;
            mdRenderEl.innerHTML = formatMarkdown(docText) + buttonHtml;
            document.getElementById('download-readme').addEventListener('click', downloadReadmeHandler);
          }
        }
      }
    }
  }

  function finalizeLiveRun(status, state) {
    const isSuccess = status === 'COMPLETE';
    setPipelineStatePill(status, isSuccess ? 'complete' : 'rejected');
    
    const sysStatus = document.getElementById('system-status');
    if (sysStatus) {
      sysStatus.querySelector('.status-text').textContent = 'OPERATIONAL';
      sysStatus.querySelector('.status-dot').style.background = '';
      sysStatus.style.background = '';
      sysStatus.style.borderColor = '';
      sysStatus.style.color = '';
    }

    triggerBtn.classList.remove('is-loading');
    triggerBtn.querySelector('span').textContent = 'Trigger Pipeline';
    pipelineRunning = false;
    
    bumpStat('stat-active-agents', 0);
    
    if (isSuccess) {
      const completedEl = document.getElementById('stat-tasks-completed');
      if (completedEl) {
        completedEl.textContent = (parseInt(completedEl.textContent.replace(/,/g, '')) + 7).toLocaleString();
      }
      appendLog('tag-release', 'DONE', 'Pipeline run complete. All artifacts available in the Artifact Hub.', false);
    } else {
      appendLog('tag-rejected', 'FAILED', `Pipeline execution terminated with status: ${status}`, false);
    }
  }

  function startPolling(sessionId, headers) {
    processedEventIds.clear();
    let pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { headers });
        if (!response.ok) throw new Error(`Polling status error: ${response.status}`);
        const state = await response.json();
        
        updateDashboardFromLiveState(state);

        const status = state.status;
        if (status === 'COMPLETE' || status === 'HOLD' || status === 'ERROR') {
          clearInterval(pollInterval);
          finalizeLiveRun(status, state);
        }
      } catch (err) {
        console.error("Polling error:", err);
        appendLog('tag-rejected', 'ERROR', `Connection lost during polling: ${err.message}`, false);
      }
    }, 1500);
  }

  async function runPipeline() {
    if (pipelineRunning) return;

    const mockModeToggle = document.getElementById('mock-mode-toggle');
    const isMockMode = mockModeToggle ? mockModeToggle.checked : true;

    if (isMockMode) {
      pipelineRunning = true;
      triggerBtn.classList.add('is-loading');
      triggerBtn.querySelector('span').textContent = 'Running...';

      const feature = featureInput.value.trim();
      const script = buildPipelineScript(feature);

      setPipelineStatePill('RUNNING', 'processing');
      document.getElementById('status-text')?.replaceChildren?.();
      const sysStatus = document.getElementById('system-status');
      sysStatus.querySelector('.status-text').textContent = 'PROCESSING';
      sysStatus.querySelector('.status-dot').style.background = 'var(--cyan)';
      sysStatus.style.background = 'var(--cyan-soft)';
      sysStatus.style.borderColor = 'rgba(6,182,212,0.3)';
      sysStatus.style.color = 'var(--cyan)';

      resetPipelineVisual();
      appendLog('tag-info', 'PIPELINE', 'Trigger received — initializing run', false);
      showToast('info', 'Pipeline triggered', 'AgentVerse AI is processing your feature request.');

      // Reset credit pools initially
      const rValueEl = document.getElementById('reasoning-pool-value');
      const rFillEl = document.getElementById('reasoning-pool-fill');
      const pValueEl = document.getElementById('production-pool-value');
      const pFillEl = document.getElementById('production-pool-fill');
      if (rValueEl) rValueEl.textContent = `$10.00 remaining`;
      if (rFillEl) rFillEl.style.width = `100%`;
      if (pValueEl) pValueEl.textContent = `$25.00 remaining`;
      if (pFillEl) pFillEl.style.width = `100%`;

      let activeAgentsCount = 1;
      bumpStat('stat-active-agents', activeAgentsCount);

      let reviewCycle = 0;
      for (let i = 0; i < script.length; i++) {
        const step = script[i];
        const agentIds = Array.isArray(step.agent) ? step.agent : [step.agent];

        agentIds.forEach(id => {
          agentState[id] = { state: step.state, task: step.task, progress: step.progress };
          updateAgentCard(id);
        });

        // 📊 Dynamically decrease resource pool metrics during run
        const reasoningLeft = (10.00 - (i / (script.length - 1)) * 1.60).toFixed(2);
        const productionLeft = (25.00 - (i / (script.length - 1)) * 2.20).toFixed(2);
        if (rValueEl) rValueEl.textContent = `$${reasoningLeft} remaining`;
        if (rFillEl) rFillEl.style.width = `${(reasoningLeft / 10.00 * 100).toFixed(1)}%`;
        if (pValueEl) pValueEl.textContent = `$${productionLeft} remaining`;
        if (pFillEl) pFillEl.style.width = `${(productionLeft / 25.00 * 100).toFixed(1)}%`;

        // 🧪 Dynamically update verification checklist state
        const syntaxItem = document.getElementById('chk-syntax');
        const securityItem = document.getElementById('chk-security');
        const unitItem = document.getElementById('chk-unit');
        const integrationItem = document.getElementById('chk-integration');

        if (i === 0) {
          [syntaxItem, securityItem, unitItem, integrationItem].forEach(item => {
            if (item) item.className = 'chk-item';
          });
        }
        if (i >= 3 && i < 6) {
          if (syntaxItem) syntaxItem.className = 'chk-item active';
        }
        if (i >= 6) {
          if (syntaxItem) syntaxItem.className = 'chk-item passed';
        }
        if (i >= 7 && i < 11) {
          if (securityItem) securityItem.className = 'chk-item active';
        }
        if (i >= 11) {
          if (securityItem) securityItem.className = 'chk-item passed';
        }
        if (i >= 12 && i < 13) {
          if (unitItem) unitItem.className = 'chk-item active';
        }
        if (i >= 13) {
          if (unitItem) unitItem.className = 'chk-item passed';
        }
        if (i >= 14 && i < 17) {
          if (integrationItem) integrationItem.className = 'chk-item active';
        }
        if (i >= 17) {
          if (integrationItem) integrationItem.className = 'chk-item passed';
        }

        const processingCount = AGENTS.filter(a => agentState[a.id].state === STATE.PROCESSING).length;
        bumpStat('stat-active-agents', Math.max(1, processingCount));

        if (step.nodes) {
          step.nodes.forEach((nid, idx) => {
            if (step.state === STATE.PROCESSING) setNodeActive(nid, 'active');
            else if (step.state === STATE.COMPLETE) setNodeActive(nid, 'done');
            else if (step.state === STATE.REJECTED) setNodeActive(nid, 'active');
          });
        }

        if (step.event === 'SPEC_GENERATED') {
          const archEl = document.querySelector('#architecture-tab pre code');
          if (archEl) {
            archEl.innerHTML = highlightJSON(JSON.stringify({
              "architecture_pattern": "REST + React SPA",
              "frontend_spec": {
                "components": ["ProfileDashboard", "AuthGuard", "ProfileEditForm"],
                "state_hooks": ["useAuthToken", "useProfileData"]
              },
              "backend_spec": {
                "framework": "FastAPI",
                "endpoints": ["POST /auth/login", "GET /profile", "PUT /profile"],
                "auth": "JWT Bearer"
              }
            }, null, 2));
          }
          setEdgeFlow('n-input', 'n-architect', false);
          setEdgeFlow('n-architect', 'n-frontend', true);
          setEdgeFlow('n-architect', 'n-backend', true);
        }
        if (step.event === 'CODE_EMITTED') {
          const isIteration2 = step.task.includes('iteration 2') || reviewCycle > 0;
          const feEl = document.querySelector('#code-tab .code-col:nth-child(1) pre code');
          if (feEl) {
            feEl.innerHTML = highlightJSX(`function ProfileDashboard() {
  const [profile, setProfile] = useState(null);
  const { token } = useAuthToken();

  useEffect(() => {
    fetchProfile(token).then(setProfile);
  }, [token]);

  if (!profile) return <Spinner />;

  return (
    <AuthGuard>
      <ProfileEditForm data={profile} />
    </AuthGuard>
  );
}`);
          }
          const beEl = document.querySelector('#code-tab .code-col:nth-child(2) pre code');
          if (beEl) {
            if (isIteration2) {
              beEl.innerHTML = highlightPython(`@app.put("/profile")
async def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user)
):
    # JWT-validated mutation (Iteration 2 Patch)
    updated = await db.profiles.update(
        {"user_id": user.id},
        payload.dict()
    )
    return {"status": "ok", "profile": updated}`);
            } else {
              beEl.innerHTML = highlightPython(`@app.put("/profile")
async def update_profile(
    payload: ProfileUpdate
):
    # Vulnerable mutation: no auth guard check (Iteration 1)
    updated = await db.profiles.update(
        {"user_id": payload.user_id},
        payload.dict()
    )
    return {"status": "ok", "profile": updated}`);
            }
          }
          const feBadge = document.getElementById('iter-badge-fe');
          if (feBadge) feBadge.textContent = 'Iteration 2';
          const beBadge = document.getElementById('iter-badge-be');
          if (beBadge) beBadge.textContent = isIteration2 ? 'Iteration 2' : 'Iteration 1';

          if (step.nodes.includes('n-frontend')) {
            setEdgeFlow('n-frontend', 'n-reviewer', true);
            setEdgeFlow('n-backend', 'n-reviewer', true);
          }
        }
        if (step.event === 'CODE_REJECTED') {
          setEdgeFlow('n-reviewer', 'n-backend', true);
        }
        if (step.event === 'CODE_APPROVED') {
          setEdgeFlow('n-reviewer', 'n-backend', false);
          setEdgeFlow('n-reviewer', 'n-qa', true);
          reviewCycle++;
        }
        if (step.event === 'TESTS_GENERATED') {
          const tCodeEl = document.querySelector('#tests-tab pre code');
          if (tCodeEl) {
            tCodeEl.innerHTML = highlightPython(`def test_update_profile_requires_auth():
    response = client.put("/profile", json={})
    assert response.status_code == 401

def test_update_profile_success(auth_headers):
    response = client.put(
        "/profile",
        json={"display_name": "Cloudy"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    # PASSED — 0.04s`);
          }
          const fwVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(1) .test-stat-value');
          if (fwVal) fwVal.textContent = 'pytest';
          const fileVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(2) .test-stat-value');
          if (fileVal) fileVal.textContent = 'test_profile_api.py';
          const covVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(3) .test-stat-value');
          if (covVal) covVal.textContent = '94%';

          setEdgeFlow('n-qa', 'n-writer', true);
        }
        if (step.event === 'DOCS_GENERATED') {
          const docText = `# Profile Dashboard Feature\n\nAdds a secure, JWT-authenticated profile dashboard allowing users to view and edit their account details.\n\n## Endpoints\n- \`POST /auth/login\` — returns a signed JWT bearer token\n- \`GET /profile\` — returns the authenticated user's profile\n- \`PUT /profile\` — updates profile fields, JWT-validated\n\n## Frontend Components\n\`ProfileDashboard\`, \`AuthGuard\`, and \`ProfileEditForm\` compose the client experience, backed by \`useAuthToken\` and \`useProfileData\` hooks.`;
          latestDocContent = docText;
          const mdRenderEl = document.querySelector('#docs-tab .markdown-render');
          if (mdRenderEl) {
            mdRenderEl.innerHTML = `
              <h3># Profile Dashboard Feature</h3>
              <p>Adds a secure, JWT-authenticated profile dashboard allowing users to view and edit their account details.</p>
              <h4>## Endpoints</h4>
              <ul>
                <li><code>POST /auth/login</code> — returns a signed JWT bearer token</li>
                <li><code>GET /profile</code> — returns the authenticated user's profile</li>
                <li><code>PUT /profile</code> — updates profile fields, JWT-validated</li>
              </ul>
              <h4>## Frontend Components</h4>
              <p><code>ProfileDashboard</code>, <code>AuthGuard</code>, and <code>ProfileEditForm</code> compose the client experience, backed by <code>useAuthToken</code> and <code>useProfileData</code> hooks.</p>
              <button type="button" class="btn-download" id="download-readme">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Download README.md
              </button>`;
            
            // Re-bind click handler
            const dlBtn = document.getElementById('download-readme');
            if (dlBtn) dlBtn.addEventListener('click', downloadReadmeHandler);
          }
          setEdgeFlow('n-qa', 'n-release', true);
        }

        if (step.logMsg) {
          appendLog(step.logTag, eventTagLabel(step), step.logMsg, i < 3);
        }

        bumpTokens(Math.floor(800 + Math.random() * 1800));
        bumpStat('stat-events', totalEvents);

        if (step.event === 'CODE_REJECTED') {
          showToast('error', 'Code Rejected', 'CodeReviewerAgent flagged missing auth guard. Looping back.');
        }
        if (step.event === 'CODE_APPROVED') {
          showToast('success', 'Code Approved', 'All quality gates passed. Proceeding to QA.');
        }
        if (step.event === 'FINAL_VERDICT_MERGE_READY') {
          showToast('success', 'Merge Ready', 'Feature pipeline complete — ready for deployment.');
        }

        await sleep(950);
      }

      setPipelineStatePill('COMPLETE', 'complete');
      sysStatus.querySelector('.status-text').textContent = 'OPERATIONAL';
      sysStatus.querySelector('.status-dot').style.background = '';
      sysStatus.style.background = '';
      sysStatus.style.borderColor = '';
      sysStatus.style.color = '';

      bumpStat('stat-active-agents', 0);
      bumpStat('stat-tasks-completed', parseInt(document.getElementById('stat-tasks-completed').textContent.replace(/,/g,'')) + 7);

      appendLog('tag-release', 'DONE', 'Pipeline run complete. All artifacts available in the Artifact Hub.', false);

      triggerBtn.classList.remove('is-loading');
      triggerBtn.querySelector('span').textContent = 'Trigger Pipeline';
      pipelineRunning = false;
    } else {
      const triggerRealRun = async () => {
        const headers = { 'Content-Type': 'application/json' };
        if (currentSession) {
          headers['Authorization'] = `Bearer ${currentSession.access_token}`;
        } else if (localBypassActive) {
          headers['Authorization'] = `Bearer bypass-local-auth`;
        }

        const feature = featureInput.value.trim();
        if (!feature) {
          showToast('error', 'Empty Request', 'Please describe the feature to generate.');
          return;
        }

        pipelineRunning = true;
        triggerBtn.classList.add('is-loading');
        triggerBtn.querySelector('span').textContent = 'Running...';
        setPipelineStatePill('RUNNING', 'processing');
        
        const sysStatus = document.getElementById('system-status');
        sysStatus.querySelector('.status-text').textContent = 'PROCESSING';
        sysStatus.querySelector('.status-dot').style.background = 'var(--cyan)';
        sysStatus.style.background = 'var(--cyan-soft)';
        sysStatus.style.borderColor = 'rgba(6,182,212,0.3)';
        sysStatus.style.color = 'var(--cyan)';
        
        resetPipelineVisual();
        resetAgents();
        
        appendLog('tag-info', 'PIPELINE', 'Sending feature trigger to API Gateway...', false);
        showToast('info', 'Pipeline Triggered', 'AgentVerse AI is triggering backend agents.');

        try {
          const bandRoomInput = document.getElementById('band-room-input');
          const bandRoomId = bandRoomInput ? bandRoomInput.value.trim() : '';

          const payload = { feature_request: feature };
          if (bandRoomId) {
            payload.band_room_id = bandRoomId;
          }

          const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(errText || `Trigger failed with status ${response.status}`);
          }

          const data = await response.json();
          const sessionId = data.session_id;
          appendLog('tag-info', 'PIPELINE', `Session created: ${sessionId}. Starting database polling...`, false);
          
          startPolling(sessionId, headers);
        } catch (err) {
          console.error(err);
          appendLog('tag-rejected', 'ERROR', `Failed to trigger pipeline: ${err.message}`, false);
          showToast('error', 'Trigger Failed', err.message);
          
          setPipelineStatePill('ERROR', 'rejected');
          triggerBtn.classList.remove('is-loading');
          triggerBtn.querySelector('span').textContent = 'Trigger Pipeline';
          pipelineRunning = false;
        }
      };

      if (!currentSession && !localBypassActive && supabase) {
        showAuthModal(triggerRealRun);
      } else {
        triggerRealRun();
      }
    }
  }

  function eventTagLabel(step) {
    if (!step.event) return 'INFO';
    return step.event.replace('FINAL_VERDICT_', '');
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  triggerBtn.addEventListener('click', runPipeline);
  featureInput.addEventListener('keydown', e => { if (e.key === 'Enter') runPipeline(); });

  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      // Clear console locally
      consoleBody.innerHTML = '';
      appendLog('tag-info', 'CLEAR', 'Log cache and console wiped.', false);
      showToast('info', 'Logs Cleared', 'Terminal window and session history cleared.');
      
      const mockModeToggle = document.getElementById('mock-mode-toggle');
      const isMockMode = mockModeToggle ? mockModeToggle.checked : true;
      if (!isMockMode) {
        // Trigger backend clear session history
        const headers = { 'Content-Type': 'application/json' };
        if (currentSession) {
          headers['Authorization'] = `Bearer ${currentSession.access_token}`;
        } else if (localBypassActive) {
          headers['Authorization'] = `Bearer bypass-local-auth`;
        }
        
        try {
          const res = await fetch('/api/sessions/clear', {
            method: 'POST',
            headers: headers
          });
          if (res.ok) {
            showToast('success', 'Backend Reset', 'Database session history wiped successfully.');
            resetAgents();
            resetPipelineVisual();
            bumpStat('stat-active-agents', 0);
          } else {
            const txt = await res.text();
            throw new Error(txt || `Clear failed with status ${res.status}`);
          }
        } catch (err) {
          console.error(err);
          appendLog('tag-rejected', 'ERROR', `Failed to wipe backend state: ${err.message}`, false);
          showToast('error', 'Reset Failed', err.message);
        }
      } else {
        resetAgents();
        resetPipelineVisual();
        bumpStat('stat-active-agents', 0);
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     AMBIENT CONSOLE FEED (idle simulation before trigger)
     ────────────────────────────────────────────────────────── */
  const AMBIENT_LOGS = [
    { tag: 'tag-info', text: 'Band bus heartbeat — room: agentverse-ai-room-01 — OK' },
    { tag: 'tag-info', text: 'Polling for new events... 0 pending' },
    { tag: 'tag-info', text: 'All 7 agents standing by' },
    { tag: 'tag-info', text: 'LLM router idle — AI/ML API + Featherless connections healthy' },
  ];
  let ambientIdx = 0;
  function ambientTick() {
    if (!pipelineRunning) {
      const log = AMBIENT_LOGS[ambientIdx % AMBIENT_LOGS.length];
      appendLog(log.tag, 'IDLE', log.text, false);
      ambientIdx++;
    }
    setTimeout(ambientTick, 6000 + Math.random() * 4000);
  }

  /* ──────────────────────────────────────────────────────────
     TABS
     ────────────────────────────────────────────────────────── */
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  /* ──────────────────────────────────────────────────────────
     SIDEBAR NAV — active state + scroll + mobile toggle
     ────────────────────────────────────────────────────────── */
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      
      const section = item.dataset.section;
      if (section === 'testing') {
        const target = document.getElementById('canvas');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const tabBtn = document.querySelector('.tab[data-tab="tests-tab"]');
        if (tabBtn) tabBtn.click();
      } else if (section === 'docs') {
        const target = document.getElementById('canvas');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const tabBtn = document.querySelector('.tab[data-tab="docs-tab"]');
        if (tabBtn) tabBtn.click();
      } else if (section === 'canvas') {
        const target = document.getElementById('canvas');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const tabBtn = document.querySelector('.tab[data-tab="code-tab"]');
        if (tabBtn) tabBtn.click();
      } else {
        const target = document.getElementById(section);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (section === 'dashboard') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
      closeMobileSidebar();
    });
  });

  const sidebar = document.getElementById('sidebar');
  const sidebarScrim = document.getElementById('sidebar-scrim');
  const mobileToggle = document.getElementById('mobile-nav-toggle');

  function openMobileSidebar() {
    sidebar.classList.add('open');
    sidebarScrim.classList.add('show');
  }
  function closeMobileSidebar() {
    sidebar.classList.remove('open');
    sidebarScrim.classList.remove('show');
  }
  mobileToggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
  });
  sidebarScrim.addEventListener('click', closeMobileSidebar);

  /* ──────────────────────────────────────────────────────────
     THEME TOGGLE
     ────────────────────────────────────────────────────────── */
  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    if (next === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  });

  /* ──────────────────────────────────────────────────────────
     FULLSCREEN TOGGLE
     ────────────────────────────────────────────────────────── */
  document.getElementById('fullscreen-toggle').addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  });

  /* ──────────────────────────────────────────────────────────
     README DOWNLOAD
     ────────────────────────────────────────────────────────── */
  function downloadReadmeHandler() {
    const content = latestDocContent || `# Profile Dashboard Feature\n\nAdds a secure, JWT-authenticated profile dashboard allowing users to view and edit their account details.`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('success', 'Download Started', 'Your README.md file is downloading.');
  }

  document.getElementById('download-readme').addEventListener('click', downloadReadmeHandler);

  /* ──────────────────────────────────────────────────────────
     PARTICLE BACKGROUND — lightweight AI network visualization
     ────────────────────────────────────────────────────────── */
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const COUNT = Math.min(70, Math.floor((w * h) / 22000));
    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.6,
      });
    }

    function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      const lineColor = isLight() ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)';
      const dotColor = isLight() ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 1 - dist / 130;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ──────────────────────────────────────────────────────────
     PRELOADER ANIMATION
     ────────────────────────────────────────────────────────── */
  function animatePreloader() {
    const preloader = document.getElementById('preloader');
    const bar = document.getElementById('preloader-bar-fill');
    const percentText = document.getElementById('preloader-percent');
    const logText = document.getElementById('preloader-log');
    if (!preloader) return;

    const logs = [
      'Initializing core system engines...',
      'Loading state mapping schemas...',
      'Resolving Supabase auth session keys...',
      'Subscribing to Band Room event stream...',
      'Establishing Neon PostgreSQL connection...',
      'Pre-compiling workspace templates...',
      'Loading interface configurations...',
      'Systems operational. Entering Control Room.'
    ];

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 8) + 4;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => {
          preloader.style.opacity = '0';
          preloader.style.pointerEvents = 'none';
          setTimeout(() => preloader.style.display = 'none', 500);
        }, 300);
      }

      if (bar) bar.style.width = `${progress}%`;
      if (percentText) percentText.textContent = `${progress}%`;

      const logIndex = Math.min(
        logs.length - 1,
        Math.floor((progress / 100) * logs.length)
      );
      if (logText) logText.textContent = logs[logIndex];
    }, 70);
  }

  /* ──────────────────────────────────────────────────────────
     SIDEBAR AUTH STATE & ACTIONS
     ────────────────────────────────────────────────────────── */
  function updateAuthUI() {
    const authStatusInfo = document.getElementById('auth-status-info');
    const sidebarAuthBtn = document.getElementById('sidebar-auth-btn');
    if (!authStatusInfo || !sidebarAuthBtn) return;

    if (currentSession) {
      authStatusInfo.textContent = currentSession.user.email;
      sidebarAuthBtn.textContent = 'Sign Out';
    } else if (localBypassActive) {
      authStatusInfo.textContent = 'Local Mock Mode';
      sidebarAuthBtn.textContent = 'Sign Out';
    } else {
      authStatusInfo.textContent = 'Not signed in';
      sidebarAuthBtn.textContent = 'Sign In';
    }
  }

  function setupSidebarAuth() {
    const btn = document.getElementById('sidebar-auth-btn');
    if (!btn) return;

    btn.addEventListener('click', async () => {
      if (currentSession || localBypassActive) {
        if (supabase && currentSession) {
          await supabase.auth.signOut();
        }
        currentSession = null;
        localBypassActive = false;
        showToast('info', 'Signed Out', 'You have been signed out.');
        updateAuthUI();
      } else {
        showAuthModal(() => {
          updateAuthUI();
        });
      }
    });
  }

  /* ──────────────────────────────────────────────────────────
     SETTINGS ROOM ID CACHE
     ────────────────────────────────────────────────────────── */
  function setupBandRoomSettings() {
    const bandRoomInput = document.getElementById('band-room-input');
    if (!bandRoomInput) return;

    const savedRoom = localStorage.getItem('agentverse_band_room_id');
    if (savedRoom) {
      bandRoomInput.value = savedRoom;
    }

    bandRoomInput.addEventListener('input', () => {
      localStorage.setItem('agentverse_band_room_id', bandRoomInput.value.trim());
    });

    const bandGuideToggle = document.getElementById('band-guide-toggle');
    const bandGuideContent = document.getElementById('band-guide-content');
    if (bandGuideToggle && bandGuideContent) {
      bandGuideToggle.addEventListener('click', () => {
        const isCollapsed = bandGuideContent.style.display === 'none';
        if (isCollapsed) {
          bandGuideContent.style.display = 'block';
          bandGuideToggle.querySelector('.toggle-icon').style.transform = 'rotate(90deg)';
        } else {
          bandGuideContent.style.display = 'none';
          bandGuideToggle.querySelector('.toggle-icon').style.transform = 'rotate(0deg)';
        }
      });
    }
  }

  /* ──────────────────────────────────────────────────────────
     STATS DETAIL MODALS
     ────────────────────────────────────────────────────────── */
  function setupStatsModal() {
    const overlay = document.getElementById('stats-detail-overlay');
    const closeBtn = document.getElementById('stats-detail-close-btn');
    const title = document.getElementById('stats-detail-title');
    const subtitle = document.getElementById('stats-detail-subtitle');
    const content = document.getElementById('stats-detail-content');

    if (!overlay || !closeBtn || !content) return;

    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('show');
    });

    const cards = [
      { id: 'stat-active-agents', key: 'agents' },
      { id: 'stat-tasks-completed', key: 'tasks' },
      { id: 'stat-success-rate', key: 'success' },
      { id: 'stat-events', key: 'events' }
    ];

    cards.forEach(c => {
      const cardEl = document.getElementById(c.id);
      const parentCard = cardEl ? cardEl.closest('.stat-card') : null;
      if (parentCard) {
        parentCard.addEventListener('click', () => {
          showStatsDetail(c.key, title, subtitle, content);
          overlay.classList.add('show');
        });
      }
    });
  }

  function showStatsDetail(key, title, subtitle, content) {
    if (key === 'agents') {
      title.textContent = 'Agent Activity Status';
      subtitle.textContent = 'Current status of the 7 pipeline agents';
      
      let html = '<div class="stats-detail-list">';
      AGENTS.forEach(a => {
        const s = agentState[a.id] || { state: 'idle', task: 'Idle — waiting on spec' };
        let badgeClass = 'tag-info';
        if (s.state === 'processing') badgeClass = 'tag-spec';
        else if (s.state === 'complete') badgeClass = 'tag-approved';
        else if (s.state === 'rejected') badgeClass = 'tag-rejected';
        
        html += `
          <div class="stats-detail-row">
            <div class="stats-detail-row-title">
              <span>${a.icon}</span>
              <strong>${a.name}</strong>
            </div>
            <div class="stats-detail-row-desc">${s.task}</div>
            <span class="stats-detail-badge ${badgeClass}">${s.state}</span>
          </div>`;
      });
      html += '</div>';
      content.innerHTML = html;
    } else if (key === 'tasks') {
      title.textContent = 'Completed Milestones';
      subtitle.textContent = 'SDLC phases completed in the current run';
      
      const milestones = [
        { title: 'Architecture Specification', desc: 'System blueprints and task matrix generated.', val: '100% Complete' },
        { title: 'Parallel Code Development', desc: 'Frontend React & Backend FastAPI modules drafted.', val: '100% Complete' },
        { title: 'Quality Code Audit', desc: 'Reviewed by Senior Architect. Security verification passed.', val: '100% Complete' },
        { title: 'Automated Test Generation', desc: 'comprehensive unit test suite written with pytest.', val: '100% Complete' },
        { title: 'Technical Documentation', desc: 'Standard development instructions README.md compiled.', val: '100% Complete' },
        { title: 'Final Release Verification', desc: 'All tests passed. System tagged as MERGE_READY.', val: '100% Complete' }
      ];

      let html = '<div class="stats-detail-list">';
      milestones.forEach(m => {
        html += `
          <div class="stats-detail-list-item">
            <div class="stats-detail-item-top">
              <span class="stats-detail-item-title">${m.title}</span>
              <span class="stats-detail-item-val">${m.val}</span>
            </div>
            <div class="stats-detail-item-desc">${m.desc}</div>
          </div>`;
      });
      html += '</div>';
      content.innerHTML = html;
    } else if (key === 'success') {
      title.textContent = 'Pipeline Quality Audit';
      subtitle.textContent = 'Security compliance and quality verification metrics';
      
      const metrics = [
        { title: 'Syntax & Compilation Check', desc: 'Verify all generated source code builds compile correctly.', val: 'PASS' },
        { title: 'Auth / Security Compliance', desc: 'Ensured JWT authentication guards protect all mutation endpoints.', val: 'PASS' },
        { title: 'Code Injection Vulnerabilities', desc: 'Static analysis check for SQLi or command injection risks.', val: '0 Issues' },
        { title: 'Test Coverage Rate', desc: 'Proportion of generated lines validated by the pytest suite.', val: '94% Coverage' },
        { title: 'Orchestrator Retries', desc: 'Number of loop-backs to correct code remediation errors.', val: '1/3 loops' }
      ];

      let html = '<div class="stats-detail-list">';
      metrics.forEach(m => {
        let valColor = 'var(--green)';
        if (m.val === 'PASS') valColor = 'var(--green)';
        else if (m.val.includes('94%')) valColor = 'var(--cyan)';
        
        html += `
          <div class="stats-detail-row">
            <div class="stats-detail-row-title">
              <strong>${m.title}</strong>
            </div>
            <div class="stats-detail-row-desc">${m.desc}</div>
            <span style="font-weight:700; color:${valColor}; font-size:0.85rem;">${m.val}</span>
          </div>`;
      });
      html += '</div>';
      content.innerHTML = html;
    } else if (key === 'events') {
      title.textContent = 'Coordination Events Audit';
      subtitle.textContent = 'Transmitted event count breakdown on the multi-agent bus';
      
      const counts = [
        { title: 'SPEC_GENERATED', desc: 'Emitted by ArchitectAgent with design specifications.', val: '1 event' },
        { title: 'CODE_EMITTED', desc: 'Emitted by FrontendDev & BackendDev agents with code.', val: '2 events' },
        { title: 'CODE_REJECTED', desc: 'Emitted by CodeReviewer due to missing auth guard.', val: '1 event' },
        { title: 'CODE_APPROVED', desc: 'Emitted by CodeReviewer sign-off verification.', val: '1 event' },
        { title: 'TESTS_GENERATED', desc: 'Emitted by QATester with unit tests.', val: '1 event' },
        { title: 'DOCS_GENERATED', desc: 'Emitted by TechWriter with README.md.', val: '1 event' },
        { title: 'FINAL_VERDICT_MERGE_READY', desc: 'Emitted by ReleaseManager to sign off deployment.', val: '1 event' }
      ];

      let html = '<div class="stats-detail-list">';
      counts.forEach(c => {
        html += `
          <div class="stats-detail-row">
            <div class="stats-detail-row-title">
              <strong>${c.title}</strong>
            </div>
            <div class="stats-detail-row-desc">${c.desc}</div>
            <span style="font-family:var(--font-mono); font-weight:600; color:var(--cyan); font-size:0.8rem;">${c.val}</span>
          </div>`;
      });
      html += '</div>';
      content.innerHTML = html;
    }
  }

  /* ──────────────────────────────────────────────────────────
     INIT
     ────────────────────────────────────────────────────────── */
  function init() {
    renderAgentGrid();
    renderPipelineSvg();
    startClock();
    animateCounters();
    initParticles();
    bumpTokens(8400);

    animatePreloader();
    setupSidebarAuth();
    setupBandRoomSettings();
    setupStatsModal();
    updateAuthUI();

    appendLog('tag-info', 'BOOT', 'AgentVerse AI Control Room initialized.', false);
    appendLog('tag-info', 'BOOT', 'Connected to Band room: agentverse-ai-room-01', false);

    setTimeout(ambientTick, 4000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

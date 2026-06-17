/* ════════════════════════════════════════════════════════════
   DEVFLOW AI — CONTROL ROOM
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
  let activePollInterval = null;

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
  /* ──────────────────────────────────────────────────────────
     PIXEL ART SVG HELPER
     ────────────────────────────────────────────────────────── */
  function makePixelArt(gridStr, colors) {
    const lines = gridStr.trim().split('\n');
    let rects = '';
    lines.forEach((line, y) => {
      const pixels = line.trim().split(/\s+/);
      pixels.forEach((pixel, x) => {
        if (pixel !== '.' && colors[pixel]) {
          rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[pixel]}" />`;
        }
      });
    });
    return `<svg viewBox="0 0 16 16" class="agent-char-svg">${rects}</svg>`;
  }

  const AGENTS = [
    { 
      id: 'architect',  
      name: 'Architect Agent',     
      role: 'AI/ML API · High Reasoning', 
      task: 'Awaiting feature request',
      icon: makePixelArt(`
        . . . . . k k k k . . . . . .
        . . . . k r r r r k . . . . .
        . . . k r r r r r r k . . . .
        . . k r o o o o o o r k . . .
        . . k o o o o o o o o k . . .
        . k o o o o o o o o o o k . .
        . k o g g g g g g g g o k . .
        . k r g g g g g g g g r k . .
        . k r k k k k k k k k r k . .
        . k r r r r r r r r r r k . .
        . k r r k r r r r k r r k . .
        . . k r k r r r r k r k . . .
        . . k r r k k k k r r k . . .
        . . . k r r r r r r k . . . .
        . . . . k k k k k k . . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#1e293b', r: '#f43f5e', o: '#fbbf24', g: '#22c55e' })
    },
    { 
      id: 'frontend',   
      name: 'Frontend Agent',      
      role: 'Featherless · React',         
      task: 'Idle — waiting on spec', 
      icon: makePixelArt(`
        . . . k k k k k k . . . . . .
        . . k k k k k k k k . . . . .
        . k k d k d k d k k k . . . .
        . k d d d d d d d d k . . . .
        . k d s s s s s s d k . . . .
        . k s s s s s s s s k . . . .
        . k s k s s s s k s k . . . .
        . k s s s s s s s s k . . . .
        . k w s s s s s s w k . . . .
        . . r k s s s s k r . . . . .
        . . k g k g k g k g . . . . .
        . . g k g k g k g k . . . . .
        . . k g k g k g k g . . . . .
        . . g k g k g k g k . . . . .
        . . . k k k k k k . . . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#111827', d: '#7f1d1d', s: '#ffedd5', g: '#10b981', w: '#ffffff', r: '#ef4444' })
    },
    { 
      id: 'backend',    
      name: 'Backend Agent',       
      role: 'Featherless · FastAPI',       
      task: 'Idle — waiting on spec', 
      icon: makePixelArt(`
        . . . k k . . . . k k . . . .
        . . k p b k . . k b p k . . .
        . k l l d d k k d d l l k . .
        . k l l l d d d d l l l k . .
        . k l l l l l l l l l l k . .
        k l l d d d d d d d d l l k .
        k l d w k d d d d k w d l k .
        k l d y k d d d d k y d l k .
        k l d d d p p p p d d d l k .
        . k d d p p p p p p d d k . .
        . k d d p k d d k p d d k . .
        . . k d d d d d d d d k . . .
        . . . k k d d d d k k . . . .
        . . k b b k k k k b b k . . .
        . . k b b b b b b b b k . . .
        . . . k k k k k k k k . . . .
      `, { k: '#0f172a', l: '#94a3b8', d: '#475569', b: '#2563eb', p: '#f472b6', y: '#facc15', w: '#ffffff' })
    },
    { 
      id: 'reviewer',   
      name: 'Code Reviewer',       
      role: 'AI/ML API · Quality Gate',    
      task: 'Idle — waiting on code', 
      icon: makePixelArt(`
        . . . y y y y y y . . . . . .
        . . y y y y y y y y . . . . .
        . y y y y y y y y y y . . . .
        . y o y o y o y o y y . . . .
        . y o s s s s s s o y . . . .
        . . s s s s s s s s . . . . .
        . . s k s s s s k s . . . . .
        . . s s s s s s s s . . . . .
        . . s s w w w w s s . . . . .
        . . k y k y k y k y . . . . .
        . k y w y w y w y w k . . . .
        . k y y w y y w y y k . . . .
        . k w y y w y y w y k . . . .
        . . k y y y y y y k . . . . .
        . . . k k k k k k . . . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#1e293b', y: '#fbbf24', o: '#f97316', s: '#ffedd5', w: '#ffffff' })
    },
    { 
      id: 'qa',         
      name: 'QA Tester',           
      role: 'Featherless · Test Suite',    
      task: 'Idle — waiting on approval', 
      icon: makePixelArt(`
        . . . . . k k k k . . . . . .
        . . . . k r r r r k . . . . .
        . . . k r r r r r r k . . . .
        . . k r r r r r r r r k . . .
        . . k r r r r r r r r k . . .
        . k r r k k r r k k r r k . .
        . k r r k k k k k k r r k . .
        . k r r k w k k w k r r k . .
        . k r d k k k k k k d r k . .
        . k d d r k k k k r d d k . .
        . . k d r r r r r r d k . . .
        . . . k d d d d d d k . . . .
        . . . k r r k k r r k . . . .
        . . . k r r r r r r k . . . .
        . . . . k k k k k k . . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#0f172a', r: '#dc2626', w: '#ffffff', d: '#7f1d1d' })
    },
    { 
      id: 'writer',     
      name: 'Tech Writer',         
      role: 'Featherless · Docs Gen',      
      task: 'Idle — waiting on tests', 
      icon: makePixelArt(`
        . . k w k . . . . k w k . . .
        . k w p w k . . k w p w k . .
        . k w p w k . . k w p w k . .
        . k w w w k . . k w w w k . .
        . . k w w k k k k w w k . . .
        . k w w w w w w w w w w k . .
        . k w w w w w w w w w w k . .
        . k w k w w w w w w k w k . .
        . k w w w p w w p w w w k . .
        . . k w w w w w w w w k . . .
        . . k b b b b b b b b k . . .
        . k b b b b b b b b b b k . .
        . k b b w w w w w w b b k . .
        . . k b w b b b b w b k . . .
        . . . k k k k k k k k . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#1e293b', w: '#ffffff', p: '#f472b6', b: '#60a5fa' })
    },
    { 
      id: 'release',    
      name: 'Release Manager',     
      role: 'AI/ML API · Final Verdict',   
      task: 'Idle — awaiting docs', 
      icon: makePixelArt(`
        . . . k k k k k k . . . . . .
        . . k k k k k k k k . . . . .
        . k k p p k k p p k k . . . .
        . k k s s s s s s k k . . . .
        . k s s s s s s s s k . . . .
        . k s s s s s s s s k . . . .
        . k s g g g g g g s k . . . .
        . k o k g k k g k o k . . . .
        . k o o s s s s o o k . . . .
        . . k o p p p p o k . . . . .
        . . k p p p p p p k . . . . .
        . k p w p w p w p w k . . . .
        . k p p w p p w p p k . . . .
        . . k p p p p p p k . . . . .
        . . . k k k k k k . . . . . .
        . . . . . . . . . . . . . . .
      `, { k: '#111827', p: '#f472b6', s: '#ffedd5', g: '#10b981', o: '#f97316', w: '#ffffff' })
    }
  ];

  const STATE = { IDLE: 'idle', PROCESSING: 'processing', COMPLETE: 'complete', REJECTED: 'rejected' };

  const STATE_LABELS = {
    idle: 'IDLE', processing: 'PROCESSING', complete: 'COMPLETE', rejected: 'REJECTED'
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

      { agent: ['frontend','backend'], state: STATE.PROCESSING, task: 'Generating component tree from spec', progress: 30,
        logTag: 'tag-info', logMsg: 'Parallel dispatch → FrontendDevAgent + BackendDevAgent', nodes: ['n-frontend', 'n-backend'] },
      { agent: ['frontend','backend'], state: STATE.PROCESSING, task: 'Writing implementation code', progress: 75,
        logTag: 'tag-code', logMsg: 'FrontendDevAgent + BackendDevAgent → drafting source files', nodes: ['n-frontend', 'n-backend'] },
      { agent: ['frontend','backend'], state: STATE.COMPLETE, task: 'CODE_EMITTED — implementation ready for review', progress: 100,
        logTag: 'tag-code', logMsg: 'event: CODE_EMITTED ×2 — ProfileDashboard.jsx, backend.py', nodes: ['n-frontend','n-backend','n-reviewer'], event: 'CODE_EMITTED' },

      { agent: 'reviewer', state: STATE.PROCESSING, task: 'Static analysis + diff review in progress', progress: 50,
        logTag: 'tag-info', logMsg: 'CodeReviewerAgent → analyzing diffs against spec', nodes: ['n-reviewer'] },
      { agent: 'reviewer', state: STATE.REJECTED, task: 'CODE_REJECTED — missing auth guard on PUT /profile', progress: 100,
        logTag: 'tag-rejected', logMsg: 'event: CODE_REJECTED — remediation ticket sent to BackendDevAgent', nodes: ['n-reviewer','n-backend'], event: 'CODE_REJECTED' },

      { agent: 'backend', state: STATE.PROCESSING, task: 'Applying remediation — adding JWT guard dependency', progress: 60,
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
      complete: 'CODE_EMITTED — frontend implementation ready',
      rejected: 'CODE_REJECTED — applying reviewer fixes...'
    },
    backend: {
      idle: 'Idle — waiting on spec',
      processing: 'Writing FastAPI backend code...',
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
        const lowercaseState = dbState.toLowerCase();
        
        let progress = 0;
        if (lowercaseState === 'processing') progress = 60;
        else if (lowercaseState === 'complete') progress = 100;
        else if (lowercaseState === 'rejected') progress = 100;

        const taskText = AGENT_DESC_TEMPLATES[id][lowercaseState] || lowercaseState;
        
        agentState[id] = { state: lowercaseState, task: taskText, progress: progress };
        updateAgentCard(id);
      }
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

      // Helper: safely check if an artifact has content (handles string and object payloads)
      function hasContent(a) {
        if (!a) return false;
        if (typeof a === 'string') return a.trim().length > 0;
        return Object.keys(a).length > 0;
      }
      function ensureObj(a) {
        if (typeof a === 'string') {
          try { return JSON.parse(a); } catch (e) { return a; }
        }
        return a;
      }
      
      if (hasContent(arts.architecture)) {
        const archData = ensureObj(arts.architecture);
        const archEl = document.querySelector('#architecture-tab pre code');
        if (archEl) {
          archEl.innerHTML = highlightJSON(typeof archData === 'string' ? archData : JSON.stringify(archData, null, 2));
        }
      }
      
      if (hasContent(arts.frontend_code)) {
        const feData = ensureObj(arts.frontend_code);
        const badge = document.getElementById('iter-badge-fe');
        if (badge) {
          badge.textContent = `Iteration ${(typeof feData === 'object' && feData.iteration_count) || 1}`;
        }
        const feEl = document.querySelector('#code-tab .code-col:nth-child(1) pre code');
        if (feEl) {
          feEl.innerHTML = highlightJSX(extractCode(feData));
        }
      }
      if (hasContent(arts.backend_code)) {
        const beData = ensureObj(arts.backend_code);
        const badge = document.getElementById('iter-badge-be');
        if (badge) {
          badge.textContent = `Iteration ${(typeof beData === 'object' && beData.iteration_count) || 1}`;
        }
        const beEl = document.querySelector('#code-tab .code-col:nth-child(2) pre code');
        if (beEl) {
          beEl.innerHTML = highlightPython(extractCode(beData));
        }
      }
      
      if (hasContent(arts.tests)) {
        const t = ensureObj(arts.tests);
        if (typeof t === 'object') {
          const fwVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(1) .test-stat-value');
          if (fwVal) fwVal.textContent = t.test_framework || 'pytest';
          
          const fileVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(2) .test-stat-value');
          if (fileVal) fileVal.textContent = t.test_file || 'test_suite.py';
          
          const covVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(3) .test-stat-value');
          if (covVal) covVal.textContent = t.coverage_estimate || 'N/A';
        }
        
        const tCodeEl = document.querySelector('#tests-tab pre code');
        if (tCodeEl) {
          tCodeEl.innerHTML = highlightPython(extractCode(t));
        }
      }
      
      if (hasContent(arts.documentation)) {
        const docData = ensureObj(arts.documentation);
        const docText = typeof docData === 'string' ? docData : (docData.content || '');
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

  async function getSessionDetail(sessionId, headers) {
    const response = await fetch(`/api/sessions/${sessionId}`, { headers });
    if (!response.ok) throw new Error(`Fetch session status error: ${response.status}`);
    return await response.json();
  }

  function startPolling(sessionId, headers) {
    if (activePollInterval) clearInterval(activePollInterval);
    processedEventIds.clear();
    activePollInterval = setInterval(async () => {
      try {
        const state = await getSessionDetail(sessionId, headers);
        updateDashboardFromLiveState(state);

        const status = state.status;
        if (status === 'COMPLETE' || status === 'HOLD' || status === 'ERROR') {
          clearInterval(activePollInterval);
          activePollInterval = null;
          finalizeLiveRun(status, state);
          localStorage.removeItem('devflow_active_session_id'); // Session complete, remove from active recovery
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
      localStorage.setItem('devflow_active_session_id', 'mock-session');

      const feature = featureInput.value.trim();
      const info = getFeatureInfo(feature);
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
      resetAgents();
      resetArtifactHub();
      appendLog('tag-info', 'PIPELINE', 'Trigger received — initializing mock run', false);
      showToast('info', 'Pipeline triggered', 'V7-Twin.ai is processing your feature request.');

      const mockState = {
        session_id: 'mock-session',
        status: 'RUNNING',
        review_cycle: 0,
        agents: {},
        artifacts: {
          architecture: {},
          frontend_code: {},
          backend_code: {},
          tests: {},
          documentation: {}
        },
        events: []
      };
      localStorage.setItem('devflow_mock_state', JSON.stringify(mockState));

      let activeAgentsCount = 1;
      bumpStat('stat-active-agents', activeAgentsCount);

      let reviewCycle = 0;
      for (let i = 0; i < script.length; i++) {
        const step = script[i];
        const agentIds = Array.isArray(step.agent) ? step.agent : [step.agent];

        agentIds.forEach(id => {
          agentState[id] = { state: step.state, task: step.task, progress: step.progress };
          updateAgentCard(id);
          mockState.agents[id] = step.state;
        });

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
          let specData;
          if (info.entity === 'Calculator') {
            specData = {
              "architecture_pattern": "REST + React SPA",
              "frontend_spec": {
                "components": ["Calculator", "CalculatorHistory"],
                "state_hooks": ["useState", "useEffect"]
              },
              "backend_spec": {
                "endpoints": [
                  {
                    "path": "/api/calculator/evaluate",
                    "method": "POST",
                    "description": "Safely evaluate mathematical expressions"
                  }
                ],
                "db_tables": ["calculation_logs"]
              },
              "task_matrix": [
                {
                  "id": "T001",
                  "assigned_to": "FrontendDevAgent",
                  "objective": "Create a fully functional interactive keypad grid and equation screen"
                },
                {
                  "id": "T002",
                  "assigned_to": "BackendDevAgent",
                  "objective": "Implement robust and safe expression parsing routes"
                }
              ]
            };
          } else {
            specData = {
              "architecture_pattern": "REST + React SPA",
              "frontend_spec": {
                "components": [`${info.entity}Header`, `${info.entity}Details`, `${info.entity}Form`],
                "state_hooks": [`use${info.entity}State`, `use${info.entity}Actions`]
              },
              "backend_spec": {
                "framework": "FastAPI",
                "endpoints": [`POST /api/${info.entity.toLowerCase()}`, `GET /api/${info.entity.toLowerCase()}`, `PUT /api/${info.entity.toLowerCase()}`],
                "auth": "JWT Bearer"
              }
            };
          }
          mockState.artifacts.architecture = specData;
          const archEl = document.querySelector('#architecture-tab pre code');
          if (archEl) {
            archEl.innerHTML = highlightJSON(JSON.stringify(specData, null, 2));
          }
          setEdgeFlow('n-input', 'n-architect', false);
          setEdgeFlow('n-architect', 'n-frontend', true);
          setEdgeFlow('n-architect', 'n-backend', true);
        }
        if (step.event === 'CODE_EMITTED') {
          const isIteration2 = step.task.includes('iteration 2') || reviewCycle > 0;
          
          let feCode = '';
          if (info.entity === 'Calculator') {
            feCode = `import React, { useState } from 'react';

export default function Calculator() {
  const [display, setDisplay] = useState('');
  const [result, setResult] = useState('');

  const handleButtonClick = (value) => {
    if (value === '=') {
      try {
        const evalResult = Function('"use strict"; return (' + display + ')')();
        setResult(String(evalResult));
        setDisplay(String(evalResult));
      } catch (err) {
        setResult('Error');
      }
    } else if (value === 'C') {
      setDisplay('');
      setResult('');
    } else {
      setDisplay(prev => prev + value);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl">
      <h3 className="text-xl font-bold text-cyan-400 mb-4 text-center">React Calculator</h3>
      <div className="bg-slate-950 p-4 rounded-lg mb-4 text-right min-h-[60px] border border-slate-800">
        <div className="text-slate-400 text-sm overflow-x-auto whitespace-nowrap">{display || '0'}</div>
        <div className="text-2xl font-bold text-white mt-1">{result}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', 'C', '=', '+'].map(btn => (
          <button
            key={btn}
            onClick={() => handleButtonClick(btn)}
            className={\`p-4 text-lg font-bold rounded-lg transition-all \${
              btn === '=' 
                ? 'bg-cyan-500 hover:bg-cyan-600 text-slate-950' 
                : btn === 'C'
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                : 'bg-slate-800 hover:bg-slate-700 text-white'
            }\`}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  );
}`;
          } else {
            feCode = `function ${info.entity}Dashboard() {
  const [data, setData] = useState(null);
  const { token } = useAuthToken();

  useEffect(() => {
    fetch${info.entity}Data(token).then(setData);
  }, [token]);

  if (!data) return <Spinner />;

  return (
    <AuthGuard>
      <\${info.entity}Details data={data} />
      <\${info.entity}Form onSubmit={save\${info.entity}} />
    </AuthGuard>
  );
}`;
          }
          const feCodeData = {
            file_target: info.entity === 'Calculator' ? 'Calculator.jsx' : `${info.entity}Dashboard.jsx`,
            language: "react",
            source_code: feCode,
            iteration_count: isIteration2 ? 2 : 1
          };
          mockState.artifacts.frontend_code = feCodeData;
          const feEl = document.querySelector('#code-tab .code-col:nth-child(1) pre code');
          if (feEl) {
            feEl.innerHTML = highlightJSX(feCode);
          }

          let beCode = '';
          if (info.entity === 'Calculator') {
            beCode = `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Calculator API")

class CalculationRequest(BaseModel):
    expression: str

class CalculationResponse(BaseModel):
    result: float
    expression: str

@app.post("/api/calculator/evaluate", response_model=CalculationResponse)
def evaluate_expression(req: CalculationRequest):
    allowed_chars = set("0123456789+-*/.() ")
    if not set(req.expression).issubset(allowed_chars):
        raise HTTPException(status_code=400, detail="Invalid characters in expression")
    try:
        res = eval(req.expression, {"__builtins__": None}, {})
        return CalculationResponse(result=float(res), expression=req.expression)
    except ZeroDivisionError:
        raise HTTPException(status_code=400, detail="Division by zero")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mathematical expression")`;
          } else {
            if (isIteration2) {
              beCode = `@app.put("/${info.entity.toLowerCase()}")
async def update_${info.entity.toLowerCase()}(
    payload: ${info.entity}Update,
    user: User = Depends(get_current_user)
):
    # JWT-validated mutation (Iteration 2 Patch)
    updated = await db.${info.entity.toLowerCase()}s.update(
        {"user_id": user.id},
        payload.dict()
    )
    return {"status": "ok", "${info.entity.toLowerCase()}": updated}`;
            } else {
              beCode = `@app.put("/${info.entity.toLowerCase()}")
async def update_${info.entity.toLowerCase()}(
    payload: ${info.entity}Update
):
    # Vulnerable mutation: no auth guard check (Iteration 1)
    updated = await db.${info.entity.toLowerCase()}s.update(
        {"user_id": payload.user_id},
        payload.dict()
    )
    return {"status": "ok", "${info.entity.toLowerCase()}": updated}`;
            }
          }

          const beCodeData = {
            file_target: "routes.py",
            language: "python",
            source_code: beCode,
            iteration_count: isIteration2 ? 2 : 1
          };
          mockState.artifacts.backend_code = beCodeData;
          const beEl = document.querySelector('#code-tab .code-col:nth-child(2) pre code');
          if (beEl) {
            beEl.innerHTML = highlightPython(beCode);
          }

          const feBadge = document.getElementById('iter-badge-fe');
          if (feBadge) feBadge.textContent = isIteration2 ? 'Iteration 2' : 'Iteration 1';
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
          mockState.review_cycle = reviewCycle;
        }
        if (step.event === 'TESTS_GENERATED') {
          let testCode = '';
          if (info.entity === 'Calculator') {
            testCode = `import pytest
from fastapi.testclient import TestClient
from routes import app

client = TestClient(app)

def test_evaluate_addition():
    response = client.post("/api/calculator/evaluate", json={"expression": "2 + 2"})
    assert response.status_code == 200
    assert response.json()["result"] == 4.0

def test_evaluate_division_by_zero():
    response = client.post("/api/calculator/evaluate", json={"expression": "10 / 0"})
    assert response.status_code == 400
    assert "division by zero" in response.json()["detail"].lower()`;
          } else {
            testCode = `def test_update_${info.entity.toLowerCase()}_requires_auth():
    response = client.put("/${info.entity.toLowerCase()}", json={})
    assert response.status_code == 401

def test_update_${info.entity.toLowerCase()}_success(auth_headers):
    response = client.put(
        "/${info.entity.toLowerCase()}",
        json={"name": "${info.entity} Test"},
        headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    # PASSED — 0.04s`;
          }
          const testData = {
            test_framework: "pytest",
            test_file: info.entity === 'Calculator' ? 'test_calculator_api.py' : `test_${info.entity.toLowerCase()}_api.py`,
            coverage_estimate: "94%",
            source_code: testCode
          };
          mockState.artifacts.tests = testData;
          const tCodeEl = document.querySelector('#tests-tab pre code');
          if (tCodeEl) {
            tCodeEl.innerHTML = highlightPython(testCode);
          }
          const fwVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(1) .test-stat-value');
          if (fwVal) fwVal.textContent = 'pytest';
          const fileVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(2) .test-stat-value');
          if (fileVal) fileVal.textContent = testData.test_file;
          const covVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(3) .test-stat-value');
          if (covVal) covVal.textContent = '94%';

          setEdgeFlow('n-qa', 'n-writer', true);
        }
        if (step.event === 'DOCS_GENERATED') {
          let docText = '';
          if (info.entity === 'Calculator') {
            docText = `# Calculator Service\n\nEvaluates mathematical expressions safely.\n\n## Endpoints\n- \`POST /api/calculator/evaluate\` — evaluates mathematical expressions safely.\n\n## Frontend Components\n\`Calculator\` UI panel with interactive grid keypad.`;
          } else {
            docText = `# ${info.entity} Feature\n\nAdds a secure, JWT-authenticated ${info.entity.toLowerCase()} service allowing users to manage their ${info.entity.toLowerCase()} details.\n\n## Endpoints\n- \`POST /auth/login\` — returns a signed JWT bearer token\n- \`GET /${info.entity.toLowerCase()}\` — returns the authenticated user's ${info.entity.toLowerCase()}\n- \`PUT /${info.entity.toLowerCase()}\` — updates ${info.entity.toLowerCase()} fields, JWT-validated\n\n## Frontend Components\n\`${info.entity}Dashboard\`, \`AuthGuard\`, and \`${info.entity}Form\` compose the client experience, backed by \`useAuthToken\` and \`use${info.entity}Data\` hooks.`;
          }
          latestDocContent = docText;
          mockState.artifacts.documentation = { content: docText };
          const mdRenderEl = document.querySelector('#docs-tab .markdown-render');
          if (mdRenderEl) {
            const buttonHtml = `
              <button type="button" class="btn-download" id="download-readme">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                Download README.md
              </button>`;
            mdRenderEl.innerHTML = formatMarkdown(docText) + buttonHtml;
            
            // Re-bind click handler
            const dlBtn = document.getElementById('download-readme');
            if (dlBtn) dlBtn.addEventListener('click', downloadReadmeHandler);
          }
          setEdgeFlow('n-qa', 'n-release', true);
        }

        if (step.logMsg) {
          appendLog(step.logTag, eventTagLabel(step), step.logMsg, false);
          mockState.events.push({
            event_id: `mock-evt-${i}-${Date.now()}`,
            event_type: step.event || 'INFO',
            sender: step.agent ? (Array.isArray(step.agent) ? step.agent[0] : step.agent) : 'Orchestrator',
            timestamp: new Date().toISOString(),
            payload_data: { message: step.logMsg }
          });
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

        // Save local state
        localStorage.setItem('devflow_mock_state', JSON.stringify(mockState));

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

      mockState.status = 'COMPLETE';
      localStorage.setItem('devflow_mock_state', JSON.stringify(mockState));
      localStorage.removeItem('devflow_active_session_id'); // mock complete

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
        resetArtifactHub();
        
        appendLog('tag-info', 'PIPELINE', 'Sending feature trigger to API Gateway...', false);
        showToast('info', 'Pipeline Triggered', 'V7-Twin.ai is triggering backend agents.');

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
          localStorage.setItem('devflow_active_session_id', sessionId); // Save active session ID for reload recovery
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

  /* ──────────────────────────────────────────────────────────
     AMBIENT CONSOLE FEED (idle simulation before trigger)
     ────────────────────────────────────────────────────────── */
  const AMBIENT_LOGS = [
    { tag: 'tag-info', text: 'Band bus heartbeat — room: devflow-ai-room-01 — OK' },
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
  /* ──────────────────────────────────────────────────────────
     SIDEBAR COLLAPSE
     ────────────────────────────────────────────────────────── */
  function setupSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    if (!sidebar || !collapseBtn) return;

    const savedState = localStorage.getItem('devflow_sidebar_collapsed');
    if (savedState === 'true') {
      sidebar.classList.add('collapsed');
    }

    collapseBtn.addEventListener('click', () => {
      const isCollapsed = sidebar.classList.toggle('collapsed');
      localStorage.setItem('devflow_sidebar_collapsed', isCollapsed);
      window.dispatchEvent(new Event('resize'));
    });
  }

  /* ──────────────────────────────────────────────────────────
     SIDEBAR AUTH STATE & ACTIONS
     ────────────────────────────────────────────────────────── */
  function updateAuthUI() {
    const sidebarAuth = document.getElementById('sidebar-auth');
    if (!sidebarAuth) return;
    
    let email = '';
    let name = '';
    let initials = '';
    let signedIn = false;
    
    if (currentSession) {
      email = currentSession.user.email;
      signedIn = true;
    } else if (localBypassActive) {
      email = 'developer@devflow.ai';
      signedIn = true;
    }
    
    if (signedIn) {
      if (email === 'vasantansh@gmail.com') {
        name = 'Ansh Vasant';
        initials = 'AV';
      } else {
        const parts = email.split('@');
        const namePart = parts[0];
        const nameSubparts = namePart.split(/[._-]/);
        name = nameSubparts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        initials = nameSubparts.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 2);
        if (!initials) initials = 'DV';
      }
      
      sidebarAuth.innerHTML = `
        <div class="account-profile">
          <div class="account-avatar" title="${name}">${initials}</div>
          <div class="account-info">
            <div class="account-name" title="${name}">${name}</div>
            <div class="account-email" title="${email}">${email}</div>
          </div>
        </div>
        <button type="button" class="sidebar-auth-btn account-logout-btn" id="sidebar-auth-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          <span>Sign Out</span>
        </button>
      `;
    } else {
      sidebarAuth.innerHTML = `
        <div class="account-profile">
          <div class="account-avatar guest"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <div class="account-info">
            <div class="account-name">Guest User</div>
            <div class="account-email">Not signed in</div>
          </div>
        </div>
        <button type="button" class="sidebar-auth-btn account-login-btn" id="sidebar-auth-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
          <span>Sign In</span>
        </button>
      `;
    }
    
    // Toggle history navigation and load history if signed in
    const navHistory = document.getElementById('nav-history');
    const historySection = document.getElementById('history');
    if (signedIn) {
      if (navHistory) navHistory.style.display = '';
      loadHistory();
    } else {
      if (navHistory) navHistory.style.display = 'none';
      if (historySection) historySection.style.display = 'none';
      const activeNav = document.querySelector('.nav-item.active');
      if (activeNav && activeNav.dataset.section === 'history') {
        const dashNav = document.querySelector('.nav-item[data-section="dashboard"]');
        if (dashNav) dashNav.click();
      }
    }
    
    // Rebind event listener since we replaced innerHTML
    setupSidebarAuthListeners();
  }

  function setupSidebarAuthListeners() {
    const btn = document.getElementById('sidebar-auth-btn');
    if (!btn) return;

    btn.replaceWith(btn.cloneNode(true)); // Clear previous listeners
    const cleanBtn = document.getElementById('sidebar-auth-btn');
    
    cleanBtn.addEventListener('click', async () => {
      if (currentSession || localBypassActive) {
        if (supabase && currentSession) {
          await supabase.auth.signOut();
        }
        currentSession = null;
        localBypassActive = false;
        localStorage.removeItem('devflow_active_session_id'); // Clear active session on signout
        showToast('info', 'Signed Out', 'You have been signed out.');
        updateAuthUI();
      } else {
        showAuthModal(() => {
          updateAuthUI();
          // Try to recover sessions for this newly signed-in user
          recoverSession();
        });
      }
    });
  }

  function setupSidebarAuth() {
    setupSidebarAuthListeners();
  }

  /* ──────────────────────────────────────────────────────────
     ROBUST CODE EXTRACTOR
     ────────────────────────────────────────────────────────── */
  function extractCode(payload) {
    if (!payload) return '';
    
    // If payload is a string containing JSON or raw text
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return extractCode(parsed);
      } catch (e) {
        // Regex search inside stringified JSON
        const match = payload.match(/"source_code"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (match) {
          try {
            return JSON.parse(`"${match[1]}"`);
          } catch (err) {
            return match[1];
          }
        }
        return payload; // fallback to raw string
      }
    }
    
    // If payload is an object containing code
    if (payload.source_code) {
      let code = payload.source_code;
      if (typeof code === 'string' && code.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(code);
          if (parsed.source_code) {
            return parsed.source_code;
          }
        } catch (e) {
          const match = code.match(/"source_code"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (match) {
            try {
              return JSON.parse(`"${match[1]}"`);
            } catch (err) {
              return match[1];
            }
          }
        }
      }
      return code;
    }
    
    if (payload.content) return payload.content;
    
    return JSON.stringify(payload, null, 2);
  }

  /* ──────────────────────────────────────────────────────────
     DYNAMIC MOCK DETAILS GENERATOR
     ────────────────────────────────────────────────────────── */
  function getFeatureInfo(prompt) {
    const text = (prompt || '').toLowerCase().trim();
    let entity = 'Profile';
    let desc = 'secure user profile dashboard allowing account editing';
    
    if (text.includes('cart') || text.includes('shop') || text.includes('checkout') || text.includes('order')) {
      entity = 'Cart';
      desc = 'e-commerce shopping cart with real-time checkout and stock validation';
    } else if (text.includes('todo') || text.includes('task') || text.includes('list')) {
      entity = 'Todo';
      desc = 'collaborative project task board and list filtering system';
    } else if (text.includes('chat') || text.includes('message') || text.includes('room') || text.includes('slack')) {
      entity = 'Chat';
      desc = 'multi-channel encrypted real-time chat room and notification center';
    } else if (text.includes('auth') || text.includes('login') || text.includes('register') || text.includes('signup')) {
      entity = 'Auth';
      desc = 'JWT-authenticated user registration, login, and MFA security gateway';
    } else if (text.includes('payment') || text.includes('billing') || text.includes('stripe') || text.includes('invoice')) {
      entity = 'Payment';
      desc = 'Stripe-integrated subscription billing portal and invoice processor';
    } else {
      const words = text.split(/\s+/).filter(w => w.length > 2 && !['add', 'build', 'create', 'make', 'new'].includes(w));
      if (words.length > 0) {
        entity = words[0].charAt(0).toUpperCase() + words[0].slice(1).replace(/[^a-zA-Z]/g, '');
      }
      if (prompt) {
        desc = prompt;
      }
    }
    return { entity, desc };
  }

  /* ──────────────────────────────────────────────────────────
     RESET ARTIFACT HUB TO LOADING PLACEHOLDERS
     ────────────────────────────────────────────────────────── */
  function resetArtifactHub() {
    const archEl = document.querySelector('#architecture-tab pre code');
    if (archEl) archEl.innerHTML = '<span class="tok-comment">// Awaiting architecture specification...</span>';

    const feEl = document.querySelector('#code-tab .code-col:nth-child(1) pre code');
    if (feEl) feEl.innerHTML = '<span class="tok-comment">// Awaiting React components...</span>';

    const beEl = document.querySelector('#code-tab .code-col:nth-child(2) pre code');
    if (beEl) beEl.innerHTML = '<span class="tok-comment"># Awaiting backend implementation...</span>';

    const tCodeEl = document.querySelector('#tests-tab pre code');
    if (tCodeEl) tCodeEl.innerHTML = '<span class="tok-comment"># Awaiting QA test generation...</span>';

    const mdRenderEl = document.querySelector('#docs-tab .markdown-render');
    if (mdRenderEl) {
      mdRenderEl.innerHTML = `
        <h3>Awaiting Documentation</h3>
        <p>Markdown documentation will render here once TechWriterAgent completes the documentation phase.</p>
      `;
    }
    
    const feBadge = document.getElementById('iter-badge-fe');
    if (feBadge) feBadge.textContent = 'Awaiting...';
    const beBadge = document.getElementById('iter-badge-be');
    if (beBadge) beBadge.textContent = 'Awaiting...';
    
    const fwVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(1) .test-stat-value');
    if (fwVal) fwVal.textContent = '...';
    const fileVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(2) .test-stat-value');
    if (fileVal) fileVal.textContent = '...';
    const covVal = document.querySelector('#tests-tab .test-summary .test-stat:nth-child(3) .test-stat-value');
    if (covVal) covVal.textContent = '...';
  }

  /* ──────────────────────────────────────────────────────────
     SESSION STATE RECOVERY
     ────────────────────────────────────────────────────────── */
  async function recoverSession() {
    const activeSessionId = localStorage.getItem('devflow_active_session_id');
    if (!activeSessionId) {
      if (currentSession) {
        try {
          const headers = { 'Content-Type': 'application/json' };
          headers['Authorization'] = `Bearer ${currentSession.access_token}`;
          const response = await fetch('/api/sessions', { headers });
          if (response.ok) {
            const sessions = await response.json();
            if (sessions && sessions.length > 0) {
              const latestSession = sessions[0];
              const state = await getSessionDetail(latestSession.session_id, headers);
              updateDashboardFromLiveState(state);
              localStorage.setItem('devflow_active_session_id', latestSession.session_id);
            }
          }
        } catch (e) {
          console.error("Failed to recover user history:", e);
        }
      }
      return;
    }

    if (activeSessionId === 'mock-session') {
      try {
        const mockStateStr = localStorage.getItem('devflow_mock_state');
        if (mockStateStr) {
          const mockState = JSON.parse(mockStateStr);
          updateDashboardFromLiveState(mockState);
        }
      } catch (e) {
        console.error("Failed to restore mock state:", e);
      }
      return;
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentSession) {
        headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      } else if (localBypassActive) {
        headers['Authorization'] = `Bearer bypass-local-auth`;
      }

      const state = await getSessionDetail(activeSessionId, headers);
      if (state && Object.keys(state).length > 0) {
        updateDashboardFromLiveState(state);
        
        if (state.status === 'RUNNING') {
          pipelineRunning = true;
          triggerBtn.classList.add('is-loading');
          triggerBtn.querySelector('span').textContent = 'Running...';
          startPolling(activeSessionId, headers);
        }
      } else {
        localStorage.removeItem('devflow_active_session_id');
      }
    } catch (e) {
      console.error("Failed to recover session details:", e);
    }
  }

  /* ──────────────────────────────────────────────────────────
     USER SESSION HISTORY ACTIONS
     ────────────────────────────────────────────────────────── */
  async function loadHistory() {
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const historyLoading = document.getElementById('history-loading');
    if (!historyList) return;

    if (historyLoading) historyLoading.style.display = 'block';
    if (historyEmpty) historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentSession) {
        headers['Authorization'] = `Bearer ${currentSession.access_token}`;
      } else if (localBypassActive) {
        headers['Authorization'] = `Bearer bypass-local-auth`;
      } else {
        if (historyLoading) historyLoading.style.display = 'none';
        if (historyEmpty) historyEmpty.style.display = 'block';
        return;
      }

      const response = await fetch('/api/sessions', { headers });
      if (!response.ok) throw new Error(`Fetch history error: ${response.status}`);
      const sessions = await response.json();

      if (historyLoading) historyLoading.style.display = 'none';

      if (!sessions || sessions.length === 0) {
        if (historyEmpty) historyEmpty.style.display = 'block';
        return;
      }

      if (historyEmpty) historyEmpty.style.display = 'none';
      historyList.innerHTML = sessions.map(s => {
        const dateStr = new Date(s.created_at).toLocaleString();
        const status = s.status || 'IDLE';
        const isComplete = status === 'COMPLETE';
        const isRunning = status === 'RUNNING' || status === 'PROCESSING';
        const badgeColor = isComplete ? 'var(--green)' : (isRunning ? 'var(--cyan)' : 'var(--red)');
        return `
          <div class="history-card glass-card" data-session-id="${s.session_id}">
            <div class="history-card-header">
              <span class="history-card-date">${dateStr}</span>
              <span class="badge" style="background:${badgeColor}20; color:${badgeColor}; border: 1px solid ${badgeColor}40; font-size:0.75rem; padding: 2px 6px;">${status}</span>
            </div>
            <div class="history-card-prompt">"${s.prompt}"</div>
            <div class="history-card-footer">
              <span class="history-card-id">ID: ${s.session_id.substring(0, 8)}...</span>
              <button class="btn btn-secondary load-session-btn" style="padding: 4px 10px; font-size: 0.8rem; background: var(--bg-elevated); border-color: var(--border-strong);">Load Run</button>
            </div>
          </div>
        `;
      }).join('');

      historyList.querySelectorAll('.history-card').forEach(card => {
        const loadBtn = card.querySelector('.load-session-btn');
        loadBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const sessionId = card.dataset.sessionId;
          await selectHistorySession(sessionId);
        });
        card.addEventListener('click', async () => {
          const sessionId = card.dataset.sessionId;
          await selectHistorySession(sessionId);
        });
      });

    } catch (e) {
      console.error("Failed to load history:", e);
      if (historyLoading) historyLoading.style.display = 'none';
      historyList.innerHTML = `<div style="color:var(--red); padding:20px; text-align:center; font-size: 0.9rem;">Failed to load history: ${e.message}</div>`;
    }
  }

  async function selectHistorySession(sessionId) {
    if (activePollInterval) {
      clearInterval(activePollInterval);
      activePollInterval = null;
    }
    
    processedEventIds.clear();
    const consoleLog = document.getElementById('status-text');
    if (consoleLog) consoleLog.innerHTML = '';
    
    const headers = { 'Content-Type': 'application/json' };
    if (currentSession) {
      headers['Authorization'] = `Bearer ${currentSession.access_token}`;
    } else if (localBypassActive) {
      headers['Authorization'] = `Bearer bypass-local-auth`;
    }

    try {
      showToast('info', 'Loading historic run...');
      const state = await getSessionDetail(sessionId, headers);
      updateDashboardFromLiveState(state);
      localStorage.setItem('devflow_active_session_id', sessionId);
      
      if (state.status === 'RUNNING' || state.status === 'PROCESSING') {
        pipelineRunning = true;
        triggerBtn.classList.add('is-loading');
        triggerBtn.querySelector('span').textContent = 'Running...';
        startPolling(sessionId, headers);
      } else {
        triggerBtn.classList.remove('is-loading');
        triggerBtn.querySelector('span').textContent = 'Trigger Pipeline';
        pipelineRunning = false;
      }
      
      const dashNav = document.querySelector('.nav-item[data-section="dashboard"]');
      if (dashNav) {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        dashNav.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      showToast('success', 'Run loaded successfully.');
    } catch (e) {
      console.error("Failed to load history session:", e);
      showToast('error', `Failed to load session: ${e.message}`);
    }
  }

  async function clearUserHistory() {
    if (!confirm('Are you sure you want to clear your entire session history? This will delete all past runs, events, and artifacts.')) {
      return;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (currentSession) {
      headers['Authorization'] = `Bearer ${currentSession.access_token}`;
    } else if (localBypassActive) {
      headers['Authorization'] = `Bearer bypass-local-auth`;
    } else {
      return;
    }

    try {
      const response = await fetch('/api/sessions/clear', {
        method: 'POST',
        headers
      });
      if (!response.ok) throw new Error(`Clear history failed: ${response.status}`);
      
      showToast('success', 'Session history cleared.');
      localStorage.removeItem('devflow_active_session_id');
      
      processedEventIds.clear();
      if (activePollInterval) {
        clearInterval(activePollInterval);
        activePollInterval = null;
      }
      pipelineRunning = false;
      triggerBtn.classList.remove('is-loading');
      triggerBtn.querySelector('span').textContent = 'Trigger Pipeline';
      
      const consoleLog = document.getElementById('status-text');
      if (consoleLog) consoleLog.innerHTML = '';
      
      AGENTS.forEach(a => {
        agentState[a.id] = { state: STATE.IDLE, task: a.task, progress: 0 };
        updateAgentCard(a.id);
      });
      updateVisualizationFromStates({}, 0);
      setPipelineStatePill('IDLE', '');
      
      await loadHistory();
      
    } catch (e) {
      console.error("Failed to clear history:", e);
      showToast('error', `Failed to clear history: ${e.message}`);
    }
  }

  /* ──────────────────────────────────────────────────────────
     SETTINGS ROOM ID CACHE
     ────────────────────────────────────────────────────────── */
  function setupBandRoomSettings() {
    const bandRoomInput = document.getElementById('band-room-input');
    if (!bandRoomInput) return;

    // Force the default live Band Room ID
    bandRoomInput.value = '3f060ffa-8a5e-487b-b462-5669677baf03';

    const copyBtn = document.getElementById('copy-band-id-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText('3f060ffa-8a5e-487b-b462-5669677baf03').then(() => {
          showToast('success', 'Room ID Copied', 'Band Room ID copied to clipboard.');
        }).catch(err => {
          console.error('Failed to copy Room ID: ', err);
          showToast('error', 'Copy Failed', 'Failed to copy Room ID to clipboard.');
        });
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
    setupSidebarCollapse();
    setupSidebarAuth();
    setupBandRoomSettings();
    setupStatsModal();
    updateAuthUI();
    recoverSession();

    const clearHistoryBtn = document.getElementById('clear-history-btn');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', clearUserHistory);
    }

    appendLog('tag-info', 'BOOT', 'V7-Twin.ai Platform initialized.', false);
    appendLog('tag-info', 'BOOT', 'Connected to Band room: devflow-ai-room-01', false);

    setTimeout(ambientTick, 4000);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

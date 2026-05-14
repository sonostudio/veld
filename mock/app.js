/* =========================================================
   OAK STUDIO — shared app logic
   ========================================================= */

const ICONS = {
  dashboard: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="2" width="5.5" height="5.5" rx="1"/><rect x="2" y="8.5" width="5.5" height="5.5" rx="1"/><rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1"/></svg>',
  camera: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="4" width="13" height="9" rx="1.5"/><circle cx="8" cy="8.5" r="2.5"/><rect x="5" y="2.5" width="6" height="1.5" rx="0.5" fill="currentColor" stroke="none"/></svg>',
  osc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2"/><path d="M4 4 L4 12 M12 4 L12 12 M2 8 L4 8 M12 8 L14 8" stroke-linecap="round"/><circle cx="4" cy="4" r="0.8" fill="currentColor"/><circle cx="12" cy="4" r="0.8" fill="currentColor"/><circle cx="4" cy="12" r="0.8" fill="currentColor"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/></svg>',
  model: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="3" width="10" height="10" rx="1"/><line x1="6" y1="3" x2="6" y2="13"/><line x1="10" y1="3" x2="10" y2="13"/><line x1="3" y1="6" x2="13" y2="6"/><line x1="3" y1="10" x2="13" y2="10"/></svg>',
  network: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><ellipse cx="8" cy="8" rx="3" ry="6"/><line x1="2" y1="8" x2="14" y2="8"/></svg>',
  system: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2"/><path d="M8 1.5 L8 3.5 M8 12.5 L8 14.5 M1.5 8 L3.5 8 M12.5 8 L14.5 8 M3.5 3.5 L5 5 M11 11 L12.5 12.5 M3.5 12.5 L5 11 M11 5 L12.5 3.5"/></svg>',
};

const NAV = [
  { id: 'dashboard',     label: 'Dashboard',     icon: 'dashboard', href: 'dashboard.html' },
  { id: 'cameras',       label: 'Cameras',       icon: 'camera',    href: 'cameras.html' },
  { id: 'osc',           label: 'OSC output',    icon: 'osc',       href: 'osc.html' },
  { id: 'models',        label: 'Custom models', icon: 'model',     href: 'models.html' },
  { id: 'network',       label: 'Network',       icon: 'network',   href: 'network.html' },
  { id: 'system',        label: 'System',        icon: 'system',    href: 'system.html' },
];

function renderSidebar(activeId) {
  const navHTML = NAV.map(item => `
    <a class="nav-item ${item.id === activeId ? 'active' : ''}" href="${item.href}">
      <span class="icon">${ICONS[item.icon]}</span>
      <span>${item.label}</span>
    </a>
  `).join('');

  return `
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-dot"></span>
        <span class="brand-name">oak studio</span>
      </div>
      ${navHTML}
      <div class="sidebar-footer">
        <div class="muted" style="margin-bottom:4px">device</div>
        <div class="ip">192.168.1.42</div>
        <div style="margin-top:6px"><span class="status">online · 4h 23m</span></div>
      </div>
    </aside>
  `;
}

function mount(activeId, mainHTML) {
  const root = document.getElementById('app-root') || document.body;
  root.innerHTML = `
    <div class="app">
      ${renderSidebar(activeId)}
      <main class="main">${mainHTML}</main>
    </div>
  `;
}

/* =========================================================
   MOCK STATE  (in-memory, reset on reload)
   ========================================================= */

const MOCK = {
  device: {
    ip: '192.168.1.42',
    uptime_s: 15780,
    cpu: 38,
    mem: 42,
    temp: 52,
    cameras_connected: 2,
  },
  cameras: [
    {
      id: 1, model: 'OAK-D Pro', status: 'online', fps: 28, latency: 32,
      active_models: ['pose', 'depth', 'object'],
      issue: null,
    },
    {
      id: 2, model: 'OAK-D Pro', status: 'online', fps: 30, latency: 28,
      active_models: ['motion', 'depth'],
      issue: null,
    },
    {
      id: 3, model: 'OAK-D Pro', status: 'online', fps: 14, latency: 71,
      active_models: ['pose', 'hand', 'face', 'gaze'],
      issue: 'Low FPS — too many Pi-side models active',
    },
    {
      id: 4, model: 'OAK-D Pro', status: 'offline', fps: 0, latency: 0,
      active_models: [],
      issue: 'Camera disconnected',
    },
  ],
  models: [
    { id: 'pose',    name: 'Pose estimation',     tier: 'both', runtime: 'VPU', enabled_on: [1, 3] },
    { id: 'depth',   name: 'Depth map',           tier: 'both', runtime: 'VPU', enabled_on: [1, 2] },
    { id: 'blob',    name: 'Blob / contour',      tier: 'both', runtime: 'VPU', enabled_on: [] },
    { id: 'motion',  name: 'Motion detection',    tier: 'both', runtime: 'VPU', enabled_on: [2] },
    { id: 'object',  name: 'Object detection',    tier: 'both', runtime: 'VPU', enabled_on: [1] },
    { id: 'hand',    name: 'Hand tracking',       tier: 'pro',  runtime: 'Pi',  enabled_on: [3] },
    { id: 'face',    name: 'Face detection',      tier: 'pro',  runtime: 'VPU', enabled_on: [3] },
    { id: 'flandmarks', name: 'Face landmarks',   tier: 'pro',  runtime: 'Pi',  enabled_on: [] },
    { id: 'gaze',    name: 'Eye / gaze tracking', tier: 'pro',  runtime: 'Pi',  enabled_on: [3] },
    { id: 'count',   name: 'Person count',        tier: 'both', runtime: 'VPU', enabled_on: [] },
    { id: 'flow',    name: 'Optical flow',        tier: 'both', runtime: 'VPU', enabled_on: [] },
    { id: 'gesture', name: 'Skeleton gestures',   tier: 'both', runtime: 'Pi',  enabled_on: [] },
    { id: 'bgsub',   name: 'Background subtraction', tier: 'both', runtime: 'VPU', enabled_on: [] },
    { id: 'color',   name: 'Color detection',     tier: 'both', runtime: 'VPU', enabled_on: [] },
  ],
  osc: {
    target_ip: '192.168.1.100',
    target_port: 7000,
    fps: 30,
    address_prefix: '/oak',
    messages_per_sec: 1247,
  },
  custom_models: [
    { id: 'cm-01', name: 'red_ball_v3',     status: 'deployed', classes: ['red_ball'],            trained: '2 days ago',  size: '4.2 MB', deployed_to: [1, 2] },
    { id: 'cm-02', name: 'gallery_objects', status: 'ready',    classes: ['painting', 'sculpture', 'visitor'], trained: '6 hours ago', size: '6.8 MB', deployed_to: [] },
    { id: 'cm-03', name: 'dancer_props_v2', status: 'training', classes: ['ribbon', 'mask', 'fan'], trained: '—',           size: '—',      deployed_to: [], progress: 64 },
    { id: 'cm-04', name: 'red_ball_v2',     status: 'archived', classes: ['red_ball'],            trained: '1 week ago',  size: '4.1 MB', deployed_to: [] },
  ],
  network: {
    mode: 'ethernet',
    fixed_ip: '192.168.1.42',
    gateway: '192.168.1.1',
    netmask: '255.255.255.0',
    dns: '1.1.1.1',
    wifi_ssid: 'studio-net-5g',
    wifi_connected: false,
  },
  system: {
    hostname: 'oak-studio-pi',
    version: '0.4.2',
    serial: 'OS-PRO-00042',
    license_tier: 'Studio Pro',
    disk_free_gb: 18.4,
    disk_total_gb: 32,
  },
};

/* =========================================================
   LIVE TICKERS — fake "real-time" data updates
   ========================================================= */

function jitter(base, range) {
  return Math.max(0, Math.round(base + (Math.random() - 0.5) * range));
}

function tickFPS() {
  document.querySelectorAll('[data-tick="fps"]').forEach(el => {
    const camId = parseInt(el.dataset.camId, 10);
    const cam = MOCK.cameras.find(c => c.id === camId);
    if (!cam || cam.status === 'offline') return;
    const newFps = jitter(cam.fps, 2);
    el.textContent = newFps;
  });

  document.querySelectorAll('[data-tick="latency"]').forEach(el => {
    const camId = parseInt(el.dataset.camId, 10);
    const cam = MOCK.cameras.find(c => c.id === camId);
    if (!cam || cam.status === 'offline') return;
    el.textContent = jitter(cam.latency, 3) + 'ms';
  });

  document.querySelectorAll('[data-tick="osc-rate"]').forEach(el => {
    el.textContent = jitter(MOCK.osc.messages_per_sec, 80).toLocaleString();
  });

  document.querySelectorAll('[data-tick="cpu"]').forEach(el => {
    el.textContent = jitter(MOCK.device.cpu, 6) + '%';
  });
  document.querySelectorAll('[data-tick="mem"]').forEach(el => {
    el.textContent = jitter(MOCK.device.mem, 3) + '%';
  });
  document.querySelectorAll('[data-tick="temp"]').forEach(el => {
    el.textContent = jitter(MOCK.device.temp, 2) + '°C';
  });
}

function startTickers() {
  tickFPS();
  setInterval(tickFPS, 1200);
}

/* =========================================================
   COMMON HELPERS
   ========================================================= */

function fmtUptime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function fmtNumber(n) { return n.toLocaleString(); }

function bindToggles() {
  document.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => t.classList.toggle('on'));
  });
}

function bindTabs(selector, onChange) {
  document.querySelectorAll(selector).forEach(tab => {
    tab.addEventListener('click', () => {
      tab.parentElement.querySelectorAll('.cam-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (onChange) onChange(tab.dataset.camId);
    });
  });
}

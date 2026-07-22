// Application State & Controller Logic v2 with JWT OTP Backend Integrations & Dynamic Roles Dashboards
window.CIB_DB = {
  currentUser: null,
  officers: [],
  cases: [],
  evidence: [],
  forensics: [],
  tasks: [],
  recentActivities: [],
  firs: []
};
let currentActiveView = 'sa-dashboard';
let sidebarCollapsed = false;
let trendChart = null;
let breakdownChart = null;
let analyticsChart = null;
let chartCasesByCrime = null;
let chartCasesByMonth = null;
let chartDeptPerf = null;
let chartOfficerPerf = null;
let chartPendingSolved = null;
let chartEvidenceStats = null;

let officersPage = 1;
const officersPageSize = 5;
let casesPage = 1;
const casesPageSize = 5;
let auditPage = 1;
const auditPageSize = 10;
let totalAuditLogs = 0;

// Role Permissions configurations mapping views for each user profile
const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['sa-dashboard', 'sa-officers', 'sa-departments', 'sa-cases', 'io-evidence', 'io-forensics', 'sa-audit-logs', 'sa-analytics', 'sa-settings'],
  SUPERINTENDENT: ['sp-dashboard', 'sp-review-cases', 'sp-approvals', 'io-evidence', 'sa-analytics'],
  INSPECTOR: ['io-dashboard', 'io-cases', 'io-evidence', 'io-timeline', 'io-notes', 'io-forensics'],
  SUB_INSPECTOR: ['si-dashboard', 'si-register-fir', 'si-create-case', 'io-cases'],
  FORENSIC_OFFICER: ['fo-dashboard', 'fo-pending', 'fo-reports', 'fo-upload', 'fo-fingerprint', 'fo-dna']
};

const VIEW_METADATA = {
  // Super Admin Views
  'sa-dashboard': { label: 'Dashboard', icon: 'ri-dashboard-line' },
  'sa-officers': { label: 'Officer Management', icon: 'ri-user-shared-line' },
  'sa-departments': { label: 'Departments', icon: 'ri-git-branch-line' },
  'sa-cases': { label: 'Cases', icon: 'ri-folder-shield-2-line' },
  'sa-audit-logs': { label: 'Audit Logs', icon: 'ri-lock-line' },
  'sa-analytics': { label: 'Analytics', icon: 'ri-bar-chart-grouped-line' },
  'sa-settings': { label: 'Settings', icon: 'ri-settings-4-line' },

  // Sub Inspector Views
  'si-dashboard': { label: 'Dashboard', icon: 'ri-dashboard-line' },
  'si-register-fir': { label: 'Register FIR', icon: 'ri-file-add-line' },
  'si-create-case': { label: 'Create Case', icon: 'ri-folder-add-line' },
  'si-victims': { label: 'Victims', icon: 'ri-heart-line' },
  'si-witnesses': { label: 'Witness Statements', icon: 'ri-user-voice-line' },
  'si-suspects': { label: 'Suspects Ledger', icon: 'ri-focus-3-line' },

  // Investigation Officer (Inspector) Views
  'io-dashboard': { label: 'Dashboard', icon: 'ri-dashboard-line' },
  'io-cases': { label: 'Assigned Cases', icon: 'ri-folder-shield-2-line' },
  'io-timeline': { label: 'Timeline', icon: 'ri-git-commit-line' },
  'io-evidence': { label: 'Evidence', icon: 'ri-bubble-chart-line' },
  'io-notes': { label: 'Investigation Notes', icon: 'ri-chat-note-line' },
  'io-forensics': { label: 'Forensics', icon: 'ri-microscope-line' },

  // Forensic Officer Views
  'fo-dashboard': { label: 'Dashboard', icon: 'ri-dashboard-line' },
  'fo-pending': { label: 'Assigned Evidence', icon: 'ri-time-line' },
  'fo-reports': { label: 'Lab Reports', icon: 'ri-file-chart-line' },
  'fo-upload': { label: 'Upload Report', icon: 'ri-upload-cloud-line' },
  'fo-fingerprint': { label: 'Evidence Verification', icon: 'ri-scan-2-line' },
  'fo-dna': { label: 'DNA Panel', icon: 'ri-dna-line' },

  // Superintendent Views
  'sp-dashboard': { label: 'Dashboard', icon: 'ri-dashboard-line' },
  'sp-approvals': { label: 'Approvals', icon: 'ri-checkbox-circle-line' },
  'sp-assign-officers': { label: 'Assign Officer', icon: 'ri-user-shared-line' },
  'sp-assign-forensics': { label: 'Assign Forensics', icon: 'ri-microscope-line' },
  'sp-review-cases': { label: 'Assigned Cases', icon: 'ri-survey-line' },
  'sp-chargesheet': { label: 'Chargesheet Hub', icon: 'ri-file-shield-line' },
  'sp-close-cases': { label: 'Close Cases', icon: 'ri-folder-lock-line' }
};

// Initialize app when window loads
window.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
  if (sessionStorage.getItem('cib_session_active') === 'true') {
    initDashboard();
  }
  document.getElementById('live-date').textContent = new Date().toISOString().split('T')[0];
  
  // Set up OTP focus shifting
  const otpBoxes = document.querySelectorAll('.otp-box');
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      if (box.value.length === 1 && idx < otpBoxes.length - 1) {
        otpBoxes[idx + 1].focus();
      }
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && box.value.length === 0 && idx > 0) {
        otpBoxes[idx - 1].focus();
      }
    });
  });

  // Attach modal closure, ESC key, and tab focus trap listeners globally once
  document.addEventListener('keydown', (e) => {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (!activeModal) return;

    if (e.key === 'Escape') {
      hideModal(activeModal.id);
    } else if (e.key === 'Tab') {
      const focusables = activeModal.querySelectorAll('input, select, textarea, button, a[href]');
      if (focusables.length === 0) return;
      
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      hideModal(e.target.id);
    }
  });

  // Officer search input listener
  document.getElementById('officer-search')?.addEventListener('input', renderOfficersTable);
});

function getAvatarSvg(name) {
  const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const nameStr = (name || 'User').trim();
  
  // Extract initials (Adil Khan -> AK, Rahul -> R)
  const parts = nameStr.split(/\s+/);
  let initials = '';
  if (parts.length > 0) {
    initials += parts[0].charAt(0).toUpperCase();
    if (parts.length > 1) {
      initials += parts[parts.length - 1].charAt(0).toUpperCase();
    }
  }
  
  // Deterministic color selection
  let codeSum = 0;
  for (let i = 0; i < nameStr.length; i++) codeSum += nameStr.charCodeAt(i);
  const color = colors[codeSum % colors.length];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="${color}" />
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="'Inter', sans-serif" font-size="${initials.length > 1 ? '22' : '28'}" font-weight="bold" fill="#ffffff">${initials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Toast System
function triggerToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'danger' ? 'toast-danger' : 'toast-success'}`;
  
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px;">
      <i class="${type === 'danger' ? 'ri-error-warning-line' : 'ri-checkbox-circle-line'}"></i>
      <span style="font-size:13px; font-weight:500;">${message}</span>
    </div>
    <i class="ri-close-line" style="cursor:pointer;" onclick="this.parentElement.remove()"></i>
  `;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Authentication Logic
let stage2FA = false;

function setAuthLoading(isLoading) {
  const submitBtn = document.getElementById('auth-submit-btn');
  const spinner = document.getElementById('auth-submit-spinner');
  const lockIcon = document.getElementById('auth-submit-lock');
  const btnText = document.getElementById('auth-submit-text');
  
  if (submitBtn) submitBtn.disabled = isLoading;
  if (spinner) spinner.style.display = isLoading ? 'inline-block' : 'none';
  if (lockIcon) lockIcon.style.display = isLoading ? 'none' : 'inline-block';
  if (btnText) btnText.textContent = isLoading ? 'Authorizing...' : 'Access CIB Portal';
}

async function handleLogin(event) {
  event.preventDefault();
  const officerId = document.getElementById('officer-id').value.trim();
  const password = document.getElementById('password').value;

  if (!officerId || !password) {
    triggerToast("Please enter Officer ID and Password.", "danger");
    return;
  }

  setAuthLoading(true);
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerId, password })
    });
    const data = await response.json();
    if (response.ok && data.success) {
      if (data.data && (data.data.firstLogin || data.data.passwordChangeRequired)) {
        triggerToast("First-time login: Temporary password detected. Please set a new password.", "warning");
        sessionStorage.setItem('cib_pending_officer_id', officerId);
        document.getElementById('first-login-officer-id').textContent = officerId;
        document.getElementById('first-login-officer-meta').textContent = `${data.data.name || officerId} (${data.data.role || 'Officer'})`;
        document.getElementById('first-login-old-password').value = password;
        document.getElementById('first-login-new-password').value = '';
        document.getElementById('first-login-confirm-password').value = '';
        validateFirstLoginPasswordInputs();
        showModal('modal-first-login-change-password');
        setAuthLoading(false);
        return;
      }

      sessionStorage.setItem('cib_session_active', 'true');
      sessionStorage.setItem('cib_jwt_token', data.data.token);
      sessionStorage.setItem('cib_officer_id', officerId);
      sessionStorage.setItem('cib_officer_role', data.data.role);
      sessionStorage.setItem('cib_officer_name', data.data.name);
      triggerToast(`Access Verified. Welcome ${data.data.name}. Redirecting...`, "success");
      setTimeout(() => initDashboard(), 800);
    } else {
      triggerToast(data.error || data.message || "Authentication verification failure.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Connection with CIB authentication backend failed.", "danger");
  } finally {
    setAuthLoading(false);
  }
}

async function resetOfficerPassword(id) {
  if (!confirm(`Are you sure you want to reset the password for Officer ${id}? A new temporary password will be generated.`)) return;
  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const res = await fetch(`/api/officers/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      document.getElementById('created-officer-id').textContent = result.data.id;
      document.getElementById('created-officer-temp-password').textContent = result.data.tempPassword;
      showModal('modal-officer-credentials');
      triggerToast("Password reset successfully. Copy new temporary credentials.", "success");
    } else {
      triggerToast(result.error || "Password reset failed.", "danger");
    }
  } catch (err) {
    console.error('Password reset error:', err);
    triggerToast("Server connection error during password reset.", "danger");
  }
}

async function handleLogout() {
  const token = sessionStorage.getItem('cib_jwt_token');
  if (token) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Logout audit log dispatch failed:', err);
    }
  }
  sessionStorage.clear();
  window.location.reload();
}

async function initDashboard() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-workspace').style.display = 'flex';
  
  renderSkeletons('cases-table-body', 5, 8);
  renderSkeletons('io-cases-table-body', 5, 8);
  
  // Sync state data from Express Postgres API endpoints
  const token = sessionStorage.getItem('cib_jwt_token');
  const activeId = sessionStorage.getItem('cib_officer_id') || 'SA-001';
  try {
    const response = await fetch('/api/dashboard/dashboard-payload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payloadResult = await response.json();
    
    if (response.ok && payloadResult.success) {
      // Hydrate local CIB database memory cache
      window.CIB_DB.cases = payloadResult.data.cases;
      window.CIB_DB.firs = payloadResult.data.firs || [];
      window.CIB_DB.officers = payloadResult.data.officers;
      window.CIB_DB.evidence = payloadResult.data.evidence;
      window.CIB_DB.forensics = payloadResult.data.forensics;
      window.CIB_DB.recentActivities = payloadResult.data.activities;
      window.CIB_DB.kpis = payloadResult.data.kpis || {};
      
      // Update SI Dashboard counts directly from PostgreSQL payload
      const siPendingEl = document.getElementById('si-pending-firs-count');
      const siTotalCasesEl = document.getElementById('si-total-cases-count');
      if (siPendingEl) {
        siPendingEl.textContent = payloadResult.data.kpis?.siPendingFirs ?? 0;
      }
      if (siTotalCasesEl) {
        siTotalCasesEl.textContent = payloadResult.data.kpis?.siTotalCases ?? 0;
      }

      // Store notifications
      notifications = payloadResult.data.notifications || [];
      updateNotificationBell();
      
      // Establish Socket connection
      connectSocket(activeId);

      // Map tasks from remaining cases
      window.CIB_DB.tasks = payloadResult.data.cases
        .filter((c) => c.status === 'Active')
        .map((c, index) => ({
          id: index + 1,
          title: `Analyze evidence for case ${c.id}`,
          priority: c.priority,
          done: false
        }));
      if (payloadResult.data.currentUser) {
        sessionStorage.setItem('cib_officer_role', payloadResult.data.currentUser.role);
        sessionStorage.setItem('cib_officer_name', payloadResult.data.currentUser.name);
      }
    } else {
      throw new Error(payloadResult.error || 'Server responded with failure status.');
    }
  } catch (err) {
    console.error('Failed to sync payload with database. Using cache fallbacks.', err);
    
    const casesTbody = document.getElementById('cases-table-body');
    if (casesTbody) {
      casesTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger-color); padding: 24px;">
        Database connection failure. <button class="btn-primary" style="width: auto; padding: 6px 12px; font-size:12px; display: inline-flex; margin-left: 8px;" onclick="initDashboard()">Retry Sync</button>
      </td></tr>`;
    }
    const ioCasesTbody = document.getElementById('io-cases-table-body');
    if (ioCasesTbody) {
      ioCasesTbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger-color); padding: 24px;">
        Database connection failure. <button class="btn-primary" style="width: auto; padding: 6px 12px; font-size:12px; display: inline-flex; margin-left: 8px;" onclick="initDashboard()">Retry Sync</button>
      </td></tr>`;
    }
  }

  const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
  
  // Find current officer avatar and name
  const officer = window.CIB_DB.officers.find(o => o.id === activeId);
  const name = officer ? officer.name : (sessionStorage.getItem('cib_officer_name') || 'Officer');
  const rank = officer ? officer.rank : (sessionStorage.getItem('cib_officer_role') || 'Special Agent');
  const avatar = getAvatarSvg(name);
  
  document.getElementById('navbar-avatar').src = avatar;
  document.getElementById('navbar-username').textContent = name;
  document.getElementById('navbar-rank').textContent = `${rank} (${activeRole})`;
  
  // Render Sidebar Links Dynamically based on Role Permissions
  renderDynamicSidebar(activeRole);
  
  const registerBtn = document.getElementById('btn-register-fir');
  if (registerBtn) {
    if (activeRole === 'SUPER_ADMIN' || activeRole === 'SUB_INSPECTOR') {
      registerBtn.style.display = 'flex';
    } else {
      registerBtn.style.display = 'none';
    }
  }
  
  renderCounts();
  renderTasks();
  renderActivities();
  renderCasesTable();
  renderEvidenceGrid();
  renderForensicsLab();
  renderOfficersList();
  renderReportOptions();
  renderTimelineView();
  initApexCharts();
  initRoomView();
  renderDepartmentsRegistry();
  renderSubInspectorRegistries();
  
  // Switch to the first authorized view of the role
  const firstView = ROLE_PERMISSIONS[activeRole][0];
  switchView(firstView);
  
  triggerToast(`System Dashboard Synchronized as ${activeRole}.`, "success");
}

function renderDynamicSidebar(role) {
  const container = document.querySelector('.sidebar-nav');
  container.innerHTML = '';
  
  const allowedViews = ROLE_PERMISSIONS[role] || ['dashboard'];
  
  allowedViews.forEach(view => {
    const meta = VIEW_METADATA[view];
    if (!meta) return;
    
    let displayLabel = meta.label;
    if (role === 'SUPERINTENDENT') {
      if (view === 'sa-departments') displayLabel = 'Department Overview';
      if (view === 'sa-analytics') displayLabel = 'Performance Reports';
      if (view === 'io-evidence') displayLabel = 'Evidence Review';
    }
    
    const link = document.createElement('a');
    link.href = '#';
    link.className = `nav-item ${view === currentActiveView ? 'active' : ''}`;
    link.setAttribute('data-view', view);
    link.onclick = () => switchView(view);
    link.innerHTML = `
      <i class="${meta.icon}"></i> <span class="nav-text">${displayLabel}</span>
    `;
    container.appendChild(link);
  });
}

// ApexCharts Initialization
function initApexCharts() {
  const chartContainers = [
    '#trend-chart-container',
    '#breakdown-chart-container',
    '#chart-cases-by-crime',
    '#chart-cases-by-month',
    '#chart-dept-perf',
    '#chart-officer-perf',
    '#chart-pending-solved',
    '#chart-evidence-stats'
  ];

  const casesToAnalyze = window.CIB_DB.cases || [];
  const officersToAnalyze = window.CIB_DB.officers || [];
  const evidenceToAnalyze = window.CIB_DB.evidence || [];

  // Parse last 6 months dynamically
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const last6Months = [];
  const incidents = [0, 0, 0, 0, 0, 0];
  const resolved = [0, 0, 0, 0, 0, 0];
  
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    last6Months.push({
      name: months[d.getMonth()],
      monthIndex: d.getMonth(),
      year: d.getFullYear()
    });
  }
  
  // Set sample incidents/resolved curve if empty
  if (!hasCases) {
    incidents[0] = 4; incidents[1] = 6; incidents[2] = 5; incidents[3] = 9; incidents[4] = 8; incidents[5] = 12;
    resolved[0] = 3; resolved[1] = 5; resolved[2] = 4; resolved[3] = 7; resolved[4] = 6; resolved[5] = 9;
  } else {
    casesToAnalyze.forEach(c => {
      const cDate = new Date(c.createdAt || c.createdDate || Date.now());
      const cMonth = cDate.getMonth();
      const cYear = cDate.getFullYear();
      
      const mIdx = last6Months.findIndex(m => m.monthIndex === cMonth && m.year === cYear);
      if (mIdx !== -1) {
        incidents[mIdx]++;
        if (c.status === 'Solved') {
          resolved[mIdx]++;
        }
      }
    });
  }

  const categories = last6Months.map(m => m.name);

  // Group by crime type
  const crimeTypeCounts = {};
  casesToAnalyze.forEach(c => {
    crimeTypeCounts[c.crimeType] = (crimeTypeCounts[c.crimeType] || 0) + 1;
  });
  const crimeLabels = Object.keys(crimeTypeCounts);
  const crimeSeries = Object.values(crimeTypeCounts);

  // Pending vs Solved
  const solvedCount = casesToAnalyze.filter(c => c.status === 'Solved').length;
  const activeCount = casesToAnalyze.filter(c => c.status === 'Active').length;

  // Evidence Counts
  const evCounts = { 'DigitalHardware': 0, 'Weapon': 0, 'Document': 0, 'Narcotics': 0, 'Other': 0 };
  evidenceToAnalyze.forEach(e => {
    if (evCounts[e.category] !== undefined) {
      evCounts[e.category]++;
    } else {
      evCounts['Other']++;
    }
  });
  const evCategories = ['Digital Hardware', 'Weapon', 'Document', 'Narcotics', 'Other'];
  const evSeries = [evCounts['DigitalHardware'], evCounts['Weapon'], evCounts['Document'], evCounts['Narcotics'], evCounts['Other']];

  // Department performance
  const deptPerformance = {};
  officersToAnalyze.forEach(o => {
    const dept = o.department || 'Other';
    if (!deptPerformance[dept]) {
      deptPerformance[dept] = { solved: 0, active: 0 };
    }
    deptPerformance[dept].solved += o.solvedCases || 0;
    deptPerformance[dept].active += o.assignedCases || 0;
  });
  const deptLabels = Object.keys(deptPerformance);
  const deptSolved = deptLabels.map(d => deptPerformance[d].solved);
  const deptActive = deptLabels.map(d => deptPerformance[d].active);

  // Top 5 Officers performance
  const sortedOfficers = [...officersToAnalyze]
    .sort((a, b) => (b.solvedCases || 0) - (a.solvedCases || 0))
    .slice(0, 5);
  const officerNames = sortedOfficers.map(o => o.name);
  const officerSolved = sortedOfficers.map(o => o.solvedCases || 0);

  // Trend Option Chart
  const trendOptions = {
    series: [
      { name: 'Incidents Logged', data: incidents },
      { name: 'Cases Resolved', data: resolved }
    ],
    chart: { type: 'area', height: 220, background: 'transparent', toolbar: { show: false }, foreColor: '#9CA3AF' },
    colors: ['#2563EB', '#10B981'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    grid: { borderColor: '#1F2937' },
    xaxis: { categories: categories },
    tooltip: { theme: 'dark' },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.2, opacityTo: 0.05 } }
  };
  const elem = document.querySelector("#trend-chart-container");
  if (elem) {
    if (trendChart) trendChart.destroy();
    trendChart = new ApexCharts(elem, trendOptions);
    trendChart.render();
  }

  // Breakdown Option Chart
  const breakdownOptions = {
    series: crimeSeries,
    chart: { type: 'donut', height: 220, background: 'transparent', foreColor: '#9CA3AF' },
    labels: crimeLabels,
    colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark' }
  };
  const elem2 = document.querySelector("#breakdown-chart-container");
  if (elem2) {
    if (breakdownChart) breakdownChart.destroy();
    breakdownChart = new ApexCharts(elem2, breakdownOptions);
    breakdownChart.render();
  }

  // Crime Category Donut Chart
  const crimeOptions = {
    series: crimeSeries,
    chart: { type: 'donut', height: 230, background: 'transparent', foreColor: '#9CA3AF' },
    labels: crimeLabels,
    colors: ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark' }
  };
  const crimeElem = document.querySelector("#chart-cases-by-crime");
  if (crimeElem) {
    if (chartCasesByCrime) chartCasesByCrime.destroy();
    chartCasesByCrime = new ApexCharts(crimeElem, crimeOptions);
    chartCasesByCrime.render();
  }

  // Month Area Chart
  const monthOptions = {
    series: [
      { name: 'Active Cases', data: incidents },
      { name: 'Solved Cases', data: resolved }
    ],
    chart: { type: 'area', height: 230, background: 'transparent', foreColor: '#9CA3AF', toolbar: { show: false } },
    colors: ['#3B82F6', '#10B981'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2 },
    grid: { borderColor: '#1F2937' },
    xaxis: { categories: categories },
    tooltip: { theme: 'dark' }
  };
  const monthElem = document.querySelector("#chart-cases-by-month");
  if (monthElem) {
    if (chartCasesByMonth) chartCasesByMonth.destroy();
    chartCasesByMonth = new ApexCharts(monthElem, monthOptions);
    chartCasesByMonth.render();
  }

  // Department Bar Chart
  const deptOptions = {
    series: [
      { name: 'Solved Cases', data: deptSolved },
      { name: 'Active Cases', data: deptActive }
    ],
    chart: { type: 'bar', height: 230, background: 'transparent', foreColor: '#9CA3AF', toolbar: { show: false } },
    colors: ['#10B981', '#3B82F6'],
    plotOptions: { bar: { horizontal: true, columnWidth: '55%' } },
    xaxis: { categories: deptLabels },
    grid: { borderColor: '#1F2937' },
    tooltip: { theme: 'dark' }
  };
  const deptElem = document.querySelector("#chart-dept-perf");
  if (deptElem) {
    if (chartDeptPerf) chartDeptPerf.destroy();
    chartDeptPerf = new ApexCharts(deptElem, deptOptions);
    chartDeptPerf.render();
  }

  // Officer Performance Chart
  const officerOptions = {
    series: [{ name: 'Solved Cases', data: officerSolved }],
    chart: { type: 'bar', height: 230, background: 'transparent', foreColor: '#9CA3AF', toolbar: { show: false } },
    colors: ['#8B5CF6'],
    plotOptions: { bar: { columnWidth: '45%', borderRadius: 4 } },
    xaxis: { categories: officerNames },
    grid: { borderColor: '#1F2937' },
    tooltip: { theme: 'dark' }
  };
  const officerElem = document.querySelector("#chart-officer-perf");
  if (officerElem) {
    if (chartOfficerPerf) chartOfficerPerf.destroy();
    chartOfficerPerf = new ApexCharts(officerElem, officerOptions);
    chartOfficerPerf.render();
  }

  // Pending vs Solved Donut Chart
  const psOptions = {
    series: [activeCount, solvedCount],
    chart: { type: 'donut', height: 230, background: 'transparent', foreColor: '#9CA3AF' },
    labels: ['Active / Pending', 'Solved / Closed'],
    colors: ['#F59E0B', '#10B981'],
    legend: { position: 'bottom' },
    dataLabels: { enabled: false },
    tooltip: { theme: 'dark' }
  };
  const psElem = document.querySelector("#chart-pending-solved");
  if (psElem) {
    if (chartPendingSolved) chartPendingSolved.destroy();
    chartPendingSolved = new ApexCharts(psElem, psOptions);
    chartPendingSolved.render();
  }

  // Evidence Stats Chart
  const evOptions = {
    series: [{ name: 'Ingested Items', data: evSeries }],
    chart: { type: 'bar', height: 230, background: 'transparent', foreColor: '#9CA3AF', toolbar: { show: false } },
    colors: ['#F59E0B'],
    plotOptions: { bar: { columnWidth: '45%' } },
    xaxis: { categories: evCategories },
    grid: { borderColor: '#1F2937' },
    tooltip: { theme: 'dark' }
  };
  const evElem = document.querySelector("#chart-evidence-stats");
  if (evElem) {
    if (chartEvidenceStats) chartEvidenceStats.destroy();
    chartEvidenceStats = new ApexCharts(evElem, evOptions);
    chartEvidenceStats.render();
  }
}

// Collapsible Sidebar logic
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar-menu');
  const icon = document.getElementById('collapse-icon');
  sidebarCollapsed = !sidebarCollapsed;
  
  // Check if viewport is mobile
  if (window.innerWidth <= 767) {
    sidebar.classList.toggle('active-drawer');
  } else {
    if (sidebarCollapsed) {
      sidebar.classList.add('collapsed');
      icon.className = 'ri-menu-unfold-line';
    } else {
      sidebar.classList.remove('collapsed');
      icon.className = 'ri-menu-fold-line';
    }
  }
}

// Single Page Navigation router with security checks (Access Denied view router)
function switchView(viewName) {
  const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
  const allowed = ROLE_PERMISSIONS[activeRole] || ['sa-dashboard'];
  
  let targetView = viewName;
  if (!allowed.includes(viewName)) {
    targetView = 'unauthorized';
  }
  
  currentActiveView = targetView;
  
  if (targetView === 'sa-audit-logs') {
    loadGlobalAuditLogs();
  }
  if (targetView === 'sa-analytics') {
    loadAnalyticsData();
  }
  
  // Close mobile drawer on link select
  const sidebar = document.getElementById('sidebar-menu');
  if (sidebar) {
    sidebar.classList.remove('active-drawer');
  }
  
  // Highlight only the allowed menu links
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-view') === targetView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
  
  document.querySelectorAll('.page-container').forEach(page => {
    page.classList.remove('active');
  });
  
  const targetPage = document.getElementById(`view-${targetView}`);
  if (targetPage) {
    targetPage.classList.add('active');
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }
}

async function loadAnalyticsData() {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch('/api/dashboard/analytics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      const data = result.data;
      const avgResTimeEl = document.getElementById('analytics-avg-resolution-time');
      const resRateEl = document.getElementById('analytics-resolution-rate');
      const auditAccEl = document.getElementById('analytics-audit-accuracy-rate');
      
      if (avgResTimeEl) avgResTimeEl.textContent = data.averageResolutionTime || '0.0 Days';
      if (resRateEl) resRateEl.textContent = data.resolutionRate || '0.0%';
      if (auditAccEl) auditAccEl.textContent = '100.0%';
    }
  } catch (err) {
    console.error('Failed to load analytics data:', err);
  }
}

// Workspace tab switcher
function switchDetailTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes(tabId)) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.remove('active');
  });

  document.getElementById(`tab-${tabId}`).classList.add('active');
}

// Counter animation helper
function animateCounter(elementId, targetValue, duration = 800) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  if (targetValue === 0) {
    el.textContent = '0';
    return;
  }
  
  let start = 0;
  const stepTime = Math.max(Math.floor(duration / targetValue), 10);
  
  const timer = setInterval(() => {
    start += 1;
    el.textContent = start;
    if (start >= targetValue) {
      el.textContent = targetValue;
      clearInterval(timer);
    }
  }, stepTime);
}

// Statistics counts
function renderCounts() {
  const activeCount = window.CIB_DB.kpis?.activeCases ?? window.CIB_DB.cases.filter(c => c.status === 'Active').length;
  const solvedCount = window.CIB_DB.kpis?.closedCases ?? window.CIB_DB.cases.filter(c => c.status === 'Solved').length;
  const highPriority = window.CIB_DB.cases.filter(c => c.priority === 'High' || c.priority === 'Critical').length;
  const evidenceCount = window.CIB_DB.kpis?.evidenceFiles ?? (window.CIB_DB.evidence || []).length;
  
  animateCounter('count-active', activeCount);
  animateCounter('count-solved', solvedCount);
  animateCounter('count-priority', highPriority);
  animateCounter('count-evidence', evidenceCount);

  const currentOfficerId = sessionStorage.getItem('cib_officer_id');
  const activeRole = sessionStorage.getItem('cib_officer_role');

  if (activeRole === 'INSPECTOR') {
    const ioAssigned = window.CIB_DB.cases.filter(c => c.officerId === currentOfficerId).length;
    const ioEvidence = window.CIB_DB.evidence.length;
    animateCounter('io-assigned-count', ioAssigned);
    animateCounter('io-evidence-count', ioEvidence);
  }

  if (activeRole === 'FORENSIC_OFFICER') {
    const foPending = window.CIB_DB.forensics.filter(f => f.status === 'Pending Analysis').length;
    const foCompleted = window.CIB_DB.forensics.filter(f => f.status === 'Approved' || f.status === 'Forensic Report Submitted').length;
    animateCounter('fo-pending-requests', foPending);
    animateCounter('fo-completed-profiles', foCompleted);
  }

  if (activeRole === 'SUPERINTENDENT') {
    const spAwaiting = window.CIB_DB.kpis?.pendingReviews ?? window.CIB_DB.forensics.filter(f => f.status !== 'Approved').length;
    const spSolved = window.CIB_DB.kpis?.closedCases ?? window.CIB_DB.cases.filter(c => c.status === 'Solved').length;
    animateCounter('sp-awaiting-review', spAwaiting);
    animateCounter('sp-solved-cases', spSolved);
  }
}

// Render checklist Tasks
function renderTasks() {
  const container = document.getElementById('todo-list');
  if (!container) return;
  container.innerHTML = '';
  
  window.CIB_DB.tasks.forEach(task => {
    const item = document.createElement('div');
    item.style = 'display:flex; justify-content:space-between; align-items:center; background-color: var(--card-color); border:1px solid var(--border-color); padding: 12px; border-radius: var(--radius-md);';
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTaskDone(${task.id})" style="accent-color: var(--primary-color); cursor:pointer;">
        <span style="font-size:13px; text-decoration: ${task.done ? 'line-through' : 'none'}; color: ${task.done ? 'var(--text-secondary)' : 'var(--text-primary)'};">${task.title}</span>
      </div>
      <span class="badge ${task.priority === 'High' ? 'priority-high' : 'priority-medium'}">${task.priority}</span>
    `;
    container.appendChild(item);
  });
}

function toggleTaskDone(id) {
  const task = window.CIB_DB.tasks.find(t => t.id === id);
  if (task) {
    task.done = !task.done;
    renderTasks();
    triggerToast(`Task "${task.title.substring(0, 18)}..." status updated.`);
  }
}

// Render activity timeline logs
function renderActivities() {
  const container = document.getElementById('recent-activities');
  if (!container) return;
  container.innerHTML = '';
  
  window.CIB_DB.recentActivities.forEach(act => {
    const item = document.createElement('div');
    item.style = 'display:flex; gap:12px; align-items:flex-start;';
    item.innerHTML = `
      <div style="width:8px; height:8px; border-radius:50%; background-color: var(--primary-color); margin-top:6px;"></div>
      <div style="display:flex; flex-direction:column; gap:2px;">
        <span style="font-size:13px;"><strong>${act.officer}</strong> ${act.action} <span style="color:var(--primary-color); font-weight:600; cursor:pointer;" onclick="viewCaseFromActivity('${act.target}')">${act.target}</span></span>
        <span style="font-size:11px; color:var(--text-secondary);">${act.time}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function viewCaseFromActivity(caseId) {
  const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
  const targetView = (activeRole === 'SUPER_ADMIN' || activeRole === 'SUPERINTENDENT') ? 'sa-cases' : 'io-cases';
  switchView(targetView);
  openCaseDetail(caseId);
}

// Render dynamic cases & FIRs list from PostgreSQL
function renderCasesTable(filteredList = null) {
  const container = document.getElementById('cases-table-body');
  const ioContainer = document.getElementById('io-cases-table-body');

  const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';

  // Build unified dataset from live PostgreSQL FIRs & Cases
  let items = [];

  const firs = window.CIB_DB.firs || [];
  const cases = window.CIB_DB.cases || [];

  // Map FIRs
  firs.forEach(f => {
    const linkedCase = cases.find(c => c.firId === f.id || c.id === f.case?.id);
    
    let officerName = null;
    let officerRole = null;

    if (f.officer && f.officer.user) {
      officerName = f.officer.user.name;
      officerRole = f.officer.user.role;
    } else if (linkedCase && linkedCase.assignedOfficer && linkedCase.assignedOfficer.user) {
      officerName = linkedCase.assignedOfficer.user.name;
      officerRole = linkedCase.assignedOfficer.user.role;
    }

    items.push({
      id: f.id,
      title: f.title,
      crimeCategory: f.crimeCategory || 'General',
      priority: linkedCase ? linkedCase.priority : 'Medium',
      assignedOfficer: officerName,
      assignedRole: officerRole,
      status: f.status || 'Registered',
      createdDate: f.createdAt || f.date,
      location: f.location || 'N/A',
      isFir: true,
      linkedCaseId: linkedCase ? linkedCase.id : null
    });
  });

  // Map standalone Cases not covered in FIRs
  cases.forEach(c => {
    if (!items.some(i => i.id === c.id || (c.firId && i.id === c.firId))) {
      let officerName = c.assignedOfficer && c.assignedOfficer.user ? c.assignedOfficer.user.name : (typeof c.assignedOfficer === 'string' ? c.assignedOfficer : null);
      items.push({
        id: c.id,
        title: c.title,
        crimeCategory: c.crimeType || 'General',
        priority: c.priority || 'Medium',
        assignedOfficer: officerName,
        status: c.status || 'Active',
        createdDate: c.createdAt || c.createdDate,
        location: c.location || 'N/A',
        isFir: false,
        linkedCaseId: c.id
      });
    }
  });

  const targetList = filteredList || items;
  const total = targetList.length;
  const startIndex = (casesPage - 1) * casesPageSize;
  const endIndex = startIndex + casesPageSize;
  const paginated = targetList.slice(startIndex, endIndex);

  // Update ranges
  const rangeEl = document.getElementById('cases-pagination-range');
  const totalEl = document.getElementById('cases-pagination-total');
  if (rangeEl) rangeEl.textContent = total ? `${startIndex + 1} - ${Math.min(endIndex, total)}` : '0';
  if (totalEl) totalEl.textContent = total;

  const populate = (tbody) => {
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 24px;">No investigation records found in PostgreSQL database.</td></tr>`;
      return;
    }

    paginated.forEach(item => {
      let officerHtml = '';
      if (!item.assignedOfficer || item.assignedOfficer === 'Not Assigned' || item.assignedOfficer === 'Unassigned') {
        officerHtml = `<span class="badge badge-warning" style="background-color: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 10px; border-radius: 4px; font-size: 11px;">Not Assigned</span>`;
      } else {
        const avatarUrl = getAvatarSvg(item.assignedOfficer);
        officerHtml = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${avatarUrl}" alt="${item.assignedOfficer}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-light);">
            <span style="font-weight: 500;">${item.assignedOfficer}</span>
          </div>
        `;
      }

      // Contextual Action Buttons (Role-based Workflow Matrix)
      let actionBtnHtml = '';

      if (activeRole === 'SUPER_ADMIN') {
        // SUPER_ADMIN: Register FIR, Assign/Reassign SI, View Case, Delete Case.
        // NEVER SHOW: Start Investigation, Upload Evidence, Upload Forensic Report, Investigation Notes.
        let assignBtn = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--primary-color);" onclick="showAssignSiModal('${item.id}')"><i class="ri-user-shared-line"></i> ${item.assignedOfficer && item.assignedOfficer !== 'Not Assigned' ? 'Reassign SI' : 'Assign SI'}</button>`;
        let viewBtn = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="openCaseDetail('${item.linkedCaseId || item.id}')"><i class="ri-eye-line"></i> View</button>`;
        let deleteBtn = `<button class="btn-primary" style="padding: 6px 10px; font-size: 11px; width: auto; background-color: #EF4444;" onclick="deleteFirOrCase('${item.id}', '${item.isFir ? 'fir' : 'case'}')"><i class="ri-delete-bin-line"></i> Delete</button>`;
        
        actionBtnHtml = `<div style="display: flex; gap: 6px; align-items: center;">${assignBtn}${viewBtn}${deleteBtn}</div>`;
      } else if (activeRole === 'SUB_INSPECTOR') {
        // SUB_INSPECTOR: View assigned FIRs, Start Investigation, Upload Evidence, Send to Forensics, Notes.
        if (item.status === 'Assigned to SI' || item.status === 'Registered') {
          actionBtnHtml = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--success-color);" onclick="startFirInvestigation('${item.id}')"><i class="ri-play-circle-line"></i> Start Investigation</button>`;
        } else {
          actionBtnHtml = `
            <div style="display: flex; gap: 6px;">
              <button class="btn-primary" style="padding: 6px 10px; font-size: 11px; width: auto;" onclick="showEvidenceUploadModal('${item.linkedCaseId}')"><i class="ri-upload-cloud-line"></i> Upload Evidence</button>
              <button class="btn-primary" style="padding: 6px 10px; font-size: 11px; width: auto; background-color: var(--warning-color);" onclick="showRequestForensicModal('${item.linkedCaseId}')"><i class="ri-flask-line"></i> Send to Forensics</button>
            </div>
          `;
        }
      } else if (activeRole === 'FORENSIC_OFFICER') {
        // FORENSIC_OFFICER: Upload Forensic Report, Complete Analysis.
        actionBtnHtml = `
          <div style="display: flex; gap: 6px;">
            <button class="btn-primary" style="padding: 6px 10px; font-size: 11px; width: auto; background-color: var(--success-color);" onclick="showSubmitForensicModal('${item.linkedCaseId}', '${item.linkedCaseId}')"><i class="ri-file-upload-line"></i> Upload Report</button>
          </div>
        `;
      } else if (activeRole === 'INSPECTOR') {
        // INSPECTOR: Review SI Investigation, Approve / Reject / Return.
        actionBtnHtml = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--warning-color);" onclick="showReviewCaseModal('${item.linkedCaseId || item.id}')"><i class="ri-survey-line"></i> Review Case</button>`;
      } else if (activeRole === 'SUPERINTENDENT') {
        // SUPERINTENDENT: Final Approval, Generate Chargesheet, Close Case.
        actionBtnHtml = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--success-color);" onclick="approveChargesheet('${item.linkedCaseId || item.id}')"><i class="ri-file-shield-line"></i> Approve & Close</button>`;
      } else {
        actionBtnHtml = `<button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="openCaseDetail('${item.linkedCaseId || item.id}')"><i class="ri-eye-line"></i> View</button>`;
      }

      const formattedDate = item.createdDate ? new Date(item.createdDate).toLocaleDateString() : 'N/A';

      const row = document.createElement('tr');
      row.style.transition = 'background-color 0.2s';
      row.innerHTML = `
        <td data-label="Case ID"><strong style="color: var(--primary-color); font-family: monospace;">${item.id}</strong></td>
        <td data-label="Title">
          <div style="font-weight:600; color: #FFFFFF;">${item.title}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top: 2px;">${item.crimeCategory}</div>
        </td>
        <td data-label="Priority"><span class="badge ${item.priority === 'Critical' ? 'priority-critical' : (item.priority === 'High' ? 'priority-high' : 'priority-medium')}" style="border-radius: 4px; font-size: 11px; padding: 4px 10px;">${item.priority}</span></td>
        <td data-label="Officer">${officerHtml}</td>
        <td data-label="Status"><span class="badge ${item.status === 'Solved' || item.status === 'Completed' ? 'badge-status-solved' : (item.status === 'Registered' ? 'badge-warning' : 'badge-status-active')}" style="border-radius: 12px; padding: 2px 10px; font-size: 11px;">${item.status}</span></td>
        <td data-label="Created Date"><span style="color: var(--text-secondary); font-size: 12px;">${formattedDate}</span></td>
        <td data-label="Actions">${actionBtnHtml}</td>
      `;
      tbody.appendChild(row);
    });
  };

  populate(container);
  populate(ioContainer);
}

function filterCases() {
  const priorityFilter = document.getElementById('filter-priority').value;
  const statusFilter = document.getElementById('filter-status').value;
  
  let result = window.CIB_DB.cases;
  
  if (priorityFilter !== 'All') {
    result = result.filter(c => c.priority === priorityFilter);
  }
  if (statusFilter !== 'All') {
    result = result.filter(c => c.status === statusFilter);
  }
  
  renderCasesTable(result);
}

// Interactive Case details view
function openCaseDetail(caseId) {
  const target = window.CIB_DB.cases.find(c => c.id === caseId);
  if (!target) return;
  
  const boxDetails = document.getElementById('case-details-section');
  if (!boxDetails) return;
  boxDetails.style.display = 'block';
  document.getElementById('detail-case-title').textContent = `${target.id} : ${target.title}`;
  document.getElementById('detail-victim').textContent = target.victim || 'Unknown';
  
  // Resolve suspects list
  const suspectsList = target.suspects || [];
  document.getElementById('detail-suspects').textContent = suspectsList.length > 0 ? suspectsList.join(', ') : 'None logged';
  document.getElementById('detail-notes').textContent = target.notes || 'No security notes recorded.';

  const actionsContainer = document.getElementById('case-actions-container');
  if (actionsContainer) {
    actionsContainer.innerHTML = '';
    const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
    const isAssigned = target.officerId === sessionStorage.getItem('cib_officer_id') || activeRole === 'SUPER_ADMIN';

    if (activeRole === 'SUPER_ADMIN' || activeRole === 'SUPERINTENDENT') {
      actionsContainer.innerHTML += `
        <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px; background-color: var(--border-light);" onclick="showAssignInspectorModal('${target.id}')"><i class="ri-user-shared-line"></i> Assign Inspector</button>
        <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px; background-color: var(--warning-color);" onclick="showReviewCaseModal('${target.id}')"><i class="ri-survey-line"></i> Log Case Review</button>
      `;
      if (target.status === 'Active') {
        actionsContainer.innerHTML += `
          <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px; background-color: var(--success-color);" onclick="approveChargesheet('${target.id}')"><i class="ri-checkbox-circle-line"></i> Approve Chargesheet & Close</button>
        `;
      }
    }
    
    if (activeRole === 'INSPECTOR' && isAssigned) {
      actionsContainer.innerHTML += `
        <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px;" onclick="showEvidenceUploadModal('${target.id}')"><i class="ri-upload-cloud-line"></i> Upload Evidence</button>
        <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px; background-color: var(--border-light);" onclick="showRequestForensicModal('${target.id}')"><i class="ri-microscope-line"></i> Request Forensic</button>
      `;
      if (target.status === 'Active') {
        actionsContainer.innerHTML += `
          <button class="btn-primary" style="width: auto; padding: 8px 16px; font-size: 12px; background-color: var(--success-color);" onclick="completeInvestigation('${target.id}')"><i class="ri-checkbox-circle-line"></i> Complete Investigation</button>
        `;
      }
    }
  }
  
  const witnessBox = document.getElementById('detail-witnesses');
  witnessBox.innerHTML = '';
  const witnessesList = target.witnesses || [];
  if (witnessesList.length === 0) {
    witnessBox.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">No witness statements recorded yet.</span>';
  } else {
    witnessesList.forEach(ws => {
      witnessBox.innerHTML += `
        <div style="margin-bottom:8px; border-bottom:1px solid var(--border-color); padding-bottom:8px;">
          <strong style="font-size:13px; display:block;">${ws.witness || ws.name}</strong>
          <span style="font-size:12px; color:var(--text-secondary); line-height:1.4;">"${ws.statement || 'No statement recorded.'}"</span>
        </div>
      `;
    });
  }
  
  const timelineBox = document.getElementById('detail-timeline');
  timelineBox.innerHTML = '';
  const stepsList = target.timeline || [];
  stepsList.forEach(step => {
    const stepEl = document.createElement('div');
    stepEl.className = `timeline-step ${step.completed ? 'completed' : ''}`;
    stepEl.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-title">
          <span>${step.step}</span>
          <span class="timeline-date">${step.date}</span>
        </div>
        ${step.details ? `<div class="timeline-desc">${step.details}</div>` : ''}
      </div>
    `;
    timelineBox.appendChild(stepEl);
  });

  const evidenceList = document.getElementById('detail-evidence-list');
  evidenceList.innerHTML = '';
  const relatedEv = (window.CIB_DB.evidence || []).filter(e => 
    e.caseId === caseId || 
    (selectedCase && (e.caseId === selectedCase.id || e.caseId === selectedCase.firId))
  );
  if (relatedEv.length === 0) {
    evidenceList.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">No related evidence found.</span>';
  } else {
    relatedEv.forEach(ev => {
      const dateStr = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : 'N/A';
      const uploaderStr = ev.collectedBy || ev.uploadedByOfficerId || 'Officer';
      const isImg = ev.previewType === 'image' || (ev.cloudinaryUrl && ev.cloudinaryUrl.match(/\.(jpg|jpeg|png|webp|gif)/i));
      
      evidenceList.innerHTML += `
        <div class="evidence-card" onclick="previewEvidence('${ev.id}')" style="cursor:pointer; background-color: var(--card-color); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden;">
          ${isImg ? `<div class="evidence-thumb-container"><img class="evidence-thumb" src="${ev.cloudinaryUrl || ev.previewData}" style="width:100%; height:120px; object-fit:cover;"></div>` : `<div class="evidence-thumb-container" style="height:120px; display:flex; align-items:center; justify-content:center; background-color:rgba(37,99,235,0.08);"><i class="ri-file-shield-line" style="font-size:32px; color:var(--primary-color);"></i></div>`}
          <div class="evidence-card-info" style="padding: 10px;">
            <div class="evidence-card-title" style="font-weight: 600; font-size: 13px; color: #FFF; margin-bottom: 4px;">${ev.name}</div>
            <div style="font-size: 11px; color: var(--text-secondary); font-family: monospace;">ID: <strong style="color: #FFF;">${ev.id}</strong></div>
            <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Case: <strong style="color: var(--primary-color); font-family: monospace;">${ev.caseId}</strong></div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 6px;">
              <span class="badge badge-warning" style="font-size: 9px; padding: 2px 6px;">${ev.category || 'Other'}</span>
              <span class="badge ${ev.verificationStatus === 'Verified' || ev.verificationStatus === 'Verified Integrity' ? 'badge-status-solved' : 'priority-medium'}" style="font-size:9px; padding:2px 6px;">${ev.verificationStatus || 'Verified'}</span>
            </div>
            <div style="font-size: 10px; color: var(--text-secondary); margin-top: 6px; display: flex; justify-content: space-between;">
              <span>By: ${uploaderStr}</span>
              <span>${dateStr}</span>
            </div>
          </div>
        </div>
      `;
    });
  }
  
  switchDetailTab('overview');
  boxDetails.scrollIntoView({ behavior: 'smooth' });
}

function closeCaseDetail() {
  document.getElementById('case-details-section').style.display = 'none';
}

// Interactive Evidence Grid
function renderEvidenceGrid() {
  const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
  const currentOfficerId = sessionStorage.getItem('cib_officer_id');
  const registryContainer = document.getElementById('evidence-registry-container');
  const interactiveLayout = document.getElementById('evidence-interactive-layout');
  const tbody = document.getElementById('evidence-registry-tbody');

  const titleEl = document.getElementById('evidence-view-title');
  const subtitleEl = document.getElementById('evidence-view-subtitle');

  if (activeRole === 'SUPER_ADMIN') {
    if (titleEl) titleEl.textContent = 'Evidence Registry';
    if (subtitleEl) subtitleEl.textContent = 'Central evidence registry table - System audit & chain-of-custody archive';
    if (registryContainer) registryContainer.style.display = 'block';
    if (interactiveLayout) interactiveLayout.style.display = 'none';

    if (tbody) {
      tbody.innerHTML = '';
      if (!window.CIB_DB.evidence || window.CIB_DB.evidence.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 24px;">No evidence records indexed in PostgreSQL registry.</td></tr>`;
        return;
      }

      window.CIB_DB.evidence.forEach(ev => {
        const row = document.createElement('tr');
        const formattedDate = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : (ev.collectionDate ? new Date(ev.collectionDate).toLocaleDateString() : 'N/A');
        const uploader = ev.collectedBy || ev.uploadedByOfficerId || 'Unknown Officer';
        const downloadUrl = ev.cloudinaryUrl || ev.previewData || '#';

        row.innerHTML = `
          <td data-label="Case ID"><strong style="color: var(--primary-color); font-family: monospace;">${ev.caseId || 'N/A'}</strong></td>
          <td data-label="Evidence ID"><span style="font-family: monospace; font-weight: 600; color: #FFF;">${ev.id}</span></td>
          <td data-label="Uploaded By"><span style="font-weight: 500; color: #FFF;">${uploader}</span></td>
          <td data-label="Uploaded Date"><span style="color: var(--text-secondary); font-size: 12px;">${formattedDate}</span></td>
          <td data-label="Evidence Type"><span class="badge badge-warning" style="font-size: 11px; padding: 2px 8px;">${ev.category || ev.previewType || 'Artifact'}</span></td>
          <td data-label="Chain of Custody"><span style="font-size: 12px; color: var(--text-secondary);">${ev.chainOfCustodyStatus || 'Secured in Vault'}</span></td>
          <td data-label="Status"><span class="badge ${ev.verificationStatus === 'Verified' || ev.verificationStatus === 'Verified Integrity' ? 'badge-status-solved' : 'priority-medium'}" style="font-size: 11px; padding: 2px 8px;">${ev.verificationStatus || 'Verified'}</span></td>
          <td data-label="Download">${downloadUrl !== '#' ? `<a href="${downloadUrl}" target="_blank" download class="btn-primary" style="padding: 4px 10px; font-size: 11px; width: auto; background-color: var(--primary-color); display: inline-flex; align-items: center; gap: 4px;"><i class="ri-download-line"></i> Download</a>` : '<span style="color:var(--text-secondary); font-size:11px;">N/A</span>'}</td>
          <td data-label="View Details"><button class="btn-primary" style="padding: 4px 10px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="previewEvidence('${ev.id}')"><i class="ri-eye-line"></i> Details</button></td>
        `;
        tbody.appendChild(row);
      });
    }
    return;
  }

  // Roles: INSPECTOR, SUB_INSPECTOR, SUPERINTENDENT, FORENSIC_OFFICER
  if (titleEl) {
    titleEl.textContent = activeRole === 'SUPERINTENDENT' ? 'Evidence Review' : 'Evidence Vault';
  }
  if (subtitleEl) {
    subtitleEl.textContent = activeRole === 'SUPERINTENDENT' 
      ? 'Review digital evidence artifacts & chain-of-custody logs across all cases' 
      : 'Secure digital tracking of forensic evidence artifacts & file chain-of-custody logs';
  }
  if (registryContainer) registryContainer.style.display = 'none';
  if (interactiveLayout) interactiveLayout.style.display = 'grid';

  const container = document.getElementById('evidence-grid-container');
  if (!container) return;
  container.innerHTML = '';

  const filteredEvidences = window.CIB_DB.evidence || [];

  if (filteredEvidences.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--text-secondary); background: var(--surface-color); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">No evidence artifacts available under your security clearance.</div>`;
    return;
  }

  filteredEvidences.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'evidence-card';
    card.style.cursor = 'pointer';
    card.onclick = () => previewEvidence(ev.id);
    
    const dateStr = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : (ev.collectionDate ? new Date(ev.collectionDate).toLocaleDateString() : 'N/A');
    const uploaderStr = ev.collectedBy || ev.uploadedByOfficerId || 'Unknown Officer';
    const statusStr = ev.verificationStatus || ev.chainOfCustodyStatus || 'Verified';
    const isImg = ev.previewType === 'image' || (ev.cloudinaryUrl && ev.cloudinaryUrl.match(/\.(jpg|jpeg|png|webp|gif)/i));

    let thumbHTML = `<div class="evidence-thumb-container" style="height:130px; display:flex; align-items:center; justify-content:center; background-color:rgba(37,99,235,0.08);"><i class="ri-file-shield-line" style="font-size:40px; color:var(--primary-color);"></i></div>`;
    if (isImg) {
      thumbHTML = `<div class="evidence-thumb-container"><img src="${ev.cloudinaryUrl || ev.previewData}" class="evidence-thumb" style="width:100%; height:130px; object-fit:cover; border-radius:6px 6px 0 0;"></div>`;
    } else if (ev.previewType === 'dna' || ev.category === 'Narcotics') {
      thumbHTML = `<div class="evidence-thumb-container" style="background-color:rgba(16,185,129,0.08); height:130px; display:flex; align-items:center; justify-content:center;"><i class="ri-dna-line" style="font-size:40px; color:var(--success-color);"></i></div>`;
    }
    
    card.innerHTML = `
      ${thumbHTML}
      <div class="evidence-card-info" style="padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <div class="evidence-card-title" style="font-weight:600; font-size:13px; color:#FFF; line-height:1.3;">${ev.name}</div>
          <span class="badge ${statusStr.includes('Verified') ? 'badge-status-solved' : 'priority-medium'}" style="font-size:9px; padding:2px 6px; white-space:nowrap;">${statusStr}</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-top:8px; font-size:11px; color:var(--text-secondary);">
          <div style="display:flex; justify-content:space-between;">
            <span>Evidence ID:</span>
            <strong style="font-family:monospace; color:#FFF;">${ev.id}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Case ID:</span>
            <strong style="font-family:monospace; color:var(--primary-color);">${ev.caseId || 'N/A'}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Category:</span>
            <span class="badge badge-warning" style="font-size:9px; padding:1px 5px;">${ev.category || 'Other'}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Uploaded By:</span>
            <span style="color:#FFF; font-weight:500;">${uploaderStr}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Uploaded Date:</span>
            <span>${dateStr}</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function previewEvidence(evId) {
  const ev = (window.CIB_DB.evidence || []).find(e => e.id === evId);
  if (!ev) return;
  
  const currentOfficerId = sessionStorage.getItem('cib_officer_id');
  const userRole = sessionStorage.getItem('cib_officer_role');
  const dateStr = ev.createdAt ? new Date(ev.createdAt).toLocaleString() : (ev.collectionDate ? new Date(ev.collectionDate).toLocaleString() : 'N/A');
  const uploaderStr = ev.collectedBy || ev.uploadedByOfficerId || 'Unknown Officer';
  const downloadUrl = ev.cloudinaryUrl || ev.previewData || '#';
  const isImg = ev.previewType === 'image' || (ev.cloudinaryUrl && ev.cloudinaryUrl.match(/\.(jpg|jpeg|png|webp|gif)/i));

  // 1. Populate Side Panel Preview Graphic
  const previewBox = document.getElementById('evidence-preview-graphic');
  if (previewBox) {
    if (isImg) {
      previewBox.innerHTML = `<img src="${downloadUrl}" alt="Evidence Graphic" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      previewBox.innerHTML = `
        <div style="font-family:monospace; font-size:11px; padding:16px; width:100%; height:100%; overflow-y:auto; color:var(--text-secondary); text-align:left; background-color: var(--card-color); border:1px solid var(--border-color); border-radius:6px;">
          <div style="color:var(--success-color); font-weight:600; margin-bottom:8px;">// SECURID FORENSIC LINK DETECTED</div>
          <div>Artifact Name: ${ev.name}</div>
          <div>Category: ${ev.category || 'Other'}</div>
          <div>MIME Type: ${ev.mimeType || 'binary/stream'}</div>
          <div>File Size: ${ev.fileSize ? (ev.fileSize / 1024).toFixed(1) + ' KB' : 'N/A'}</div>
          <div>Uploaded: ${dateStr}</div>
        </div>
      `;
    }
  }

  // 2. Populate Side Panel Custody Chain
  const timelineBox = document.getElementById('evidence-custody-chain');
  if (timelineBox) {
    timelineBox.innerHTML = '';
    const custodyChain = ev.transfers || [];
    if (custodyChain.length === 0) {
      timelineBox.innerHTML = '<span style="color:var(--text-secondary); font-size:13px; padding:12px;">No transfer logs recorded.</span>';
    } else {
      custodyChain.forEach(log => {
        const logDate = log.date ? new Date(log.date).toLocaleString() : (log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A');
        timelineBox.innerHTML += `
          <div class="custody-log" style="background-color: var(--card-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <strong style="font-size: 13px; color: #FFFFFF; display: block; margin-bottom: 2px;">${log.action}</strong>
              <span style="display:block; font-size:11px; color:var(--text-secondary);">Handler: <span style="color: var(--primary-color); font-weight: 500;">${log.handler}</span></span>
            </div>
            <span style="color:var(--text-secondary); font-size: 10px; font-family: monospace;">${logDate}</span>
          </div>
        `;
      });
    }
  }

  // 3. Populate Dedicated Evidence Detail Modal (modal-evidence-detail)
  const modalTitle = document.getElementById('modal-ev-title');
  const modalIdBadge = document.getElementById('modal-ev-id-badge');
  const modalPreview = document.getElementById('modal-ev-preview');
  const modalDownload = document.getElementById('modal-ev-download');
  const modalMetadata = document.getElementById('modal-ev-metadata');
  const modalCustody = document.getElementById('modal-ev-custody');
  const modalDeleteContainer = document.getElementById('modal-ev-delete-container');

  if (modalTitle) modalTitle.textContent = ev.name;
  if (modalIdBadge) modalIdBadge.textContent = `${ev.id} | Case: ${ev.caseId}`;

  // Preview in modal
  if (modalPreview) {
    if (isImg) {
      modalPreview.innerHTML = `<img src="${downloadUrl}" style="max-width:100%; max-height:350px; object-fit:contain;">`;
    } else {
      modalPreview.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:12px; padding:30px;">
          <i class="ri-file-shield-line" style="font-size:56px; color:var(--primary-color);"></i>
          <span style="font-size:14px; font-weight:600; color:#FFF;">${ev.name}</span>
          <span style="font-size:12px; color:var(--text-secondary); font-family:monospace;">MIME: ${ev.mimeType || 'application/octet-stream'}</span>
        </div>
      `;
    }
  }

  // Download link bar
  if (modalDownload) {
    modalDownload.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="ri-cloud-download-line" style="font-size:24px; color:var(--primary-color);"></i>
        <div>
          <strong style="font-size:13px; color:#FFF; display:block;">Cloudinary Digital Artifact Asset</strong>
          <span style="font-size:11px; color:var(--text-secondary);">${ev.fileSize ? (ev.fileSize / 1024).toFixed(1) + ' KB' : 'Cloud Storage'} | Format: ${(ev.cloudinaryFormat || ev.mimeType || 'File').toUpperCase()}</span>
        </div>
      </div>
      ${downloadUrl !== '#' ? `<a href="${downloadUrl}" target="_blank" download class="btn-primary" style="padding: 8px 16px; font-size: 12px; width: auto; background-color: var(--primary-color); display: inline-flex; align-items: center; gap: 6px;"><i class="ri-download-line"></i> Download Asset</a>` : '<span style="color:var(--text-secondary); font-size:12px;">No URL</span>'}
    `;
  }

  // Metadata grid
  if (modalMetadata) {
    modalMetadata.innerHTML = `
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Evidence ID</span><strong style="font-family:monospace; color:#FFF;">${ev.id}</strong></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Case ID</span><strong style="font-family:monospace; color:var(--primary-color);">${ev.caseId}</strong></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Category</span><span class="badge badge-warning" style="font-size:10px;">${ev.category || 'Other'}</span></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Current Status</span><span class="badge badge-status-solved" style="font-size:10px;">${ev.verificationStatus || 'Verified'}</span></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Uploaded By</span><strong style="color:#FFF;">${uploaderStr}</strong></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Upload Timestamp</span><span style="color:var(--text-secondary); font-size:12px;">${dateStr}</span></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Chain of Custody Status</span><span style="color:var(--text-secondary); font-size:12px;">${ev.chainOfCustodyStatus || 'Secured in Vault'}</span></div>
      <div><span style="font-size:11px; color:var(--text-secondary); display:block;">Remarks / Notes</span><span style="color:var(--text-secondary); font-size:12px;">${ev.remarks || 'No remarks added.'}</span></div>
    `;
  }

  // Custody timeline
  if (modalCustody) {
    modalCustody.innerHTML = '';
    const transfers = ev.transfers || [];
    if (transfers.length === 0) {
      modalCustody.innerHTML = '<span style="color:var(--text-secondary); font-size:12px;">No custody transfer logs recorded yet.</span>';
    } else {
      transfers.forEach(t => {
        const tDate = t.date ? new Date(t.date).toLocaleString() : (t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A');
        modalCustody.innerHTML += `
          <div style="background-color: var(--card-color); border: 1px solid var(--border-color); border-radius: 6px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 12px; color: #FFF; display: block;">${t.action}</strong>
              <span style="font-size: 11px; color: var(--text-secondary);">Handler: <span style="color: var(--primary-color);">${t.handler}</span></span>
            </div>
            <span style="font-size: 10px; color: var(--text-secondary); font-family: monospace;">${tDate}</span>
          </div>
        `;
      });
    }
  }

  // Delete button if uploader or Super Admin
  if (modalDeleteContainer) {
    modalDeleteContainer.innerHTML = '';
    if (userRole === 'SUPER_ADMIN' || (userRole === 'SUB_INSPECTOR' && ev.uploadedByOfficerId === currentOfficerId)) {
      modalDeleteContainer.innerHTML = `
        <button type="button" class="btn-primary" style="background-color: var(--danger-color); font-size: 12px; padding: 6px 14px; width: auto;" onclick="hideModal('modal-evidence-detail'); deleteEvidenceRecord('${ev.id}', '${ev.caseId}')">
          <i class="ri-delete-bin-line"></i> Delete Evidence
        </button>
      `;
    }
  }

  showModal('modal-evidence-detail');
  triggerToast(`Loaded details for ${ev.id}`);
}

// Timeline Case selector & tracing
function renderTimelineView() {
  const selectBody = document.getElementById('timeline-case-selector');
  if (!selectBody) return;
  selectBody.innerHTML = '';
  
  window.CIB_DB.cases.forEach(c => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><strong>${c.id}</strong></td>
      <td>${c.title}</td>
      <td><button class="btn-primary" style="padding:6px 12px; font-size:12px; width:auto;" onclick="loadTimelineForCase('${c.id}')">Trace</button></td>
    `;
    selectBody.appendChild(row);
  });
}

function loadTimelineForCase(caseId) {
  const target = window.CIB_DB.cases.find(c => c.id === caseId);
  if (!target) return;
  
  document.getElementById('timeline-focused-case-title').textContent = `${target.id} Timeline Flow`;
  
  const container = document.getElementById('master-timeline-workflow');
  container.innerHTML = '';
  const stepsList = target.timeline || [];
  stepsList.forEach(step => {
    const stepEl = document.createElement('div');
    stepEl.className = `timeline-step ${step.completed ? 'completed' : ''}`;
    stepEl.style.marginBottom = '24px';
    stepEl.innerHTML = `
      <div class="timeline-dot" style="border-width: 3px; width: 16px; height: 16px; left: -29px; top: 8px;"></div>
      <div class="timeline-content" style="background-color: var(--surface-color); border: 1px solid var(--border-color); padding: 18px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.15);">
        <div class="timeline-title" style="font-size: 14px; font-weight: 600; color: #FFFFFF; display: flex; justify-content: space-between; align-items: center;">
          <span>${step.step}</span>
          <span class="timeline-date" style="font-family: monospace; font-size: 11px; color: var(--text-secondary);">${step.date}</span>
        </div>
        ${step.details ? `<div class="timeline-desc" style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; line-height: 1.5;">${step.details}</div>` : ''}
      </div>
    `;
    container.appendChild(stepEl);
  });
}

// Forensics Lab Reports list & assigned evidence queue handler
function renderForensicsLab() {
  // 1. Populate Assigned Evidence & Requests Table (fo-pending-tbody)
  const tbody = document.getElementById('fo-pending-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    const forensics = window.CIB_DB.forensics || [];
    const evidenceList = window.CIB_DB.evidence || [];
    
    if (forensics.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 24px;">No pending forensic requests or assigned evidence in laboratory queue.</td></tr>`;
    } else {
      forensics.forEach(f => {
        const tr = document.createElement('tr');
        
        // Find linked Evidence or details
        const linkedEv = evidenceList.find(e => e.caseId === f.caseId) || { name: f.type || 'Digital Evidence', category: f.type };
        const dateStr = f.createdAt ? new Date(f.createdAt).toLocaleDateString() : (f.approvalDate || 'N/A');
        const senderStr = f.case?.assignedOfficer?.name || f.analyst || 'Investigating Officer';
        const statusBadge = f.status === 'Approved' || f.status === 'Forensic Report Submitted'
          ? `<span class="badge badge-status-solved" style="font-size:11px; padding:2px 8px;">${f.status}</span>`
          : `<span class="badge priority-medium" style="font-size:11px; padding:2px 8px;">${f.status || 'Pending Analysis'}</span>`;
        
        tr.innerHTML = `
          <td data-label="Evidence">
            <strong style="color: #FFF; font-size: 13px;">${linkedEv.name || f.type}</strong>
            <span style="display:block; font-size: 11px; color: var(--text-secondary); font-family: monospace;">Ref: ${f.id}</span>
          </td>
          <td data-label="Case">
            <strong style="color: var(--primary-color); font-family: monospace;">${f.caseId}</strong>
            <span style="display:block; font-size: 11px; color: var(--text-secondary);">${f.case?.title || 'Active Case'}</span>
          </td>
          <td data-label="Sender">
            <span style="font-weight: 500; color: #FFF;">${senderStr}</span>
          </td>
          <td data-label="Date">
            <span style="color: var(--text-secondary); font-size: 12px;">${dateStr}</span>
          </td>
          <td data-label="Status">${statusBadge}</td>
          <td data-label="Action">
            <button class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--success-color); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" onclick="showSubmitForensicModal('${f.id}', '${f.caseId}', '${f.reportTitle || f.type}', '${f.type}')">
              <i class="ri-upload-cloud-line"></i> Upload Report
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  // 2. Populate Forensic Lab Archive Cards
  const container = document.getElementById('forensics-grid-container');
  if (container) {
    container.innerHTML = '';
    const forensics = window.CIB_DB.forensics || [];
    if (forensics.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; padding: 24px; text-align: center; color: var(--text-secondary); background: var(--surface-color); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">No forensic lab reports logged in registry.</div>`;
      return;
    }

    forensics.forEach(f => {
      const card = document.createElement('div');
      card.className = 'lab-card';
      card.style = 'background-color: var(--surface-color); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 14px;';
      
      const docLink = f.reportFileUrl ? `<a href="${f.reportFileUrl}" target="_blank" class="btn-primary" style="padding: 6px 12px; font-size: 11px; width: auto; background-color: var(--primary-color); display: inline-flex; align-items: center; gap: 4px;"><i class="ri-file-pdf-line"></i> View Report PDF</a>` : '';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="lab-badge" style="font-size: 11px; background-color: rgba(37, 99, 235, 0.15); color: var(--primary-color); border: 1px solid rgba(37, 99, 235, 0.25); padding: 4px 8px; border-radius: 4px; font-weight: 600;">${f.type || 'Lab Report'}</span>
          <span class="badge ${f.status === 'Approved' || f.status === 'Forensic Report Submitted' ? 'badge-status-solved' : 'priority-medium'}" style="font-size:11px; padding: 2px 10px; border-radius: 12px;">${f.status}</span>
        </div>
        <div>
          <strong style="font-size:14px; display:block; margin-bottom:4px; color:#FFFFFF;">${f.reportTitle || 'Forensic Analysis Report'}</strong>
          <span style="font-size:12px; color:var(--text-secondary);">Case: <strong style="color:var(--primary-color); font-family:monospace;">${f.caseId}</strong></span>
          <p style="font-size:12px; color:var(--text-secondary); line-height:1.5; background-color: var(--card-color); padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); margin-top: 8px;">${f.summary}</p>
          ${f.observations ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px;">${f.observations}</div>` : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary); border-top:1px solid var(--border-color); padding-top:10px; margin-top:auto;">
          <span>Analyst: <strong style="color:#FFF;">${f.analyst || 'Forensic Specialist'}</strong></span>
          ${docLink}
        </div>
      `;
      container.appendChild(card);
    });
  }
}

function approveForensicReport(reportId) {
  const rep = window.CIB_DB.forensics.find(f => f.id === reportId);
  if (rep) {
    rep.status = 'Approved';
    rep.approvalDate = new Date().toISOString().split('T')[0];
    renderForensicsLab();
    triggerToast("Forensic Report findings approved and finalized in blockchain audit logs.", "success");
  }
}

async function handleForensicUpload(event) {
  event.preventDefault();
  const caseId = document.getElementById('forenic-upload-case').value;
  const type = document.getElementById('forenic-upload-type').value;
  const summary = document.getElementById('forensic-upload-summary').value;
  
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch('/api/forensics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        id: `FOR-2026-${Math.floor(Math.random() * 900 + 100)}`,
        caseId,
        type,
        analyst: 'Elena Rostova',
        summary
      })
    });
    
    if (response.ok) {
      triggerToast("New forensic report submitted for review.");
      initDashboard();
      document.getElementById('forensic-upload-summary').value = '';
    } else {
      triggerToast("Failed to upload forensic findings.", "danger");
    }
  } catch (err) {
    triggerToast("Connection failed.", "danger");
  }
}

// Active Officers view renderer / Officer Management
async function fetchOfficers() {
  const token = sessionStorage.getItem('cib_jwt_token');
  renderSkeletons('officers-table-body', 5, 9);
  
  const search = document.getElementById('officer-search')?.value || '';
  const role = document.getElementById('officer-filter-role')?.value || '';
  const status = document.getElementById('officer-filter-status')?.value || '';
  const department = document.getElementById('officer-filter-dept')?.value || '';
  const sort = document.getElementById('officer-sort')?.value || 'created_desc';
  
  let sortBy = 'createdAt';
  let sortOrder = 'desc';
  if (sort === 'name_asc') { sortBy = 'name'; sortOrder = 'asc'; }
  if (sort === 'name_desc') { sortBy = 'name'; sortOrder = 'desc'; }
  if (sort === 'created_asc') { sortBy = 'createdAt'; sortOrder = 'asc'; }

  const url = `/api/officers?search=${encodeURIComponent(search)}&role=${role}&status=${status}&department=${department}&sortBy=${sortBy}&sortOrder=${sortOrder}&page=${officersPage}&limit=${officersPageSize}`;

  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    
    console.log('[Officer Audit] API URL called:', url);
    console.log('[Officer Audit] Response status:', response.status);
    console.log('[Officer Audit] Response body:', result);

    if (response.ok && result.success) {
      const rawData = result.data;
      let officersList = [];
      let total = 0;

      if (Array.isArray(rawData)) {
        officersList = rawData;
        total = rawData.length;
      } else if (rawData && typeof rawData === 'object') {
        officersList = rawData.officers || rawData.data || [];
        total = rawData.total || officersList.length;
      }

      window.CIB_DB.officers = officersList;
      
      console.log('[Officer Audit] Number of officers received:', officersList.length, '| Total count:', total);

      const rangeEl = document.getElementById('officers-pagination-range');
      const totalEl = document.getElementById('officers-pagination-total');
      const startIndex = (officersPage - 1) * officersPageSize;
      const endIndex = startIndex + window.CIB_DB.officers.length;
      if (rangeEl) rangeEl.textContent = total ? `${startIndex + 1} - ${endIndex}` : '0';
      if (totalEl) totalEl.textContent = total;
    } else {
      triggerToast(result.error || "Failed to fetch officers list.", "danger");
    }
  } catch (err) {
    console.error('[Officer Audit] Fetch error:', err);
    triggerToast("Failed to connect to officers database.", "danger");
  }
}

async function renderOfficersTable() {
  const body = document.getElementById('officers-table-body');
  if (!body) return;
  
  // Render skeletons first
  renderSkeletons('officers-table-body', 5, 9);
  
  await fetchOfficers();

  body.innerHTML = '';

  wrapErrorBoundary(() => {
    const paginated = window.CIB_DB.officers || [];
    console.log('[Officer Audit] Number of officers rendered in table:', paginated.length);

    if (paginated.length === 0) {
      body.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary); padding: 24px;">No officers found.</td></tr>`;
      return;
    }

    paginated.forEach(o => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: monospace; font-weight: 700;">${o.id}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${getAvatarSvg(o.name)}" style="width: 24px; height: 24px; border-radius: 50%;">
            <span>${o.name}</span>
          </div>
        </td>
        <td>${o.role}</td>
        <td>${o.department}</td>
        <td>
          <span class="badge ${o.isActive ? 'badge-status-solved' : 'priority-high'}" style="background-color: ${o.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; color: ${o.isActive ? 'var(--success-color)' : 'var(--danger-color)'};">
            ${o.isActive ? 'Active' : 'Suspended'}
          </span>
        </td>
        <td>${o.email}</td>
        <td>${o.phone || 'N/A'}</td>
        <td>${new Date(o.createdAt).toLocaleDateString()}</td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="viewOfficerLogs('${o.id}')" title="View Logs & File"><i class="ri-article-line"></i></button>
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="showEditOfficerModal('${o.id}')" title="Edit Profile"><i class="ri-edit-line"></i></button>
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; width: auto; background-color: var(--border-light);" onclick="resetOfficerPassword('${o.id}')" title="Reset Credentials"><i class="ri-key-line"></i></button>
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; width: auto; background-color: ${o.isActive ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; color: ${o.isActive ? 'var(--danger-color)' : 'var(--success-color)'};" onclick="toggleSuspendOfficer('${o.id}', ${o.isActive})" title="${o.isActive ? 'Suspend' : 'Activate'} Account">
              <i class="${o.isActive ? 'ri-user-unfollow-line' : 'ri-user-follow-line'}"></i>
            </button>
            <button class="btn-primary" style="padding: 4px 8px; font-size: 11px; width: auto; background-color: rgba(239,68,68,0.1); color: var(--danger-color);" onclick="deleteOfficer('${o.id}')" title="Delete Profile"><i class="ri-delete-bin-line"></i></button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });
  }, 'officers-table-body');
}

async function renderOfficersList() {
  await renderOfficersTable();
}

// Modal System Implementation
let previousActiveElement = null;

function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  previousActiveElement = document.activeElement;
  modal.classList.add('active');
  document.body.classList.add('modal-open');

  // Focus first input/interactive element inside modal
  const firstInput = modal.querySelector('input, select, textarea, button');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 50);
  }
}

function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('active');
  
  const anyActive = document.querySelector('.modal-overlay.active');
  if (!anyActive) {
    document.body.classList.remove('modal-open');
  }

  if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    previousActiveElement.focus();
  }
}

async function handleFirstLoginPasswordChangeSubmit(event) {
  event.preventDefault();
  const officerId = sessionStorage.getItem('cib_pending_officer_id') || document.getElementById('first-login-officer-id').textContent;
  const oldPassword = document.getElementById('first-login-old-password').value;
  const newPassword = document.getElementById('first-login-new-password').value;
  const confirmPassword = document.getElementById('first-login-confirm-password').value;

  const errorBox = document.getElementById('first-login-modal-error');
  const errorText = document.getElementById('first-login-modal-error-text');

  if (!newPassword || newPassword !== confirmPassword) {
    if (errorBox && errorText) {
      errorText.textContent = "New passwords do not match.";
      errorBox.style.display = 'block';
    } else {
      triggerToast("New passwords do not match.", "danger");
    }
    return;
  }

  const submitBtn = document.getElementById('first-login-password-submit-btn');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ri-loader-4-line spinner"></i> Establishing Credentials...`;

  try {
    // 1. Submit password change
    const changeRes = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerId, oldPassword, newPassword })
    });

    const changeData = await changeRes.json();
    if (!changeRes.ok || !changeData.success) {
      const errMsg = changeData.error || changeData.message || "Failed to update password.";
      if (errorBox && errorText) {
        errorText.textContent = errMsg;
        errorBox.style.display = 'block';
      } else {
        triggerToast(errMsg, "danger");
      }
      return;
    }

    // 2. Invalidate temporary state completely and perform fresh login from DB
    sessionStorage.removeItem('cib_pending_officer_id');
    hideModal('modal-first-login-change-password');

    const freshLoginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officerId, password: newPassword })
    });

    const freshLoginData = await freshLoginRes.json();
    if (!freshLoginRes.ok || !freshLoginData.success) {
      triggerToast("Password updated successfully. Please log in with your new password.", "success");
      return;
    }

    // 3. Establish clean session with database-authenticated user profile
    sessionStorage.setItem('cib_session_active', 'true');
    sessionStorage.setItem('cib_jwt_token', freshLoginData.data.token);
    sessionStorage.setItem('cib_officer_id', officerId);
    sessionStorage.setItem('cib_officer_role', freshLoginData.data.role);
    sessionStorage.setItem('cib_officer_name', freshLoginData.data.name);

    triggerToast(`Password Established. Authenticated as ${freshLoginData.data.name} (${freshLoginData.data.role}).`, "success");
    
    // 4. Initialize dashboard dynamically for the authentic role
    setTimeout(() => initDashboard(), 500);

  } catch (err) {
    console.error('Password change error:', err);
    triggerToast("Server connection error during password update.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

let activeDetailTab = 'profile';
function switchModalTab(tabName) {
  activeDetailTab = tabName;
  document.querySelectorAll('.modal-tab').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelectorAll('.modal-tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const tabBtn = document.getElementById(`tab-${tabName}-btn`);
  if (tabBtn) tabBtn.classList.add('active');
  
  const content = document.getElementById(`modal-tab-${tabName}`);
  if (content) content.classList.add('active');
}

function showAddOfficerModal() {
  document.getElementById('officer-modal-title').innerHTML = `<i class="ri-user-add-line"></i> Add New Officer`;
  document.getElementById('officer-submit-btn').textContent = 'Create Officer';
  document.getElementById('officer-form-id').value = '';
  document.getElementById('officer-form').reset();
  showModal('modal-officer-form');
}

async function showEditOfficerModal(id) {
  document.getElementById('officer-modal-title').innerHTML = `<i class="ri-edit-line"></i> Edit Officer Profile`;
  document.getElementById('officer-submit-btn').textContent = 'Save Changes';
  
  const officer = window.CIB_DB.officers.find(o => o.id === id);
  if (!officer) return;

  document.getElementById('officer-form-id').value = officer.id;
  document.getElementById('officer-form-name').value = officer.name;
  document.getElementById('officer-form-email').value = officer.email;
  document.getElementById('officer-form-phone').value = officer.phone || '';
  document.getElementById('officer-form-role').value = officer.role;
  document.getElementById('officer-form-rank').value = officer.rank || 'SPECIAL_AGENT';
  document.getElementById('officer-form-department').value = officer.department || 'MAJOR_CRIMES_DIVISION';
  document.getElementById('officer-form-station').value = officer.policeStation || '';

  showModal('modal-officer-form');
}

async function handleOfficerSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('officer-form-id').value;
  const name = document.getElementById('officer-form-name').value;
  const email = document.getElementById('officer-form-email').value;
  const phone = document.getElementById('officer-form-phone').value;
  const role = document.getElementById('officer-form-role').value;
  const rank = document.getElementById('officer-form-rank').value;
  const department = document.getElementById('officer-form-department').value;
  const policeStation = document.getElementById('officer-form-station').value;

  // Clear any existing highlighted invalid fields
  const fields = ['name', 'email', 'phone', 'station'];
  fields.forEach(f => {
    const el = document.getElementById(`officer-form-${f}`);
    if (el) el.style.borderColor = 'var(--border-color)';
  });

  let hasError = false;
  if (!name.trim()) {
    document.getElementById('officer-form-name').style.borderColor = 'var(--danger-color)';
    hasError = true;
  }
  if (!email.trim() || !email.includes('@')) {
    document.getElementById('officer-form-email').style.borderColor = 'var(--danger-color)';
    hasError = true;
  }
  if (!phone.trim()) {
    document.getElementById('officer-form-phone').style.borderColor = 'var(--danger-color)';
    hasError = true;
  }
  if (!policeStation.trim()) {
    document.getElementById('officer-form-station').style.borderColor = 'var(--danger-color)';
    hasError = true;
  }

  if (hasError) {
    triggerToast("Please correct highlighted fields before submitting.", "danger");
    return;
  }

  const token = sessionStorage.getItem('cib_jwt_token');
  const payload = { name, email, phone, role, rank, department, policeStation };

  const submitBtn = document.getElementById('officer-submit-btn');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    let url = '/api/officers';
    let method = 'POST';
    if (id) {
      url = `/api/officers/${id}`;
      method = 'PUT';
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (response.ok && result.success) {
      hideModal('modal-officer-form');
      document.getElementById('officer-form').reset();
      await renderOfficersList();

      if (!id && result.data && result.data.tempPassword) {
        document.getElementById('created-officer-id').textContent = result.data.id || result.data.badgeNumber;
        document.getElementById('created-officer-temp-password').textContent = result.data.tempPassword;
        showModal('modal-officer-credentials');
        triggerToast("Officer onboarded successfully. Copy temporary credentials.", "success");
      } else {
        triggerToast("Officer profile updated successfully.", "success");
      }
    } else {
      triggerToast(result.error || "Operation failed.", "danger");
      if (result.error && result.error.toLowerCase().includes('email')) {
        document.getElementById('officer-form-email').style.borderColor = 'var(--danger-color)';
      }
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function copyOfficerCredentials() {
  const officerId = document.getElementById('created-officer-id').textContent;
  const tempPassword = document.getElementById('created-officer-temp-password').textContent;
  const textToCopy = `Officer ID: ${officerId}\nTemporary Password: ${tempPassword}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    triggerToast("Officer ID & Temporary Password copied to clipboard.", "success");
  }).catch(err => {
    console.error('Clipboard copy failed:', err);
    triggerToast("Clipboard copy failed. Please manually select text.", "warning");
  });
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ri-eye-off-line';
  } else {
    input.type = 'password';
    icon.className = 'ri-eye-line';
  }
}

function validateFirstLoginPasswordInputs() {
  const newPwd = document.getElementById('first-login-new-password').value;
  const confirmPwd = document.getElementById('first-login-confirm-password').value;
  const submitBtn = document.getElementById('first-login-password-submit-btn');

  const hasLength = newPwd.length >= 8;
  const hasUpper = /[A-Z]/.test(newPwd);
  const hasLower = /[a-z]/.test(newPwd);
  const hasNumber = /[0-9]/.test(newPwd);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPwd);
  const matches = newPwd.length > 0 && newPwd === confirmPwd;

  const setReq = (id, text, pass) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (pass) {
      el.style.color = 'var(--success-color)';
      el.innerHTML = `<i class="ri-checkbox-circle-line"></i> ${text}`;
    } else {
      el.style.color = 'var(--danger-color)';
      el.innerHTML = `<i class="ri-close-circle-line"></i> ${text}`;
    }
  };

  setReq('req-length', 'Min 8 Characters', hasLength);
  setReq('req-upper', 'Uppercase Letter (A-Z)', hasUpper);
  setReq('req-lower', 'Lowercase Letter (a-z)', hasLower);
  setReq('req-number', 'Number (0-9)', hasNumber);
  setReq('req-special', 'Special Char (!@#$%^&*)', hasSpecial);
  setReq('req-match', 'Passwords Match', matches);

  // Live Password Strength Meter
  let score = 0;
  if (hasLength) score++;
  if (hasUpper) score++;
  if (hasLower) score++;
  if (hasNumber) score++;
  if (hasSpecial) score++;

  const strengthBar = document.getElementById('password-strength-bar');
  const strengthLabel = document.getElementById('password-strength-label');

  if (strengthBar && strengthLabel) {
    if (newPwd.length === 0) {
      strengthBar.style.width = '0%';
      strengthBar.style.backgroundColor = 'var(--danger-color)';
      strengthLabel.style.color = 'var(--danger-color)';
      strengthLabel.textContent = 'Too Weak';
    } else if (score <= 2) {
      strengthBar.style.width = '25%';
      strengthBar.style.backgroundColor = 'var(--danger-color)';
      strengthLabel.style.color = 'var(--danger-color)';
      strengthLabel.textContent = 'Weak';
    } else if (score === 3 || score === 4) {
      strengthBar.style.width = '65%';
      strengthBar.style.backgroundColor = 'var(--warning-color)';
      strengthLabel.style.color = 'var(--warning-color)';
      strengthLabel.textContent = 'Good';
    } else if (score === 5) {
      strengthBar.style.width = '100%';
      strengthBar.style.backgroundColor = 'var(--success-color)';
      strengthLabel.style.color = 'var(--success-color)';
      strengthLabel.textContent = 'Strong';
    }
  }

  const isValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial && matches;
  if (submitBtn) {
    submitBtn.disabled = !isValid;
  }
}

async function handleFirstLoginPasswordChangeSubmit(event) {
  event.preventDefault();
  const oldPassword = document.getElementById('first-login-old-password').value;
  const newPassword = document.getElementById('first-login-new-password').value;
  const confirmPassword = document.getElementById('first-login-confirm-password').value;

  const errorBox = document.getElementById('first-login-modal-error');
  const errorText = document.getElementById('first-login-modal-error-text');

  if (newPassword !== confirmPassword) {
    if (errorBox && errorText) {
      errorText.textContent = "New password and confirmation password do not match.";
      errorBox.style.display = 'flex';
    }
    return;
  }

  const officerId = sessionStorage.getItem('cib_pending_officer_id') || sessionStorage.getItem('cib_officer_id');
  const token = sessionStorage.getItem('cib_jwt_token');

  const submitBtn = document.getElementById('first-login-password-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Updating Password...';

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ officerId, oldPassword, newPassword })
    });
    const result = await res.json();

    if (res.ok && result.success) {
      if (errorBox) errorBox.style.display = 'none';
      sessionStorage.setItem('cib_session_active', 'true');
      sessionStorage.setItem('cib_jwt_token', result.data.token);
      sessionStorage.setItem('cib_officer_id', officerId);
      sessionStorage.setItem('cib_officer_role', result.data.role);
      sessionStorage.setItem('cib_officer_name', result.data.name);
      triggerToast("Password successfully updated! Proceeding to Dashboard.", "success");
      hideModal('modal-first-login-change-password');
      sessionStorage.removeItem('cib_pending_officer_id');
      document.getElementById('first-login-password-form').reset();
      await initDashboard();
    } else {
      const msg = result.error || result.message || "Password update failed.";
      if (errorBox && errorText) {
        errorText.textContent = msg;
        errorBox.style.display = 'flex';
      }
      triggerToast(msg, "danger");
    }
  } catch (err) {
    console.error(err);
    if (errorBox && errorText) {
      errorText.textContent = "Server connection error. Please try again.";
      errorBox.style.display = 'flex';
    }
    triggerToast("Server connection error.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="ri-key-line"></i> Update Password`;
  }
}

async function toggleSuspendOfficer(id, currentStatus) {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch(`/api/officers/${id}/suspend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ suspend: currentStatus })
    });
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast(currentStatus ? "Officer suspended." : "Officer activated.", "success");
      await renderOfficersList();
    } else {
      triggerToast(result.error || "Failed to update status.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

async function resetOfficerPassword(id) {
  if (!confirm("Are you sure you want to reset password for this officer?")) return;
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch(`/api/officers/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Password reset successfully. Credentials sent to email.", "success");
    } else {
      triggerToast(result.error || "Failed to reset password.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

async function deleteOfficer(id) {
  if (!confirm("Are you sure you want to delete this officer permanently?")) return;
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch(`/api/officers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Officer removed successfully.", "success");
      await renderOfficersList();
    } else {
      triggerToast(result.error || "Failed to delete officer.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

async function viewOfficerLogs(id) {
  const officer = window.CIB_DB.officers.find(o => o.id === id);
  if (!officer) return;

  // Hydrate profile tab
  document.getElementById('detail-avatar-img').src = getAvatarSvg(officer.name);
  document.getElementById('detail-name').textContent = officer.name;
  document.getElementById('detail-id').textContent = officer.id;
  document.getElementById('detail-role').textContent = officer.role;
  document.getElementById('detail-rank').textContent = officer.rank || 'N/A';
  document.getElementById('detail-dept').textContent = officer.department || 'N/A';
  document.getElementById('detail-station').textContent = officer.policeStation || 'N/A';
  
  const statusSpan = document.getElementById('detail-status');
  statusSpan.textContent = officer.isActive ? 'Active' : 'Suspended';
  statusSpan.className = officer.isActive ? 'badge badge-status-solved' : 'badge priority-high';
  
  document.getElementById('detail-email').textContent = officer.email;
  document.getElementById('detail-phone').textContent = officer.phone || 'N/A';
  document.getElementById('detail-created').textContent = new Date(officer.createdAt).toLocaleString();

  // Fetch logs
  const token = sessionStorage.getItem('cib_jwt_token');
  const activityLogsDiv = document.getElementById('detail-activity-logs');
  const loginLogsDiv = document.getElementById('detail-login-logs');
  
  activityLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Loading logs...</div>';
  loginLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Loading logs...</div>';

  showModal('modal-officer-detail');
  switchModalTab('profile');

  try {
    const response = await fetch(`/api/officers/${id}/logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (response.ok && result.success) {
      // Activity Logs
      activityLogsDiv.innerHTML = '';
      if (result.data.activityLogs.length === 0) {
        activityLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">No activity logs found.</div>';
      } else {
        result.data.activityLogs.forEach(l => {
          const div = document.createElement('div');
          div.className = 'log-item';
          div.innerHTML = `
            <div class="log-date">${new Date(l.timestamp).toLocaleString()}</div>
            <div>${l.action}</div>
          `;
          activityLogsDiv.appendChild(div);
        });
      }

      // Login Logs (filtered from audit logs)
      loginLogsDiv.innerHTML = '';
      const loginLogs = result.data.auditLogs;
      if (loginLogs.length === 0) {
        loginLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">No login history found.</div>';
      } else {
        loginLogs.forEach(l => {
          const div = document.createElement('div');
          div.className = 'log-item';
          div.innerHTML = `
            <div class="log-date">${new Date(l.timestamp).toLocaleString()}</div>
            <div><strong>${l.action}</strong>${l.details ? ` - ${l.details}` : ''}</div>
          `;
          loginLogsDiv.appendChild(div);
        });
      }
    } else {
      activityLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Failed to load logs.</div>';
      loginLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Failed to load logs.</div>';
    }
  } catch (err) {
    console.error(err);
    activityLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Server connection error.</div>';
    loginLogsDiv.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding:10px;">Server connection error.</div>';
  }
}

// Reports generation and export mocks
function renderReportOptions() {
  const selector = document.getElementById('report-case-select');
  if (!selector) return;
  selector.innerHTML = '';
  
  window.CIB_DB.cases.forEach(c => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = `${c.id} - ${c.title}`;
    selector.appendChild(option);
  });
}

function generateReportType(reportType) {
  const caseId = document.getElementById('report-case-select').value;
  const target = window.CIB_DB.cases.find(c => c.id === caseId);
  if (!target) return;
  
  const preview = document.getElementById('report-doc-preview');
  
  let docContent = `========================================================\n`;
  docContent += `             CRIME INVESTIGATION BOARD REPORT            \n`;
  docContent += `========================================================\n`;
  docContent += `Report Type    : ${reportType}\n`;
  docContent += `Target Case ID : ${target.id}\n`;
  docContent += `Classification : INTERNAL SECURE USE ONLY\n`;
  docContent += `Timestamp      : ${new Date().toISOString()}\n`;
  docContent += `Lead Officer   : ${target.assignedOfficer || 'Marcus Vance'}\n`;
  docContent += `--------------------------------------------------------\n\n`;
  
  if (reportType === 'Chargesheet') {
    docContent += `SUSPECT LIST:\n`;
    const suspects = target.suspects || [];
    suspects.forEach(s => {
      docContent += `- ${s}\n`;
    });
    docContent += `\nCASE NOTES:\n${target.notes || 'No notes logged.'}\n\n`;
    docContent += `STATUS: Charges proposed for Grand Jury indictment.`;
  } else if (reportType === 'Final Summary') {
    docContent += `INCIDENT SUMMARY & STATUS:\n`;
    docContent += `The case details events originating on ${target.createdDate} at ${target.location}.\n`;
    docContent += `Status is marked as ${target.status}.\n\n`;
    docContent += `RESOLVED METRICS:\n`;
    const timeline = target.timeline || [];
    docContent += `Investigation steps complete: ${timeline.filter((t) => t.completed).length} of ${timeline.length}.`;
  } else {
    docContent += `EVIDENCE SUMMARY LOGS:\n`;
    const relatedEv = window.CIB_DB.evidence.filter(e => e.caseId === caseId);
    if (relatedEv.length === 0) {
      docContent += `No items registered for this case in the secure vault.`;
    } else {
      relatedEv.forEach(e => {
        docContent += `- ${e.id} [${e.category}]: ${e.name} (Status: ${e.verificationStatus})\n`;
      });
    }
  }
  
  preview.textContent = docContent;
  triggerToast(`Generated ${reportType} findings. Ready for export.`, "success");
}

function exportPDFMock() {
  const docText = document.getElementById('report-doc-preview').textContent;
  if (docText.trim().startsWith('Select a case')) {
    triggerToast("Please generate a report document first.", "danger");
    return;
  }
  
  const blob = new Blob([docText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CIB-Report-${new Date().toISOString().split('T')[0]}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  triggerToast("Legally signed and exported PDF file downloaded.", "success");
}

// Investigation Room Logic
function initRoomView() {
  const selector = document.getElementById('room-case-selector');
  if (!selector) return;
  selector.innerHTML = '';
  window.CIB_DB.cases.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.id} - ${c.title}`;
    selector.appendChild(opt);
  });
  
  if (window.CIB_DB.cases.length > 0) {
    loadRoomCase(window.CIB_DB.cases[0].id);
  }
}

function loadRoomCase(caseId) {
  const target = window.CIB_DB.cases.find(c => c.id === caseId);
  if (!target) return;
  
  document.getElementById('room-notes').value = target.notes || 'No security notes compiled.';
  
  const timelineContainer = document.getElementById('room-timeline');
  timelineContainer.innerHTML = '';
  const timeline = target.timeline || [];
  timeline.forEach(step => {
    const stepEl = document.createElement('div');
    stepEl.className = `timeline-step ${step.completed ? 'completed' : ''}`;
    stepEl.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content" style="padding: 10px;">
        <div class="timeline-title" style="font-size:12px; font-weight:600;">${step.step}</div>
        <span style="font-size:10px; color:var(--text-secondary);">${step.date}</span>
      </div>
    `;
    timelineContainer.appendChild(stepEl);
  });

  const activitiesContainer = document.getElementById('room-activities');
  activitiesContainer.innerHTML = '';
  const relatedTasks = window.CIB_DB.tasks;
  relatedTasks.forEach(task => {
    const item = document.createElement('div');
    item.style = 'background-color: var(--card-color); border:1px solid var(--border-color); padding: 10px; border-radius: var(--radius-md); font-size:12px; display:flex; justify-content:space-between; align-items:center;';
    item.innerHTML = `
      <span>${task.title}</span>
      <span class="badge ${task.done ? 'badge-status-solved' : 'priority-medium'}" style="font-size:9px; padding:2px 6px;">${task.done ? 'DONE' : 'PENDING'}</span>
    `;
    activitiesContainer.appendChild(item);
  });

  const board = document.getElementById('room-connection-board');
  board.innerHTML = '';

  const relatedEv = window.CIB_DB.evidence.filter(e => e.caseId === caseId);
  
  let svgContent = `<svg width="100%" height="100%" style="position:absolute; top:0; left:0;">`;
  
  svgContent += `
    <!-- Connective Threads -->
    <line x1="280" y1="160" x2="100" y2="80" stroke="var(--danger-color)" stroke-width="2" stroke-dasharray="4" />
    <line x1="280" y1="160" x2="460" y2="80" stroke="var(--danger-color)" stroke-width="2" stroke-dasharray="4" />
  `;
  
  relatedEv.forEach((ev, idx) => {
    const evX = idx === 0 ? 100 : 460;
    const evY = 240;
    svgContent += `<line x1="280" y1="160" x2="${evX}" y2="${evY}" stroke="var(--primary-color)" stroke-width="1.5" />`;
  });
  
  svgContent += `</svg>`;
  board.innerHTML = svgContent;
  
  board.innerHTML += `
    <div style="position:absolute; left:230px; top:120px; width:100px; padding:12px; background: rgba(37,99,235,0.1); border: 2px solid var(--primary-color); border-radius: var(--radius-md); text-align:center; box-shadow:0 0 15px rgba(37,99,235,0.4);">
      <div style="font-weight:700; font-size:12px; color:white;">${target.id}</div>
      <div style="font-size:9px; color:var(--text-secondary); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${target.title}</div>
    </div>
  `;
  
  const suspects = target.suspects || [];
  if (suspects.length > 0) {
    board.innerHTML += `
      <div style="position:absolute; left:40px; top:40px; width:120px; padding:8px; background: var(--card-color); border: 1px solid var(--border-light); border-radius: var(--radius-md); text-align:center;">
        <i class="ri-user-shared-line" style="font-size:16px; color:var(--danger-color);"></i>
        <div style="font-weight:600; font-size:11px; margin-top:4px;">${suspects[0]}</div>
        <div style="font-size:9px; color:var(--text-secondary);">Primary Suspect</div>
      </div>
    `;
  }
  
  // Resolve assigned officer name
  const leadOfficer = window.CIB_DB.officers.find(o => o.id === target.officerId);
  const leadName = leadOfficer ? leadOfficer.name : 'Marcus Vance';

  board.innerHTML += `
    <div style="position:absolute; left:400px; top:40px; width:120px; padding:8px; background: var(--card-color); border: 1px solid var(--border-light); border-radius: var(--radius-md); text-align:center;">
      <i class="ri-shield-user-line" style="font-size:16px; color:var(--success-color);"></i>
      <div style="font-weight:600; font-size:11px; margin-top:4px;">${leadName}</div>
      <div style="font-size:9px; color:var(--text-secondary);">Lead Officer</div>
    </div>
  `;
  
  relatedEv.forEach((ev, idx) => {
    const evX = idx === 0 ? 40 : 400;
    const evY = 220;
    board.innerHTML += `
      <div class="evidence-card" onclick="switchView('io-evidence'); previewEvidence('${ev.id}')" style="position:absolute; left:${evX}px; top:${evY}px; width:130px; padding:8px; background: var(--card-color); border: 1px solid var(--border-light); border-radius: var(--radius-md); text-align:center;">
        <i class="ri-bubble-chart-line" style="font-size:16px; color:var(--primary-color);"></i>
        <div style="font-weight:600; font-size:10px; margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ev.name}</div>
        <div style="font-size:9px; color:var(--text-secondary);">${ev.id}</div>
      </div>
    `;
  });
  
  triggerToast(`Loaded command board connection mapping for ${caseId}`);
}

async function triggerGlobalSearch(query) {
  if (!query) {
    renderCasesTable();
    return;
  }
  
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (response.ok && result.success) {
      const casesResult = result.data.cases || [];
      renderCasesTable(casesResult);
      
      if (casesResult.length > 0) {
        if (currentActiveView !== 'sa-cases' && currentActiveView !== 'io-cases') {
          const activeRole = sessionStorage.getItem('cib_officer_role') || 'SUPER_ADMIN';
          const targetView = (activeRole === 'SUPER_ADMIN' || activeRole === 'SUPERINTENDENT') ? 'sa-cases' : 'io-cases';
          switchView(targetView);
        }
      }
    }
  } catch (err) {
    console.error('[Global Search] Backend query failed:', err);
  }
}

// Notification Center Simulator
function showNotificationCenter() {
  triggerToast("Incident alert: DNA comparison for EVID-1182 verified successfully.", "success");
}

// Window Bindings for Officer Management
window.showAddOfficerModal = showAddOfficerModal;
window.showEditOfficerModal = showEditOfficerModal;
window.handleOfficerSubmit = handleOfficerSubmit;
window.toggleSuspendOfficer = toggleSuspendOfficer;
window.resetOfficerPassword = resetOfficerPassword;
window.deleteOfficer = deleteOfficer;
window.viewOfficerLogs = viewOfficerLogs;
window.switchModalTab = switchModalTab;
window.hideModal = hideModal;
window.renderOfficersTable = renderOfficersTable;
window.renderOfficersList = renderOfficersList;

// Investigation Workflow Implementations: Live PostgreSQL FIRs & Cases Synchronization
async function fetchAndRenderFirs() {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const [firRes, caseRes] = await Promise.all([
      fetch('/api/firs', { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch('/api/cases', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    if (firRes.ok) {
      const firData = await firRes.json();
      if (firData.success) {
        window.CIB_DB.firs = firData.data || [];
      }
    }

    if (caseRes.ok) {
      const caseData = await caseRes.json();
      if (caseData.success) {
        window.CIB_DB.cases = caseData.data || [];
      }
    }

    // Populate SI FIR table if present
    const tbody = document.getElementById('si-firs-table-body');
    if (tbody) {
      tbody.innerHTML = '';
      if (window.CIB_DB.firs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 24px;">No FIR records registered in PostgreSQL database.</td></tr>`;
      } else {
        window.CIB_DB.firs.forEach(f => {
          const tr = document.createElement('tr');
          const hasCase = window.CIB_DB.cases.some(c => c.firId === f.id || c.id === f.case?.id);
          const actionBtn = hasCase 
            ? `<span class="badge badge-status-solved" style="padding: 4px 10px; font-size: 11px;"><i class="ri-checkbox-circle-line"></i> Case Opened</span>`
            : `<button class="btn-primary" style="padding: 6px 12px; font-size:11px; width:auto;" onclick="showCreateCaseFromFirModal('${f.id}')"><i class="ri-folder-add-line"></i> Open Case</button>`;

          const dateStr = f.date ? new Date(f.date).toLocaleDateString() : 'N/A';
          tr.innerHTML = `
            <td><strong style="color: var(--primary-color); font-family: monospace;">${f.id}</strong></td>
            <td>${f.reporter}</td>
            <td><span class="badge priority-medium" style="font-size:11px;">${f.crimeCategory || 'Other'}</span></td>
            <td>${dateStr}</td>
            <td>${f.location || 'N/A'}</td>
            <td><span class="badge badge-status-active" style="font-size: 11px;">${f.status}</span></td>
            <td style="text-align: right;">${actionBtn}</td>
          `;
          tbody.appendChild(tr);
        });
      }
    }

    // Render Manage Cases table automatically
    renderCasesTable();
  } catch (err) {
    console.error('[FIR/Case list] Fetch failed:', err);
  }
}

// Super Admin: Show Assign SI Modal
async function showAssignSiModal(firId) {
  document.getElementById('assign-si-fir-id').value = firId;
  const select = document.getElementById('assign-si-select');
  const remarksInput = document.getElementById('assign-si-remarks');
  if (remarksInput) remarksInput.value = '';

  select.innerHTML = '<option value="">Loading Sub Inspector officers...</option>';
  showModal('modal-assign-si');

  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch('/api/officers?role=SUB_INSPECTOR&status=active&limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      const rawData = Array.isArray(result.data) ? result.data : (result.data?.officers || []);
      const sis = rawData.filter(o => {
        const role = o.role || o.user?.role;
        const active = o.isActive !== false && (o.user ? o.user.isActive !== false : true);
        return role === 'SUB_INSPECTOR' && active;
      });

      if (sis.length === 0) {
        select.innerHTML = '<option value="">No Sub Inspectors available. Please create one first.</option>';
        return;
      }

      select.innerHTML = '<option value="">Select Sub Inspector...</option>';
      sis.forEach(o => {
        const option = document.createElement('option');
        const officerId = o.id || o.badgeNumber || o.officer?.id;
        const displayName = o.name || o.user?.name || 'Sub Inspector';
        const displayRank = o.rank || o.officer?.rank || 'SUB_INSPECTOR';

        option.value = officerId;
        option.textContent = `${displayName} (${displayRank} - ${officerId})`;
        select.appendChild(option);
      });
    } else {
      select.innerHTML = '<option value="">Error loading officers</option>';
    }
  } catch (err) {
    console.error('Error fetching SIs:', err);
    select.innerHTML = '<option value="">Error loading officers</option>';
  }
}

// Super Admin: Handle Assign SI Submission
async function handleAssignSiSubmit(event) {
  event.preventDefault();
  const firId = document.getElementById('assign-si-fir-id').value;
  const officerId = document.getElementById('assign-si-select').value;
  const remarks = document.getElementById('assign-si-remarks').value;
  const token = sessionStorage.getItem('cib_jwt_token');

  if (!officerId) {
    triggerToast("Please select a Sub Inspector to assign.", "danger");
    return;
  }

  const submitBtn = document.getElementById('assign-si-submit-btn');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ri-loader-4-line spinner"></i> Assigning...`;

  try {
    const response = await fetch(`/api/firs/${firId}/assign`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ officerId, remarks })
    });

    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast(result.message || `FIR ${firId} assigned to SI.`, "success");
      hideModal('modal-assign-si');
      await fetchAndRenderFirs();
    } else {
      triggerToast(result.error || "Failed to assign SI.", "danger");
    }
  } catch (err) {
    console.error('Assign SI submission error:', err);
    triggerToast("Server connection error during assignment.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

// Sub Inspector: Start Investigation on Assigned FIR
async function startFirInvestigation(firId) {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch(`/api/firs/${firId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'Under Investigation' })
    });
    const result = await res.json();
    if (res.ok && result.success) {
      triggerToast(`Investigation initiated for FIR ${firId}. Status: Under Investigation.`, "success");
      await fetchAndRenderFirs();
    } else {
      showCreateCaseFromFirModal(firId);
    }
  } catch (err) {
    console.error('Start investigation error:', err);
    showCreateCaseFromFirModal(firId);
  }
}

// Super Admin: Delete FIR or Case with confirmation modal
function deleteFirOrCase(id, type = 'fir') {
  document.getElementById('delete-target-id').textContent = id;
  document.getElementById('delete-target-type').value = type;
  showModal('modal-confirm-delete');
}

async function executeDeleteRecord() {
  const id = document.getElementById('delete-target-id').textContent;
  const type = document.getElementById('delete-target-type').value;
  const token = sessionStorage.getItem('cib_jwt_token');

  const btn = document.getElementById('confirm-delete-btn');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i class="ri-loader-4-line spinner"></i> Deleting...`;

  try {
    const endpoint = type === 'case' ? `/api/cases/${id}` : `/api/firs/${id}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      triggerToast(result.message || `${id} permanently deleted.`, "success");
      hideModal('modal-confirm-delete');
      await fetchAndRenderFirs();
    } else {
      triggerToast(result.error || "Failed to delete record.", "danger");
    }
  } catch (err) {
    console.error('Delete error:', err);
    triggerToast("Server connection error during deletion.", "danger");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

function showRegisterFirModal() {
  document.getElementById('fir-modal-mode').value = 'register';
  document.getElementById('fir-form-details-section').style.display = 'flex';
  document.getElementById('fir-form-case-section').style.display = 'none';

  // Modal Title & Button
  const modalTitle = document.querySelector('#modal-register-fir .modal-title');
  if (modalTitle) modalTitle.innerHTML = `<i class="ri-file-add-line"></i> Register FIR Entry`;
  const submitBtn = document.querySelector('#modal-register-fir button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = `Register FIR`;
    submitBtn.disabled = false;
  }

  // Clear inputs
  document.getElementById('fir-form-id').value = '';
  document.getElementById('fir-form-reporter').value = '';
  document.getElementById('fir-form-contact').value = '';
  document.getElementById('fir-form-title').value = '';
  document.getElementById('fir-form-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('fir-form-time').value = new Date().toTimeString().split(' ')[0].slice(0, 5);
  document.getElementById('fir-form-desc').value = '';
  document.getElementById('fir-form-location').value = '';
  document.getElementById('fir-form-category').value = 'Homicide';

  showModal('modal-register-fir');
}

function showCreateCaseFromFirModal(firId) {
  document.getElementById('fir-modal-mode').value = 'create-case';
  document.getElementById('fir-form-details-section').style.display = 'none';
  document.getElementById('fir-form-case-section').style.display = 'flex';

  // Modal Title & Button
  const modalTitle = document.querySelector('#modal-register-fir .modal-title');
  if (modalTitle) modalTitle.innerHTML = `<i class="ri-folder-add-line"></i> Initiate Criminal Case from FIR`;
  const submitBtn = document.querySelector('#modal-register-fir button[type="submit"]');
  if (submitBtn) {
    submitBtn.innerHTML = `Create Case File`;
    submitBtn.disabled = false;
  }

  // Populate IDs
  document.getElementById('fir-form-id').value = firId;
  const rawNum = firId.split('-').pop() || '';
  document.getElementById('fir-case-id').value = `CASE-2026-${rawNum}`;
  document.getElementById('fir-case-title').value = '';
  document.getElementById('fir-victim-name').value = '';
  document.getElementById('fir-victim-contact').value = '';
  document.getElementById('fir-suspect-name').value = '';
  document.getElementById('fir-suspect-desc').value = '';

  // Setup officer dropdown
  const officerSelect = document.getElementById('fir-assigned-officer');
  const currentOfficerId = sessionStorage.getItem('cib_officer_id');
  const currentRole = sessionStorage.getItem('cib_officer_role');
  if (officerSelect) {
    officerSelect.innerHTML = '<option value="">Select Officer...</option>';
    (window.CIB_DB.officers || []).forEach(o => {
      const option = document.createElement('option');
      option.value = o.id;
      option.textContent = `${o.name} (${o.role})`;
      officerSelect.appendChild(option);
    });
    if (currentOfficerId && currentRole === 'SUB_INSPECTOR') {
      officerSelect.value = currentOfficerId;
    }
  }

  showModal('modal-register-fir');
}

async function handleFirSubmit(event) {
  event.preventDefault();
  const mode = document.getElementById('fir-modal-mode').value;
  const firId = document.getElementById('fir-form-id').value;
  const token = sessionStorage.getItem('cib_jwt_token');

  const submitBtn = document.querySelector('#modal-register-fir button[type="submit"]');
  const originalHtml = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="ri-loader-4-line spinner"></i> Processing...`;

  try {
    if (mode === 'register') {
      const reporter = document.getElementById('fir-form-reporter').value;
      const complainantContact = document.getElementById('fir-form-contact').value;
      const title = document.getElementById('fir-form-title').value;
      const incidentDate = document.getElementById('fir-form-date').value;
      const incidentTime = document.getElementById('fir-form-time').value;
      const crimeCategory = document.getElementById('fir-form-category').value;
      const location = document.getElementById('fir-form-location').value;
      const description = document.getElementById('fir-form-desc').value;

      const response = await fetch('/api/firs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          reporter,
          complainantContact,
          incidentDate,
          incidentTime,
          crimeCategory,
          location
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        triggerToast(`FIR successfully logged. Assigned reference ID: ${result.data.id}`, "success");
        hideModal('modal-register-fir');
        await initDashboard();
      } else {
        triggerToast(result.error || "Failed to register FIR.", "danger");
      }
    } else {
      // mode === 'create-case'
      const caseId = document.getElementById('fir-case-id').value;
      const caseTitle = document.getElementById('fir-case-title').value;
      const priority = document.getElementById('fir-case-priority').value;
      const assignedOfficerId = document.getElementById('fir-assigned-officer').value;
      const victimName = document.getElementById('fir-victim-name').value;
      const victimContact = document.getElementById('fir-victim-contact').value;
      const suspectName = document.getElementById('fir-suspect-name').value;
      const suspectDesc = document.getElementById('fir-suspect-desc').value;

      // Extract crime type and location from matched FIR details
      const matchedFir = (window.CIB_DB.firs || []).find(f => f.id === firId);
      const crimeType = matchedFir ? matchedFir.crimeCategory : 'Other';
      const location = matchedFir ? matchedFir.location : 'Unknown';

      // Inline validation
      if (!caseId.trim() || !caseTitle.trim() || !assignedOfficerId) {
        triggerToast("Please complete all required case details.", "danger");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        return;
      }

      const caseResponse = await fetch('/api/workflow/create-case', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: caseId,
          title: caseTitle,
          crimeType,
          priority,
          location,
          firId,
          assignedOfficerId,
          victimName,
          suspectName
        })
      });

      const caseResult = await caseResponse.json();
      if (caseResponse.ok && caseResult.success) {
        triggerToast("Case file generated and initiated successfully.", "success");
        hideModal('modal-register-fir');
        await initDashboard();
      } else {
        triggerToast(caseResult.error || "Failed to initiate Case.", "danger");
      }
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalHtml;
  }
}

async function showAssignInspectorModal(caseId) {
  document.getElementById('assign-case-id').value = caseId;
  const select = document.getElementById('assign-inspector-select');
  if (!select) return;
  select.innerHTML = '';

  // Get all officers from the DB/cache
  await fetchOfficers();
  
  // Filter for INSPECTOR role
  const inspectors = window.CIB_DB.officers.filter(o => o.role === 'INSPECTOR');
  if (inspectors.length === 0) {
    select.innerHTML = '<option value="">No Inspectors available in division</option>';
  } else {
    inspectors.forEach(ins => {
      select.innerHTML += `<option value="${ins.id}">${ins.name} (${ins.rank || 'Inspector'})</option>`;
    });
  }

  showModal('modal-assign-inspector');
}

async function handleAssignInspectorSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('assign-case-id').value;
  const inspectorId = document.getElementById('assign-inspector-select').value;
  if (!inspectorId) return;

  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/assign-inspector', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ caseId, inspectorId })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Case assigned to officer successfully.", "success");
      hideModal('modal-assign-inspector');
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Failed to assign officer.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

function showEvidenceUploadModal(caseId) {
  const selectedCase = (window.CIB_DB.cases || []).find(c => c.id === caseId || c.firId === caseId)
                    || (window.CIB_DB.firs || []).find(f => f.id === caseId);

  let actualCaseId = caseId;
  if (selectedCase) {
    if (selectedCase.linkedCaseId) actualCaseId = selectedCase.linkedCaseId;
    else if (selectedCase.case?.id) actualCaseId = selectedCase.case.id;
    else if (selectedCase.id && !selectedCase.isFir) actualCaseId = selectedCase.id;
    else {
      const match = (window.CIB_DB.cases || []).find(c => c.id === caseId || c.firId === caseId);
      if (match) actualCaseId = match.id;
    }
  }

  console.log('[DEBUG WORKFLOW] Upload Evidence values:', {
    passedParam: caseId,
    selectedCaseObject: selectedCase,
    'Case.id': actualCaseId,
    'Case.caseNumber': selectedCase?.caseNumber || selectedCase?.id || null,
    'FIR number': selectedCase?.firNumber || selectedCase?.firId || null,
    'FIR id': selectedCase?.isFir ? selectedCase?.id : (selectedCase?.firId || null),
    'Assignment id': selectedCase?.assignmentId || null
  });

  document.getElementById('evidence-case-id').value = actualCaseId;
  const titleInput = document.getElementById('evidence-title-input');
  if (titleInput) titleInput.value = '';
  const remarksInput = document.getElementById('evidence-remarks-input');
  if (remarksInput) remarksInput.value = '';
  document.getElementById('evidence-file-input').value = '';
  const fileInfo = document.getElementById('drag-drop-file-info');
  if (fileInfo) fileInfo.style.display = 'none';
  const progressContainer = document.getElementById('evidence-progress-container');
  if (progressContainer) progressContainer.style.display = 'none';
  showModal('modal-evidence-upload');
  initDragAndDropUpload();
}

function handleEvidenceFileSelect(event) {
  const file = event.target.files ? event.target.files[0] : null;
  const infoEl = document.getElementById('drag-drop-file-info');
  if (file && infoEl) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    infoEl.style.display = 'block';
    infoEl.innerHTML = `<i class="ri-checkbox-circle-line"></i> Selected File: <strong>${file.name}</strong> (${sizeMb} MB)`;
  }
}

function initDragAndDropUpload() {
  const dropZone = document.getElementById('evidence-drop-zone');
  if (!dropZone) return;

  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, e => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.backgroundColor = 'rgba(37,99,235,0.15)';
      dropZone.style.borderColor = 'var(--success-color)';
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => {
      dropZone.style.backgroundColor = 'rgba(37,99,235,0.05)';
      dropZone.style.borderColor = 'var(--primary-color)';
    }, false);
  });

  dropZone.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files && files.length > 0) {
      const fileInput = document.getElementById('evidence-file-input');
      if (fileInput) {
        fileInput.files = files;
        handleEvidenceFileSelect({ target: fileInput });
      }
    }
  }, false);
}

function handleEvidenceUploadSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('evidence-case-id').value;
  console.log('[DEBUG WORKFLOW] caseId before FormData.append():', caseId);

  const fileInput = document.getElementById('evidence-file-input');
  const titleInput = document.getElementById('evidence-title-input');
  const category = document.getElementById('evidence-category-select').value;
  const remarksInput = document.getElementById('evidence-remarks-input');

  if (fileInput.files.length === 0) {
    triggerToast("Please select a file to upload.", "danger");
    return;
  }

  const file = fileInput.files[0];
  if (file.size > 25 * 1024 * 1024) {
    triggerToast("File size exceeds maximum limit of 25MB.", "danger");
    return;
  }

  const token = sessionStorage.getItem('cib_jwt_token');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('caseId', caseId);
  formData.append('category', category);
  formData.append('title', titleInput ? titleInput.value : file.name);
  formData.append('remarks', remarksInput ? remarksInput.value : '');

  const submitBtn = document.getElementById('evidence-upload-submit-btn');
  const progressContainer = document.getElementById('evidence-progress-container');
  const progressBar = document.getElementById('evidence-progress-bar');
  const progressText = document.getElementById('evidence-progress-text');

  if (submitBtn) submitBtn.disabled = true;
  if (progressContainer) progressContainer.style.display = 'flex';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/evidence/upload', true);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}%`;
    }
  };

  xhr.onload = async function() {
    if (submitBtn) submitBtn.disabled = false;
    try {
      const result = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && result.success) {
        triggerToast("Evidence file successfully uploaded to Cloudinary and saved to PostgreSQL.", "success");
        hideModal('modal-evidence-upload');
        await initDashboard();
        openCaseDetail(caseId);
      } else {
        triggerToast(result.error || result.message || "Evidence upload failed.", "danger");
      }
    } catch (err) {
      console.error('Upload parse error:', err);
      triggerToast("Upload failed due to server error.", "danger");
    }
  };

  xhr.onerror = function() {
    if (submitBtn) submitBtn.disabled = false;
    triggerToast("Network error during file upload.", "danger");
  };

  xhr.send(formData);
}

function showRequestForensicModal(caseId) {
  const selectedCase = (window.CIB_DB.cases || []).find(c => c.id === caseId || c.firId === caseId)
                    || (window.CIB_DB.firs || []).find(f => f.id === caseId);

  let actualCaseId = caseId;
  if (selectedCase) {
    if (selectedCase.linkedCaseId) actualCaseId = selectedCase.linkedCaseId;
    else if (selectedCase.case?.id) actualCaseId = selectedCase.case.id;
    else if (selectedCase.id && !selectedCase.isFir) actualCaseId = selectedCase.id;
    else {
      const match = (window.CIB_DB.cases || []).find(c => c.id === caseId || c.firId === caseId);
      if (match) actualCaseId = match.id;
    }
  }

  console.log('[DEBUG WORKFLOW] Send to Forensics values:', {
    passedParam: caseId,
    selectedCaseObject: selectedCase,
    'Case.id': actualCaseId,
    'Case.caseNumber': selectedCase?.caseNumber || selectedCase?.id || null,
    'FIR number': selectedCase?.firNumber || selectedCase?.firId || null,
    'FIR id': selectedCase?.isFir ? selectedCase?.id : (selectedCase?.firId || null),
    'Assignment id': selectedCase?.assignmentId || null
  });

  document.getElementById('forensic-case-id').value = actualCaseId;
  document.getElementById('forensic-report-id').value = `FOR-2026-${Math.floor(100 + Math.random() * 900)}`;
  document.getElementById('forensic-summary-input').value = '';
  showModal('modal-request-forensic');
}

async function handleRequestForensicSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('forensic-case-id').value;
  console.log('[DEBUG WORKFLOW] forensic caseId before request:', caseId);
  const reportId = document.getElementById('forensic-report-id').value;
  const type = document.getElementById('forensic-type-select').value;
  const summary = document.getElementById('forensic-summary-input').value;

  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/request-forensic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reportId, caseId, type, summary })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Forensic laboratory analysis request submitted.", "success");
      hideModal('modal-request-forensic');
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Request failed.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

function showSubmitForensicModal(reportId, caseId = '', defaultTitle = '', defaultType = '') {
  document.getElementById('submit-report-id').value = reportId;
  const caseIdInput = document.getElementById('submit-report-case-id');
  if (caseIdInput) caseIdInput.value = caseId;
  
  const titleInput = document.getElementById('submit-forensic-title');
  if (titleInput) titleInput.value = defaultTitle ? `${defaultTitle} - Verified Findings` : '';
  
  const findingsInput = document.getElementById('submit-forensic-findings');
  if (findingsInput) findingsInput.value = '';
  
  const recInput = document.getElementById('submit-forensic-recommendation');
  if (recInput) recInput.value = '';
  
  const remarksInput = document.getElementById('submit-forensic-remarks');
  if (remarksInput) remarksInput.value = '';
  
  const fileInput = document.getElementById('submit-forensic-file');
  if (fileInput) fileInput.value = '';
  
  const progressContainer = document.getElementById('forensic-progress-container');
  if (progressContainer) progressContainer.style.display = 'none';
  
  showModal('modal-submit-forensic');
}

function handleSubmitForensicSubmit(event) {
  event.preventDefault();
  const reportId = document.getElementById('submit-report-id').value;
  const caseId = document.getElementById('submit-report-case-id')?.value || reportId;
  const titleInput = document.getElementById('submit-forensic-title');
  const fileInput = document.getElementById('submit-forensic-file');
  const findingsInput = document.getElementById('submit-forensic-findings');
  const recommendationInput = document.getElementById('submit-forensic-recommendation');
  const remarksInput = document.getElementById('submit-forensic-remarks');

  if (fileInput && fileInput.files.length === 0) {
    triggerToast("Please attach a PDF or Document report file.", "danger");
    return;
  }

  const token = sessionStorage.getItem('cib_jwt_token');
  const formData = new FormData();
  formData.append('reportId', reportId);
  formData.append('caseId', caseId);
  formData.append('reportTitle', titleInput ? titleInput.value : 'Forensic Report');
  formData.append('findings', findingsInput ? findingsInput.value : '');
  formData.append('recommendation', recommendationInput ? recommendationInput.value : '');
  formData.append('remarks', remarksInput ? remarksInput.value : '');
  if (fileInput && fileInput.files.length > 0) {
    formData.append('file', fileInput.files[0]);
  }

  const submitBtn = document.getElementById('submit-forensic-submit-btn');
  const progressContainer = document.getElementById('forensic-progress-container');
  const progressBar = document.getElementById('forensic-progress-bar');
  const progressText = document.getElementById('forensic-progress-text');

  if (submitBtn) submitBtn.disabled = true;
  if (progressContainer) progressContainer.style.display = 'flex';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/forensics/upload', true);
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      const percent = Math.round((e.loaded / e.total) * 100);
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressText) progressText.textContent = `${percent}%`;
    }
  };

  xhr.onload = async function() {
    if (submitBtn) submitBtn.disabled = false;
    try {
      const result = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && result.success) {
        triggerToast("Forensic report PDF and findings uploaded & Inspector notified.", "success");
        hideModal('modal-submit-forensic');
        await initDashboard();
        if (typeof renderForensicsLab === 'function') renderForensicsLab();
      } else {
        triggerToast(result.error || result.message || "Forensic upload failed.", "danger");
      }
    } catch (err) {
      console.error('Forensic upload error:', err);
      triggerToast("Forensic submission error.", "danger");
    }
  };

  xhr.onerror = function() {
    if (submitBtn) submitBtn.disabled = false;
    triggerToast("Network error during report upload.", "danger");
  };

  xhr.send(formData);
}

async function deleteEvidenceRecord(evidenceId, caseId = '') {
  if (!confirm(`Are you sure you want to permanently delete evidence file ${evidenceId}?`)) return;
  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await res.json();
    if (res.ok && result.success) {
      triggerToast(result.message || "Evidence file deleted.", "success");
      if (caseId) openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Failed to delete evidence file.", "danger");
    }
  } catch (err) {
    console.error('Delete evidence error:', err);
    triggerToast("Server error deleting evidence file.", "danger");
  }
}

function showReviewCaseModal(caseId) {
  document.getElementById('review-case-id').value = caseId;
  document.getElementById('review-notes-input').value = '';
  showModal('modal-review-case');
}

async function handleReviewCaseSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('review-case-id').value;
  const notes = document.getElementById('review-notes-input').value;

  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/review-case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ caseId, notes })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Case review remarks recorded in timeline.", "success");
      hideModal('modal-review-case');
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Failed to submit review.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

async function approveChargesheet(caseId) {
  if (!confirm("Are you sure you want to approve the chargesheet and CLOSE this case?")) return;
  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/approve-chargesheet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ caseId })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Chargesheet approved. Case closed and marked SOLVED.", "success");
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Failed to close case.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

async function completeInvestigation(caseId) {
  if (!confirm("Confirm investigation completion? This will submit findings for Superintendent review.")) return;
  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/complete-investigation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ caseId })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Investigation marked as completed and submitted.", "success");
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Failed to submit investigation.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

window.showRegisterFirModal = showRegisterFirModal;
window.showCreateCaseFromFirModal = showCreateCaseFromFirModal;
window.handleFirSubmit = handleFirSubmit;
window.fetchAndRenderFirs = fetchAndRenderFirs;
window.showAssignSiModal = showAssignSiModal;
window.handleAssignSiSubmit = handleAssignSiSubmit;
window.startFirInvestigation = startFirInvestigation;
window.deleteFirOrCase = deleteFirOrCase;
window.executeDeleteRecord = executeDeleteRecord;
window.showAssignInspectorModal = showAssignInspectorModal;
window.handleAssignInspectorSubmit = handleAssignInspectorSubmit;
window.showEvidenceUploadModal = showEvidenceUploadModal;
window.handleEvidenceUploadSubmit = handleEvidenceUploadSubmit;
window.handleEvidenceFileSelect = handleEvidenceFileSelect;
window.showRequestForensicModal = showRequestForensicModal;
window.handleRequestForensicSubmit = handleRequestForensicSubmit;
window.showSubmitForensicModal = showSubmitForensicModal;
window.handleSubmitForensicSubmit = handleSubmitForensicSubmit;
window.copyOfficerCredentials = copyOfficerCredentials;
window.resetOfficerPassword = resetOfficerPassword;
window.togglePasswordVisibility = togglePasswordVisibility;
window.validateFirstLoginPasswordInputs = validateFirstLoginPasswordInputs;
window.handleFirstLoginPasswordChangeSubmit = handleFirstLoginPasswordChangeSubmit;
window.showReviewCaseModal = showReviewCaseModal;
window.handleReviewCaseSubmit = handleReviewCaseSubmit;
window.approveChargesheet = approveChargesheet;
window.completeInvestigation = completeInvestigation;

async function loadGlobalAuditLogs() {
  const token = sessionStorage.getItem('cib_jwt_token');
  const container = document.getElementById('sa-audit-logs-list');
  if (!container) return;
  
  const searchInput = document.getElementById('audit-log-search');
  const actionSelect = document.getElementById('audit-log-filter-action');
  const roleSelect = document.getElementById('audit-log-filter-role');

  const search = searchInput ? searchInput.value : '';
  const action = actionSelect ? actionSelect.value : '';
  const role = roleSelect ? roleSelect.value : '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (action) params.append('action', action);
  if (role) params.append('role', role);
  params.append('page', auditPage);
  params.append('limit', auditPageSize);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  renderCardSkeletons('sa-audit-logs-list', 5);
  
  try {
    const response = await fetch(`/api/officers/audit-logs${queryStr}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const res = await response.json();
    if (response.ok && res.success) {
      const { logs, total } = res.data;
      totalAuditLogs = total;

      const rangeEl = document.getElementById('audit-pagination-range');
      const totalEl = document.getElementById('audit-pagination-total');
      const startIndex = (auditPage - 1) * auditPageSize;
      if (rangeEl) rangeEl.textContent = total ? `${startIndex + 1} - ${Math.min(startIndex + logs.length, total)}` : '0';
      if (totalEl) totalEl.textContent = total;

      if (logs.length === 0) {
        container.innerHTML = '<span style="color:var(--text-secondary);">No logs registered matching criteria.</span>';
      } else {
        container.innerHTML = '';
        logs.forEach(log => {
          const logDiv = document.createElement('div');
          logDiv.style.cssText = 'background-color: var(--card-color); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 8px;';
          logDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
              <strong style="color:var(--primary-color);">${log.action}</strong>
              <span style="color:var(--text-secondary); font-size:11px;">${new Date(log.timestamp).toLocaleString()}</span>
            </div>
            <div style="color:var(--text-secondary); font-size:12px; line-height:1.4;">${log.details || 'No details registered.'}</div>
            <div style="font-size:10px; color:var(--text-secondary); margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap;">
              <span>Officer: <strong>${log.userId || 'SYSTEM'}</strong></span>
              <span>Role: <strong>${log.role || 'N/A'}</strong></span>
              <span>IP: <strong>${log.ipAddress || 'unknown'}</strong></span>
              <span>Browser: <strong>${log.browser || 'N/A'}</strong></span>
              <span>Device: <strong>${log.device || 'N/A'}</strong></span>
            </div>
          `;
          container.appendChild(logDiv);
        });
      }
    } else {
      container.innerHTML = '<span style="color:var(--danger-color);">Verification error. Access denied.</span>';
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<span style="color:var(--danger-color);">Error connecting to system logs database.</span>';
  }
}

function paginateCases(direction) {
  const targetList = window.CIB_DB.cases;
  const total = targetList.length;
  if (direction === 'prev' && casesPage > 1) {
    casesPage--;
    renderCasesTable();
  } else if (direction === 'next' && casesPage * casesPageSize < total) {
    casesPage++;
    renderCasesTable();
  }
}

function paginateOfficers(direction) {
  const totalText = document.getElementById('officers-pagination-total')?.textContent || '0';
  const total = parseInt(totalText) || 0;
  
  if (direction === 'prev' && officersPage > 1) {
    officersPage--;
    renderOfficersTable();
  } else if (direction === 'next' && officersPage * officersPageSize < total) {
    officersPage++;
    renderOfficersTable();
  }
}

function paginateAuditLogs(direction) {
  if (direction === 'prev' && auditPage > 1) {
    auditPage--;
    loadGlobalAuditLogs();
  } else if (direction === 'next' && auditPage * auditPageSize < totalAuditLogs) {
    auditPage++;
    loadGlobalAuditLogs();
  }
}

function renderSkeletons(targetId, rowCount = 5, columnCount = 5) {
  const container = document.getElementById(targetId);
  if (!container) return;
  
  let html = '';
  for (let r = 0; r < rowCount; r++) {
    html += '<tr>';
    for (let c = 0; c < columnCount; c++) {
      html += `<td><div class="skeleton-pulse skeleton-text" style="width: ${80 + Math.random() * 20}%"></div></td>`;
    }
    html += '</tr>';
  }
  container.innerHTML = html;
}

function renderCardSkeletons(targetId, count = 5) {
  const container = document.getElementById(targetId);
  if (!container) return;
  
  let html = '';
  for (let c = 0; c < count; c++) {
    html += `
      <div class="skeleton-pulse" style="padding: 16px; border-radius: var(--radius-md); margin-bottom: 8px;">
        <div class="skeleton-pulse skeleton-text" style="width: 30%; height: 14px; margin-bottom: 8px;"></div>
        <div class="skeleton-pulse skeleton-text" style="width: 80%; height: 12px; margin-bottom: 8px;"></div>
        <div class="skeleton-pulse skeleton-text short" style="height: 10px;"></div>
      </div>
    `;
  }
  container.innerHTML = html;
}

window.loadGlobalAuditLogs = loadGlobalAuditLogs;
window.paginateCases = paginateCases;
window.paginateOfficers = paginateOfficers;
window.paginateAuditLogs = paginateAuditLogs;

function wrapErrorBoundary(fn, containerId) {
  try {
    fn();
  } catch (error) {
    console.error(`[Error Boundary caught an error in ${containerId}]:`, error);
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <tr><td colspan="12">
          <div class="error-boundary-widget">
            <i class="ri-error-warning-line" style="font-size: 32px; color: var(--danger-color); margin-bottom: 8px; display: inline-block;"></i>
            <h3 style="font-size: 14px; font-weight: 600; margin-bottom: 4px; color: #FFF;">Workspace Execution Interrupted</h3>
            <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
              A critical rendering exception occurred in this module. The session state has been protected.
            </p>
            <button class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 11px;" onclick="window.location.reload()">Reload Workspace</button>
          </div>
        </td></tr>
      `;
    }
  }
}

window.wrapErrorBoundary = wrapErrorBoundary;

let socket = null;
let notifications = [];
let notificationDropdownOpen = false;

function connectSocket(userId) {
  if (typeof io === 'undefined') return;
  if (socket) socket.disconnect();

  socket = io();

  socket.on('connect', () => {
    console.log('[Socket.IO] Connected to CIB Real-Time server');
    socket.emit('authenticate', userId);
  });

  socket.on('notification', (data) => {
    console.log('[Socket.IO] Received personal notification:', data);
    triggerToast(data.message, data.type === 'Alert' ? 'danger' : 'success');
    initDashboard();
  });

  socket.on('global-notification', (data) => {
    console.log('[Socket.IO] Received global notification:', data);
    triggerToast(data.message, data.type === 'Alert' ? 'danger' : 'success');
    initDashboard();
  });

  socket.on('role-notification', (data) => {
    const myRole = sessionStorage.getItem('cib_officer_role');
    if (data.role === myRole) {
      console.log('[Socket.IO] Received role notification:', data);
      triggerToast(data.message, data.type === 'Alert' ? 'danger' : 'success');
      initDashboard();
    }
  });
}

function updateNotificationBell() {
  const badge = document.querySelector('.bell-badge');
  if (!badge) return;
  const unreadCount = notifications.filter(n => !n.isRead).length;
  if (unreadCount > 0) {
    badge.textContent = unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function syncNotificationsOnly() {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const response = await fetch('/api/dashboard/dashboard-payload', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const payloadResult = await response.json();
    if (response.ok && payloadResult.success) {
      notifications = payloadResult.data.notifications || [];
      updateNotificationBell();
    }
  } catch (err) {
    console.error('Failed to sync notifications:', err);
  }
}

let notificationPage = 1;
const notificationPageSize = 5;

function renderNotificationsDropdownContent(dropdown) {
  let list = dropdown.querySelector('.notification-list-container');
  if (!list) {
    list = document.createElement('div');
    list.className = 'notification-list-container';
    list.style.overflowY = 'auto';
    list.style.flexGrow = '1';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    dropdown.appendChild(list);
  }
  
  let footer = dropdown.querySelector('.notification-footer-container');
  if (!footer) {
    footer = document.createElement('div');
    footer.className = 'notification-footer-container';
    dropdown.appendChild(footer);
  }
  
  list.innerHTML = '';
  const total = notifications.length;
  
  if (total === 0) {
    list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">No notifications.</div>`;
    footer.innerHTML = '';
    return;
  }
  
  const maxPage = Math.ceil(total / notificationPageSize);
  if (notificationPage > maxPage) notificationPage = maxPage || 1;
  if (notificationPage < 1) notificationPage = 1;
  
  const startIndex = (notificationPage - 1) * notificationPageSize;
  const endIndex = startIndex + notificationPageSize;
  const paginated = notifications.slice(startIndex, endIndex);
  
  paginated.forEach(n => {
    const item = document.createElement('div');
    item.style.padding = '12px 16px';
    item.style.borderBottom = '1px solid rgba(75, 85, 99, 0.1)';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.backgroundColor = n.isRead ? 'transparent' : 'rgba(37, 99, 235, 0.05)';
    item.style.cursor = 'pointer';
    item.onclick = () => {
      if (!n.isRead) {
        markNotificationAsRead(n.id);
      }
    };
    
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <div style="flex-grow: 1; margin-right: 8px;">
          <div style="font-size: 12px; color: ${n.isRead ? 'var(--text-secondary)' : '#FFF'}; font-weight: ${n.isRead ? '400' : '600'}; line-height: 1.4;">${n.message}</div>
          <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">${new Date(n.timestamp).toLocaleString()}</div>
        </div>
        <button style="background: none; border: none; color: var(--danger-color); font-size: 14px; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;" onclick="event.stopPropagation(); deleteNotification(${n.id})" title="Delete Notification">
          <i class="ri-delete-bin-line"></i>
        </button>
      </div>
    `;
    list.appendChild(item);
  });
  
  footer.innerHTML = `
    <div style="padding: 8px 16px; border-top: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; background-color: var(--surface-color);">
      <button style="background: none; border: none; color: var(--primary-color); font-size: 11px; cursor: pointer;" onclick="event.stopPropagation(); paginateNotifications('prev')">Prev</button>
      <span style="font-size: 11px; color: var(--text-secondary);">${startIndex + 1} - ${Math.min(endIndex, total)} of ${total}</span>
      <button style="background: none; border: none; color: var(--primary-color); font-size: 11px; cursor: pointer;" onclick="event.stopPropagation(); paginateNotifications('next')">Next</button>
    </div>
  `;
}

function paginateNotifications(direction) {
  const total = notifications.length;
  if (direction === 'prev' && notificationPage > 1) {
    notificationPage--;
  } else if (direction === 'next' && notificationPage * notificationPageSize < total) {
    notificationPage++;
  }
  const dropdown = document.getElementById('notification-dropdown');
  if (dropdown) {
    renderNotificationsDropdownContent(dropdown);
  }
}

async function deleteNotification(id) {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch(`/api/dashboard/notifications/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      notifications = notifications.filter(n => n.id !== id);
      updateNotificationBell();
      const dropdown = document.getElementById('notification-dropdown');
      if (dropdown) {
        renderNotificationsDropdownContent(dropdown);
      }
    }
  } catch (err) {
    console.error('[Notification Delete] Failed:', err);
  }
}

async function showNotificationCenter() {
  const bell = document.querySelector('.notification-bell');
  if (!bell) return;
  let dropdown = document.getElementById('notification-dropdown');
  
  if (notificationDropdownOpen) {
    if (dropdown) dropdown.remove();
    notificationDropdownOpen = false;
    return;
  }

  dropdown = document.createElement('div');
  dropdown.id = 'notification-dropdown';
  dropdown.style.position = 'absolute';
  dropdown.style.top = '50px';
  dropdown.style.right = '0';
  dropdown.style.width = '320px';
  dropdown.style.maxHeight = '400px';
  dropdown.style.backgroundColor = 'var(--card-color)';
  dropdown.style.border = '1px solid var(--border-color)';
  dropdown.style.borderRadius = '6px';
  dropdown.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.5)';
  dropdown.style.zIndex = '9999';
  dropdown.style.display = 'flex';
  dropdown.style.flexDirection = 'column';
  dropdown.style.overflow = 'hidden';

  const header = document.createElement('div');
  header.style.padding = '12px 16px';
  header.style.borderBottom = '1px solid var(--border-color)';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.innerHTML = `
    <span style="font-weight: 600; font-size: 13px; color: #FFF;">Notifications</span>
    <button style="background: none; border: none; color: var(--primary-color); font-size: 11px; cursor: pointer;" onclick="markAllNotificationsRead()">Mark all read</button>
  `;
  dropdown.appendChild(header);

  renderNotificationsDropdownContent(dropdown);
  
  bell.appendChild(dropdown);
  notificationDropdownOpen = true;

  const closeHandler = (e) => {
    if (!bell.contains(e.target)) {
      dropdown.remove();
      notificationDropdownOpen = false;
      document.removeEventListener('click', closeHandler);
    }
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 10);
}

async function markAllNotificationsRead() {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch('/api/dashboard/notifications/read-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      notifications.forEach(n => n.isRead = true);
      updateNotificationBell();
      const dropdown = document.getElementById('notification-dropdown');
      if (dropdown) {
        dropdown.remove();
        notificationDropdownOpen = false;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function markNotificationAsRead(id) {
  const token = sessionStorage.getItem('cib_jwt_token');
  try {
    const res = await fetch(`/api/dashboard/notifications/${id}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const n = notifications.find(x => x.id === id);
      if (n) n.isRead = true;
      updateNotificationBell();
      const dropdown = document.getElementById('notification-dropdown');
      if (dropdown) {
        dropdown.remove();
        notificationDropdownOpen = false;
      }
    }
  } catch (err) {
    console.error(err);
  }
}

function renderDepartmentsRegistry() {
  const grid = document.getElementById('departments-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  
  const depts = [
    { name: 'Major Crimes Division', key: 'MAJOR_CRIMES_DIVISION' },
    { name: 'Homicide Unit', key: 'HOMICIDE_UNIT' },
    { name: 'Digital Forensics Unit', key: 'DIGITAL_FORENSICS_UNIT' },
    { name: 'Financial Crimes Division', key: 'FINANCIAL_CRIMES_DIVISION' },
    { name: 'Organized Crime Unit', key: 'ORGANIZED_CRIME_UNIT' }
  ];
  
  depts.forEach(d => {
    const count = window.CIB_DB.officers.filter(o => o.department === d.key).length;
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.innerHTML = `
      <div class="stat-info">
        <span class="stat-label">${d.name}</span>
        <span class="stat-val" style="font-size: 18px; margin-top: 10px; font-weight: 700;">${count} Active Officers</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderSubInspectorRegistries() {
  const victimsTbody = document.getElementById('view-victims-tbody');
  if (victimsTbody) {
    victimsTbody.innerHTML = '';
    const allVictims = [];
    window.CIB_DB.cases.forEach(c => {
      if (c.victims) {
        c.victims.forEach(v => {
          allVictims.push({ ...v, caseTitle: c.title, caseId: c.id });
        });
      }
    });
    
    if (allVictims.length === 0) {
      victimsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 24px;">No victims registered yet.</td></tr>`;
    } else {
      allVictims.forEach(v => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>VIC-${v.id}</td>
          <td>${v.name}</td>
          <td><strong style="color: var(--primary-color);">${v.caseId}</strong> - ${v.caseTitle}</td>
          <td>${v.contact || 'N/A'}</td>
        `;
        victimsTbody.appendChild(tr);
      });
    }
  }

  const witnessesTbody = document.getElementById('view-witnesses-tbody');
  if (witnessesTbody) {
    witnessesTbody.innerHTML = '';
    const allWitnesses = [];
    window.CIB_DB.cases.forEach(c => {
      if (c.witnesses) {
        c.witnesses.forEach(w => {
          allWitnesses.push({ ...w, caseTitle: c.title, caseId: c.id });
        });
      }
    });
    
    if (allWitnesses.length === 0) {
      witnessesTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 24px;">No witnesses registered yet.</td></tr>`;
    } else {
      allWitnesses.forEach(w => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>WIT-${w.id}</td>
          <td>${w.name}</td>
          <td><strong style="color: var(--primary-color);">${w.caseId}</strong> - ${w.caseTitle}</td>
          <td>"${w.statement || 'No statement logged.'}"</td>
        `;
        witnessesTbody.appendChild(tr);
      });
    }
  }

  const suspectsTbody = document.getElementById('view-suspects-tbody');
  if (suspectsTbody) {
    suspectsTbody.innerHTML = '';
    const allSuspects = [];
    window.CIB_DB.cases.forEach(c => {
      if (c.suspects) {
        c.suspects.forEach(s => {
          allSuspects.push({ ...s, caseTitle: c.title, caseId: c.id });
        });
      }
    });
    
    if (allSuspects.length === 0) {
      suspectsTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 24px;">No suspects registered yet.</td></tr>`;
    } else {
      allSuspects.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>SUS-${s.id}</td>
          <td>${s.name}</td>
          <td>${s.aliases || 'N/A'}</td>
          <td><strong style="color: var(--primary-color);">${s.caseId}</strong> - ${s.caseTitle}</td>
        `;
        suspectsTbody.appendChild(tr);
      });
    }
  }
}

window.handleFirstLoginPasswordChangeSubmit = handleFirstLoginPasswordChangeSubmit;
window.showNotificationCenter = showNotificationCenter;
window.markAllNotificationsRead = markAllNotificationsRead;
window.markNotificationAsRead = markNotificationAsRead;
window.paginateNotifications = paginateNotifications;
window.deleteNotification = deleteNotification;
window.renderDepartmentsRegistry = renderDepartmentsRegistry;
window.renderSubInspectorRegistries = renderSubInspectorRegistries;



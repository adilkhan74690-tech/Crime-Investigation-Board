// Application State & Controller Logic v2 with JWT OTP Backend Integrations & Dynamic Roles Dashboards
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
  SUPERINTENDENT: ['sp-dashboard', 'sp-review-cases', 'sa-departments', 'sp-approvals', 'sa-analytics'],
  SUB_INSPECTOR: ['si-dashboard', 'si-register-fir', 'si-create-case', 'sp-assign-officers', 'si-victims', 'si-witnesses', 'si-suspects', 'io-timeline'],
  INSPECTOR: ['io-dashboard', 'io-cases', 'io-evidence', 'io-timeline', 'io-notes', 'si-witnesses'],
  FORENSIC_OFFICER: ['fo-dashboard', 'fo-pending', 'fo-reports', 'fo-fingerprint', 'fo-dna', 'fo-upload']
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
});

function getAvatarSvg(name) {
  const colors = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];
  const nameStr = name || 'User';
  const char = nameStr.charAt(0).toUpperCase();
  let codeSum = 0;
  for (let i = 0; i < nameStr.length; i++) codeSum += nameStr.charCodeAt(i);
  const color = colors[codeSum % colors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="32" fill="${color}" />
    <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="28" font-weight="bold" fill="#ffffff">${char}</text>
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

  setAuthLoading(true);
  if (!stage2FA) {
    try {
      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId, password })
      });
      const data = await response.json();
      if (response.ok) {
        if (data.data && data.data.passwordChangeRequired) {
          triggerToast("First-time login: Please update your password.", "warning");
          // Handle force password change dialog if needed, or prompt
          const newPassword = prompt("First-Time Login: Please enter a new password (min 6 chars):");
          if (!newPassword || newPassword.length < 6) {
            triggerToast("Password change cancelled or too short. Login aborted.", "danger");
            setAuthLoading(false);
            return;
          }
          const changeResponse = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ officerId, oldPassword: password, newPassword })
          });
          const changeData = await changeResponse.json();
          if (changeResponse.ok) {
            triggerToast("Password successfully changed. Proceeding with login...", "success");
            // Automatically log in with new password
            const newLoginResponse = await fetch('/api/auth/request-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ officerId, password: newPassword })
            });
            const newLoginData = await newLoginResponse.json();
            if (newLoginResponse.ok) {
              if (newLoginData.data && newLoginData.data.bypassOtp) {
                // Demo-only shortcut for root Super Admin account (SA-001)
                triggerToast("Root authentication bypassed for demonstration.", "success");
                sessionStorage.setItem('cib_jwt_token', newLoginData.data.token);
                sessionStorage.setItem('cib_officer_id', officerId);
                sessionStorage.setItem('cib_officer_role', newLoginData.data.role);
                sessionStorage.setItem('cib_officer_name', newLoginData.data.name);
                initDashboard();
                return;
              }
              triggerToast("One-time security verification code dispatched to registered officer device.", "success");
              stage2FA = true;
              document.getElementById('officer-id').disabled = true;
              document.getElementById('password').disabled = true;
              document.getElementById('otp-form-group').style.display = 'block';
              document.querySelector('.otp-box').focus();
            } else {
              triggerToast("Failed to request verification code after password change.", "danger");
            }
          } else {
            triggerToast(changeData.error || "Password update failed.", "danger");
          }
          setAuthLoading(false);
          return;
        }

        // Demo-only shortcut: Check if OTP is bypassed on backend for root Super Admin (SA-001)
        if (data.data && data.data.bypassOtp) {
          triggerToast("Root authentication bypassed for demonstration.", "success");
          sessionStorage.setItem('cib_jwt_token', data.data.token);
          sessionStorage.setItem('cib_officer_id', officerId);
          sessionStorage.setItem('cib_officer_role', data.data.role);
          sessionStorage.setItem('cib_officer_name', data.data.name);
          initDashboard();
          return;
        }

        triggerToast("One-time security verification code dispatched to registered officer device.", "success");
        stage2FA = true;
        document.getElementById('officer-id').disabled = true;
        document.getElementById('password').disabled = true;
        document.getElementById('otp-form-group').style.display = 'block';
        document.querySelector('.otp-box').focus();
      } else {
        triggerToast(data.error || "Authentication verification failure.", "danger");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Connection with CIB authentication backend failed.", "danger");
    } finally {
      setAuthLoading(false);
    }
  } else {
    const otpBoxes = document.querySelectorAll('.otp-box');
    let code = '';
    otpBoxes.forEach(box => code += box.value);

    if (code.length < 6) {
      triggerToast("Please complete the 6-digit OTP verification code.", "danger");
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerId, code })
      });
      const data = await response.json();
      
      if (response.ok) {
        sessionStorage.setItem('cib_session_active', 'true');
        sessionStorage.setItem('cib_jwt_token', data.data.token);
        sessionStorage.setItem('cib_officer_role', data.data.role);
        sessionStorage.setItem('cib_officer_id', officerId);
        
        triggerToast(`Access Verified. Welcome ${data.data.name}. Redirecting...`, "success");
        
        setTimeout(() => {
          initDashboard();
        }, 1000);
      } else {
        triggerToast(data.error || "Incorrect security code verification.", "danger");
        setAuthLoading(false);
      }
    } catch (err) {
      console.error(err);
      triggerToast("Connection failed. Dynamic OTP code validation failed.", "danger");
      setAuthLoading(false);
    }
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
      window.CIB_DB.officers = payloadResult.data.officers;
      window.CIB_DB.evidence = payloadResult.data.evidence;
      window.CIB_DB.forensics = payloadResult.data.forensics;
      window.CIB_DB.recentActivities = payloadResult.data.activities;
      
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
  const name = officer ? officer.name : 'Adil Khan';
  const rank = officer ? officer.rank : 'Supervisory Special Agent';
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
  
  document.getElementById('officer-search')?.addEventListener('input', renderOfficersTable);
  
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

  if (!window.CIB_DB.cases || window.CIB_DB.cases.length === 0) {
    chartContainers.forEach(sel => {
      const container = document.querySelector(sel);
      if (container) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 48px 24px; font-size: 13px;">No analytics available.</div>`;
      }
    });
    return;
  }

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
  
  window.CIB_DB.cases.forEach(c => {
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

  const categories = last6Months.map(m => m.name);

  // Group by crime type
  const crimeTypeCounts = {};
  window.CIB_DB.cases.forEach(c => {
    crimeTypeCounts[c.crimeType] = (crimeTypeCounts[c.crimeType] || 0) + 1;
  });
  const crimeLabels = Object.keys(crimeTypeCounts);
  const crimeSeries = Object.values(crimeTypeCounts);

  // Pending vs Solved
  const solvedCount = window.CIB_DB.cases.filter(c => c.status === 'Solved').length;
  const activeCount = window.CIB_DB.cases.filter(c => c.status === 'Active').length;

  // Evidence Counts
  const evCounts = { 'DigitalHardware': 0, 'Weapon': 0, 'Document': 0, 'Narcotics': 0, 'Other': 0 };
  (window.CIB_DB.evidence || []).forEach(e => {
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
  window.CIB_DB.officers.forEach(o => {
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
  const sortedOfficers = [...window.CIB_DB.officers]
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

// Statistics counts
function renderCounts() {
  const activeCount = window.CIB_DB.cases.filter(c => c.status === 'Active').length;
  const solvedCount = window.CIB_DB.cases.filter(c => c.status === 'Solved').length;
  const highPriority = window.CIB_DB.cases.filter(c => c.priority === 'High' || c.priority === 'Critical').length;
  
  const act = document.getElementById('count-active');
  if (act) act.textContent = activeCount;
  
  const sol = document.getElementById('count-solved');
  if (sol) sol.textContent = solvedCount;
  
  const pri = document.getElementById('count-priority');
  if (pri) pri.textContent = highPriority;
  
  const ev = document.getElementById('count-evidence');
  if (ev) ev.textContent = window.CIB_DB.evidence.length;
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

// Render dynamic cases list
function renderCasesTable(filteredList = null) {
  const container = document.getElementById('cases-table-body');
  const ioContainer = document.getElementById('io-cases-table-body');
  
  const targetList = filteredList || window.CIB_DB.cases;
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-secondary); padding: 24px;">No investigations found.</td></tr>`;
      return;
    }

    paginated.forEach(c => {
      const officer = window.CIB_DB.officers.find(o => o.name === c.assignedOfficer || o.id === c.officerId);
      const officerName = officer ? officer.name : 'Unassigned';
      const avatarUrl = getAvatarSvg(officerName);

      const row = document.createElement('tr');
      row.style.transition = 'background-color 0.2s';
      row.innerHTML = `
        <td data-label="Case ID"><strong style="color: var(--primary-color); font-family: monospace;">${c.id}</strong></td>
        <td data-label="Title">
          <div style="font-weight:600; color: #FFFFFF;">${c.title}</div>
          <div style="font-size:11px; color:var(--text-secondary); margin-top: 2px;">${c.crimeType}</div>
        </td>
        <td data-label="Priority"><span class="badge ${c.priority === 'Critical' ? 'priority-critical' : (c.priority === 'High' ? 'priority-high' : 'priority-medium')}" style="border-radius: 4px; font-size: 11px; padding: 4px 10px;">${c.priority}</span></td>
        <td data-label="Officer">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${avatarUrl}" alt="${officerName}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border-light);">
            <span style="font-weight: 500;">${officerName}</span>
          </div>
        </td>
        <td data-label="Location"><span style="color: var(--text-secondary); font-size: 13px;">${c.location}</span></td>
        <td data-label="Status"><span class="badge ${c.status === 'Solved' ? 'badge-status-solved' : 'badge-status-active'}" style="border-radius: 12px; padding: 2px 10px; font-size: 11px;">${c.status}</span></td>
        <td data-label="Updated"><span style="color: var(--text-secondary); font-size: 12px;">${c.lastUpdated}</span></td>
        <td data-label="Action"><button class="btn-primary" style="padding: 8px 16px; font-size:12px; width:auto; border-radius: 6px;" onclick="openCaseDetail('${c.id}')">View workspace</button></td>
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
  const relatedEv = window.CIB_DB.evidence.filter(e => e.caseId === caseId);
  if (relatedEv.length === 0) {
    evidenceList.innerHTML = '<span style="color:var(--text-secondary); font-size:13px;">No related evidence found.</span>';
  } else {
    relatedEv.forEach(ev => {
      evidenceList.innerHTML += `
        <div class="evidence-card" onclick="switchView('io-evidence'); previewEvidence('${ev.id}')">
          ${ev.previewType === 'image' ? `<div class="evidence-thumb-container"><img class="evidence-thumb" src="${ev.previewData}"></div>` : `<div class="evidence-thumb-container"><i class="ri-dna-line" style="font-size:24px;"></i></div>`}
          <div class="evidence-card-info">
            <div class="evidence-card-title">${ev.name}</div>
            <span style="font-size:11px; color:var(--text-secondary);">${ev.id}</span>
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
  const container = document.getElementById('evidence-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  window.CIB_DB.evidence.forEach(ev => {
    const card = document.createElement('div');
    card.className = 'evidence-card';
    card.onclick = () => previewEvidence(ev.id);
    
    let thumbHTML = `<div class="evidence-thumb-container"><i class="ri-file-text-line" style="font-size:32px; color:var(--text-secondary);"></i></div>`;
    if (ev.previewType === 'image') {
      thumbHTML = `<div class="evidence-thumb-container"><img src="${ev.previewData}" class="evidence-thumb"></div>`;
    } else if (ev.previewType === 'dna') {
      thumbHTML = `<div class="evidence-thumb-container" style="background-color:rgba(16,185,129,0.05);"><i class="ri-dna-line" style="font-size:32px; color:var(--success-color);"></i></div>`;
    }
    
    card.innerHTML = `
      ${thumbHTML}
      <div class="evidence-card-info">
        <div class="evidence-card-title">${ev.name}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
          <span style="font-size:11px; color:var(--text-secondary);">${ev.id}</span>
          <span class="badge ${ev.verificationStatus === 'Verified' ? 'badge-status-solved' : 'priority-medium'}" style="font-size:9px; padding:2px 6px;">${ev.verificationStatus}</span>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function previewEvidence(evId) {
  const ev = window.CIB_DB.evidence.find(e => e.id === evId);
  if (!ev) return;
  
  const previewBox = document.getElementById('evidence-preview-graphic');
  if (!previewBox) return;
  previewBox.innerHTML = '';
  
  if (ev.previewType === 'image') {
    previewBox.innerHTML = `
      <img src="${ev.previewData}" alt="Evidence Graphic" style="width:100%; height:100%; object-fit:cover;">
    `;
  } else {
    previewBox.innerHTML = `
      <div style="font-family:monospace; font-size:11px; padding:16px; width:100%; height:100%; overflow-y:auto; color:var(--text-secondary); text-align:left; background-color: var(--card-color); border:1px solid var(--border-color); border-radius:6px;">
        <div style="color:var(--success-color); font-weight:600; margin-bottom:8px;">// SECURID FORENSIC LINK DETECTED</div>
        ${ev.previewData}
      </div>
    `;
  }
  
  const timelineBox = document.getElementById('evidence-custody-chain');
  timelineBox.innerHTML = '';
  const custodyChain = ev.transfers || [];
  
  if (custodyChain.length === 0) {
    timelineBox.innerHTML = '<span style="color:var(--text-secondary); font-size:13px; padding:12px;">No transfer logs recorded.</span>';
  } else {
    custodyChain.forEach(log => {
      timelineBox.innerHTML += `
        <div class="custody-log" style="background-color: var(--card-color); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 13px; color: #FFFFFF; display: block; margin-bottom: 2px;">${log.action}</strong>
            <span style="display:block; font-size:11px; color:var(--text-secondary);">Handler: <span style="color: var(--primary-color); font-weight: 500;">${log.handler}</span></span>
          </div>
          <span style="color:var(--text-secondary); font-size: 11px; font-family: monospace;">${log.date}</span>
        </div>
      `;
    });
  }
  
  triggerToast(`Loaded verification log for ${ev.id}`);
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

// Forensics Lab Reports list & upload handler
function renderForensicsLab() {
  const container = document.getElementById('forensics-grid-container');
  if (!container) return;
  container.innerHTML = '';
  
  window.CIB_DB.forensics.forEach(f => {
    const card = document.createElement('div');
    card.className = 'lab-card';
    card.style = 'background-color: var(--surface-color); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column; gap: 16px;';
    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="lab-badge" style="font-size: 11px; background-color: rgba(37, 99, 235, 0.15); color: var(--primary-color); border: 1px solid rgba(37, 99, 235, 0.25); padding: 4px 8px; border-radius: 4px; font-weight: 600;">${f.type}</span>
        <span class="badge ${f.status === 'Approved' ? 'badge-status-solved' : 'priority-medium'}" style="font-size:11px; padding: 2px 10px; border-radius: 12px;">${f.status}</span>
      </div>
      <div>
        <strong style="font-size:15px; display:block; margin-bottom:6px; color:#FFFFFF;">Case Link: <span style="font-family: monospace; color: var(--primary-color);">${f.caseId}</span></strong>
        <p style="font-size:13px; color:var(--text-secondary); line-height:1.6; background-color: var(--card-color); padding: 12px; border-radius: 6px; border: 1px solid var(--border-color);">${f.summary}</p>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; color:var(--text-secondary); border-top:1px solid var(--border-color); padding-top:12px; margin-top:auto;">
        <span>Analyst: <strong>${f.analyst}</strong></span>
        <span>${f.approvalDate}</span>
      </div>
      ${f.status !== 'Approved' ? `<button class="btn-primary" style="padding:10px; font-size:12px; margin-top:8px; border-radius: 6px;" onclick="approveForensicReport('${f.id}')">Approve Findings</button>` : ''}
    `;
    container.appendChild(card);
  });
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
    if (response.ok && result.success) {
      window.CIB_DB.officers = result.data.officers || [];
      
      const total = result.data.total || 0;
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
    console.error(err);
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
function showModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function hideModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
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
      triggerToast(id ? "Officer updated successfully." : "Officer created successfully.", "success");
      hideModal('modal-officer-form');
      document.getElementById('officer-form').reset();
      await renderOfficersList();
    } else {
      triggerToast(result.error || "Operation failed.", "danger");
      if (result.error && result.error.toLowerCase().includes('email')) {
        document.getElementById('officer-form-email').style.borderColor = 'var(--danger-color)';
      }
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
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

// Investigation Workflow Implementations
function showRegisterFirModal() {
  const randNum = Math.floor(100 + Math.random() * 900);
  document.getElementById('fir-form-id').value = `FIR-2026-${randNum}`;
  document.getElementById('fir-case-id').value = `CASE-2026-${randNum}`;
  document.getElementById('fir-form-reporter').value = '';
  document.getElementById('fir-form-title').value = '';
  document.getElementById('fir-form-desc').value = '';
  document.getElementById('fir-case-title').value = '';
  document.getElementById('fir-case-location').value = '';
  
  showModal('modal-register-fir');
}

async function handleFirSubmit(event) {
  event.preventDefault();
  const firId = document.getElementById('fir-form-id').value;
  const reporter = document.getElementById('fir-form-reporter').value;
  const firTitle = document.getElementById('fir-form-title').value;
  const firDesc = document.getElementById('fir-form-desc').value;
  
  const caseId = document.getElementById('fir-case-id').value;
  const caseTitle = document.getElementById('fir-case-title').value;
  const crimeType = document.getElementById('fir-crime-type').value;
  const priority = document.getElementById('fir-case-priority').value;
  const location = document.getElementById('fir-case-location').value;

  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    // 1. Register FIR
    const firResponse = await fetch('/api/workflow/register-fir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: firId, title: firTitle, description: firDesc, reporter })
    });
    
    const firResult = await firResponse.json();
    if (!firResponse.ok || !firResult.success) {
      triggerToast(firResult.error || "Failed to register FIR.", "danger");
      return;
    }

    // 2. Create Case
    const caseResponse = await fetch('/api/workflow/create-case', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id: caseId, title: caseTitle, crimeType, priority, location, firId })
    });

    const caseResult = await caseResponse.json();
    if (caseResponse.ok && caseResult.success) {
      triggerToast("FIR registered and Case file created successfully.", "success");
      hideModal('modal-register-fir');
      
      // Refresh local cache and UI
      await initDashboard();
    } else {
      triggerToast(caseResult.error || "Failed to initiate Case.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
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
  document.getElementById('evidence-case-id').value = caseId;
  document.getElementById('evidence-file-input').value = '';
  showModal('modal-evidence-upload');
}

async function handleEvidenceUploadSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('evidence-case-id').value;
  const fileInput = document.getElementById('evidence-file-input');
  const category = document.getElementById('evidence-category-select').value;

  if (fileInput.files.length === 0) return;

  const token = sessionStorage.getItem('cib_jwt_token');
  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('caseId', caseId);
  formData.append('category', category);
  formData.append('folder', 'evidence');

  try {
    const response = await fetch('/api/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Evidence uploaded and indexed successfully.", "success");
      hideModal('modal-evidence-upload');
      await initDashboard();
      openCaseDetail(caseId);
    } else {
      triggerToast(result.error || "Upload failed.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
  }
}

function showRequestForensicModal(caseId) {
  document.getElementById('forensic-case-id').value = caseId;
  document.getElementById('forensic-report-id').value = `FOR-2026-${Math.floor(100 + Math.random() * 900)}`;
  document.getElementById('forensic-summary-input').value = '';
  showModal('modal-request-forensic');
}

async function handleRequestForensicSubmit(event) {
  event.preventDefault();
  const caseId = document.getElementById('forensic-case-id').value;
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

function showSubmitForensicModal(reportId) {
  document.getElementById('submit-report-id').value = reportId;
  document.getElementById('submit-forensic-summary').value = '';
  showModal('modal-submit-forensic');
}

async function handleSubmitForensicSubmit(event) {
  event.preventDefault();
  const reportId = document.getElementById('submit-report-id').value;
  const summary = document.getElementById('submit-forensic-summary').value;

  const token = sessionStorage.getItem('cib_jwt_token');

  try {
    const response = await fetch('/api/workflow/submit-forensic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ reportId, summary })
    });
    
    const result = await response.json();
    if (response.ok && result.success) {
      triggerToast("Forensic analysis findings logged successfully.", "success");
      hideModal('modal-submit-forensic');
      await initDashboard();
      if (typeof renderForensicsLab === 'function') renderForensicsLab();
    } else {
      triggerToast(result.error || "Failed to submit findings.", "danger");
    }
  } catch (err) {
    console.error(err);
    triggerToast("Server connection error.", "danger");
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
window.handleFirSubmit = handleFirSubmit;
window.showAssignInspectorModal = showAssignInspectorModal;
window.handleAssignInspectorSubmit = handleAssignInspectorSubmit;
window.showEvidenceUploadModal = showEvidenceUploadModal;
window.handleEvidenceUploadSubmit = handleEvidenceUploadSubmit;
window.showRequestForensicModal = showRequestForensicModal;
window.handleRequestForensicSubmit = handleRequestForensicSubmit;
window.showSubmitForensicModal = showSubmitForensicModal;
window.handleSubmitForensicSubmit = handleSubmitForensicSubmit;
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
    syncNotificationsOnly();
  });

  socket.on('global-notification', (data) => {
    console.log('[Socket.IO] Received global notification:', data);
    triggerToast(data.message, data.type === 'Alert' ? 'danger' : 'success');
    syncNotificationsOnly();
  });

  socket.on('role-notification', (data) => {
    const myRole = sessionStorage.getItem('cib_officer_role');
    if (data.role === myRole) {
      console.log('[Socket.IO] Received role notification:', data);
      triggerToast(data.message, data.type === 'Alert' ? 'danger' : 'success');
      syncNotificationsOnly();
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

  const list = document.createElement('div');
  list.style.overflowY = 'auto';
  list.style.flexGrow = '1';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';

  if (notifications.length === 0) {
    list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--text-secondary); font-size: 13px;">No notifications.</div>`;
  } else {
    notifications.forEach(n => {
      const item = document.createElement('div');
      item.style.padding = '12px 16px';
      item.style.borderBottom = '1px solid rgba(75, 85, 99, 0.1)';
      item.style.display = 'flex';
      item.style.flexDirection = 'column';
      item.style.gap = '4px';
      item.style.cursor = 'pointer';
      item.style.backgroundColor = n.isRead ? 'transparent' : 'rgba(37, 99, 235, 0.05)';
      item.onclick = () => {
        if (!n.isRead) {
          markNotificationAsRead(n.id);
        }
      };

      item.innerHTML = `
        <div style="font-size: 12px; color: ${n.isRead ? 'var(--text-secondary)' : '#FFF'}; font-weight: ${n.isRead ? '400' : '600'};">${n.message}</div>
        <div style="font-size: 10px; color: var(--text-secondary);">${new Date(n.timestamp).toLocaleString()}</div>
      `;
      list.appendChild(item);
    });
  }
  dropdown.appendChild(list);
  
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

window.showNotificationCenter = showNotificationCenter;
window.markAllNotificationsRead = markAllNotificationsRead;
window.markNotificationAsRead = markNotificationAsRead;
window.renderDepartmentsRegistry = renderDepartmentsRegistry;
window.renderSubInspectorRegistries = renderSubInspectorRegistries;



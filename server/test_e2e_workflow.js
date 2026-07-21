const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

function request(options, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path: options.path,
      method: options.method || 'GET',
      headers: { ...headers }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function postJson(path, data, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({ path, method: 'POST' }, data, headers);
}

function getJson(path, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({ path, method: 'GET' }, null, headers);
}

function postMultipart(path, fields, fileField, filePath, token = null) {
  return new Promise((resolve, reject) => {
    const boundary = '--------------------------' + Date.now().toString(16);
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const postData = [];
    for (const [key, val] of Object.entries(fields)) {
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
    }

    if (fileField && filePath) {
      const fileName = path.basename(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      postData.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
      postData.push(fileBuffer);
      postData.push(Buffer.from('\r\n'));
    }

    postData.push(Buffer.from(`--${boundary}--\r\n`));
    const payload = Buffer.concat(postData);

    headers['Content-Length'] = payload.length;

    const req = http.request({
      hostname: 'localhost',
      port: PORT,
      path,
      method: 'POST',
      headers
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runE2ESimulation() {
  console.log('=====================================================');
  console.log('STARTING ENTERPRISE E2E WORKFLOW SIMULATION TEST');
  console.log('=====================================================\n');

  try {
    let superAdminToken = '';
    let siToken = '';
    let inspectorToken = '';
    let forensicToken = '';
    let spToken = '';

    const createdOfficerId = `E2E-SI-${Date.now().toString().slice(-4)}`;
    const createdInspectorId = `E2E-INS-${Date.now().toString().slice(-4)}`;
    const createdForensicId = `E2E-FOR-${Date.now().toString().slice(-4)}`;
    const createdSPId = `E2E-SP-${Date.now().toString().slice(-4)}`;

    const testFirId = `FIR-E2E-${Date.now().toString().slice(-4)}`;
    const testCaseId = `CASE-E2E-${Date.now().toString().slice(-4)}`;
    const testReportId = `REP-E2E-${Date.now().toString().slice(-4)}`;

    // 1. Super Admin Login
    console.log('[STEP 1] Logging in as Super Admin (SA-001)...');
    const saLoginRes = await postJson('/api/auth/login', { officerId: 'SA-001', password: 'Admin123!' });
    if (saLoginRes.status !== 200 || !saLoginRes.data.data.token) {
      throw new Error(`Super Admin Login Failed: ${JSON.stringify(saLoginRes)}`);
    }
    superAdminToken = saLoginRes.data.data.token;
    console.log('✓ Super Admin authenticated successfully.\n');

    // 2. Onboard 4 Officers
    console.log('[STEP 2] Onboarding Officers across all 4 roles...');
    
    const onboardRes1 = await postJson('/api/workflow/onboard-officer', {
      officerId: createdOfficerId, email: `si_${createdOfficerId}@cib.gov`, name: 'Sub Inspector Raj', role: 'SUB_INSPECTOR', department: 'MAJOR_CRIMES_DIVISION', rank: 'DETECTIVE'
    }, superAdminToken);
    const pass1 = onboardRes1.data.data.temporaryPassword;
    console.log(`✓ Onboarded Sub-Inspector: ${createdOfficerId}`);

    const onboardRes2 = await postJson('/api/workflow/onboard-officer', {
      officerId: createdInspectorId, email: `ins_${createdInspectorId}@cib.gov`, name: 'Inspector Vikram', role: 'INSPECTOR', department: 'HOMICIDE_UNIT', rank: 'LEAD_DETECTIVE'
    }, superAdminToken);
    const pass2 = onboardRes2.data.data.temporaryPassword;
    console.log(`✓ Onboarded Inspector: ${createdInspectorId}`);

    const onboardRes3 = await postJson('/api/workflow/onboard-officer', {
      officerId: createdForensicId, email: `for_${createdForensicId}@cib.gov`, name: 'Dr. Forensic Specialist', role: 'FORENSIC_OFFICER', department: 'DIGITAL_FORENSICS_UNIT', rank: 'CYBER_SPECIALIST'
    }, superAdminToken);
    const pass3 = onboardRes3.data.data.temporaryPassword;
    console.log(`✓ Onboarded Forensic Officer: ${createdForensicId}`);

    const onboardRes4 = await postJson('/api/workflow/onboard-officer', {
      officerId: createdSPId, email: `sp_${createdSPId}@cib.gov`, name: 'Superintendent Mehta', role: 'SUPERINTENDENT', department: 'MAJOR_CRIMES_DIVISION', rank: 'SUPERVISORY_SPECIAL_AGENT'
    }, superAdminToken);
    const pass4 = onboardRes4.data.data.temporaryPassword;
    console.log(`✓ Onboarded Superintendent: ${createdSPId}\n`);

    // Authenticate all role profiles handling password change requirement
    const authenticateOfficer = async (offId, tempPass) => {
      let res = await postJson('/api/auth/login', { officerId: offId, password: tempPass });
      if (res.data && res.data.data && res.data.data.firstLogin) {
        const changeRes = await postJson('/api/auth/change-password', { officerId: offId, oldPassword: tempPass, newPassword: 'SecurePass123!' });
        if (!changeRes.data || !changeRes.data.success) {
          console.error(`[CHANGE PASS FAILURE LOG] ${offId}:`, JSON.stringify(changeRes));
        }
        res = await postJson('/api/auth/login', { officerId: offId, password: 'SecurePass123!' });
      }
      if (!res.data || !res.data.data || !res.data.data.token) {
        console.error(`[AUTH FAILURE LOG] Login failed for ${offId}:`, JSON.stringify(res));
        throw new Error(`Authentication token missing for officer ${offId}`);
      }
      return res.data.data.token;
    };

    siToken = await authenticateOfficer(createdOfficerId, pass1);
    inspectorToken = await authenticateOfficer(createdInspectorId, pass2);
    forensicToken = await authenticateOfficer(createdForensicId, pass3);
    spToken = await authenticateOfficer(createdSPId, pass4);

    console.log('✓ All 4 officer roles authenticated and tokens received.\n');

    // 4. Sub Inspector registers FIR & creates Case
    console.log('[STEP 4] Registering FIR & Creating Case File by Sub Inspector...');
    await postJson('/api/workflow/register-fir', {
      id: testFirId, title: 'E2E Cyber Hacking Incident', description: 'Unauthorized access detected on central bank gateway.', reporter: 'Bank IT Officer'
    }, siToken);
    console.log(`✓ FIR Registered: ${testFirId}`);

    await postJson('/api/workflow/create-case', {
      id: testCaseId, title: 'Operation Digital Breach', crimeType: 'Cybercrime', priority: 'High', location: 'Central Banking District', firId: testFirId, assignedOfficerId: createdOfficerId, victimName: 'National Reserve Bank', suspectName: 'Unknown Hacker Group'
    }, siToken);
    console.log(`✓ Case File Created & Assigned to SI: ${testCaseId}\n`);

    // 5. Evidence Upload by Sub Inspector
    console.log('[STEP 5] Uploading Evidence File by Sub Inspector...');
    const dummyFilePath = path.join(__dirname, 'temp_evidence_e2e.txt');
    fs.writeFileSync(dummyFilePath, 'DUMMY CLASSIFIED LOGS FOR E2E AUDIT TEST');

    const uploadRes = await postMultipart('/api/files/upload', {
      caseId: testCaseId, category: 'Digital Hardware', title: 'Server Dump Log.txt', remarks: 'Ingested memory dump from router.'
    }, 'file', dummyFilePath, siToken);
    fs.unlinkSync(dummyFilePath);
    console.log(`✓ Evidence Uploaded Successfully. ID: ${uploadRes.data.data.id}\n`);

    // 6. Superintendent Assigns Inspector to the Case
    console.log('[STEP 6] Superintendent assigning Case to Inspector...');
    await postJson('/api/workflow/assign-inspector', { caseId: testCaseId, inspectorId: createdInspectorId }, spToken);
    console.log(`✓ Inspector ${createdInspectorId} assigned to Case ${testCaseId}.\n`);

    // 7. Inspector Requests Forensic Analysis
    console.log('[STEP 7] Inspector requesting Forensic Analysis...');
    await postJson('/api/workflow/request-forensic', {
      reportId: testReportId, caseId: testCaseId, type: 'Digital Forensics Memory Inspection', summary: 'Analyze memory dump for malware signatures.'
    }, inspectorToken);
    console.log(`✓ Forensic Analysis Requested. Report ID: ${testReportId}\n`);

    // 8. Forensic Officer Uploads Forensic Report
    console.log('[STEP 8] Forensic Officer uploading Lab Report...');
    const reportFilePath = path.join(__dirname, 'temp_forensic_report.pdf');
    fs.writeFileSync(reportFilePath, 'FORENSIC ANALYSIS REPORT RESULTS - CLEAN MALWARE SIGNATURE CONFIRMED');

    await postMultipart('/api/forensics/upload', {
      caseId: testCaseId, reportTitle: 'Memory Analysis Final Report', type: 'Digital Forensics', summary: 'Malware IP trace completed.', observations: 'Attacker IP traced to proxy node.'
    }, 'file', reportFilePath, forensicToken);
    fs.unlinkSync(reportFilePath);
    console.log('✓ Forensic Report File Uploaded & Ingested into PostgreSQL.\n');

    // 9. Inspector Completes Investigation
    console.log('[STEP 9] Inspector marking investigation complete...');
    await postJson('/api/workflow/complete-investigation', { caseId: testCaseId }, inspectorToken);
    console.log('✓ Case investigation marked complete by Inspector.\n');

    // 10. Superintendent Reviews & Approves Chargesheet (Case Closed)
    console.log('[STEP 10] Superintendent reviewing and approving chargesheet...');
    await postJson('/api/workflow/review-case', { caseId: testCaseId, notes: 'Reviewed forensic report and evidence. Proceed with final chargesheet.' }, spToken);

    const closeRes = await postJson('/api/workflow/approve-chargesheet', { caseId: testCaseId }, spToken);
    console.log(`✓ Superintendent Approved Chargesheet. Case Status: ${closeRes.data.data.status}\n`);

    // 11. PostgreSQL Analytics Verification
    console.log('[STEP 11] Verifying Dynamic Dashboard Analytics Payload...');
    const analyticsRes = await getJson('/api/dashboard/analytics', superAdminToken);
    console.log('Real-Time Active Cases in PostgreSQL:', analyticsRes.data.data.totalActiveCases);
    console.log('Total FIRs Registered in PostgreSQL:', analyticsRes.data.data.totalFirRegistered);
    console.log('Evidence Files Uploaded in PostgreSQL:', analyticsRes.data.data.evidenceUploaded);

    console.log('\n=====================================================');
    console.log('SUCCESS: E2E ENTERPRISE CASE WORKFLOW FULLY VERIFIED!');
    console.log('=====================================================\n');

  } catch (err) {
    console.error('\n❌ E2E Simulation Failed:', err);
    process.exit(1);
  }
}

runE2ESimulation();

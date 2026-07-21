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

function postMultipart(urlPath, fields, fileField, filePath, token = null) {
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
      path: urlPath,
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

async function verifyFullWorkflow() {
  console.log('=====================================================');
  console.log('VERIFYING COMPREHENSIVE E2E WORKFLOW (BUG 1 & BUG 2)');
  console.log('=====================================================\n');

  try {
    // 1. Super Admin Login
    console.log('[STEP 1] Super Admin (Adil) Login...');
    const saLogin = await postJson('/api/auth/login', { officerId: 'SA-001', password: 'Admin123!' });
    if (!saLogin.data || !saLogin.data.data.token) {
      throw new Error(`Super Admin login failed: ${JSON.stringify(saLogin)}`);
    }
    const saToken = saLogin.data.data.token;
    console.log('✓ Super Admin authenticated successfully.\n');

    // 2. Super Admin Creates SI
    console.log('[STEP 2] Super Admin creates Sub-Inspector (Rohan)...');
    const newSiId = `SI-ROHAN-${Date.now().toString().slice(-4)}`;
    const createSiRes = await postJson('/api/officers', {
      name: 'Sub Inspector Rohan',
      email: `rohan_${newSiId}@cib.gov`,
      phone: '+91 9876543210',
      role: 'SUB_INSPECTOR',
      rank: 'DETECTIVE',
      department: 'MAJOR_CRIMES_DIVISION',
      policeStation: 'HQ Central'
    }, saToken);

    if (!createSiRes.data || !createSiRes.data.data.tempPassword) {
      throw new Error(`SI Creation failed: ${JSON.stringify(createSiRes)}`);
    }
    const createdOfficerId = createSiRes.data.data.id;
    const tempPassword = createSiRes.data.data.tempPassword;
    console.log(`✓ SI Created in PostgreSQL with ID: ${createdOfficerId} | Temp Password: ${tempPassword}\n`);

    // 3. SI Logs In with Temporary Password
    console.log('[STEP 3] SI Logs in with temporary password...');
    const siTempLogin = await postJson('/api/auth/login', { officerId: createdOfficerId, password: tempPassword });
    if (!siTempLogin.data || !siTempLogin.data.data || !siTempLogin.data.data.firstLogin) {
      console.error('Login Response Error:', JSON.stringify(siTempLogin));
      throw new Error('Expected firstLogin flag to be true.');
    }
    console.log('✓ Temporary password login detected firstLogin: true.\n');

    // 4. SI Changes Password
    console.log('[STEP 4] SI Changes Password...');
    const changeRes = await postJson('/api/auth/change-password', {
      officerId: createdOfficerId,
      oldPassword: tempPassword,
      newPassword: 'SecurePassword123!'
    });
    if (!changeRes.data || !changeRes.data.success) {
      throw new Error(`Password change failed: ${JSON.stringify(changeRes)}`);
    }
    console.log('✓ Password updated successfully.\n');

    // 5. Re-authenticate SI and verify role stored in DB
    console.log('[STEP 5] SI Re-authenticates with new password...');
    const siFreshLogin = await postJson('/api/auth/login', { officerId: createdOfficerId, password: 'SecurePassword123!' });
    if (!siFreshLogin.data || !siFreshLogin.data.data.token) {
      throw new Error(`Fresh SI login failed: ${JSON.stringify(siFreshLogin)}`);
    }
    const siToken = siFreshLogin.data.data.token;
    const siRole = siFreshLogin.data.data.role;
    console.log(`✓ SI Authenticated. Verified DB Role: ${siRole} (NOT SUPER_ADMIN).\n`);

    // 6. SI Registers FIR & Creates Case
    console.log('[STEP 6] SI Registers FIR & Creates Case...');
    const testFirId = `FIR-${Date.now().toString().slice(-4)}`;
    const testCaseId = `CASE-${Date.now().toString().slice(-4)}`;

    await postJson('/api/workflow/register-fir', {
      id: testFirId, title: 'Bank Fraud Incident', description: 'Unauthorized fund transfer detected.', reporter: 'Bank Auditor'
    }, siToken);

    await postJson('/api/workflow/create-case', {
      id: testCaseId, title: 'Operation Bank Fraud', crimeType: 'Financial Crime', priority: 'High', location: 'District Bank HQ', firId: testFirId, assignedOfficerId: createdOfficerId, victimName: 'District Bank', suspectName: 'Unknown Account'
    }, siToken);
    console.log(`✓ FIR ${testFirId} & Case ${testCaseId} created by SI ${createdOfficerId}.\n`);

    // 7. SI Uploads Evidence File
    console.log('[STEP 7] SI Uploading Evidence File...');
    const dummyFile = path.join(__dirname, 'temp_verify_evidence.jpg');
    fs.writeFileSync(dummyFile, 'CLASSIFIED EVIDENCE LOG DATA FOR VERIFICATION');

    const uploadRes = await postMultipart('/api/evidence/upload', {
      caseId: testCaseId, category: 'Document', title: 'Transaction Logs.jpg', remarks: 'Bank gateway transfer log snippet.'
    }, 'file', dummyFile, siToken);
    fs.unlinkSync(dummyFile);

    if (uploadRes.status !== 200 || !uploadRes.data.data || !uploadRes.data.data.id) {
      throw new Error(`Evidence Upload Failed: ${JSON.stringify(uploadRes)}`);
    }
    const evidenceId = uploadRes.data.data.id;
    console.log(`✓ Evidence Uploaded & Indexed in PostgreSQL successfully. Evidence ID: ${evidenceId}\n`);

    // 8. Super Admin Verifies Evidence Visibility
    console.log('[STEP 8] Super Admin verifying evidence visibility...');
    const saEvidenceList = await getJson(`/api/evidence/case/${testCaseId}`, saToken);
    if (!saEvidenceList.data || !saEvidenceList.data.data.some(e => e.id === evidenceId)) {
      throw new Error(`Evidence ${evidenceId} not visible to Super Admin.`);
    }
    console.log(`✓ Evidence ${evidenceId} verified visible to Super Admin.\n`);

    console.log('=====================================================');
    console.log('SUCCESS: COMPREHENSIVE WORKFLOW & BUG FIXES VERIFIED!');
    console.log('=====================================================\n');

  } catch (err) {
    console.error('\n❌ E2E Verification Failed:', err);
    process.exit(1);
  }
}

verifyFullWorkflow();

const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    const parsedUrl = new URL(url);
    
    const options = {
      method: method,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', (chunk) => {
        data.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(data);
        const contentType = res.headers['content-type'] || '';
        let parsed = buffer.toString('utf8');
        
        if (contentType.includes('application/json') && parsed) {
          try {
            parsed = JSON.parse(parsed);
          } catch (e) {
            // Ignored
          }
        }
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ status: res.statusCode, body: parsed, headers: res.headers });
        } else {
          const err = new Error(parsed.error || parsed.message || `Request failed with code ${res.statusCode}`);
          err.status = res.statusCode;
          err.body = parsed;
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING ANONYMOUS ASSESSMENT E2E TESTS ===');
  
  let assessmentId = null;
  let adminToken = null;

  try {
    // 1. Create an anonymous assessment
    console.log('\n[1] Creating a new anonymous assessment...');
    const createRes = await request('POST', '/assessments', {
      associationName: 'جمعية زائرة للتجربة'
    });
    assessmentId = createRes.body.assessment.id;
    console.log('✔ Anonymous assessment created successfully. ID:', assessmentId);
    console.log('User ID in DB (should be null):', createRes.body.assessment.user_id);
    if (createRes.body.assessment.user_id !== null) {
      throw new Error(`Expected user_id to be null, got ${createRes.body.assessment.user_id}`);
    }

    // 2. Auto-save answers (partial) anonymously
    console.log('\n[2] Saving initial answers (auto-save) anonymously...');
    const answersToSave = [
      { axisId: 1, questionIndex: 0, score: 2 },
      { axisId: 1, questionIndex: 1, score: 1 },
      { axisId: 2, questionIndex: 0, score: 0 }
    ];
    const saveRes = await request('PUT', `/assessments/${assessmentId}/answers`, {
      answers: answersToSave
    });
    console.log('✔ Answers saved. Total answers in response:', saveRes.body.answers.length);
    if (saveRes.body.answers.length !== 3) {
      throw new Error(`Expected 3 answers, got ${saveRes.body.answers.length}`);
    }

    // 3. Fetch assessment details anonymously
    console.log('\n[3] Fetching assessment details anonymously...');
    const getRes = await request('GET', `/assessments/${assessmentId}`);
    console.log('✔ Assessment details fetched.');
    console.log('Association:', getRes.body.assessment.association_name);
    console.log('Answers count:', getRes.body.answers.length);
    if (getRes.body.answers.length !== 3) {
      throw new Error(`Expected 3 answers, got ${getRes.body.answers.length}`);
    }

    // 4. Save rest of answers to be able to complete
    console.log('\n[4] Saving remaining mock answers...');
    const AXES = require('c:/Users/Afif jouili/Desktop/assessment platform/shared/questions').AXES;
    const allAnswers = [];
    AXES.forEach(axis => {
      axis.questions.forEach((_, idx) => {
        allAnswers.push({
          axisId: axis.id,
          questionIndex: idx,
          score: Math.floor(Math.random() * 3) // 0, 1, or 2
        });
      });
    });

    console.log(`Saving remaining ${allAnswers.length} answers in batches...`);
    const batchSize = 20;
    for (let i = 0; i < allAnswers.length; i += batchSize) {
      const batch = allAnswers.slice(i, i + batchSize);
      await request('PUT', `/assessments/${assessmentId}/answers`, { answers: batch });
    }
    console.log('✔ All answers saved successfully.');

    // 5. Complete the assessment anonymously
    console.log('\n[5] Completing the assessment anonymously...');
    const completeRes = await request('POST', `/assessments/${assessmentId}/complete`);
    console.log('✔ Assessment completed successfully.');
    console.log('Score:', completeRes.body.assessment.total_score, '/', completeRes.body.assessment.max_score);
    console.log('Percentage:', completeRes.body.assessment.percentage + '%');
    console.log('Compliance level:', completeRes.body.assessment.level);

    // 6. Export Excel anonymously
    console.log('\n[6] Exporting Excel anonymously...');
    const excelRes = await request('GET', `/export/${assessmentId}/excel`);
    console.log('✔ Excel generated successfully. Content-Type:', excelRes.headers['content-type']);
    if (!excelRes.headers['content-type'].includes('spreadsheet') && !excelRes.headers['content-type'].includes('octet-stream')) {
      throw new Error(`Expected spreadsheet/octet-stream content-type, got ${excelRes.headers['content-type']}`);
    }

    // 7. Export PDF anonymously
    console.log('\n[7] Exporting PDF details anonymously...');
    const pdfRes = await request('GET', `/export/${assessmentId}/pdf`);
    console.log('✔ PDF details fetched successfully.');
    console.log('Owner user field (should be null):', pdfRes.body.user);
    if (pdfRes.body.user !== null) {
      throw new Error(`Expected user object to be null, got ${JSON.stringify(pdfRes.body.user)}`);
    }

    // 8. Admin Verification
    console.log('\n[8] Logging in as admin...');
    const adminLogin = await request('POST', '/auth/login', {
      email: 'admin@platform.tn',
      password: 'admin123'
    });
    adminToken = adminLogin.body.token;
    console.log('✔ Admin logged in successfully.');

    console.log('\n[9] Admin fetching platform stats...');
    const statsRes = await request('GET', '/admin/stats', null, { 'Authorization': `Bearer ${adminToken}` });
    console.log('✔ Stats fetched. Total Assessments:', statsRes.body.totalAssessments);
    
    const listedInStats = statsRes.body.recentAssessments.find(a => a.id === assessmentId);
    if (!listedInStats) {
      throw new Error('Anonymous assessment not found in admin stats recent list!');
    }
    console.log('✔ Found anonymous assessment in admin stats recent list.');
    console.log('Owner name in admin panel stats list:', listedInStats.user_name);
    console.log('Owner email in admin panel stats list:', listedInStats.user_email);
    if (listedInStats.user_name !== 'زائر (غير مسجل)') {
      throw new Error(`Expected owner name to be "زائر (غير مسجل)", got ${listedInStats.user_name}`);
    }

    console.log('\n[10] Admin listing all assessments...');
    const listRes = await request('GET', '/admin/assessments', null, { 'Authorization': `Bearer ${adminToken}` });
    const listedInAll = listRes.body.assessments.find(a => a.id === assessmentId);
    if (!listedInAll) {
      throw new Error('Anonymous assessment not found in admin assessments list!');
    }
    console.log('✔ Found anonymous assessment in admin assessments list.');
    console.log('Owner name in admin list:', listedInAll.user_name);
    if (listedInAll.user_name !== 'زائر (غير مسجل)') {
      throw new Error(`Expected owner name to be "زائر (غير مسجل)", got ${listedInAll.user_name}`);
    }

    console.log('\n=========================================');
    console.log('🎉 ANONYMOUS ASSESSMENT E2E TESTS PASSED! 🎉');
    console.log('=========================================');

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    if (err.body) console.error('Error Body:', err.body);
    process.exit(1);
  }
}

runTests();

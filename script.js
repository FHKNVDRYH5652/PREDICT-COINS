
/* =======================
   Firebase & App Setup
   ======================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getDatabase, ref, push, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBs7eQyMrcN8kJWMHl2ac2UZHlYQ6DypD8",
  authDomain: "terminal-xxrr.firebaseapp.com",
  databaseURL: "https://terminal-xxrr-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "terminal-xxrr",
  storageBucket: "terminal-xxrr.firebasestorage.app",
  messagingSenderId: "722753278120",
  appId: "1:722753278120:web:bfa37aab39635a4e57f29d",
  measurementId: "G-E3MZH3E1K5"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

function saveUTRtoFirebase(utr, amount, deviceId, planDays, planLabel, loss){
  const utrRef = ref(db, 'utrRequests');
  const newRef = push(utrRef);
  set(newRef, {
    utr: utr,
    amount: amount,
    status: 'pending',
    deviceId: deviceId,
    planDays: planDays,
    planLabel: planLabel,
    loss: loss,
    time: Date.now()
  });
}

/* =======================
   Utility & UI helpers
   ======================= */
function speak(t){ try{ let u=new SpeechSynthesisUtterance(t); u.lang='hi-IN'; speechSynthesis.cancel(); speechSynthesis.speak(u);}catch(e){} }
function showPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const bg={'welcome':'anime1.png','loss':'anime2.png','plan':'anime3.png','payment':'anime4.png','strategy':'anime5.png','predict':'anime4.png'};
  document.body.style.backgroundImage = "url('"+(bg[id]||'anime1.png')+"')";
}

/* =======================
   App State (local)
   ======================= */
let loss = parseFloat(localStorage.getItem('lossAmount') || '0');
let selectedPlan = null;
let planPrice = 0;
let baseBet = parseInt(localStorage.getItem('baseBet')||'0',10) || 0;
let martingaleCurrent = parseInt(localStorage.getItem('martingaleCurrent')||'0',10) || 0;
let deviceId = localStorage.getItem('deviceId') || (Math.random().toString(36).slice(2));
localStorage.setItem('deviceId', deviceId);

// plan options
const plans = [
  {label:'3 Month',pct:7,days:90},
  {label:'1 Month',pct:12.5,days:30},
  {label:'1 Week',pct:15,days:7},
  {label:'3 Days',pct:20,days:3},
  {label:'1 Day',pct:25,days:1}
];

/* =======================
   Build Plans UI
   ======================= */
function buildPlans(){
  const box = document.getElementById('plans'); box.innerHTML='';
  plans.forEach(p=>{
    const price = (loss * p.pct / 100).toFixed(2);
    const div = document.createElement('div');
    div.className = 'plan';
    div.innerHTML = `<b>${p.label}</b><div class="small">Price: ₹${price}</div><div class="small">Duration: ${p.days} days</div>`;
    div.onclick = ()=>{
      document.querySelectorAll('.plan').forEach(x=>x.classList.remove('selected'));
      div.classList.add('selected');
      selectedPlan = p;
      planPrice = price;
      speak('Apne '+p.label+' plan chuna. Price '+price+' rupaye');
    };
    box.appendChild(div);
  });
}

/* =======================
   User Flow: Loss -> Plan -> Payment -> UTR submit
   ======================= */
function goLoss(){ showPage('loss'); speak('Apna loss amount darj karein'); }
function confirmLoss(){
  const v = parseFloat(document.getElementById('lossAmount').value);
  document.getElementById('lossAmount').value = v; // ensure displayed correctly
  if(!v || v <= 0){ alert('Enter valid loss amount'); return; }
  loss = v;
  localStorage.setItem('lossAmount', String(loss));
  baseBet = Math.max(1, Math.round(loss * 0.05)); // base 5%
  martingaleCurrent = baseBet;
  localStorage.setItem('baseBet', String(baseBet));
  localStorage.setItem('martingaleCurrent', String(martingaleCurrent));
  buildPlans();
  showPage('plan');
  speak('Apko apna loss kitne dino mai cover karna hai. Plan choose karein');
}
function goPayment(){
  if(!selectedPlan){ alert('Select a plan'); return; }
  document.getElementById('planName').innerText = selectedPlan.label;
  document.getElementById('planPrice').innerText = planPrice;
  showPage('payment');
  speak('QR scan karke '+planPrice+' rupaye ka payment karein.');
}
function submitUTR(){
  const utr = document.getElementById('utr').value.trim();
  if(!utr){ alert('Enter UTR'); return; }
  // push to firebase with deviceId
  saveUTRtoFirebase(utr, planPrice, deviceId, selectedPlan.days, selectedPlan.label, loss);
  alert('Payment submitted for approval. Admin will approve soon.');
  showPage('strategy');
  renderStrategyLocked(); // locked until approved
}

/* =======================
   Firebase: Admin side & User listen for approval
   ======================= */
// Admin panel will listen to all requests and show approve/reject buttons
const requestsRef = ref(db, 'utrRequests');
onValue(requestsRef, (snap)=>{
  const el = document.getElementById('adminRequests');
  if(!snap.exists()){ el.innerHTML = '<div class="small">No requests</div>'; checkUserApproval(null); return; }
  const data = snap.val();
  // build admin list with approve/reject
  let html = '<table><thead><tr><th>Key</th><th>UTR</th><th>Amt</th><th>DeviceId</th><th>Plan</th><th>Days</th><th>Status</th><th>Time</th><th>Action</th></tr></thead><tbody>';
  for(const k in data){
    if(data[k].status !== 'pending') continue;
    const r = data[k];
    html += `<tr>
      <td style="font-size:12px">${k}</td>
      <td>${r.utr || ''}</td>
      <td>₹${r.amount || ''}</td>
      <td style="font-size:12px">${r.deviceId || ''}</td>
      <td>${r.planLabel || ''}</td>
      <td>${r.planDays || ''}</td>
      <td>${r.status || ''}</td>
      <td style="font-size:12px">${new Date(r.time).toLocaleString()}</td>
      <td>
        ${r.status !== 'approved' ? `<button class="btn" onclick="adminApprove('${k}')">Approve</button>` : ''}
        ${r.status !== 'rejected' ? `<button class="btn" onclick="adminReject('${k}')">Reject</button>` : ''}
      </td>
    </tr>`;
  }
  html += '</tbody></table>';
  el.innerHTML = html;
  html += `<div style='margin-top:15px;text-align:left;font-size:14px;line-height:1.5'>
    <b>📌 Step-by-Step Recovery Guide:</b><br>
    1️⃣ हर दिन system आपके लिए target calculate करेगा.<br>
    2️⃣ आज का deposit amount और target ऊपर table में देखें.<br>
    3️⃣ Prediction page पर जाएं → Last 10 results डालें → "Generate AI Prediction" पर click करें.<br>
    4️⃣ हर bet के बाद "Win" या "Loss" button दबाकर result update करें.<br>
    5️⃣ जब आज का target पूरा हो जाए → status "Completed" दिखेगा और अगला दिन unlock होगा.<br>
    6️⃣ Plan पूरा होने पर आपका पूरा loss recover हो जाएगा ✅.<br>
  </div>`;

  // Also check if user's request changed (for current device)
  const myReqKey = findMyRequestKey(data);
  if(myReqKey) checkUserApproval({key: myReqKey, data: data[myReqKey]});
  else checkUserApproval(null);
});

function adminApprove(key){
  console.log('Approving request', key);
  if(!confirm('Approve this request?')) return;
  const node = ref(db, 'utrRequests/' + key);
  update(node, { status: 'approved', approvedAt: Date.now() }).then(()=>{checkUserApproval({key:key, data:{status:'approved', loss:loss, planDays:selectedPlan?selectedPlan.days:localStorage.getItem('planDays'), planLabel:selectedPlan?selectedPlan.label:localStorage.getItem('planLabel')}}); showPage('strategy');});
}
function adminReject(key){
  if(!confirm('Reject this request?')) return;
  const node = ref(db, 'utrRequests/' + key);
  update(node, { status: 'rejected', rejectedAt: Date.now() });
}

function findMyRequestKey(allData){
  if(!allData) return null;
  for(const k in allData){
    if(allData[k].deviceId === deviceId) return k;
  }
  return null;
}

/* =======================
   User: React to approval changes
   ======================= */
function checkUserApproval(req){
  // req = {key, data} or null
  if(!req){
    // no request for this device - show locked strategy
    renderStrategyLocked();
    return;
  }
  const data = req.data || req;
  if(data.status === 'approved'){
    // store approved info locally and build progressive targets
    localStorage.setItem('approvedRequestKey', req.key || '');
    localStorage.setItem('approved', 'true');
    // store selectedPlan details from firebase record if available
    if(data.loss) localStorage.setItem('lossAmount', String(data.loss));
    if(data.planDays) localStorage.setItem('planDays', String(data.planDays));
    if(data.planLabel) localStorage.setItem('planLabel', data.planLabel);
    // now generate progressive targets and unlock strategy
    generateAndStoreTargets();
    renderStrategyUnlocked();
    return;
  } else if(data.status === 'rejected'){
    // show rejection message
    renderStrategyRejected();
    return;
  } else {
    // pending
    renderStrategyLocked();
  }
}

/* =======================
   Strategy: Progressive AP targets
   ======================= */
function generateAndStoreTargets(){
  // read loss and days (prefer local selected plan details)
  const l = parseFloat(localStorage.getItem('lossAmount') || '0');
  const days = parseInt(localStorage.getItem('planDays') || (selectedPlan ? selectedPlan.days : '0'), 10);
  if(!l || !days) return;
  // a = base first day target (safe): use baseBet or 5% of loss but capped small
  let a = Math.max(1, Math.round(l * 0.03)); // start with 3% of loss (safer start)
  // Solve for d via AP sum: sum = n/2 * (2a + (n-1)d) = l
  // => (2a + (n-1)d) = 2l/n  => d = (2l/n - 2a) / (n-1)
  let d = 0;
  if(days > 1) d = (2 * l / days - 2 * a) / (days - 1);
  else d = 0;
  // build targets and round
  let targets = [];
  let sum = 0;
  for(let i=0;i<days;i++){
    let t = Math.max(1, Math.round(a + i * d));
    targets.push(t);
    sum += t;
  }
  // adjust rounding difference
  const diff = Math.round(l - sum);
  if(diff !== 0){
    targets[targets.length - 1] += diff;
  }
  // store
  localStorage.setItem('dayTargets', JSON.stringify(targets));
  // day statuses
  const statusArr = Array.from({length: days}, (_,i) => (i===0? 'Pending':'Pending'));
  localStorage.setItem('dayStatus', JSON.stringify(statusArr));
  localStorage.setItem('currentDay', '1');
  // also store planDays & planLabel if not present
  if(!localStorage.getItem('planDays') && selectedPlan) localStorage.setItem('planDays', String(selectedPlan.days));
  if(!localStorage.getItem('planLabel') && selectedPlan) localStorage.setItem('planLabel', selectedPlan.label);
}

/* Render strategy UI states */
function renderStrategyLocked(){
  const el = document.getElementById('strategyContent');
  el.innerHTML = `<p class="small">Your payment is pending admin approval. Submit UTR on Payment page and wait for admin.</p>`;
  document.getElementById('strategyButtons').innerHTML = `<div class="small">Pending approval... (Admin will approve in the Admin Panel)</div>`;
}
function renderStrategyRejected(){
  const el = document.getElementById('strategyContent');
  el.innerHTML = `<p style="color:#ffb4b4"><b>Payment rejected by admin. Contact admin.</b></p><div><button class="btn" onclick="showPage('payment')">Resubmit UTR</button></div>`;
  document.getElementById('strategyButtons').innerHTML = '';
}
function renderStrategyUnlocked(){
  const el = document.getElementById('strategyContent');
  const targets = JSON.parse(localStorage.getItem('dayTargets')||'[]');
  const dayStatus = JSON.parse(localStorage.getItem('dayStatus')||'[]');
  const currentDay = parseInt(localStorage.getItem('currentDay')||'1',10);
  if(!targets.length){ el.innerHTML = '<p class="small">Targets not generated yet.</p>'; return; }
  let html = `<p class=\"small\">Plan: ${localStorage.getItem('planLabel')||''} | Total Loss: ₹${localStorage.getItem('lossAmount')||''}</p>`;

  // calculate progress
  const completedCount = dayStatus.filter(s=>s==='Completed').length;
  const totalDays = targets.length;
  const progressPct = Math.round((completedCount/totalDays)*100);
  html = `<div style='margin:10px 0'>
    <div style='background:#333;border-radius:8px;overflow:hidden;height:20px;width:100%'>
      <div style='background:#4ade80;height:100%;width:${progressPct}%;transition:width 0.5s'></div>
    </div>
    <p class='small'>Progress: ${completedCount}/${totalDays} days (${progressPct}%)</p>
  </div>` + html;

  html += `<p class='small'>Your recovery strategy is divided into daily steps. Follow AI prediction each day until target achieved.</p>`;
  html += '<table><thead><tr><th>Day</th><th>Target (₹)</th><th>Deposit %</th><th>Status</th></tr></thead><tbody>';
  targets.forEach((t,i)=>{
    const idx = i+1;
    const st = (dayStatus[i] || 'Pending');
    const mark = (st === 'Completed' ? '✅ Completed' : (idx === currentDay ? '➡️ Current' : '⏳ Pending'));
    let depositPct = (idx===1?10:Math.round((t/parseFloat(localStorage.getItem('lossAmount')||'1'))*100));
    html += `<tr><td>${idx}</td><td>₹${t}</td><td>${depositPct}%</td><td>${mark}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
  html += `<div style='margin-top:15px;text-align:left;font-size:14px;line-height:1.5'>
    <b>📌 Step-by-Step Recovery Guide:</b><br>
    1️⃣ हर दिन system आपके लिए target calculate करेगा.<br>
    2️⃣ आज का deposit amount और target ऊपर table में देखें.<br>
    3️⃣ Prediction page पर जाएं → Last 10 results डालें → "Generate AI Prediction" पर click करें.<br>
    4️⃣ हर bet के बाद "Win" या "Loss" button दबाकर result update करें.<br>
    5️⃣ जब आज का target पूरा हो जाए → status "Completed" दिखेगा और अगला दिन unlock होगा.<br>
    6️⃣ Plan पूरा होने पर आपका पूरा loss recover हो जाएगा ✅.<br>
  </div>`;

  // buttons: start today's prediction or continue
  document.getElementById('strategyButtons').innerHTML = `<div style="margin-top:12px">
    <button class="btn" onclick="startTodayPrediction()">Start Today's Prediction (Day ${currentDay})</button>
    <button class="btn" onclick="resetPlanConfirm()">Cancel/Reset Plan</button>
  </div>`;
}

/* =======================
   Start prediction for current day
   ======================= */
function startTodayPrediction(){
  // allow if approved OR if strategy targets exist
  if(localStorage.getItem('approved') === 'true' || localStorage.getItem('dayTargets')){
    showPage('predict');
    const currentDay = parseInt(localStorage.getItem('currentDay')||'1',10);
    speak('Day ' + currentDay + ' prediction start karen.');
  } else {
    alert('Payment not yet approved.');
  }
}
  // go to predict page
  showPage('predict');
  const currentDay = parseInt(localStorage.getItem('currentDay')||'1',10);
  speak('Day ' + currentDay + ' prediction start karen.');
}

/* =======================
   AI Prediction (pattern logic reused from previous)
   ======================= */
function parseSeq(text){
  if(!text) return [];
  const parts = text.trim().split(/\s+/).map(s=>{
    const a = s.toLowerCase();
    if(a.startsWith('b')) return 'Big';
    if(a.startsWith('s')) return 'Small';
    return null;
  }).filter(Boolean);
  return parts;
}
function computePatternPrediction(seq){
  const n = seq.length;
  if(n === 0) return {prediction:'Big', confidence:50, reason:'no-data'};
  const counts = {Big:0, Small:0};
  seq.forEach(x=>counts[x] = (counts[x]||0)+1);
  let last = seq[n-1];
  let streak = 1;
  for(let i=n-2;i>=0;i--){ if(seq[i]===last) streak++; else break; }
  let alternations = 0;
  for(let i=1;i<n;i++){ if(seq[i] !== seq[i-1]) alternations++; }
  const alternationRatio = alternations / Math.max(1, n-1);
  let score = {Big:0, Small:0};
  if(counts.Big > counts.Small) score.Big += 1;
  if(counts.Small > counts.Big) score.Small += 1;
  if(alternationRatio < 0.4) score[last] += 2;
  else if(alternationRatio > 0.6) score[last] += 1;
  if(streak >= 4){
    const other = last === 'Big' ? 'Small' : 'Big';
    score[other] += 3;
  } else if(streak >= 2){ score[last] += 1; }
  if(n >= 4){
    const last4 = seq.slice(-4).join(' ');
    if(/^(Big Small Big Small|Small Big Small Big)$/i.test(last4)){
      const next = last === 'Big' ? 'Small' : 'Big';
      score[next] += 2;
    }
    if(/^(Big Big Small|Small Small Big)$/i.test(last4)){
      const next = last === 'Big' ? 'Small' : 'Big';
      score[next] += 1;
    }
  }
  let prediction = 'Big';
  if(score.Small > score.Big) prediction = 'Small';
  else if(score.Big > score.Small) prediction = 'Big';
  else {
    if(streak >= 3) prediction = (last === 'Big' ? 'Small' : 'Big');
    else prediction = (counts.Big >= counts.Small ? 'Big' : 'Small');
  }
  let confidence = 50;
  const diff = Math.abs(score.Big - score.Small);
  confidence += Math.min(30, diff * 10);
  if(streak >= 4) confidence += 10;
  if(alternationRatio > 0.7) confidence += 5;
  confidence += Math.min(10, Math.abs(counts.Big - counts.Small) * 2);
  confidence = Math.max(50, Math.min(95, Math.round(confidence)));
  let reason = `counts: B${counts.Big}/S${counts.Small}, streak:${last}x${streak}, alt:${Math.round(alternationRatio*100)}%`;
  return {prediction, confidence, reason, score};
}
function genPrediction(){
  const last10Text = document.getElementById('last10').value.trim();
  const seq = parseSeq(last10Text);
  if(seq.length < 3){ alert('Enter at least 3 recent results (ideally 10).'); return; }
  const period = document.getElementById('period').value.trim();
  const res = document.getElementById('predictionResult');
  res.innerHTML = `<p class="small">AI analyzing trends... (8-12 sec)</p>
                   <div class="chip">Period: ${period || 'N/A'}</div>`;
  setTimeout(()=>{
    const out = computePatternPrediction(seq);
    // suggested bet = martingaleCurrent or base
    let suggestedBet = martingaleCurrent || baseBet;
    const cap = Math.max(1, Math.round(loss * 0.30));
    if(suggestedBet > cap) suggestedBet = cap;
    res.innerHTML = `<h3>Prediction: ${out.prediction}</h3>
                     <p class="small">Confidence: <b>${out.confidence}%</b></p>
                     <p class="small">Reason: ${out.reason}</p>
                     <p class="small">Suggested Bet: <b>₹${suggestedBet}</b></p>
                     <p class="small">Tip: Martingale doubles on loss, resets on win.</p>`;
    // store prediction history locally
    const hist = JSON.parse(localStorage.getItem('predictionHistory')||'[]');
    hist.push({time:Date.now(), period:period||null, seq:seq.slice(-10), pred:out.prediction, conf:out.confidence});
    if(hist.length > 300) hist.shift();
    localStorage.setItem('predictionHistory', JSON.stringify(hist));
    speak('Agla result hone ki sambhavna hai ' + out.prediction + ' confidence ' + out.confidence + ' percent');
  }, 10000);
}

/* =======================
   Record result + day completion logic
   ======================= */
function handleRecord(outcome){
  // outcome = 'win' or 'loss' relative to last prediction
  const predDiv = document.getElementById('predictionResult');
  if(!predDiv.innerText || predDiv.innerText.trim()===''){ alert('Pehle AI prediction generate kijiye.'); return; }

  // Ask user for actual result and profit made (daily)
  const actual = prompt('Enter actual result (Big or Small):');
  if(!actual){ alert('Actual result required'); return; }
  const actualNorm = actual.toLowerCase().startsWith('b') ? 'Big' : actual.toLowerCase().startsWith('s') ? 'Small' : null;
  if(!actualNorm){ alert('Invalid actual. Use Big or Small.'); return; }

  // Ask how much ₹ recovered today (profit used for target)
  const recoveredStr = prompt('Enter profit/recovery amount you made this session (₹). If none, enter 0:','0');
  const recovered = Math.max(0, Math.round(parseFloat(recoveredStr) || 0));

  // update martingale
  if(outcome === 'win'){
    martingaleCurrent = baseBet;
    localStorage.setItem('martingaleCurrent', String(martingaleCurrent));
    predDiv.innerHTML += `<p>✅ Win recorded. Martingale reset to ₹${martingaleCurrent}.</p>`;
  } else {
    // double martingale but cap to 50% of loss to avoid blowup
    martingaleCurrent = Math.min(Math.round((martingaleCurrent || baseBet) * 2), Math.max(1, Math.round(loss * 0.5)));
    localStorage.setItem('martingaleCurrent', String(martingaleCurrent));
    predDiv.innerHTML += `<p>❌ Loss recorded. Martingale increased to ₹${martingaleCurrent}.</p>`;
  }

  // append actual to last10 input
  const field = document.getElementById('last10');
  const cur = parseSeq(field.value);
  cur.push(actualNorm);
  const newArr = cur.slice(-10);
  field.value = newArr.join(' ');
  predDiv.innerHTML += `<p class="small">History updated: ${newArr.join(' ')}</p>`;

  // handle day target progress
  const targets = JSON.parse(localStorage.getItem('dayTargets')||'[]');
  let dayStatus = JSON.parse(localStorage.getItem('dayStatus')||'[]');
  let currentDay = parseInt(localStorage.getItem('currentDay')||'1',10);
  if(!targets.length){ alert('Targets not configured.'); return; }

  // If recovered >= today's target -> mark completed and progress
  const todayTarget = targets[currentDay - 1] || 0;
  if(recovered >= todayTarget){
    dayStatus[currentDay - 1] = 'Completed';
    localStorage.setItem('dayStatus', JSON.stringify(dayStatus));
    predDiv.innerHTML += `<p>🎉 Day ${currentDay} target ₹${todayTarget} achieved. Marked Completed.</p>`;
    // move to next day
    const totalDays = targets.length;
    if(currentDay >= totalDays){
      // All days may be completed? check
      const allCompleted = dayStatus.every(s => s === 'Completed');
      if(allCompleted){
        predDiv.innerHTML += `<p style="color:#b7f5b7"><b>🎊 Congratulations! Your full loss ₹${loss} recovered. Resetting...</b></p>`;
        // reset everything after short delay
        setTimeout(() => { resetAll(); }, 3000);
        return;
      } else {
        // find next pending day
        const next = dayStatus.findIndex(s => s !== 'Completed');
        if(next >= 0){
          currentDay = next + 1;
          localStorage.setItem('currentDay', String(currentDay));
        }
      }
    } else {
      // increment to next day
      currentDay = currentDay + 1;
      localStorage.setItem('currentDay', String(currentDay));
    }
    // after marking, go back to strategy to show updated table
    setTimeout(()=>{ renderStrategyUnlocked(); showPage('strategy'); }, 1200);
  } else {
    // not enough recovered today
    predDiv.innerHTML += `<p style="color:#ffd6d6">⚠️ Recovered ₹${recovered} — less than today's target ₹${todayTarget}. Day remains pending.</p>`;
  }

  // save a brief local history entry
  const hist = JSON.parse(localStorage.getItem('predictionHistory')||'[]');
  const lastEntry = hist.length ? hist[hist.length -1] : null;
  if(lastEntry){
    lastEntry.outcome = outcome;
    lastEntry.actual = actualNorm;
    lastEntry.recovered = recovered;
    lastEntry.martingaleAfter = martingaleCurrent;
    localStorage.setItem('predictionHistory', JSON.stringify(hist));
  }
}

/* =======================
   Reset/Cancel functions
   ======================= */
function resetAll(){
  localStorage.removeItem('dayTargets');
  localStorage.removeItem('dayStatus');
  localStorage.removeItem('currentDay');
  localStorage.removeItem('approved');
  localStorage.removeItem('approvedRequestKey');
  localStorage.removeItem('planDays');
  localStorage.removeItem('planLabel');
  localStorage.removeItem('lossAmount');
  localStorage.removeItem('baseBet');
  localStorage.removeItem('martingaleCurrent');
  localStorage.removeItem('predictionHistory');
  // redirect to welcome
  alert('Plan reset. Back to start.');
  showPage('welcome');
}
function resetPlanConfirm(){
  if(confirm('Are you sure you want to cancel/reset this plan? This will clear local progress.')) resetAll();
}

/* =======================
   Admin UI open/close & Approve helpers
   ======================= */
function openAdmin(){
  const pass = prompt('Enter Admin Password to open panel:');
  if(pass === '456'){
    document.getElementById('adminPanel').style.display = 'block';
  } else {
    alert('Wrong password');
  }
}
function closeAdmin(){ document.getElementById('adminPanel').style.display = 'none'; }

/* =======================
   Helper: find my request key and call checkUserApproval each time (also called by onValue)
   ======================= */
function checkRequestsAndMyStatus(){
  // request listener already calls checkUserApproval on updates via onValue above.
  // This function kept for possible future polling triggers.
}

/* =======================
   Helpers: fill example
   ======================= */
function autoFillExample(){
  document.getElementById('period').value = 'yesterday-123';
  document.getElementById('last10').value = 'Small Big Small Big Big Big Small Big Small Big';
  speak('Example filled, ab Generate AI Prediction karo');
}

/* =======================
   Init UI on load
   ======================= */
(function init(){
  // if there's an approved request stored, render unlocked strategy; else locked
  if(localStorage.getItem('approved') === 'true' && localStorage.getItem('dayTargets')){
    renderStrategyUnlocked();
  } else {
    renderStrategyLocked();
  }
  // if loss already set, prefill
  const storedLoss = parseFloat(localStorage.getItem('lossAmount')||'0');
  if(storedLoss) {
    loss = storedLoss;
  }
  // build plans if loss known
  if(loss) buildPlans();
})();

/* Expose some functions for inline onclick usage */
window.goLoss = goLoss;
window.confirmLoss = confirmLoss;
window.goPayment = goPayment;
window.submitUTR = submitUTR;
window.genPrediction = genPrediction;
window.handleRecord = handleRecord;
window.openAdmin = openAdmin;
window.closeAdmin = closeAdmin;
window.resetPlanConfirm = resetPlanConfirm;
window.autoFillExample = autoFillExample;


// assessment_module.js

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getFirestore, doc, setDoc, getDocs, getDoc, collection, query, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// ==== Firebase Config ====
const firebaseConfig = {
  apiKey: "AIzaSyADVdmyzhrewkr2-AjV15NwdAqrfhw2TaY",
  authDomain: "imathgination-7e610.firebaseapp.com",
  projectId: "imathgination-7e610",
  storageBucket: "imathgination-7e610.appspot.com",
  messagingSenderId: "591589679937",
  appId: "1:591589679937:web:5298f062812021e64c77c0"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ==== Session Check ====
const currentUser = JSON.parse(localStorage.getItem("session") || "null");
if (!currentUser || currentUser.role !== "teacher") {
  alert("Please log in as a teacher first.");
  window.location.href = "imathgination.html";
  throw new Error("No teacher logged in");
}

// ==== Navigation ====
window.goBack = function() {
  window.location.href = "teacher.html";
};

// ==== State ====
let quests = [];
let currentQuestIndex = null;
let editingQuestionIndex = null;

// ==== DOM Elements ====
const questList = document.getElementById("questList");
const createQuestBtn = document.getElementById("createQuestBtn");

// ==== Utils ====
function generateId() {
  return "quest_" + Math.random().toString(36).substring(2, 9);
}

// ==== Create Quest ====
createQuestBtn.addEventListener("click", () => {
  if (quests.length >= 5) return alert("Maximum of 5 quests reached.");
  document.getElementById("questTitleInput").value = "";
  document.getElementById("modalTitle").innerText = "Create New Batch";
  currentQuestIndex = null;
  openModal("questModal");
});

// ==== Render Functions ====
function renderQuests() {
  questList.innerHTML = "";
  quests.forEach((quest, index) => {
    const div = document.createElement("div");
    div.className = "quest-card";
    div.innerHTML = `
      <div class="quest-title">${quest.title}</div>
      <button onclick="openAssessment(${index})">View/Edit Assessment</button>
      <button onclick="editQuest(${index})">Edit Quest</button>
      <button onclick="deleteQuest(${index})">Delete</button>
    `;
    questList.appendChild(div);
  });
  renderAssessmentModals();
  localStorage.setItem("quests", JSON.stringify(quests));
}

// ==== Quest CRUD ====
window.saveQuest = async function () {
  const titleEl = document.getElementById("questTitleInput");
  if (!titleEl) return alert('Save failed: title input not found');
  const title = titleEl.value.trim();
  if (!title) return alert("Quest title required.");

  try {
    if (currentQuestIndex !== null) {
      // edit existing quest
      const q = quests[currentQuestIndex] = quests[currentQuestIndex] || {};
      q.title = title;
      // sync to Firestore if we have an id
      if (q.id) {
        const docRef = doc(db, "assessments", q.id);
        try {
          // prefer updateDoc so we don't accidentally overwrite other fields
          await updateDoc(docRef, { title, updatedAt: new Date().toISOString() });
        } catch (updErr) {
          // fallback to setDoc (merge) if update failed (e.g., doc missing or permissions)
          try {
            await setDoc(docRef, { title, updatedAt: new Date().toISOString(), teacherEmail: currentUser?.email || null }, { merge: true });
          } catch (setErr) {
            console.warn('Failed to persist quest edit to Firestore', updErr, setErr);
            alert('Saved locally but failed to update Firestore (see console).');
          }
        }
      } else {
        // No id -> create doc
        const newId = generateId();
        q.id = newId;
        const docRef = doc(db, "assessments", newId);
        try {
          await setDoc(docRef, { title: q.title, questions: q.questions || [], teacherEmail: currentUser?.email || null, createdAt: new Date().toISOString() }, { merge: true });
        } catch (e) {
          console.warn('Failed to create assessment in Firestore', e);
          alert('Saved locally but failed to create record in Firestore.');
        }
      }
    } else {
      // create new quest and persist
      const newId = generateId();
      const newQuest = { id: newId, title, questions: [] };
      quests.push(newQuest);
      currentQuestIndex = quests.length - 1;
      const docRef = doc(db, "assessments", newId);
      try {
        await setDoc(docRef, { title: newQuest.title, questions: [], teacherEmail: currentUser?.email || null, createdAt: new Date().toISOString() }, { merge: true });
      } catch (e) {
        console.warn('Failed to create assessment in Firestore', e);
        alert('Created locally but failed to persist to Firestore.');
      }
      closeModal("questModal");
      renderQuests();
      setTimeout(() => {
        openModal(`assessmentModal-${currentQuestIndex}`);
        openAddQuestion(currentQuestIndex);
      }, 200);
      try { localStorage.setItem("quests", JSON.stringify(quests)); } catch(e) { /* ignore */ }
      return;
    }
  } catch (errOuter) {
    console.error('saveQuest failed', errOuter);
    alert('Save failed: see console for details.');
  }

  // persist locally and update UI
  closeModal("questModal");
  try { localStorage.setItem("quests", JSON.stringify(quests)); } catch (e) { /* ignore */ }
  renderQuests();
  alert('Quest saved.');
};

window.editQuest = function (index) {
  currentQuestIndex = index;
  document.getElementById("questTitleInput").value = quests[index].title;
  document.getElementById("modalTitle").innerText = "Edit Quest";
  openModal("questModal");
};

window.deleteQuest = async function (index) {
  if (!confirm("Delete this quest?")) return;
  const quest = quests[index];
  try {
    // If this quest was already saved to Firestore, remove the document
    if (quest && quest.id) {
      await deleteDoc(doc(db, "assessments", quest.id));
    }
    // Remove from local state and re-render
    quests.splice(index, 1);
    renderQuests();
  } catch (err) {
    console.error("Failed to delete quest:", err);
    alert("Failed to delete quest: " + (err.message || err));
  }
};

window.openAssessment = function (index) {
  openModal(`assessmentModal-${index}`);
};

// ==== Assessment Modal ====
function renderAssessmentModals() {
  const container = document.getElementById("assessmentModals");
  container.innerHTML = "";
  quests.forEach((quest, index) => {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.id = `assessmentModal-${index}`;
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close" onclick="closeModal('assessmentModal-${index}')">&times;</span>
        <h3>${quest.title} - Assessment</h3>
        <div class="scrollable-content">
          <div id="questions-${index}">
            ${quest.questions.map((q, i) => `
              <div class="question-item">
                <b>Q${i + 1}:</b> ${q.text} <em>(${q.type})</em>
                <span style="margin-left:12px; background:#6b8e23;color:#fff;padding:4px 8px;border-radius:10px;font-weight:700;">Points: ${q.points !== undefined ? q.points : 1}</span><br>
                <ul>${q.options.map(opt => `<li>${opt}${q.correctAnswers.includes(opt) ? " ✅" : ""}</li>`).join("")}</ul>
                <button onclick="editQuestion(${index},${i})">✏️</button>
                <button onclick="deleteQuestion(${index},${i})">🗑️</button>
              </div>
            `).join("")}
          </div>
        </div>
        <button onclick="openAddQuestion(${index})">+ Add Question</button>
        <button style="margin-top:10px;background:#4a6b16;color:white;" onclick="uploadAssessment(${index})">⬆️ Save to Firestore</button>
      </div>
    `;
    container.appendChild(modal);
  });
}

// ==== Question Modal Logic ====
window.openAddQuestion = function (questIndex) {
  currentQuestIndex = questIndex;
  editingQuestionIndex = null;
  if (quests[questIndex].questions.length >= 30) {
    return alert("Maximum of 30 questions per quest reached.");
  }
  document.getElementById("questionModalTitle").innerText = "Add Question";
  clearQuestionFields();
  openModal("questionModal");
};

function clearQuestionFields() {
  document.getElementById("questionText").value = "";
  document.getElementById("questionType").value = "";
  document.getElementById("optionsContainer").innerHTML = "";
  document.getElementById("answerContainer").innerHTML = "";
  // reset points to default 1 when opening add-question
  const ptsEl = document.getElementById('questionPoints');
  if (ptsEl) ptsEl.value = '1';
}

// ==== Handle Question Type ====
window.handleQuestionTypeChange = function () {
  const type = document.getElementById("questionType").value;
  const optionsContainer = document.getElementById("optionsContainer");
  const answerContainer = document.getElementById("answerContainer");
  optionsContainer.innerHTML = "";
  answerContainer.innerHTML = "";

  if (type === "multiple") {
    optionsContainer.innerHTML = `
      <label>Choices (comma separated):</label>
      <input type="text" id="optionsInput" placeholder="e.g. A, B, C, D">
    `;
    document.getElementById("optionsInput").addEventListener("input", () => {
      const options = document.getElementById("optionsInput").value.split(",").map(o => o.trim()).filter(o => o);
      renderCheckboxes(options);
    });
  } else if (type === "truefalse") {
    renderCheckboxes(["True", "False"]);
  }
};

// ==== Better Checkbox Rendering (Multiple + True/False) ====
function renderCheckboxes(options) {
  const container = document.getElementById("answerContainer");
  container.innerHTML = `
    <label>Select correct answer(s):</label>
    <div id="checkboxGroup" style="
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 6px;
    "></div>
  `;

  const checkboxGroup = document.getElementById("checkboxGroup");

  options.forEach(opt => {
    const label = document.createElement("label");
    label.style.display = "flex";
    label.style.alignItems = "center";
    label.style.gap = "5px";
    label.style.cursor = "pointer";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "correctOptions";
    input.value = opt;

    const text = document.createTextNode(opt);
    label.appendChild(input);
    label.appendChild(text);
    checkboxGroup.appendChild(label);
  });
}

// ==== Save Question ==== (updated to include points)
window.saveQuestion = function () {
  const text = document.getElementById("questionText").value.trim();
  const type = document.getElementById("questionType").value;
  const checkboxes = Array.from(document.querySelectorAll("input[name='correctOptions']:checked"));
  const correctAnswers = checkboxes.map(cb => cb.value);

  let options = [];
  if (type === "multiple") {
    options = document.getElementById("optionsInput").value.split(",").map(o => o.trim()).filter(o => o);
  } else if (type === "truefalse") {
    options = ["True", "False"];
  }

  if (!text || !type || options.length < 2 || correctAnswers.length === 0)
    return alert("Please fill in question, choose type, provide options, and select at least one correct answer.");

  // read points input (default to 1)
  const ptsEl = document.getElementById('questionPoints');
  const ptsRaw = ptsEl ? ptsEl.value.trim() : '';
  const ptsNum = Number(ptsRaw);
  const points = Number.isFinite(ptsNum) && ptsNum > 0 ? ptsNum : 1;

  const newQ = { text, type, options, correctAnswers, points };

  if (editingQuestionIndex !== null)
    quests[currentQuestIndex].questions[editingQuestionIndex] = newQ;
  else
    quests[currentQuestIndex].questions.push(newQ);

  closeModal("questionModal");
  renderQuests();
  openModal(`assessmentModal-${currentQuestIndex}`);
};

window.editQuestion = function (questIndex, qIndex) {
  const q = quests[questIndex].questions[qIndex];
  currentQuestIndex = questIndex;
  editingQuestionIndex = qIndex;

  document.getElementById("questionModalTitle").innerText = "Edit Question";
  document.getElementById("questionText").value = q.text;
  document.getElementById("questionType").value = q.type;
  handleQuestionTypeChange();

  if (q.type === "multiple") {
    document.getElementById("optionsInput").value = q.options.join(", ");
    renderCheckboxes(q.options);
  } else {
    renderCheckboxes(["True", "False"]);
  }

  q.correctAnswers.forEach(ans => {
    const cb = document.querySelector(`input[name='correctOptions'][value='${ans}']`);
    if (cb) cb.checked = true;
  });

  // populate points input when editing
  const ptsEditEl = document.getElementById('questionPoints');
  if (ptsEditEl) ptsEditEl.value = (q.points !== undefined && q.points !== null) ? q.points : '1';

  openModal("questionModal");
};

window.deleteQuestion = function (questIndex, qIndex){
  // backup current in-memory quests to localStorage before deleting
  try { localStorage.setItem('quests_backup_' + new Date().toISOString(), JSON.stringify(quests)); } catch(e){ console.warn('backup failed', e); }

  if(!confirm('Delete this question? A backup will be stored in localStorage. Continue?')) return;

  // remove and re-render
  quests[questIndex].questions.splice(qIndex,1);
  renderQuests();
  // optionally persist the updated assessment right away
  if(typeof uploadAssessment === 'function') uploadAssessment(questIndex);
}

// ==== Firestore Upload ==== (include points in payload)
window.uploadAssessment = async function (index) {
  const quest = quests[index];
  if (!quest.questions.length) return alert("Please add at least one question before saving.");

  try {
    if (!quest.id) quest.id = generateId();
    const docRef = doc(db, "assessments", quest.id);

    const payload = {
      title: quest.title,
      questions: quest.questions.map(q => ({
        question: q.text,
        type: q.type,
        options: q.options,
        correctAnswers: q.correctAnswers,
        points: (q.points !== undefined && q.points !== null) ? q.points : 1
      })),
      teacherEmail: currentUser?.email || null,
      createdAt: new Date().toISOString()
    };

    console.info("Saving assessment payload:", quest.id, payload);

    await setDoc(docRef, payload, { merge: true });

    // read back immediately to verify
    const snap = await getDoc(docRef);
    console.info("Saved doc snapshot:", snap.exists() ? snap.data() : null);

    // update local cache and localStorage so UI won't be overwritten by stale data
    quests[index].id = quest.id;
    quests[index].questions = (payload.questions || []).map(q => ({
      text: q.question, type: q.type, options: q.options, correctAnswers: q.correctAnswers, points: q.points
    }));
    localStorage.setItem("quests", JSON.stringify(quests));

    alert(`${quest.title} saved to Firestore (${quest.id})`);
  } catch (err) {
    console.error("Firestore save error:", err);
    alert("Failed to save to Firestore: " + (err && err.message ? err.message : String(err)));
  }
};

// ==== Load Firestore ==== (read points back)
async function loadFromFirestore() {
  try {
    const q = query(collection(db, "assessments"), where("teacherEmail", "==", currentUser.email));
    const querySnapshot = await getDocs(q);
    quests = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      quests.push({
        id: docSnap.id,
        title: data.title,
        questions: (data.questions || []).map(q => ({
          text: q.question,
          type: q.type || "multiple",
          options: q.options || [],
          correctAnswers: q.correctAnswers || [],
          points: (q.points !== undefined && q.points !== null) ? q.points : 1
        }))
      });
    });
    renderQuests();
  } catch (err) {
    console.error("Error loading from Firestore:", err);
  }
}

// Delete an assessment document by id and update the UI
async function deleteAssessmentById(id){
  if(!id) return;
  const ok = confirm(`Delete assessment "${id}"? This cannot be undone.`);
  if(!ok) return;
  try{
    // delete Firestore document
    await deleteDoc(doc(db, 'assessments', id));

    // remove element from DOM if present (you should render items with data-assessment-id="${id}")
    const el = document.querySelector(`[data-assessment-id="${id}"]`);
    if(el) el.remove();

    // try calling existing refresh function(s) if available
    if(typeof loadQuestList === 'function') {
      await loadQuestList();
    } else if(typeof renderQuestList === 'function') {
      await renderQuestList();
    } else {
      // fallback: reload page to make sure UI matches DB
      location.reload();
    }
  }catch(err){
    console.error('deleteAssessmentById error', err);
    alert('Failed to delete assessment: ' + (err.message || err));
  }
}

// delegated handler for delete buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.delete-assessment');
  if(!btn) return;
  const id = btn.dataset?.id || btn.getAttribute('data-id');
  deleteAssessmentById(id);
});

// ==== Modal Helpers ====
window.openModal = id => document.getElementById(id).style.display = "block";
window.closeModal = id => document.getElementById(id).style.display = "none";

// ==== Init ====
loadFromFirestore();

// helper utilities
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function _num(v){ const n = Number(v); return Number.isFinite(n) ? n : 1; }

/**
 * Render an assessment modal (or update it) so each question shows a points badge.
 * assessment must be an object { id, title, questions: [{question, answer, points}, ...] }
 */
function renderAssessmentModal(assessment){
  if(!assessment || !assessment.id) return;
  const id = assessment.id;
  const container = document.getElementById('assessmentModals');
  let modal = document.getElementById(`assessmentModal-${id}`);
  const htmlQuestions = (assessment.questions || []).map((q, idx) => {
    const pts = _num(q.points);
    return `
      <div class="question-item" data-question-index="${idx}">
        <div class="q-preview">
          <strong>Q${idx+1}:</strong> ${escapeHtml(q.question||'')}
          <span class="points-badge">Points: ${escapeHtml(String(pts))}</span>
        </div>
        <div style="margin-top:8px;">
          <button class="btn-edit-q" data-assessment="${escapeHtml(id)}" data-index="${idx}">✏️ Edit</button>
          <button class="btn-del-q" data-assessment="${escapeHtml(id)}" data-index="${idx}">🗑 Delete</button>
        </div>
      </div>`;
  }).join('\n');

  const modalHtml = `
    <div class="modal" id="assessmentModal-${escapeHtml(id)}" data-assessment-id="${escapeHtml(id)}">
      <div class="modal-content">
        <span class="close" onclick="closeModal('assessmentModal-${escapeHtml(id)}')">&times;</span>
        <h3>${escapeHtml(assessment.title || 'Assessment')}</h3>
        <div class="scrollable-content" id="assessmentQuestionsList-${escapeHtml(id)}">
          ${htmlQuestions || '<em>No questions yet</em>'}
        </div>
        <div style="margin-top:12px;">
          <button class="add-q" data-assessment="${escapeHtml(id)}">+ Add Question</button>
          <button class="save-assessment" data-assessment="${escapeHtml(id)}">Save to Firestore</button>
        </div>
      </div>
    </div>`;

  if(modal){
    // replace inner questions list only
    const listEl = document.getElementById(`assessmentQuestionsList-${id}`);
    if(listEl) listEl.innerHTML = htmlQuestions || '<em>No questions yet</em>';
  } else {
    container.insertAdjacentHTML('beforeend', modalHtml);
  }
}

/**
 * Update a single question display inside an assessment modal after edit/save.
 * qObj = { question, answer, points }
 */
function updateAssessmentQuestionDisplay(assessmentId, index, qObj){
  const modal = document.getElementById(`assessmentModal-${assessmentId}`);
  if(!modal) return;
  const item = modal.querySelector(`.question-item[data-question-index="${index}"]`);
  if(!item) return;
  const pts = _num(qObj.points);
  const preview = item.querySelector('.q-preview');
  if(preview) {
    preview.innerHTML = `<strong>Q${index+1}:</strong> ${escapeHtml(qObj.question||'')}
                         <span class="points-badge">Points: ${escapeHtml(String(pts))}</span>`;
  }
}

/**
 * When the question "Save" action runs (from your existing questionModal saveQuestion),
 * call this function to update the assessment modal immediately:
 *
 *   // after saving to Firestore and obtaining assessmentId + questionIndex + savedQuestionObj:
 *   updateAssessmentQuestionDisplay(assessmentId, questionIndex, savedQuestionObj);
 *
 * If you don't have index, re-render the whole modal via renderAssessmentModal(updatedAssessment).
 */

/* Example wiring for edit buttons (delegated) */
document.addEventListener('click', (e) => {
  // open edit question modal
  const editBtn = e.target.closest && e.target.closest('.btn-edit-q');
  if(editBtn){
    const aid = editBtn.dataset.assessment;
    const idx = Number(editBtn.dataset.index);
    // fetch question data from your in-memory cache or Firestore, then open questionModal
    // Example assumes a global `assessmentsCache` object keyed by id:
    const a = window.assessmentsCache && window.assessmentsCache[aid];
    const q = a && a.questions && a.questions[idx];
    if(q){
      // populate your questionModal fields
      document.getElementById('questionModalTitle').textContent = `Edit Q${idx+1}`;
      document.getElementById('questionText').value = q.question || '';
      document.getElementById('questionPoints').value = _num(q.points);
      // store metadata for save handler
      document.getElementById('questionModal').dataset.editingAssessment = aid;
      document.getElementById('questionModal').dataset.editingIndex = idx;
      openModal('questionModal');
    }
  }

  // delete question from modal (and later persist)
  const delBtn = e.target.closest && e.target.closest('.btn-del-q, .del-q');
  if(delBtn){
    const aid = delBtn.dataset.assessment;
    const idx = Number(delBtn.dataset.index);
    if(!confirm('Delete this question?')) return;
    // remove from assessmentsCache (if present) and re-render
    if(window.assessmentsCache && window.assessmentsCache[aid]){
      window.assessmentsCache[aid].questions.splice(idx,1);
      renderAssessmentModal(window.assessmentsCache[aid]);
      // persist change: call your save function for the assessment, e.g. saveAssessmentToFirestore(aid)
      if(typeof saveAssessmentToFirestore === 'function') saveAssessmentToFirestore(aid);
    } else {
      // Fallback: close modal and reload list after deletion persisted elsewhere
      const modal = document.getElementById(`assessmentModal-${aid}`);
      if(modal) modal.remove();
    }
  }
});

/* Example save handler for questionModal changes:
   integrate this into your existing saveQuestion() so it calls updateAssessmentQuestionDisplay */
window._saveQuestionAndSync = async function(){
  // gather values from question modal inputs
  const aid = document.getElementById('questionModal').dataset.editingAssessment;
  const idx = Number(document.getElementById('questionModal').dataset.editingIndex);
  const qText = document.getElementById('questionText').value || '';
  const qPts = _num(document.getElementById('questionPoints').value);
  const savedQ = { question: qText, points: qPts }; // include answer if needed

  // update cache & UI
  if(window.assessmentsCache && window.assessmentsCache[aid]){
    // ensure questions array exists
    window.assessmentsCache[aid].questions = window.assessmentsCache[aid].questions || [];
    window.assessmentsCache[aid].questions[idx] = savedQ;
    updateAssessmentQuestionDisplay(aid, idx, savedQ);
  }

  // persist to Firestore using your existing function (example name)
  if(typeof saveAssessmentQuestionToFirestore === 'function'){
    await saveAssessmentQuestionToFirestore(aid, idx, savedQ);
  } else if(typeof saveAssessmentToFirestore === 'function'){
    // fallback: save entire assessment
    await saveAssessmentToFirestore(aid);
  }

  closeModal('questionModal');
};

// replace direct startup wiring with a safe init that waits for DOM and guards nodes

function appInit() {
  // Example: guard any code that previously ran immediately and assumed nodes exist
  // Replace any direct top-level addEventListener/getElementById calls with guarded ones here.
  // e.g. if your code did: document.getElementById('topicBtns').addEventListener(...)
  const topicParent = document.getElementById('topicParent'); // adjust id/name if different
  if (topicParent) {
    topicParent.addEventListener('click', (e) => {
      // ...existing code...
    });
  } else {
    console.warn('appInit: topicParent not found - skipping topic click wiring');
  }
}

// ensure appInit runs after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', appInit);
} else {
  appInit();
}

// Safe render function: always get tbody at call time (avoid using an undefined global)
function renderScoresRows(rows){
  const tbody = document.getElementById('scoreTableBody'); // ensure this id exists in data_reports.html
  if (!tbody) {
    console.warn('renderScoresRows: #scoreTableBody not found');
    return;
  }
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.lastName || '')}</td>
      <td>${escapeHtml(r.firstName || '')}</td>
      <td>${escapeHtml(r.section || '')}</td>
      <td style="text-align:center">${escapeHtml(String(r.score || 0))}</td>
    </tr>
  `).join('');
}

// Load scores for a single assessment id (topicId) and render table
async function loadScoresForTopic(topicId){
  try{
    // adjust 'results' to whatever collection holds student submissions
    const colRef = collection(db, 'results'); // or 'scores' / 'submissions'
    // Query where assessmentId equals the topic id
    const q = query(colRef, where('assessmentId', '==', topicId));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(docSnap => {
      const data = docSnap.data();
      rows.push({
        lastName: data.lastName || data.lname || data.studentLast || '',
        firstName: data.firstName || data.fname || data.studentFirst || '',
        section: data.section || '',
        score: data.score || 0
      });
    });
    renderScoresRows(rows);
  }catch(err){
    console.error('loadScoresForTopic error', err);
  }
}

// Wire topic buttons (delegated)
document.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.topic-btn');
  if(!btn) return;
  const topicId = btn.dataset.assessmentId || btn.getAttribute('data-assessment-id');
  if(!topicId) {
    console.warn('topic button missing assessment id');
    return;
  }
  // update UI active state if needed
  document.querySelectorAll('.topic-btn').forEach(b=> b.classList.toggle('active', b===btn));
  // load scores for the selected topic
  loadScoresForTopic(topicId);
});

// Optionally automatically load the first topic on startup:
document.addEventListener('DOMContentLoaded', () => {
  const first = document.querySelector('.topic-btn[data-assessment-id]');
  if(first) first.click();
});

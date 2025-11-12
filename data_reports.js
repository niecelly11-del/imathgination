import "https://cdn.jsdelivr.net/npm/chart.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, query, where, onSnapshot, getDocs, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

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

const topics = {
  timelessVillage: "Time and World Zones (Timeless Village)",
  gmdasOperations: "GMDAS Operations (Operation Forest)",
  multiplyingFractions: "Multiplying Fractions (Fraction River)",
  areaOfShapes: "Area of Shapes (Tri Trap Par Cave)",
  infinityTower: "Infinity Tower"
};

// Add consistent marks for UI
const MARK_OK = '✅';
const MARK_WRONG = '✘';

let allUsers = [];
let currentSection = "All";

function listenToStudents() {
  const q = query(collection(db, "users"), where("role", "==", "student"));
  onSnapshot(q, snapshot => {
    allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderSectionButtons();
    updateTables();
  });
}

function renderSectionButtons() {
  const container = document.getElementById("sectionButtons");
  container.innerHTML = "";
  let teacherSection = window._teacherSection || null;
  if (!teacherSection) {
    try {
      const session = JSON.parse(localStorage.getItem('session'));
      if (session && session.role === 'teacher' && session.section) teacherSection = session.section;
    } catch (e) { /* ignore parse errors */ }
  }

  if (teacherSection) {
    const btn = document.createElement("button");
    btn.className = `section-btn active`;
    btn.textContent = teacherSection;
    currentSection = teacherSection;
    container.appendChild(btn);
  } else {
    const sections = ["All", ...new Set(allUsers.filter(u => u.active !== false).map(u => u.section).filter(Boolean))];
    sections.forEach(section => {
      const btn = document.createElement("button");
      btn.className = `section-btn ${section === currentSection ? "active" : ""}`;
      btn.textContent = section;
      btn.onclick = () => filterSection(section);
      container.appendChild(btn);
    });
  }
  populateWrongSectionOptions();
}

function populateWrongSectionOptions() {
  try {
    const lbl = document.getElementById('wrongSectionLabel');
    if (!lbl) return;
    lbl.textContent = window._teacherSection || 'All';
  } catch (e) { console.warn('populateWrongSectionOptions failed', e); }
}

function renderTabs() {
  const tabsContainer = document.getElementById("topicTabs");
  const contentContainer = document.getElementById("tabContents");
  tabsContainer.innerHTML = "";
  contentContainer.innerHTML = "";

  Object.entries(topics).forEach(([key, label], i) => {
    const tabBtn = document.createElement("button");
    tabBtn.className = `tab-btn ${i === 0 ? "active" : ""}`;
    tabBtn.textContent = label;
    tabBtn.onclick = () => showTab(key);
    tabsContainer.appendChild(tabBtn);

    const content = document.createElement("div");
    content.className = `tab-content ${i === 0 ? "active" : ""}`;
    content.id = `tab-${key}`;
    content.innerHTML = `
      <div class="table-card">
        <h3>${label}</h3>
        <table>
          <thead>
            <tr><th>Last Name</th><th>First Name</th><th>Section</th><th>Score</th></tr>
          </thead>
          <tbody id="scores-${key}"></tbody>
        </table>
      </div>`;
    contentContainer.appendChild(content);
  });
  updateTables();
}

function showTab(key) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(btn => {
    if (btn.textContent.includes(topics[key])) btn.classList.add("active");
  });
  document.getElementById(`tab-${key}`).classList.add("active");
}

function getScoreForTopic(user, topicLabel, topicKey) {
  const normLabel = typeof normalizeText === 'function' ? normalizeText(topicLabel || '') : (topicLabel || '').toString().toLowerCase();

  if (user.scores && user.scores[topicKey] !== undefined) {
    const n = Number(user.scores[topicKey]);
    return Number.isFinite(n) ? n : 0;
  }

  if (user.progress) {
    const entries = Array.isArray(user.progress) ? user.progress : Object.values(user.progress || {});
    for (const p of entries) {
      if (!p) continue;
      const pId = String(p.id || p.assessmentId || p.key || '').trim();
      if (pId && pId === topicKey) {
        const n = Number(p.score);
        if (Number.isFinite(n)) return n;
      }
      const pTitleNorm = normalizeText(p.title || p.name || '');
      const pTopicNorm = normalizeText(p.topic || p.assessmentTopic || '');
      if (pTitleNorm && (pTitleNorm === normLabel || pTitleNorm.includes(normLabel) || normLabel.includes(pTitleNorm))) {
        const n = Number(p.score);
        if (Number.isFinite(n)) return n;
      }
      if (pTopicNorm && (pTopicNorm === normLabel || pTopicNorm.includes(normLabel) || normLabel.includes(pTopicNorm))) {
        const n = Number(p.score);
        if (Number.isFinite(n)) return n;
      }
    }
  }

  // enhanced: consult user.assessmentScores and map assessment ids to topicKey using cached index
  if (user.assessmentScores && typeof user.assessmentScores === 'object') {
    // direct topicKey stored as a key (legacy / alternate)
    if (user.assessmentScores[topicKey] !== undefined) {
      const n = Number(user.assessmentScores[topicKey]);
      return Number.isFinite(n) ? n : 0;
    }

    const assessmentsIndex = window._assessmentsIndex || {};
    const matchedScores = [];
    for (const [aid, rawVal] of Object.entries(user.assessmentScores || {})) {
      const scoreVal = Number(rawVal);
      if (!Number.isFinite(scoreVal)) continue;
      const ainfo = assessmentsIndex[aid];
      if (ainfo && Array.isArray(ainfo.matchedTopicKeys) && ainfo.matchedTopicKeys.includes(topicKey)) {
        matchedScores.push(scoreVal);
      }
      // fallback: if assessment id equals topicKey (some setups), accept it
      if (!ainfo && aid === topicKey) matchedScores.push(scoreVal);
    }
    if (matchedScores.length) {
      // return average of matched assessmentScores (round)
      const avg = Math.round(matchedScores.reduce((a,b)=>a+b,0) / matchedScores.length);
      return avg;
    }
  }

  if (user.lastAssessmentScore !== undefined) {
    const n = Number(user.lastAssessmentScore);
    if (Number.isFinite(n)) return Math.round(n);
  }

  return 0;
}

// new global normalizer for comparing answers (used by multiple helpers)
function normalizeAnswerForCompareGlobal(s) {
	// mirrors the local normalizeAnswerForCompare logic but available globally
	if (s === undefined || s === null) return '';
	let x = String(s).trim();
	if (!x) return '';
	const low = x.toLowerCase();
	if (['true','false','yes','no','y','n'].includes(low)) {
		if (['yes','y'].includes(low)) return 'true';
		if (['no','n'].includes(low)) return 'false';
		return low;
	}
	const timeMatch = x.match(/^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i);
	if (timeMatch) {
		let hh = Number(timeMatch[1]), mm = timeMatch[2], ampm = (timeMatch[3] || '').toLowerCase();
		if (ampm) {
			if (ampm === 'pm' && hh < 12) hh += 12;
			if (ampm === 'am' && hh === 12) hh = 0;
		}
		const hhStr = String(hh).padStart(2,'0');
		return `${hhStr}:${mm}`;
	}
	const time24 = x.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
	if (time24) {
		const hh = String(Number(time24[1])).padStart(2,'0');
		return `${hh}:${time24[2]}`;
	}
	if (!isNaN(Number(x.replace(/,/g,'')))) return String(Number(x.replace(/,/g,'')));
	return normalizeText(x);
}

// --- PATCH: enhance deriveAttemptText to also handle letter choices (A,B,C,...) ---
function deriveAttemptText(qObj, entry, qKey) {
	// helper: letter -> index
	const letterToIndex = (ch) => {
		if (!ch) return null;
		const s = String(ch).trim().toUpperCase();
		if (s.length === 1 && s >= 'A' && s <= 'Z') return s.charCodeAt(0) - 65;
		return null;
	};

	// a) explicit numeric index on the entry
	if (entry && entry.index !== undefined && entry.index !== null && String(entry.index).trim() !== '') {
		const tryIdx = Number(entry.index);
		if (Number.isFinite(tryIdx)) {
			const t = optionTextFor(qObj, tryIdx);
			if (t) return t;
		}
	}
	// b) studentAnswer may be numeric index OR letter stored as string (map to option text)
	const rawAns = entry && (entry.studentAnswer ?? entry.answer ?? entry.response ?? entry.value);
	if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '') {
		const trimmed = String(rawAns).trim();
		const asNum = Number(trimmed);
		if (Number.isFinite(asNum)) {
			const t = optionTextFor(qObj, asNum);
			if (t) return t;
		} else {
			const li = letterToIndex(trimmed);
			if (li !== null) {
				const t = optionTextFor(qObj, li);
				if (t) return t;
			}
		}
		// not numeric/letter-mappable or mapping failed -> return raw text
		return String(rawAns);
	}
	// c) fallback: use numeric part of qKey (e.g., "q0" -> 0)
	const m = String(qKey || '').match(/(\d+)/);
	if (m) {
		const parsed = Number(m[1]);
		if (Number.isFinite(parsed)) {
			const t = optionTextFor(qObj, parsed);
			if (t) return t;
		}
	}
	// final fallback
	return '—';
}
// --- END PATCH deriveAttemptText ---

async function computeScoreFromAssessmentAnswers(user, topicKey) {
	const aa = user.assessmentAnswers || {};
	if (!aa || typeof aa !== 'object') return null;
	if (!window._assessmentsIndex) {
		try { await loadAssessmentsIndex(); } catch (_) {}
	}
	const idx = window._assessmentsIndex || {};

	let anyFound = false;
	let totalPossible = 0;
	let totalEarned = 0;

	const parseIdxFromKey = (k) => {
		if (!k) return null;
		const m = String(k).match(/(\d+)/);
		return m ? Number(m[1]) : null;
	};

	for (const aid of Object.keys(aa)) {
		const ainfo = idx[aid];
		const matchesTopic =
			(aid === topicKey) ||
			(ainfo && Array.isArray(ainfo.matchedTopicKeys) && ainfo.matchedTopicKeys.includes(topicKey)) ||
			(ainfo && ainfo.titleNorm && normalizeText(topics[topicKey] || '') && (
				ainfo.titleNorm === normalizeText(topics[topicKey]) ||
				ainfo.titleNorm.includes(normalizeText(topics[topicKey])) ||
				normalizeText(topics[topicKey]).includes(ainfo.titleNorm)
			));

		if (!matchesTopic) continue;

		anyFound = true;
		try {
			const aSnap = await getDoc(doc(db, 'assessments', aid));
			if (!aSnap.exists()) continue;
			const aData = aSnap.data() || {};
			const qArr = makeQuestionArray(aData);

			const raw = aa[aid] || {};
			const userEntries = [];
			if (Array.isArray(raw)) {
				raw.forEach((e, i) => { if (e) userEntries.push({ key: String(i), entry: e }); });
			} else if (raw && typeof raw === 'object') {
				if (Array.isArray(raw.answers)) raw.answers.forEach((e, i) => { if (e) userEntries.push({ key: `answers_${i}`, entry: e }); });
				if (Array.isArray(raw.items)) raw.items.forEach((e, i) => { if (e) userEntries.push({ key: `items_${i}`, entry: e }); });
				Object.keys(raw).forEach(k => {
					if (k === 'answers' || k === 'items') return;
					const e = raw[k];
					if (e && typeof e === 'object') userEntries.push({ key: k, entry: e });
				});
			}

			for (const ue of userEntries) {
				const ek = ue.key;
				const entry = ue.entry || {};
				const qIdx = parseIdxFromKey(ek);

				// Resolve question object
				let qObj = null;
				const entryQid = entry && (entry.id || entry.questionId || entry.qid);
				if (entryQid != null && qArr.length) {
					qObj = qArr.find(q => {
						const idv = q && (q.id || q.questionId || q.qid);
						return idv !== undefined && idv !== null && String(idv) === String(entryQid);
					}) || null;
				}
				if (!qObj && Number.isFinite(qIdx) && qArr.length) {
					if (qArr[qIdx] !== undefined) qObj = qArr[qIdx];
					else if (qArr[qIdx - 1] !== undefined) qObj = qArr[qIdx - 1]; // tolerate off-by-one
				}
				if (!qObj && entry && entry.index !== undefined && entry.index !== null && qArr.length) {
					const hint = Number(entry.index);
					if (Number.isFinite(hint)) {
						if (qArr[hint]) qObj = qArr[hint];
						else if (qArr[hint - 1]) qObj = qArr[hint - 1];
					}
				}
				if (!qObj && qArr.length) {
					const entryQText = entry && (entry.question || entry.text || entry.prompt) || '';
					if (entryQText) {
						const norm = normalizeText(entryQText);
						qObj = qArr.find(q => {
							const qt = q && (q.question || q.prompt || q.text || '');
							return qt && normalizeText(qt) === norm;
						}) || null;
					}
				}

				// If legacy explicit correct flag present & true -> auto award
				if (entry && entry.correct !== undefined) {
					const flag = entry.correct === true || entry.correct === 1 || entry.correct === '1';
					const ptsAuto = (qObj && Number.isFinite(Number(qObj.points))) ? Number(qObj.points) : 1;
					totalPossible += ptsAuto;
					if (flag) {
						totalEarned += ptsAuto;
						continue;
					}
				}

				// Build correct set
				const { normSet: normCorrectSet } = buildNormalizedCorrectSet(null, qObj);
				// Student attempt
				const attemptText = deriveAttemptText(qObj, entry, ek);
				const normAttempt = normalizeAnswerForCompareGlobal(attemptText);

				const pts = (qObj && Number.isFinite(Number(qObj.points))) ? Number(qObj.points) : 1;
				totalPossible += pts;

				if (normAttempt && normCorrectSet.size && normCorrectSet.has(normAttempt)) {
					totalEarned += pts;
				} else if (!normCorrectSet.size) {
					// Fallback single answer fields
					const fallback = qObj && (qObj.answer || qObj.correctAnswer);
					if (fallback && normalizeAnswerForCompareGlobal(fallback) === normAttempt) {
						totalEarned += pts;
					}
				}
			}
		} catch (e) {
			console.warn('computeScoreFromAssessmentAnswers failed loading', aid, e);
			continue;
		}
	}

	if (!anyFound) return null;
	return `${totalEarned}/${totalPossible}`;
}
// --- END PATCH computeScoreFromAssessmentAnswers ---

async function updateTables() {
	// build rows first (so UI updates quickly), then compute scores and patch cells
	Object.keys(topics).forEach(key => {
		const tbodyScores = document.getElementById(`scores-${key}`);
		if (!tbodyScores) return;

		const filteredUsers = allUsers.filter(u => {
			if (u.active === false) return false;
			return currentSection === "All" || u.section === currentSection;
		});

		// create rows with placeholder score cell
		const rowsHtml = filteredUsers.map(u => {
			const uidSafe = u.id || '';
			const scoreCellId = `score_${key}_${uidSafe}`.replace(/[^a-zA-Z0-9_-]/g,'_');
			return `
			<tr data-uid="${uidSafe}" data-topic="${key}" style="cursor:pointer">
				<td>${u.last || "—"}</td>
				<td>${u.first || "—"}</td>
				<td>${u.section || "—"}</td>
				<td id="${scoreCellId}">Loading...</td>
			</tr>`;
		}).join("");

		tbodyScores.innerHTML = rowsHtml || `<tr><td colspan="4">No data available</td></tr>`;

		// attach click handlers
		try {
			Array.from(tbodyScores.querySelectorAll('tr[data-uid]')).forEach(tr => {
				tr.onclick = () => {
					const uid = tr.getAttribute('data-uid');
					const topic = tr.getAttribute('data-topic');
					if (uid) window.openStudentResponses(uid, topic);
				};
			});
		} catch (e) { console.warn('attach row click handlers failed', e); }
	});

	// now compute scores async and patch cells
	for (const key of Object.keys(topics)) {
		const filteredUsers = allUsers.filter(u => u.active !== false && (currentSection === "All" || u.section === currentSection));
		for (const u of filteredUsers) {
			const uidSafe = u.id || '';
			const scoreCellId = `score_${key}_${uidSafe}`.replace(/[^a-zA-Z0-9_-]/g,'_');
			const cell = document.getElementById(scoreCellId);
			if (!cell) continue;
			try {
				// try assessmentAnswers-based computed score first
				const computed = await computeScoreFromAssessmentAnswers(u, key);
				if (computed !== null) {
					cell.textContent = computed;
				} else {
					// fallback to legacy synchronous getter (percentage/score)
					const legacy = getScoreForTopic(u, topics[key], key);
					cell.textContent = (legacy === 0 || legacy) ? String(legacy) : 'N/A';
				}
			} catch (e) {
				console.warn('score compute failed', u.id, key, e);
				// fallback
				const legacy = getScoreForTopic(u, topics[key], key);
				cell.textContent = (legacy === 0 || legacy) ? String(legacy) : 'N/A';
			}
		}
	}
}

// ensure modal exists (create fallback if markup not present)
function ensureStudentModal() {
  if (document.getElementById('studentDetailModal')) return;
  const html = `
    <div class="modal" id="studentDetailModal" style="display:none">
      <div class="modal-content">
        <h3 id="studentDetailTitle">Student Responses</h3>
        <div id="studentDetailList" style="max-height:480px; overflow:auto; margin-bottom:12px;"></div>
        <button id="closeStudentDetailBtn">Close</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  document.getElementById('closeStudentDetailBtn')?.addEventListener('click', () => {
    const m = document.getElementById('studentDetailModal');
    if (m) m.style.display = 'none';
  });
}

// Replaced openStudentResponses to always render assessmentAnswers (extracted renderer)
window.openStudentResponses = async function(userId, topicKey) {
  try {
    ensureStudentModal();

    let user = allUsers.find(u => (u.id || '') === userId);
    if (!user) {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return alert('Student not found');
      user = { id: snap.id, ...(snap.data()||{}) };
    }

    const modal = document.getElementById('studentDetailModal');
    const title = document.getElementById('studentDetailTitle');
    const list = document.getElementById('studentDetailList');
    if (!modal || !title || !list) return alert('Unable to open student details (UI element missing).');

    title.textContent = `${user.first || ''} ${user.last || ''} — Responses`;
    list.innerHTML = '';

    const progress = user.progress || user.progressData || user.attempts || {};
    const entries = Array.isArray(progress) ? progress : Object.values(progress || {});
    const topicLabel = topics[topicKey] || '';
    const normTopic = normalizeText(topicLabel || '');
    const matched = entries.filter(p => {
      if (!p) return false;
      const pTitle = normalizeText(p.title || p.name || '');
      const pTopic = normalizeText(p.topic || p.assessmentTopic || '');
      const pId = String(p.id || p.assessmentId || p.key || '').trim();
      if (pId && pId === topicKey) return true;
      if (pTitle && (pTitle === normTopic || pTitle.includes(normTopic) || normTopic.includes(pTitle))) return true;
      if (pTopic && (pTopic === normTopic || pTopic.includes(normTopic) || normTopic.includes(pTopic))) return true;
      return false;
    });

    // helper: render assessmentAnswers entries (aids filtered by provided list or all)
    async function renderAssessmentAnswersSection(parentEl, filterAids = null) {
      if (!window._assessmentsIndex) {
        try { await loadAssessmentsIndex(); } catch (e) { console.warn('loadAssessmentsIndex fallback failed', e); }
      }
      const assessmentAnswers = user.assessmentAnswers || {};
      const aids = filterAids && filterAids.length ? filterAids : Object.keys(assessmentAnswers || {});
      if (!aids.length) return;

      function assessmentMatchesTopic(aData, aid) {
        if (!topicKey || topicKey === 'All') return true;
        if (aid === topicKey) return true;
        const idx = window._assessmentsIndex && window._assessmentsIndex[aid];
        if (idx) {
          if (Array.isArray(idx.matchedTopicKeys) && idx.matchedTopicKeys.includes(topicKey)) return true;
          if (idx.titleNorm && normTopic && (idx.titleNorm === normTopic || idx.titleNorm.includes(normTopic) || normTopic.includes(idx.titleNorm))) return true;
          if (idx.topicNorm && normTopic && (idx.topicNorm === normTopic || idx.topicNorm.includes(normTopic) || normTopic.includes(idx.topicNorm))) return true;
        }
        const aTitleNorm = normalizeText(aData && (aData.title || aData.titleNorm || ''));
        const aTopicNorm = normalizeText(aData && (aData.topic || aData.assessmentTopic || (Array.isArray(aData.tags)?aData.tags.join(' '):'') || aData.topicNorm || '') || '');
        if (aTitleNorm && (aTitleNorm === normTopic || aTitleNorm.includes(normTopic) || normTopic.includes(aTitleNorm))) return true;
        if (aTopicNorm && (aTopicNorm === normTopic || aTopicNorm.includes(normTopic) || normTopic.includes(aTopicNorm))) return true;
        return false;
      }

      const matchedAids = [];
      const otherAids = [];
      const idxCache = window._assessmentsIndex || {};
      for (const aid of aids) {
        const idx = idxCache[aid];
        if (idx) {
          if (Array.isArray(idx.matchedTopicKeys) && idx.matchedTopicKeys.includes(topicKey)) { matchedAids.push(aid); continue; }
          if (idx.titleNorm && normTopic && (idx.titleNorm === normTopic || idx.titleNorm.includes(normTopic) || normTopic.includes(idx.titleNorm))) { matchedAids.push(aid); continue; }
          if (idx.topicNorm && normTopic && (idx.topicNorm === normTopic || idx.topicNorm.includes(normTopic) || normTopic.includes(idx.topicNorm))) { matchedAids.push(aid); continue; }
        }
        otherAids.push(aid);
      }

      async function renderAidList(aidList, sectionTitle = null) {
        if (!aidList || !aidList.length) return;
        if (sectionTitle) {
          const secH = document.createElement('div'); secH.style.fontWeight = '700'; secH.style.marginTop = '8px';
          secH.textContent = sectionTitle;
          parentEl.appendChild(secH);
        }
        for (const aid of aidList) {
          try {
            const aSnap = await getDoc(doc(db, 'assessments', aid));
            const aData = aSnap.exists() ? (aSnap.data()||{}) : null;
            if (sectionTitle && !assessmentMatchesTopic(aData, aid)) continue;

            const heading = document.createElement('div'); heading.style.fontWeight = '700';
            heading.textContent = (aData && aData.title) ? aData.title : aid;
            parentEl.appendChild(heading);

            // normalize shape: object with q0..qN; array; nested answers/items
            const raw = (user.assessmentAnswers || {})[aid] || {};
            let flatList = [];
            if (Array.isArray(raw)) {
              raw.forEach((entry, idx) => { if (entry) flatList.push({ key: String(idx), entry }); });
            } else if (raw && typeof raw === 'object') {
              if (Array.isArray(raw.answers)) raw.answers.forEach((entry, idx) => { if (entry) flatList.push({ key: `answers_${idx}`, entry }); });
              if (Array.isArray(raw.items)) raw.items.forEach((entry, idx) => { if (entry) flatList.push({ key: `items_${idx}`, entry }); });
              Object.keys(raw).forEach(k => {
                if (k === 'answers' || k === 'items') return;
                const entry = raw[k];
                if (entry && typeof entry === 'object') flatList.push({ key: k, entry });
              });
            }

            const inner = document.createElement('div'); inner.style.paddingLeft = '8px';
            const questionArray = makeQuestionArray(aData);

            const groups = new Map();
            const orderKeys = [];

            function parseKeyIndex(qKey) {
              const m = String(qKey || '').match(/(\d+)/);
              return m ? Number(m[1]) : null; // q0->0, q1->1, ...
            }

            function resolveQuestion(entry, qKey) {
              const entryQid = entry && (entry.id || entry.questionId || entry.qid || null);
              let qObj = null;
              // 1) id
              if (entryQid && questionArray.length) {
                qObj = questionArray.find(q => {
                  const qid = q && (q.id || q.questionId || q.qid);
                  return qid !== undefined && qid !== null && String(qid) === String(entryQid);
                }) || null;
              }
              // 2) index from key (0-based) with 1-based fallback
              if (!qObj && questionArray.length) {
                const idxFromKey = parseKeyIndex(qKey);
                if (Number.isFinite(idxFromKey)) {
                  if (questionArray[idxFromKey]) qObj = questionArray[idxFromKey];
                  else if (questionArray[idxFromKey - 1]) qObj = questionArray[idxFromKey - 1]; // tolerate off-by-one
                }
              }
              // 3) entry.index fallback (0-based then 1-based)
              if (!qObj && questionArray.length) {
                const hint = Number(entry && entry.index);
                if (Number.isFinite(hint)) {
                  if (questionArray[hint]) qObj = questionArray[hint];
                  else if (questionArray[hint - 1]) qObj = questionArray[hint - 1];
                }
              }
              // 4) text
              if (!qObj && questionArray.length) {
                const entryQText = entry && (entry.question || entry.text || entry.prompt) || '';
                if (entryQText) {
                  const normEntry = normalizeText(entryQText);
                  qObj = questionArray.find(q => {
                    const qtext = q && (q.question || q.prompt || q.text || '');
                    return qtext && normalizeText(qtext) === normEntry;
                  }) || null;
                }
              }
              return qObj;
            }

            // improved: robust correct-answer extractor (returns {raw, display, normSet, indexSet})
            function getCorrectPackage(qObj, entry) {
              // build correct set ONLY from assessment question data
              const pkg = buildNormalizedCorrectSet(null, qObj);
              return {
                raw: pkg.display ? pkg.display.split(',').map(s => s.trim()) : null,
                display: pkg.display || '',
                normSet: pkg.normSet || new Set(),
                indexSet: pkg.indexSet || new Set()
              };
            }

            // add missing correctness checker (uses normalized text and index off-by-one tolerance)
            function isCorrectAttempt(attemptText, correctSet, studentIndex, correctIndexSet) {
              // index-based match first (tolerate off-by-one)
              if (Number.isFinite(studentIndex) && correctIndexSet && correctIndexSet.size) {
                const s = Number(studentIndex);
                if (correctIndexSet.has(s) || correctIndexSet.has(s - 1) || correctIndexSet.has(s + 1)) return true;
              }
              // normalized text compare
              const normAttempt = normalizeAnswerForCompareGlobal(attemptText);
              if (!normAttempt || !correctSet || !correctSet.size) return false;
              return correctSet.has(normAttempt);
            }

            flatList.forEach(({ key: qKey, entry }, idxOrder) => {
              const qObj = resolveQuestion(entry, qKey);
              const qtext = (qObj && (qObj.question || qObj.prompt || qObj.text)) || (entry && (entry.question || entry.text || entry.prompt)) || `Question ${idxOrder + 1}`;

              const entryQid = entry && (entry.id || entry.questionId || entry.qid || null);
              let canonical = null;
              const idxFromKey = parseKeyIndex(qKey);
              if (qObj && (qObj.id || qObj.questionId || qObj.qid)) canonical = `id:${String(qObj.id || qObj.questionId || qObj.qid)}`;
              else if (entryQid) canonical = `id:${String(entryQid)}`;
              else if (Number.isFinite(idxFromKey)) canonical = `idx:${idxFromKey}`;
              else canonical = `txt:${normalizeText(qtext || '')}`;

              if (!groups.has(canonical)) {
                const correctPkg = getCorrectPackage(qObj, entry);
                groups.set(canonical, {
                  text: qtext,
                  pts: (entry && entry.points !== undefined && entry.points !== null)
                    ? entry.points
                    : ((qObj && qObj.points !== undefined && qObj.points !== null) ? qObj.points : 1),
                  correctDisplay: correctPkg.display,
                  correctSet: correctPkg.normSet,
                  correctIndexSet: correctPkg.indexSet || new Set(),
                  attempts: [],
                  orderIndex: Number.isFinite(idxFromKey) ? idxFromKey : idxOrder
                });
                orderKeys.push(canonical);
              }

              const g = groups.get(canonical);
              // derive attempt text using new helper
              const attemptText = deriveAttemptText(qObj, entry, qKey);

              // also determine studentIndex if available (for index comparisons)
              let studentIndex = null;
              if (entry && entry.index !== undefined && entry.index !== null && entry.index !== '') {
                const tIdx = Number(entry.index);
                if (Number.isFinite(tIdx)) studentIndex = tIdx;
              } else {
                const m = String(entry && (entry.studentAnswer ?? '')).match(/^\s*(\d+)\s*$/);
                if (m) studentIndex = Number(m[1]);
              }

              const ok = isCorrectAttempt(attemptText, g.correctSet, studentIndex, g.correctIndexSet);
              g.attempts.push({ text: attemptText, ok });
            });

            // render grouped rows with MARK_OK / MARK_WRONG and one correct answer display
            orderKeys.sort((a, b) => (groups.get(a).orderIndex || 0) - (groups.get(b).orderIndex || 0))
              .forEach(gk => {
                const g = groups.get(gk);
                const attemptsStr = g.attempts.map(a => `${escapeHtml(a.text)} ${a.ok ? MARK_OK : MARK_WRONG}`).join(', ');

                const qdiv = document.createElement('div'); qdiv.style.marginBottom = '8px';
                qdiv.innerHTML =
                  `<div style="font-weight:600">${escapeHtml(String(g.text || ''))}
                      <span style="font-weight:400; font-size:0.9rem; margin-left:8px;">(Points: ${escapeHtml(String(g.pts))})</span>
                   </div>
                   <div style="margin-left:6px">Answers: ${attemptsStr || '—'} ${g.correctDisplay ? '('+escapeHtml(g.correctDisplay)+')' : ''}</div>`;
                inner.appendChild(qdiv);
              });

            if (!orderKeys.length) {
              const noq = document.createElement('div'); noq.textContent = 'No question-level answers found in assessmentAnswers.'; inner.appendChild(noq);
            }

            parentEl.appendChild(inner);
          } catch (e) {
            console.warn('failed to load assessment doc', aid, e);
          }
        }
      }

      if (matched.length) {
        await renderAidList(matchedAids);
        const remaining = aids.filter(a => !matchedAids.includes(a));
        if (remaining.length) await renderAidList(remaining, 'Other assessments');
      } else {
        await renderAidList(aids);
      }
    }

    // If progress matched entries exist, render them first...
    if (matched.length) {
      const seenProgressQuestions = new Set();
      matched.forEach(p => {
        const container = document.createElement('div'); container.style.marginBottom = '10px';
        const heading = document.createElement('div'); heading.style.fontWeight = '700'; heading.textContent = p.title || p.name || p.id || 'Entry';
        container.appendChild(heading);

        const qList = Array.isArray(p.questions) ? p.questions : (Array.isArray(p.answers) ? p.answers : (Array.isArray(p.responses) ? p.responses : []));
        if (!qList.length) {
          const para = document.createElement('div'); para.textContent = 'No question-level data available for this entry.'; container.appendChild(para);
        } else {
          const ul = document.createElement('div'); ul.style.paddingLeft = '8px';
          qList.forEach((q, i) => {
            const rawQText = q.question || q.prompt || q.q || q.text || '';
            const qId = q.id || q.questionId || q.qid || null;
            const canonical = qId ? String(qId).trim() : normalizeText(rawQText || '');
            if (!canonical) return;
            if (seenProgressQuestions.has(canonical)) return;
            seenProgressQuestions.add(canonical);

            const qdiv = document.createElement('div'); qdiv.style.marginBottom = '6px';
            const qtext = rawQText;

            // get student answer (various possible fields)
            const studentAns = q.studentAnswer !== undefined ? q.studentAnswer
              : (q.answer !== undefined ? q.answer
              : (q.response !== undefined ? q.response
              : (q.value !== undefined ? q.value : '')));

            // build normalized correct set (handles options / numeric indices / arrays / legacy fields)
            const { normSet: normCorrectSet, display: displayCorrect } = buildNormalizedCorrectSet(q, null);
            const normStudent = normalizeAnswerForCompareGlobal(String(studentAns === undefined || studentAns === null ? '' : studentAns));

            // decide flag: MARK_OK if match, MARK_WRONG if there are known corrects and no match, otherwise ''
            let correctFlag = '';
            if (normCorrectSet.size && normStudent && normCorrectSet.has(normStudent)) correctFlag = MARK_OK;
            else if (normCorrectSet.size) correctFlag = MARK_WRONG;

            const pts = (q && q.points !== undefined && q.points !== null) ? q.points : 1;
            qdiv.innerHTML = `<div style="font-weight:600">Q${i+1}: ${escapeHtml(String(qtext || ''))} <span style="font-weight:400; font-size:0.9rem; margin-left:8px;">(Points: ${escapeHtml(String(pts))})</span></div><div style="margin-left:6px">Answer: ${escapeHtml(String(studentAns||'—'))} ${displayCorrect ? '('+escapeHtml(displayCorrect)+') ' + correctFlag : correctFlag}</div>`;
            ul.appendChild(qdiv);
          });
          container.appendChild(ul);
        }
        list.appendChild(container);
      });
      // ...and then also render any assessmentAnswers for this topic
      await renderAssessmentAnswersSection(list);
    } else {
      // no matched progress: still render assessmentAnswers (this covers the original branch)
      await renderAssessmentAnswersSection(list);
    }

    modal.style.display = 'flex';
  } catch (e) {
    console.error('openStudentResponses failed', e);
    alert('Failed to load responses.');
  }
};

function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c] || c)); }

async function computeAveragePerSection() {
  const sections = {};
  allUsers.forEach(u => {
    if (u.active === false) return;
    const sec = u.section || 'Unknown';
    const avg = computeUserAverage(u);
    if (!sections[sec]) sections[sec] = { total: 0, count: 0 };
    if (typeof avg === 'number') { sections[sec].total += avg; sections[sec].count++; }
  });
  const out = Object.entries(sections).map(([sec, v]) => `${sec}: ${v.count ? Math.round(v.total / v.count) : 'N/A'}`);
  document.getElementById('avgPerSection').textContent = out.join('\n');
}

function computeUserAverage(user) {
  const progress = user.progress || {};
  const scores = Object.values(progress).map(p => (p && p.score)).filter(s => typeof s === 'number');
  if (scores.length) return Math.round(scores.reduce((a,b) => a+b,0)/scores.length);

  if (user.assessmentScores && typeof user.assessmentScores === 'object') {
    const as = Object.values(user.assessmentScores).map(v => Number(v)).filter(v => Number.isFinite(v));
    if (as.length) return Math.round(as.reduce((a,b) => a+b,0)/as.length);
  }

  if (user.lastAssessmentScore !== undefined) {
    const n = Number(user.lastAssessmentScore);
    if (Number.isFinite(n)) return Math.round(n);
  }

  return 'N/A';
}

function computeTopStudent() {
  let top = null;
  allUsers.forEach(u => {
    if (u.active === false) return;
    const avg = computeUserAverage(u);
    if (typeof avg === 'number' && (!top || avg > top.avg)) top = { user: u, avg };
  });
  document.getElementById('topStudent').textContent = top ? `${top.user.first} ${top.user.last} — ${top.avg}` : 'N/A';
}

function computeStudentsNeedingReview(threshold = 50) {
  const list = allUsers.filter(u => {
    if (u.active === false) return false;
    const avg = computeUserAverage(u);
    return typeof avg === 'number' && avg < threshold;
  }).slice(0,10);
  document.getElementById('needReview').innerHTML = list.length ? list.map(u => `${u.first || ''} ${u.last || ''} (${computeUserAverage(u)})`).join('<br/>') : 'None';
}

const customizeHtml = `
  <div class="modal" id="customizeModal">
    <div class="modal-content">
      <h3>Customize Questions</h3>
      <label>Assessment ID</label>
      <input id="customAssessmentId" placeholder="e.g. quest_1" />
      <div id="questionsList"></div>
      <button id="addQuestionBtn">Add Question</button>
      <div style="margin-top:12px; text-align:right;"><button id="saveQuestionsBtn">Save</button> <button id="closeCustomizeBtn">Close</button></div>
    </div>
  </div>`;
document.body.insertAdjacentHTML('beforeend', customizeHtml);

async function loadAssessment(id) {
  try {
    const ref = doc(db, 'assessments', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) { console.error(e); return null; }
}

function renderQuestionsEditor(assessment) {
  const container = document.getElementById('questionsList');
  container.innerHTML = '';
  (assessment.questions || []).forEach((q, i) => {
    const div = document.createElement('div');
    const pts = (q.points !== undefined && q.points !== null) ? q.points : 1;
    div.innerHTML = `
      <div class="q-preview">
        <strong>Q${i+1}:</strong> ${escapeHtml(String(q.question || ''))}
        <span class="points-badge">Points: ${escapeHtml(String(pts))}</span>
      </div>
      <div class="q-edit">
        <input data-index="${i}" class="q-text" value="${escapeHtml(String(q.question||''))}" style="flex:1;"/>
        <input data-index="${i}" class="q-answer" value="${escapeHtml(String(q.answer||''))}" style="width:260px;"/>
        <input data-index="${i}" class="q-points" value="${escapeHtml(String(pts))}" style="width:72px;" placeholder="pts"/>
      </div>`;
    container.appendChild(div);
    const pointsInput = div.querySelector('.q-points');
    const badge = div.querySelector('.points-badge');
    if (pointsInput && badge) {
      pointsInput.addEventListener('input', () => {
        const v = pointsInput.value.trim() || '1';
        badge.textContent = `Points: ${escapeHtml(String(v))}`;
      });
    }
  });
}

async function saveAssessment(id) {
  const container = document.getElementById('questionsList');
  const texts = Array.from(container.querySelectorAll('.q-text'));
  const answers = Array.from(container.querySelectorAll('.q-answer'));
  const points = Array.from(container.querySelectorAll('.q-points'));
  const qs = texts.map((el, i) => ({ 
    question: el.value, 
    answer: (answers[i] && answers[i].value) || '',
    points: (points[i] && Number(points[i].value)) ? Number(points[i].value) : 1
  }));
  await setDoc(doc(db, 'assessments', id), { title: id, questions: qs });
  alert('Saved');
}

document.addEventListener('DOMContentLoaded', () => {
  const customizeBtn = document.getElementById('customizeBtn');
  const closeCustomizeBtn = document.getElementById('closeCustomizeBtn');
  const saveQuestionsBtn = document.getElementById('saveQuestionsBtn');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  if (customizeBtn) customizeBtn.addEventListener('click', async () => {
    document.getElementById('customizeModal').style.display = 'flex';
    document.getElementById('customAssessmentId').value = 'quest_1';
    const a = await loadAssessment('quest_1') || { questions: [] };
    renderQuestionsEditor(a);
  });
  if (closeCustomizeBtn) closeCustomizeBtn.addEventListener('click', () => document.getElementById('customizeModal').style.display = 'none');
  if (saveQuestionsBtn) saveQuestionsBtn.addEventListener('click', async () => {
    const id = document.getElementById('customAssessmentId').value.trim();
    if (!id) return alert('Enter assessment id');
    await saveAssessment(id);
  });
  if (addQuestionBtn) addQuestionBtn.addEventListener('click', () => {
    const container = document.getElementById('questionsList');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="q-preview">
        <strong>Q${idx+1}:</strong> New question <span class="points-badge">Points: 1</span>
      </div>
      <div class="q-edit">
        <input class="q-text" value="New question" style="flex:1;"/>
        <input class="q-answer" value="Answer" style="width:260px;"/>
        <input class="q-points" value="1" style="width:72px;" placeholder="pts"/>
      </div>`;
    container.appendChild(div);
    const pointsInputNew = div.querySelector('.q-points');
    const badgeNew = div.querySelector('.points-badge');
    if (pointsInputNew && badgeNew) {
      pointsInputNew.addEventListener('input', () => {
        badgeNew.textContent = `Points: ${escapeHtml(String(pointsInputNew.value || '1'))}`;
      });
    }
  });
});

window.filterSection = function (section) {
  currentSection = section;
  document.querySelectorAll(".section-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".section-btn").forEach(btn => {
    if (btn.textContent === section) btn.classList.add("active");
  });
  updateTables();
};

window.goBack = function () {
  window.location.href = "teacher.html";
};

// --- new: load and cache assessments index to map assessment ids -> normalized topic/title and matched topicKeys ---
async function loadAssessmentsIndex() {
  try {
    const snaps = await getDocs(collection(db, 'assessments'));
    const assessmentsIndex = {};
    const questionTextIndex = {}; // normalized question text -> { aid, qObj }
    const questionIdIndex = {};   // explicit question id -> { aid, qObj }
    const topicKeyNorms = {};
    Object.entries(topics).forEach(([tk, label]) => { topicKeyNorms[tk] = normalizeText(label || ''); });

    snaps.forEach(d => {
      const a = d.data() || {};
      const aid = d.id;
      let topicCandidate = a.topic || a.assessmentTopic || (Array.isArray(a.tags) ? a.tags.join(' ') : '') || a.title || '';
      if (Array.isArray(topicCandidate)) topicCandidate = topicCandidate.join(' ');
      const topicNorm = normalizeText(topicCandidate || '');
      const titleNorm = normalizeText(a.title || '');
      // find which topicKey(s) this assessment likely belongs to
      const matchedTopicKeys = [];
      Object.entries(topicKeyNorms).forEach(([tk, tNorm]) => {
        if (!tNorm) return;
        if ((topicNorm && (topicNorm === tNorm || topicNorm.includes(tNorm) || tNorm.includes(topicNorm)))
         || (titleNorm && (titleNorm === tNorm || titleNorm.includes(tNorm) || tNorm.includes(titleNorm)))) {
          matchedTopicKeys.push(tk);
        }
      });
      assessmentsIndex[aid] = { id: aid, topicNorm, titleNorm, matchedTopicKeys };

      // index questions for quick lookup by text or by id
      const qArr = makeQuestionArray(a);
      qArr.forEach((q, qi) => {
        if (!q) return;
        const qtext = q.question || q.prompt || q.text || '';
        const qtextNorm = normalizeText(qtext || '');
        if (qtextNorm) {
          // store first-seen mapping (do not overwrite to keep deterministic mapping)
          if (!questionTextIndex[qtextNorm]) questionTextIndex[qtextNorm] = { aid, qObj: q, qIndex: qi };
        }
        const qid = q.id || q.questionId || null;
        if (qid !== undefined && qid !== null && String(qid).trim() !== '') {
          const key = String(qid).trim();
          if (!questionIdIndex[key]) questionIdIndex[key] = { aid, qObj: q, qIndex: qi };
        }
      });
    });

    window._assessmentsIndex = assessmentsIndex;
    window._questionTextIndex = questionTextIndex;
    window._questionIdIndex = questionIdIndex;
  } catch (e) {
    console.warn('loadAssessmentsIndex failed', e);
    window._assessmentsIndex = {};
    window._questionTextIndex = {};
    window._questionIdIndex = {};
  }
}
// --- end new ---

async function init() {
  renderTabs();
  window._teacherSection = null;
  try {
    const session = JSON.parse(localStorage.getItem('session'));
    if (session && session.role === 'teacher' && session.number) {
      try {
        const tq = query(collection(db, 'users'), where('number', '==', session.number));
        const tSnap = await getDocs(tq);
        if (!tSnap.empty) {
          const teacherData = tSnap.docs[0].data();
          if (teacherData && teacherData.section) {
            window._teacherSection = teacherData.section;
            currentSection = teacherData.section;
          }
        }
      } catch (innerErr) { console.warn('Failed to fetch teacher record for section default', innerErr); }
    }
  } catch (e) { /* ignore parse errors and fall back to 'All' */ }

  await loadAssessmentsIndex(); // <-- ensure assessments are indexed so assessmentScores map to topics
  listenToStudents();
}

// ensure init runs once after the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function loadJsPdf() {
  return new Promise((resolve, reject) => {
    if (window.jspdf) return resolve(window.jspdf);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => { resolve(window.jspdf); };
    s.onerror = (e) => reject(e || new Error('Failed to load jsPDF'));
    document.head.appendChild(s);
  });
}
function loadJSZip() {
  return new Promise((resolve, reject) => {
    if (window.JSZip) return resolve(window.JSZip);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => { resolve(window.JSZip); };
    s.onerror = (e) => reject(e || new Error('Failed to load JSZip'));
    document.head.appendChild(s);
  });
}

async function exportProgressPdfs() {
  try {
    alert('Preparing PDFs...');
    await Promise.all([loadJsPdf(), loadJSZip()]);
    const { jsPDF } = window.jspdf || {};
    if (!jsPDF || !window.JSZip) { alert('Required libraries failed to load.'); return; }

    const students = allUsers.filter(u => (u.role === 'student' || !u.role) && u.active !== false && (currentSection === 'All' || !currentSection || u.section === currentSection));
    if (!students.length) { alert('No active students to export'); return; }

    const zip = new window.JSZip(); let count = 0;
    for (const u of students) {
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      let y = 48;
      doc.setFontSize(14); doc.text('Student Progress Report', 40, y); y += 26;
      doc.setFontSize(11);
      doc.text(`Name: ${(u.first||'') + ' ' + (u.last||'')}`, 40, y); y += 16;
      if (u.section) { doc.text(`Section: ${u.section}`, 40, y); y += 16; }
      if (u.number) { doc.text(`ID: ${u.number}`, 40, y); y += 16; }
      if (u.email) { doc.text(`Email: ${u.email}`, 40, y); y += 20; }

      doc.text('Progress:', 40, y); y += 16;
      const progress = u.progress || {};
      const entries = Array.isArray(progress) ? progress : Object.values(progress || {});
      if (!entries.length) {
        doc.text('No progress data available.', 60, y); y += 16;
      } else {
        entries.forEach(p => {
          const title = p.title || p.name || p.id || 'Untitled';
          const score = (p.score !== undefined) ? String(p.score) : (p.percentage !== undefined ? String(p.percentage) : 'N/A');
          const details = [];
          if (p.correct !== undefined) details.push(`correct: ${p.correct}`);
          if (p.wrong !== undefined) details.push(`wrong: ${p.wrong}`);
          doc.text(`${title} — Score: ${score}${details.length ? ' (' + details.join(', ') + ')' : ''}`, 60, y); y += 14;
          if (y > 720) { doc.addPage(); y = 48; }
        });
      }

      const pdfBlob = doc.output('blob');
      const fileNameSafe = ((u.last||'') + '_' + (u.first||'')).replace(/[^a-z0-9_-]/ig,'_');
      zip.file(`${fileNameSafe || 'student'}_${u.id || 'id'}.pdf`, pdfBlob);
      count++;
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a'); a.href = url; a.download = `students_progress_${new Date().toISOString().slice(0,10)}.zip`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    alert(`Exported ${count} PDFs`);
  } catch (e) { console.error('exportProgressPdfs failed', e); alert('PDF export failed: ' + (e && e.message ? e.message : e)); }
}

const analyticsModalHtml = `
  <div class="modal" id="analyticsModal">
    <div class="modal-content">
      <div class="modal-header">
        <h3>Performance Analytics</h3>
        
        <button id="closeAnalyticsBtn" class="modal-close">Close</button>
      </div>
      <div class="table-card" id="dashboardCardsModal" style="display:flex; gap:12px; flex-wrap:wrap; justify-content:space-between; margin-bottom:20px;">
        <div class="card" style="flex:1; min-width:220px;">
          <h3>📊 Average score per section</h3>
          <div id="avgPerSection">Loading...</div>
        </div>
        <div class="card" style="flex:1; min-width:220px;">
          <h3>🧠 Top-performing student</h3>
          <div id="topStudent">Loading...</div>
        </div>
        <div class="card" style="flex:1; min-width:220px;">
          <h3>🚩 Students needing review</h3>
          <div id="needReview">Loading...</div>
        </div>
      </div>

      <canvas id="barChart" style="max-height:300px;"></canvas>
      <canvas id="pieChart" style="max-height:300px;"></canvas>
      <canvas id="lineChart" style="max-height:300px;"></canvas>
    </div>
  </div>`;
document.body.insertAdjacentHTML('beforeend', analyticsModalHtml);

window.openAnalyticsModal = function() { 
  document.getElementById('analyticsModal').style.display = 'flex'; 
  computeAveragePerSection();
  computeTopStudent();
  computeStudentsNeedingReview();
  loadPerformanceAnalytics();
};
window.closeAnalyticsModal = function() { document.getElementById('analyticsModal').style.display = 'none'; };

document.addEventListener('DOMContentLoaded', () => {
  const aBtn = document.getElementById('analyticsBtn');
  const wBtn = document.getElementById('wrongBtn');
  const pdfBtn = document.getElementById('exportPdfBtn');
  const bBtn = document.getElementById('backBtn');
  if (aBtn) aBtn.addEventListener('click', () => { window.location.href = 'performance_analytics.html'; });
  if (wBtn) wBtn.addEventListener('click', () => { window.location.href = 'most_missed.html'; });
  if (pdfBtn) pdfBtn.addEventListener('click', () => exportProgressPdfs());
  if (bBtn) bBtn.addEventListener('click', () => window.goBack());
  const closeWrongBtn = document.getElementById('closeWrongBtn');
  if (closeWrongBtn) closeWrongBtn.addEventListener('click', () => window.closeWrongAnswersModal());
  const closeAnalyticsBtn = document.getElementById('closeAnalyticsBtn');
  if (closeAnalyticsBtn) closeAnalyticsBtn.addEventListener('click', () => window.closeAnalyticsModal());
  const closeWrongAnswersBtn = document.getElementById('closeWrongAnswersBtn');
  if (closeWrongAnswersBtn) closeWrongAnswersBtn.addEventListener('click', () => window.closeWrongAnswersModal());
  document.addEventListener('click', (e) => {
    if (e.target && e.target.matches && e.target.matches('button') && e.target.textContent.trim() === 'Close') {
      if (document.getElementById('analyticsModal')?.style.display === 'flex') window.closeAnalyticsModal();
    }
  });
  document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'customizeBtn') {
      document.getElementById('customizeModal').style.display = 'flex';
      document.getElementById('customAssessmentId').value = 'quest_1';
      const a = await loadAssessment('quest_1') || { questions: [] };
      renderQuestionsEditor(a);
    }
  });
});

async function loadPerformanceAnalytics() {
  const { collection, query, where, getDocs, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js');
  const studentsQ = query(collection(db, 'users'), where('role', '==', 'student'));
  const snapshot = await getDocs(studentsQ);

  let totalCorrect = 0, totalWrong = 0;
  const questScores = [];
  const questLabels = [];

  for (const studentDoc of snapshot.docs) {
    const userData = studentDoc.data();
    const progress = userData.progress || {};
    for (const [pid, p] of Object.entries(progress)) {
      questLabels.push(`${userData.last || userData.name || 'Unknown'}: ${p.title || pid}`);
      questScores.push(p.score || 0);
      totalCorrect += p.correct || 0;
      totalWrong += p.wrong || 0;
    }
  }

  if (window.barChartInstance) window.barChartInstance.destroy();
  if (window.pieChartInstance) window.pieChartInstance.destroy();
  if (window.lineChartInstance) window.lineChartInstance.destroy();

  const Chart = (await import('https://cdn.jsdelivr.net/npm/chart.js')).default;
  const barCtx = document.getElementById('barChart').getContext('2d');
  window.barChartInstance = new Chart(barCtx, { type: 'bar', data: { labels: questLabels, datasets: [{ label: 'Score per Quest', data: questScores, backgroundColor: '#6b8e23' }] }, options: { responsive: true } });

  const pieCtx = document.getElementById('pieChart').getContext('2d');
  window.pieChartInstance = new Chart(pieCtx, { type: 'pie', data: { labels: ['Correct','Wrong'], datasets: [{ data: [totalCorrect, totalWrong], backgroundColor: ['#6b8e23','#b6c28f'] }] }, options: { responsive: true } });

  const lineCtx = document.getElementById('lineChart').getContext('2d');
  window.lineChartInstance = new Chart(lineCtx, { type: 'line', data: { labels: questLabels, datasets: [{ label: 'Performance Over Time', data: questScores, borderColor: '#4c6a1a', fill: false }] }, options: { responsive: true } });
}

window.openWrongAnswersModal = function() {
  document.getElementById("wrongAnswersModal").style.display = "flex";
  window.loadWrongAnswers && window.loadWrongAnswers();
}
window.closeWrongAnswersModal = function() {
  document.getElementById("wrongAnswersModal").style.display = "none";
}

// Simple aggregated loadWrongAnswers (kept for compatibility; may be overwritten later)
window.loadWrongAnswers = async function() {
  const { collection, query, where, getDocs } = await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js');
  const tbody = document.querySelector("#wrongAnswersTable tbody");
  tbody.innerHTML = "<tr><td colspan='4'>Loading...</td></tr>";

  const questionStats = {};
  const studentsQ = query(collection(db, "users"), where("role", "==", "student"));
  const snapshot = await getDocs(studentsQ);

  for (const studentDoc of snapshot.docs) {
    const studentData = studentDoc.data();
    const progress = studentData.progress || {};
    Object.values(progress).forEach(p => {
      (p.questions || []).forEach(q => {
        const key = q.question ? q.question.trim().toLowerCase() : '';
        if (!key) return;
        if (!questionStats[key]) {
          questionStats[key] = {
            question: q.question,
            correctAnswer: q.correctAnswer || '',
            studentAnswers: {}
          };
        }
        const studentAns = (q.studentAnswer !== undefined) ? q.studentAnswer.trim() : ((q.answer !== undefined) ? q.answer.trim() : '');
        if (studentAns) {
          questionStats[key].studentAnswers[studentAns] = (questionStats[key].studentAnswers[studentAns] || 0) + 1;
        }
      });
    });
  }
  const sorted = Object.values(questionStats).sort((a, b) => {
    const aCount = Object.values(a.studentAnswers).reduce((s, v) => s + v, 0);
    const bCount = Object.values(b.studentAnswers).reduce((s, v) => s + v, 0);
    return bCount - aCount;
  });
  if (sorted.length > 0) {
    tbody.innerHTML = sorted.map((q, i) => {
      const answers = Object.entries(q.studentAnswers).sort((a,b) => b[1]-a[1]).map(([ans, cnt]) => `${ans}: ${cnt}`).join(', ');
      return `
      <tr>
        <td>${i + 1}</td>
        <td>${q.question}</td>
        <td>${q.correctAnswer}</td>
        <td>${answers || '—'}</td>
      </tr>`;
    }).join("");
  } else {
    tbody.innerHTML = "<tr><td colspan='4'>No data found.</td></tr>";
  }
}

// --- supplemental non-module script logic (delegation + enhanced loadWrongAnswers) ---

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('wrongFilterApply')?.addEventListener('click', () => window.loadWrongAnswers());
  document.getElementById('wrongFilterClear')?.addEventListener('click', () => { /* no-op */ });
  document.getElementById('closeWrongBtn')?.addEventListener('click', () => window.closeWrongAnswersModal());
  document.getElementById('closeDetailBtn')?.addEventListener('click', () => document.getElementById('wrongDetailModal').style.display = 'none');
  document.getElementById('closeStudentDetailBtn')?.addEventListener('click', () => document.getElementById('studentDetailModal').style.display = 'none');
  document.querySelector('#wrongAnswersTable tbody')?.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || !tr.dataset || !tr.dataset.qkey) return;
    const qkey = tr.dataset.qkey;
    const stats = window._wrongQuestionStats && window._wrongQuestionStats[qkey];
    if (stats) openWrongDetail(qkey, stats);
  });
  renderTopicTabs();
});

const _topicListExplicit = [
  'Time and World Zones (Timeless Village)',
  'GMDAS Operations (Operation Forest)',
  'Multiplying Fractions (Fraction River)',
  'Area of Shapes (Tri Trap Par Cave)',
  'Infinity Tower'
];
window._wrongTopicSelected = _topicListExplicit[0];
window._wrongPage = 1;
window._wrongRowsPerPage = 15;

// new: render wrong-topic tabs (was missing -> caused ReferenceError)
function renderTopicTabs() {
  const tabs = document.getElementById('wrongTopicTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  _topicListExplicit.forEach(t => {
    const btn = document.createElement('button');
    btn.textContent = t;
    btn.className = window._wrongTopicSelected === t ? 'tab-btn active' : 'tab-btn';
    btn.onclick = () => {
      window._wrongTopicSelected = t;
      window._wrongPage = 1;
      // reload list for new topic and re-render tabs to update active state
      if (typeof window.loadWrongAnswers === 'function') window.loadWrongAnswers();
      renderTopicTabs();
    };
    tabs.appendChild(btn);
  });
}

function parsePossibleDate(obj) {
  if (!obj) return null;
  const candidates = [obj.timestamp, obj.submittedAt, obj.date, obj.time];
  for (const c of candidates) {
    if (!c) continue;
    const n = Number(c);
    if (!Number.isNaN(n)) return new Date(n);
    const d = new Date(c);
    if (!isNaN(d)) return d;
  }
  return null;
}

function normalizeText(str) {
	// robust normalizer: remove diacritics, punctuation, collapse whitespace, lowercase
	if (!str && str !== 0) return '';
	try {
		const s = String(str);
		const base = (typeof s.normalize === 'function') ? s.normalize('NFKD') : s;
		// remove diacritics (use unicode flag) then strip punctuation and collapse spaces
		return base
			.replace(/\p{Diacritic}/gu, '')
			.replace(/[^\w\s]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.toLowerCase();
	} catch (e) {
		return String(str).replace(/[^A-Za-z0-9\s]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
	}
}

// new helper: canonicalize assessment.questions into an array (preserve numeric keys order when available)
function makeQuestionArray(aData) {
	const q = aData && aData.questions;
	if (!q) return [];
	if (Array.isArray(q)) return q;
	if (typeof q === 'object') {
		const entries = Object.entries(q || {});
		// prefer numeric keys order if keys look numeric
		const allNumeric = entries.length && entries.every(([k]) => /^\d+$/.test(String(k)));
		if (allNumeric) {
			return entries.sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => v);
		}
		// fallback: preserve object's value order
		return entries.map(([k, v]) => v);
		}
	return [];
}

// map index -> option text (0-based preferred, 1-based fallback)
function optionTextFor(qObj, idx) {
	// ...defensive lookup for common option fields...
	if (!qObj) return null;
	const opts = Array.isArray(qObj.options) ? qObj.options
				: (Array.isArray(qObj.choices) ? qObj.choices
				: (Array.isArray(qObj.optionsList) ? qObj.optionsList : null));
	if (!opts || !opts.length) return null;
	const i = Number(idx);
	if (!Number.isFinite(i)) return null;
	if (opts[i] !== undefined && opts[i] !== null) return String(opts[i]);
	if (opts[i - 1] !== undefined && opts[i - 1] !== null) return String(opts[i - 1]); // 1-based fallback
	return null;
}

// build a normalized set of correct answers for a question-like object (progress q or assessment qObj)
function buildNormalizedCorrectSet(progressQ, qObj = null) {
  // returns { normSet, display, indexSet }
  const candidates = [];
  const indexSet = new Set();

  const pickFrom = (o) => {
    if (!o) return;
    if (Array.isArray(o.correctAnswers)) candidates.push(...o.correctAnswers);
    if (o.correctAnswer !== undefined && o.correctAnswer !== null) candidates.push(o.correctAnswer);
    if (o.answer !== undefined && o.answer !== null) candidates.push(o.answer);
    if (o.correct !== undefined && o.correct !== null) candidates.push(o.correct);
    if (o.key !== undefined && o.key !== null) candidates.push(o.key);
    if (o.value !== undefined && o.value !== null) candidates.push(o.value);
    if (Array.isArray(o.solutions)) candidates.push(...o.solutions);
    if (Array.isArray(o.answers)) candidates.push(...o.answers);

    // numeric/index style hints
    ['correctIndex','correctIdx'].forEach(k => {
      if (o[k] !== undefined && o[k] !== null) {
        const v = Number(o[k]);
        if (Number.isFinite(v)) { indexSet.add(v); indexSet.add(v - 1); indexSet.add(v + 1); }
      }
    });
    if (Array.isArray(o.correctIndices)) o.correctIndices.forEach(v => { const n = Number(v); if (Number.isFinite(n)) { indexSet.add(n); indexSet.add(n-1); indexSet.add(n+1); }});
    if (Array.isArray(o.correctAnswersIndexes)) o.correctAnswersIndexes.forEach(v => { const n = Number(v); if (Number.isFinite(n)) { indexSet.add(n); indexSet.add(n-1); indexSet.add(n+1); }});
  };

  pickFrom(progressQ);
  pickFrom(qObj);

  // flatten text candidates
  const flattened = [];
  candidates.forEach(c => {
    if (c === undefined || c === null) return;
    if (Array.isArray(c)) c.forEach(x => { if (x !== undefined && x !== null && String(x).trim() !== '') flattened.push(String(x)); });
    else if (typeof c === 'object') {
      if (c.value !== undefined && c.value !== null && String(c.value).trim() !== '') flattened.push(String(c.value));
    } else if (String(c).trim() !== '') {
      flattened.push(String(c));
    }
  });

  // local: map A/B/C... -> 0/1/2
  const letterToIndex = (v) => {
    const s = String(v || '').trim().toUpperCase();
    if (s.length === 1) {
      const code = s.charCodeAt(0) - 65;
      if (code >= 0 && code < 26) return code;
    }
    return null;
  };

  // include option mapping ONLY for known indices/hints; do NOT add all options
  const mappedOptionTexts = [];
  const opts = qObj && (Array.isArray(qObj.options) ? qObj.options : (Array.isArray(qObj.choices) ? qObj.choices : (Array.isArray(qObj.optionsList) ? qObj.optionsList : null)));
  if (opts && opts.length) {
    // map indices from indexSet
    indexSet.forEach(idx => {
      const t = optionTextFor(qObj, idx);
      if (t) mappedOptionTexts.push(t);
    });
    // map numeric or letter candidates to option text
    flattened.forEach(v => {
      const n = Number(v);
      if (Number.isFinite(n)) {
        const t = optionTextFor(qObj, n);
        if (t) mappedOptionTexts.push(t);
      } else {
        const li = letterToIndex(v);
        if (li !== null) {
          const t = optionTextFor(qObj, li);
          if (t) mappedOptionTexts.push(t);
        }
      }
    });
  }

  // final set: original textual candidates + mapped option texts for known correct indices only
  const uniqRaw = Array.from(new Set([...flattened, ...mappedOptionTexts]));
  const normSet = new Set(uniqRaw.map(x => normalizeAnswerForCompareGlobal(String(x))).filter(Boolean));
  const display = uniqRaw.join(', ');
  return { normSet, display, indexSet };
}
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

async function logQuestionCount(assessmentId) {
  const snap = await getDoc(doc(db, "assessments", assessmentId));
  if (!snap.exists()) {
    console.log(`No assessment found for id: ${assessmentId}`);
    return;
  }
  const data = snap.data() || {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  console.log(`Assessment "${assessmentId}" has ${questions.length} questions.`, questions);
}

// Example usage:
logQuestionCount("yourAssessmentId");

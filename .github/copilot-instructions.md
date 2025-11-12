# Copilot instructions — iMATHgination_Portal

Purpose
- Single-page admin UI (data_reports.html) used by teachers to inspect student progress, export PDFs, and view "most missed" questions.
- Data lives in Firestore (collections used: `users`, `assessments`). UI runs in the browser and imports Firebase/Chart.js via CDN modules.

Big picture / components
- data_reports.html — main file. Contains:
  - `topics` object (topicKey → display label).
  - Firestore listeners: `listenToStudents()` (users), `loadWrongAnswers()` (aggregated question stats), and `loadPerformanceAnalytics()`.
  - Helpers: `normalizeText`, `sanitizeKey`, `getScoreForTopic`, `openStudentResponses`, `computeUserAverage`, `exportProgressPdfs`.
- Firestore collections:
  - users: many shapes supported — common fields: `first`, `last`, `number`, `section`, `active`, `role`, `progress` (array or map), `assessmentScores`, `assessmentAnswers`, `lastAssessmentScore`.
  - assessments: `{ title, questions: [{ question, answer, points, id? }], topic/tags? }`

Key patterns & conventions
- Flexible/defensive data handling: progress may be an array or object; question entries use multiple possible keys (question/prompt/text; studentAnswer/answer).
- Normalization: `normalizeText(str)` is used to permissively match question titles/text across different storage shapes; use it when matching.
- Matching order when reading scores (see `getScoreForTopic`):
  1. user.scores[topicKey]
  2. matching entry in user.progress (title/name)
  3. user.assessmentScores map or lastAssessmentScore
  4. fallback "N/A"
- Wrong-answers aggregation builds two indexes:
  - questionTextIndex: normalized question text → assessmentQuestion keys
  - questionIdIndex: explicit question id → keys
  Then it matches student progress entries to assessment questions by id or normalized text.

How to fetch questions by title or topic (concrete)
- Prefer to query `assessments` then filter using normalized fields (fast and robust):
  - Example (pseudo-code referencing helpers in data_reports.html):
    const docs = await getDocs(collection(db, 'assessments'));
    const matches = docs.docs.filter(d => {
      const a = d.data();
      // match by title or topic fields using normalizeText:
      return normalizeText(a.title || '') === normalizeText(targetTitle)
        || normalizeText(a.topic || a.assessmentTopic || (a.tags||[]).join(' ')) === normalizeText(targetTopic);
    });
- If you only have question text from student progress, match to assessment questions using the same normalization:
  1. Build a map: normalizedQuestionText → assessmentQuestion (see `loadWrongAnswers`).
  2. Normalize student `q.question` and lookup the map.
- If assessments have explicit question `id`/`questionId`, prefer that for exact lookups (see `questionIdIndex` usage in `loadWrongAnswers`).

Files to inspect for examples
- c:\Users\niece\Downloads\iMATHgination_Portal\data_reports.html
  - Helpers: `normalizeText`, `sanitizeKey`, `getScoreForTopic`, `openStudentResponses`, `loadWrongAnswers`
  - Topic list: `topics` object near top of script
- Firestore read patterns: `getDocs(collection(db, 'assessments'))` and `query(collection(db, 'users'), where('role','==','student'))`

Developer workflow / run & debug
- Serve files over HTTP (module imports via CDN require a server). Examples:
  - python: `python -m http.server 8000` from the project folder
  - VS Code: use Live Server extension
- Open browser console for diagnostics: `loadWrongAnswers` and `init` include console logs and status elements (e.g., `wrongStatus`) to help debug mapping/matching.
- To test title/topic matching, add console logs near `questionTextIndex` and `questionIdIndex` or run `loadWrongAnswers()` interactively in console.

Small improvements to consider (for PRs)
- Add a small Firestore query for assessments by `title` (indexed) for exact title lookups to avoid scanning all assessments.
- Normalize and persist a canonical `assessmentTopicNormalized` in assessments documents to avoid recomputing normalization at query time.
- Add unit tests (JS) for `normalizeText` with typical variants seen in DB (punctuation, diacritics, whitespace).

If anything is unclear or you want me to:
- add a short code snippet for querying assessments by title and returning question lists,
- or make code changes in data_reports.html to expose a helper function fetchQuestionsByTitle(topicOrTitle),
tell me which and I will update the code and iterate.

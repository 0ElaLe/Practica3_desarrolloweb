const API_BASE = "http://127.0.0.1:5000";
const QUIZ_ID = "quiz1";

const $ = (id) => document.getElementById(id);

let userId = null;
let questions = []; // cache

function setOutput(obj) {
  $("output").textContent = JSON.stringify(obj, null, 2);
}

function clearMsgs() {
  $("authErr").textContent = "";
  $("qErr").textContent = "";
  $("saveErr").textContent = "";
  $("authMsg").textContent = "";
  $("saveMsg").textContent = "";
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // intenta mostrar error estructurado de tu API
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const details = data?.details ? ` | ${JSON.stringify(data.details)}` : "";
    throw new Error(`${msg}${details}`);
  }
  return data;
}

function renderQuestions(qs) {
  if (!qs.length) {
    $("questionsBox").innerHTML = `<p class="muted">No hay preguntas.</p>`;
    return;
  }

  const html = qs.map(q => {
    const type = q.type === "number" ? "number" : "text";
    const requiredMark = q.required ? " *" : "";
    return `
      <div style="margin: 12px 0;">
        <label>${q.text}${requiredMark}</label>
        <input data-qid="${q.id}" type="${type}" placeholder="Tu respuesta..." />
        <div class="muted">id: ${q.id} | type: ${q.type} | required: ${q.required}</div>
      </div>
    `;
  }).join("");

  $("questionsBox").innerHTML = html;
}

function collectAnswers() {
  const inputs = $("questionsBox").querySelectorAll("input[data-qid]");
  const answers = [];
  inputs.forEach(inp => {
    answers.push({ question_id: inp.dataset.qid, value: inp.value });
  });
  return answers;
}

async function startFlow() {
  clearMsgs();

  const identifier = $("identifier").value.trim();
  if (!identifier) {
    $("authErr").textContent = "Escribe un identifier.";
    return;
  }

  // 1) verify
  const verify = await apiFetch("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ identifier })
  });

  if (verify.registered) {
    userId = verify.user_id;
    $("authMsg").textContent = "Usuario encontrado ✅";
  } else {
    // 2) register
    const created = await apiFetch("/users", {
      method: "POST",
      body: JSON.stringify({ identifier })
    });
    userId = created.user_id;
    $("authMsg").textContent = "Usuario registrado ✅";
  }

  $("userIdText").textContent = userId;

  // 3) get questions (si ya contestó, tu API manda 409; lo atrapamos)
  try {
    const q = await apiFetch(`/quizzes/${QUIZ_ID}/questions?user_id=${encodeURIComponent(userId)}`);
    questions = q.questions || [];
    renderQuestions(questions);
    setOutput(q);
  } catch (e) {
    // si ya contestó, mostramos mensaje y sugerimos ver respuestas
    $("qErr").textContent = e.message;
    $("questionsBox").innerHTML = `<p class="muted">No se pueden cargar preguntas (posible: ya contestaste). Usa “Ver mis respuestas”.</p>`;
  }
}

async function submitAnswers() {
  clearMsgs();
  if (!userId) {
    $("saveErr").textContent = "Primero inicia (identifier).";
    return;
  }

  const answers = collectAnswers();

  try {
    const saved = await apiFetch(`/quizzes/${QUIZ_ID}/responses`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId, answers })
    });
    $("saveMsg").textContent = "Respuestas guardadas ✅";
    setOutput(saved);
  } catch (e) {
    $("saveErr").textContent = e.message;
  }
}

async function viewAnswers() {
  clearMsgs();
  if (!userId) {
    $("saveErr").textContent = "Primero inicia (identifier).";
    return;
  }

  try {
    const resp = await apiFetch(`/quizzes/${QUIZ_ID}/responses?user_id=${encodeURIComponent(userId)}`);
    setOutput(resp);
  } catch (e) {
    $("saveErr").textContent = e.message;
  }
}

$("btnStart").addEventListener("click", () => startFlow().catch(err => $("authErr").textContent = err.message));
$("btnSubmit").addEventListener("click", () => submitAnswers().catch(err => $("saveErr").textContent = err.message));
$("btnView").addEventListener("click", () => viewAnswers().catch(err => $("saveErr").textContent = err.message));

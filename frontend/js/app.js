const API_URL = `${API_BASE_URL}/api/students`;

const form = document.getElementById("student-form");
const idInput = document.getElementById("student-id");
const submitBtn = document.getElementById("submit-btn");
const cancelBtn = document.getElementById("cancel-btn");
const formTitle = document.getElementById("form-title");
const messageEl = document.getElementById("message");
const studentsEl = document.getElementById("students");
const emptyEl = document.getElementById("empty");
const counterEl = document.getElementById("counter");

const FIELDS = ["cedula", "nombre", "email", "telefono", "direccion", "fechaNacimiento"];

document.getElementById("fechaNacimiento").max = new Date().toISOString().split("T")[0];

/* ---------- Mensajes ---------- */

function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  messageEl.hidden = false;
}

function clearMessage() {
  messageEl.hidden = true;
  messageEl.textContent = "";
  FIELDS.forEach((name) => form.elements[name].classList.remove("invalid"));
}

/* ---------- Comunicación con el backend ---------- */

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Error ${response.status}`);
    error.fields = data.errors || {};
    throw error;
  }
  return data;
}

async function loadStudents() {
  try {
    const students = await request(API_URL);
    renderStudents(students);
  } catch (error) {
    renderStudents([]);
    showMessage("No se pudo conectar con el backend. ¿Está en ejecución?", "error");
    console.error(error);
  }
}

/* ---------- Renderizado de tarjetas ---------- */

function infoLine(label, value) {
  const p = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}: `;
  p.append(strong, document.createTextNode(value));
  return p;
}

function buildCard(student) {
  const card = document.createElement("article");
  card.className = "card";

  const title = document.createElement("h3");
  title.textContent = student.nombre;

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "btn";
  editBtn.textContent = "Editar";
  editBtn.addEventListener("click", () => startEdit(student));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "btn danger";
  deleteBtn.textContent = "Eliminar";
  deleteBtn.addEventListener("click", () => deleteStudent(student));

  actions.append(editBtn, deleteBtn);

  card.append(
    title,
    infoLine("Cédula", student.cedula),
    infoLine("Email", student.email),
    infoLine("Teléfono", student.telefono),
    infoLine("Dirección", student.direccion),
    infoLine("Nacimiento", student.fechaNacimiento),
    actions
  );
  return card;
}

function renderStudents(students) {
  studentsEl.replaceChildren(...students.map(buildCard));
  counterEl.textContent = students.length;
  emptyEl.hidden = students.length > 0;
}

/* ---------- Formulario ---------- */

function resetForm() {
  form.reset();
  idInput.value = "";
  formTitle.textContent = "Registrar estudiante";
  submitBtn.textContent = "Guardar";
  cancelBtn.hidden = true;
}

function startEdit(student) {
  clearMessage();
  idInput.value = student.id;
  FIELDS.forEach((name) => {
    form.elements[name].value = student[name] ?? "";
  });
  formTitle.textContent = `Editando a ${student.nombre}`;
  submitBtn.textContent = "Actualizar";
  cancelBtn.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function readForm() {
  const data = {};
  FIELDS.forEach((name) => {
    data[name] = form.elements[name].value.trim();
  });
  return data;
}

function markInvalidFields(fields) {
  Object.keys(fields).forEach((name) => {
    if (form.elements[name]) form.elements[name].classList.add("invalid");
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const id = idInput.value;
  const isEdit = id !== "";
  submitBtn.disabled = true;

  try {
    await request(isEdit ? `${API_URL}/${id}` : API_URL, {
      method: isEdit ? "PUT" : "POST",
      body: JSON.stringify(readForm()),
    });
    resetForm();
    showMessage(isEdit ? "Estudiante actualizado." : "Estudiante registrado.", "ok");
    await loadStudents();
  } catch (error) {
    markInvalidFields(error.fields || {});
    const details = Object.values(error.fields || {}).join(" · ");
    showMessage(details ? `${error.message}: ${details}` : error.message, "error");
  } finally {
    submitBtn.disabled = false;
  }
});

cancelBtn.addEventListener("click", () => {
  resetForm();
  clearMessage();
});

async function deleteStudent(student) {
  if (!confirm(`¿Eliminar a ${student.nombre}?`)) return;
  clearMessage();
  try {
    await request(`${API_URL}/${student.id}`, { method: "DELETE" });
    if (idInput.value === String(student.id)) resetForm();
    showMessage("Estudiante eliminado.", "ok");
    await loadStudents();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

loadStudents();

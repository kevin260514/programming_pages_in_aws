(function () {
  "use strict";

  // config.js define API_BASE_URL. En produccion es "" (peticiones relativas).
  const BASE_URL = typeof API_BASE_URL === "string" ? API_BASE_URL : "http://localhost:8080";
  const ENDPOINT = `${BASE_URL}/api/assistant`;

  const MAX_QUESTION = 500;
  const REQUEST_TIMEOUT_MS = 70000; // el backend puede reintentar si Gemini esta saturado

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- Estructura ---------- */

  const fab = el("button", "assistant-fab");
  fab.type = "button";
  fab.setAttribute("aria-haspopup", "dialog");
  fab.setAttribute("aria-expanded", "false");
  fab.setAttribute("aria-label", "Abrir el asistente de IA");
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
  fab.append(el("span", "assistant-fab-label", "Asistente IA"));

  const panel = el("section", "assistant-panel");
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-labelledby", "assistant-title");

  const header = el("div", "assistant-header");
  const titles = el("div");
  const title = el("h2", "", "Asistente de IA");
  title.id = "assistant-title";
  titles.append(title, el("p", "assistant-sub", "Pregunta sobre lo que estás viendo"));
  const closeBtn = el("button", "assistant-close", "×");
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Cerrar el asistente");
  header.append(titles, closeBtn);

  const contextBar = el("div", "assistant-context");
  contextBar.hidden = true;
  const contextLabel = el("span", "assistant-context-label");
  const contextClear = el("button", "assistant-context-clear", "×");
  contextClear.type = "button";
  contextClear.setAttribute("aria-label", "Quitar el contexto");
  contextBar.append(contextLabel, contextClear);

  const messages = el("div", "assistant-messages");
  messages.setAttribute("role", "log");
  messages.setAttribute("aria-live", "polite");

  const suggestions = el("div", "assistant-suggestions");

  const form = el("form", "assistant-form");
  const input = el("textarea", "assistant-input");
  input.rows = 1;
  input.maxLength = MAX_QUESTION;
  input.placeholder = "Escribe tu pregunta…";
  input.setAttribute("aria-label", "Tu pregunta");
  const sendBtn = el("button", "btn primary assistant-send", "Enviar");
  sendBtn.type = "submit";
  form.append(input, sendBtn);

  panel.append(header, contextBar, messages, suggestions, form);
  document.body.append(fab, panel);

  /* ---------- Estado ---------- */

  let context = null; // { label, text } enviado por assistant-context.js
  let pending = false;
  let greeted = false;

  /* ---------- Mensajes ---------- */

  function addMessage(role, text, extraClass) {
    const bubble = el("div", `assistant-msg ${role}${extraClass ? " " + extraClass : ""}`, text);
    messages.append(bubble);
    messages.scrollTop = messages.scrollHeight;
    return bubble;
  }

  function renderSuggestions() {
    suggestions.replaceChildren();
    if (messages.querySelector(".assistant-msg.user")) return;
    const options = context
      ? ["Resume lo que estoy viendo", "Cuéntame una curiosidad sobre esto"]
      : ["¿Qué puedes hacer?", "Recomiéndame un Pokémon de tipo Fuego"];
    options.forEach((text) => {
      const chip = el("button", "assistant-chip", text);
      chip.type = "button";
      chip.addEventListener("click", () => send(text));
      suggestions.append(chip);
    });
  }

  function setPending(value) {
    pending = value;
    sendBtn.disabled = value;
    panel.setAttribute("aria-busy", String(value));
  }

  /* ---------- Envío ---------- */

  async function send(rawQuestion) {
    const question = rawQuestion.trim();
    if (!question || pending) return;

    addMessage("user", question);
    input.value = "";
    autoGrow();
    suggestions.replaceChildren();
    setPending(true);
    const thinking = addMessage("assistant", "Pensando…", "thinking");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: context ? context.text : "" }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));

      thinking.remove();
      if (response.ok && data.answer) {
        addMessage("assistant", data.answer);
      } else {
        addMessage(
          "assistant",
          data.message || `El servidor respondió con un error (${response.status}).`,
          "error"
        );
      }
    } catch (error) {
      thinking.remove();
      const aborted = error && error.name === "AbortError";
      addMessage(
        "assistant",
        aborted
          ? "La respuesta tardó demasiado. Inténtalo de nuevo."
          : "No se pudo conectar con el servidor. Comprueba que el backend está encendido.",
        "error"
      );
    } finally {
      clearTimeout(timer);
      setPending(false);
      input.focus();
    }
  }

  /* ---------- Abrir y cerrar ---------- */

  function open() {
    panel.hidden = false;
    fab.hidden = true;
    fab.setAttribute("aria-expanded", "true");
    document.body.classList.add("assistant-open");
    if (!greeted) {
      greeted = true;
      addMessage(
        "assistant",
        "Hola, soy el asistente de IA de esta página. Puedes preguntarme sobre los personajes de Rick & Morty o los Pokémon que estás viendo."
      );
    }
    renderSuggestions();
    input.focus();
  }

  function close() {
    panel.hidden = true;
    fab.hidden = false;
    fab.setAttribute("aria-expanded", "false");
    document.body.classList.remove("assistant-open");
    fab.focus();
  }

  fab.addEventListener("click", open);
  closeBtn.addEventListener("click", close);

  // Escape cierra el chat solo cuando el foco esta dentro de el
  // (la ventana modal gestiona su propio Escape).
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  });

  /* ---------- Formulario ---------- */

  function autoGrow() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  input.addEventListener("input", autoGrow);

  input.addEventListener("keydown", (event) => {
    // Enter envia; Shift+Enter agrega un salto de linea
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    send(input.value);
  });

  /* ---------- Contexto (lo emite assistant-context.js) ---------- */

  function showContext() {
    contextBar.hidden = !context;
    contextLabel.textContent = context ? `Hablando sobre: ${context.label}` : "";
    if (!panel.hidden) renderSuggestions();
  }

  document.addEventListener("assistant:context", (event) => {
    const detail = event.detail;
    context = detail && detail.text ? { label: detail.label || "lo seleccionado", text: detail.text } : null;
    showContext();
  });

  contextClear.addEventListener("click", () => {
    context = null;
    showContext();
    input.focus();
  });
})();

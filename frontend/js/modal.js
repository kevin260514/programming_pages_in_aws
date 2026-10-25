(function () {
  "use strict";

  const root = document.getElementById("modal-root");
  if (!root) return;

  const STATUS_TEXT = { Alive: "vivo", Dead: "muerto", unknown: "desconocido" };
  const GENDER_TEXT = {
    Male: "masculino",
    Female: "femenino",
    Genderless: "sin género",
    unknown: "desconocido",
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- Estructura de la ventana ---------- */

  const overlay = el("div", "modal-overlay");
  overlay.hidden = true;

  const dialog = el("div", "modal");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "modal-title");

  const image = el("img", "modal-image");
  const body = el("div", "modal-body");
  const title = el("h3", "");
  title.id = "modal-title";
  const description = el("p", "modal-description");
  const details = el("dl", "modal-details");

  const backButton = el("button", "btn primary", "Volver (Back)");
  backButton.type = "button";

  body.append(title, description, details, backButton);
  dialog.append(image, body);
  overlay.append(dialog);
  root.append(overlay);

  /* ---------- Contenido ---------- */

  function addDetail(label, value) {
    details.append(el("dt", "", label), el("dd", "", value));
  }

  function fill(character) {
    const episodes = character.episode.length;
    const statusText = STATUS_TEXT[character.status] || character.status;
    const species = character.type
      ? `${character.species} (${character.type})`
      : character.species;

    image.src = character.image;
    image.alt = `Imagen de ${character.name}`;
    title.textContent = character.name;
    description.textContent =
      `${character.name} es un personaje de especie ${species}. ` +
      `Su estado actual es: ${statusText}. ` +
      `Aparece en ${episodes} episodio${episodes === 1 ? "" : "s"} de la serie.`;

    details.replaceChildren();
    addDetail("Género", GENDER_TEXT[character.gender] || character.gender);
    addDetail("Origen", character.origin.name);
    addDetail("Última ubicación conocida", character.location.name);
  }

  /* ---------- Abrir y cerrar ---------- */

  let lastFocused = null;

  function isOpen() {
    return !overlay.hidden;
  }

  function open(character) {
    fill(character);
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add("modal-open");
    backButton.focus();
  }

  function close() {
    overlay.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  document.addEventListener("character:select", (event) => open(event.detail));

  backButton.addEventListener("click", close);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen()) return;
    if (event.key === "Escape") {
      close();
    } else if (event.key === "Tab") {
      // El único elemento enfocable es el botón: mantiene el foco dentro.
      event.preventDefault();
      backButton.focus();
    }
  });
})();

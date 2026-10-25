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
  const MAX_STAT = 255;

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
  const subtitle = el("p", "modal-subtitle");
  const description = el("p", "modal-description");
  const details = el("dl", "modal-details");
  const statsBox = el("div", "modal-stats");

  const backButton = el("button", "btn primary", "Volver (Back)");
  backButton.type = "button";

  body.append(title, subtitle, description, details, statsBox, backButton);
  dialog.append(image, body);
  overlay.append(dialog);
  root.append(overlay);

  /* ---------- Contenido ---------- */

  function addDetail(label, value) {
    details.append(el("dt", "", label), el("dd", "", value));
  }

  function renderStats(stats) {
    statsBox.replaceChildren();
    statsBox.hidden = !stats || stats.length === 0;
    if (statsBox.hidden) return;

    statsBox.append(el("h4", "modal-stats-title", "Estadísticas base"));
    stats.forEach((stat) => {
      const row = el("div", "stat-row");
      const track = el("div", "stat-track");
      const fill = el("div", "stat-fill");
      fill.style.width = `${Math.min(100, Math.round((stat.value / MAX_STAT) * 100))}%`;
      track.append(fill);
      row.append(
        el("span", "stat-label", stat.label),
        el("span", "stat-value", String(stat.value)),
        track
      );
      statsBox.append(row);
    });
  }

  // Cada origen de datos se convierte a este formato común:
  // { title, subtitle, description, image, alt, fit, details: [[etiqueta, valor]], stats }

  function fromCharacter(character) {
    const episodes = character.episode.length;
    const statusText = STATUS_TEXT[character.status] || character.status;
    const species = character.type
      ? `${character.species} (${character.type})`
      : character.species;

    return {
      title: character.name,
      subtitle: "",
      description:
        `${character.name} es un personaje de especie ${species}. ` +
        `Su estado actual es: ${statusText}. ` +
        `Aparece en ${episodes} episodio${episodes === 1 ? "" : "s"} de la serie.`,
      image: character.image,
      alt: `Imagen de ${character.name}`,
      fit: "cover",
      details: [
        ["Género", GENDER_TEXT[character.gender] || character.gender],
        ["Origen", character.origin.name],
        ["Última ubicación conocida", character.location.name],
      ],
      stats: null,
    };
  }

  function fromPokemon(pokemon) {
    const details = [
      ["N.º", `#${String(pokemon.id).padStart(4, "0")}`],
      ["Tipos", pokemon.types.join(", ")],
      ["Altura", `${pokemon.height} m`],
      ["Peso", `${pokemon.weight} kg`],
      ["Habilidades", pokemon.abilities.join(", ")],
    ];
    if (typeof pokemon.baseExperience === "number") {
      details.push(["Experiencia base", String(pokemon.baseExperience)]);
    }

    return {
      title: pokemon.name,
      subtitle: pokemon.genus || "",
      description: pokemon.description,
      image: pokemon.image,
      alt: `Imagen de ${pokemon.name}`,
      fit: "contain",
      details,
      stats: pokemon.stats,
    };
  }

  function fill(content) {
    image.className = content.fit === "contain" ? "modal-image is-contain" : "modal-image";
    image.src = content.image;
    image.alt = content.alt;
    title.textContent = content.title;
    subtitle.textContent = content.subtitle;
    subtitle.hidden = !content.subtitle;
    description.textContent = content.description;

    details.replaceChildren();
    content.details.forEach(([label, value]) => addDetail(label, value));
    renderStats(content.stats);
  }

  /* ---------- Abrir y cerrar ---------- */

  let lastFocused = null;

  function isOpen() {
    return !overlay.hidden;
  }

  function open(content) {
    fill(content);
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

  document.addEventListener("character:select", (event) =>
    open(fromCharacter(event.detail))
  );
  document.addEventListener("pokemon:select", (event) =>
    open(fromPokemon(event.detail))
  );

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

(function () {
  "use strict";

  const API_URL = "https://rickandmortyapi.com/api/character/";
  const DEBOUNCE_MS = 4500;

  const root = document.getElementById("explorer");
  if (!root) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /* ---------- Interfaz ---------- */

  const searchBox = el("div", "search");

  const input = el("input");
  input.type = "search";
  input.id = "character-search";
  input.placeholder = "Escribe un nombre, por ejemplo: Rick";
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Buscar personaje por nombre");

  const progress = el("div", "progress");
  progress.setAttribute("aria-hidden", "true");
  const bar = el("div", "bar");
  progress.append(bar);

  const hint = el(
    "p",
    "hint",
    "La búsqueda se lanza 4.5 segundos después de que dejes de escribir."
  );

  const status = el("p", "search-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const results = el("div", "cards");
  results.id = "character-results";

  searchBox.append(input, progress, hint);
  root.append(searchBox, status, results);

  function setStatus(text) {
    status.textContent = text;
  }

  /* ---------- Debounce ---------- */

  function debounce(fn, wait, onSchedule) {
    let timer = null;

    function debounced(...args) {
      clearTimeout(timer);
      if (onSchedule) onSchedule();
      timer = setTimeout(() => {
        timer = null;
        fn(...args);
      }, wait);
    }

    debounced.cancel = () => {
      clearTimeout(timer);
      timer = null;
    };

    return debounced;
  }

  function startCountdown() {
    bar.classList.remove("running");
    void bar.offsetWidth; // reinicia la animación
    bar.style.animationDuration = `${DEBOUNCE_MS}ms`;
    bar.classList.add("running");
  }

  function stopCountdown() {
    bar.classList.remove("running");
  }

  /* ---------- Tarjetas ---------- */

  function buildCard(character) {
    const card = el("button", "card character-card");
    card.type = "button";

    const image = el("img");
    image.src = character.image;
    image.alt = `Imagen de ${character.name}`;
    image.loading = "lazy";

    const name = el("h3", "", character.name);
    const meta = el("p", "", `${character.species} · ${character.status}`);

    card.append(image, name, meta);

    // La ventana modal (PAG-21) escucha este evento.
    card.addEventListener("click", () => {
      document.dispatchEvent(
        new CustomEvent("character:select", { detail: character })
      );
    });

    return card;
  }

  function renderResults(list) {
    results.replaceChildren(...list.map(buildCard));
  }

  /* ---------- Consulta a la API ---------- */

  let controller = null;

  async function search(query) {
    stopCountdown();
    if (controller) controller.abort();
    controller = new AbortController();

    setStatus("Buscando…");

    try {
      const response = await fetch(
        `${API_URL}?name=${encodeURIComponent(query)}`,
        { signal: controller.signal }
      );

      if (response.status === 404) {
        renderResults([]);
        setStatus(`No se encontraron personajes con "${query}".`);
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      renderResults(data.results);

      const total = data.info.count;
      setStatus(
        total > data.results.length
          ? `${total} resultados (se muestran los primeros ${data.results.length}).`
          : `${total} resultado${total === 1 ? "" : "s"}.`
      );
    } catch (error) {
      if (error.name === "AbortError") return;
      renderResults([]);
      setStatus("No se pudo consultar la API. Inténtalo de nuevo.");
      console.error(error);
    }
  }

  const scheduleSearch = debounce(search, DEBOUNCE_MS, startCountdown);

  input.addEventListener("input", () => {
    const query = input.value.trim();

    if (!query) {
      scheduleSearch.cancel();
      stopCountdown();
      if (controller) controller.abort();
      renderResults([]);
      setStatus("Escribe un nombre para buscar personajes.");
      return;
    }

    setStatus("Esperando a que termines de escribir…");
    scheduleSearch(query);
  });

  setStatus("Escribe un nombre para buscar personajes.");
})();

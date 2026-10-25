(function () {
  "use strict";

  const API_URL = "https://pokeapi.co/api/v2";
  const HIDDEN_TYPES = ["unknown", "shadow", "stellar"];

  const root = document.getElementById("cascade");
  if (!root) return;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function format(name) {
    return name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function fillSelect(select, placeholder, items) {
    select.replaceChildren(
      new Option(placeholder, ""),
      ...items.map((item) => new Option(item.label, item.value))
    );
  }

  /* ---------- Interfaz ---------- */

  const grid = el("div", "cascade-grid");

  const typeField = el("div", "cascade-field");
  const typeLabel = el("label", "", "1. Tipo de Pokémon");
  typeLabel.htmlFor = "pokemon-type";
  const typeSelect = el("select");
  typeSelect.id = "pokemon-type";
  typeSelect.disabled = true;
  typeField.append(typeLabel, typeSelect);

  const pokemonField = el("div", "cascade-field");
  const pokemonLabel = el("label", "", "2. Pokémon");
  pokemonLabel.htmlFor = "pokemon-name";
  const pokemonSelect = el("select");
  pokemonSelect.id = "pokemon-name";
  pokemonSelect.disabled = true;
  pokemonField.append(pokemonLabel, pokemonSelect);

  grid.append(typeField, pokemonField);

  const status = el("p", "cascade-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  const result = el("div", "pokemon-result");
  result.hidden = true;

  root.append(grid, status, result);

  function setStatus(text) {
    status.textContent = text;
  }

  function resetResult() {
    result.hidden = true;
    result.replaceChildren();
  }

  fillSelect(typeSelect, "Cargando…", []);
  fillSelect(pokemonSelect, "Primero elige un tipo", []);

  /* ---------- Select 1: tipos ---------- */

  async function loadTypes() {
    setStatus("Cargando tipos…");
    try {
      const data = await getJson(`${API_URL}/type`);
      const items = data.results
        .filter((type) => !HIDDEN_TYPES.includes(type.name))
        .map((type) => ({ value: type.name, label: format(type.name) }));
      fillSelect(typeSelect, "Elige un tipo…", items);
      typeSelect.disabled = false;
      setStatus("");
    } catch (error) {
      fillSelect(typeSelect, "No disponible", []);
      setStatus("No se pudieron cargar los tipos. Recarga la página.");
      console.error(error);
    }
  }

  /* ---------- Select 2: se carga según el tipo elegido ---------- */

  let typeRequest = 0;

  typeSelect.addEventListener("change", async () => {
    const type = typeSelect.value;
    const requestId = ++typeRequest;

    resetResult();
    pokemonSelect.disabled = true;
    fillSelect(pokemonSelect, "Primero elige un tipo", []);

    if (!type) {
      setStatus("");
      return;
    }

    fillSelect(pokemonSelect, "Cargando…", []);
    setStatus(`Cargando Pokémon de tipo ${format(type)}…`);

    try {
      const data = await getJson(`${API_URL}/type/${type}`);
      if (requestId !== typeRequest) return; // llegó una respuesta vieja

      const items = data.pokemon
        .map((entry) => entry.pokemon.name)
        .sort()
        .map((name) => ({ value: name, label: format(name) }));

      fillSelect(pokemonSelect, "Elige un Pokémon…", items);
      pokemonSelect.disabled = false;
      setStatus(`${items.length} Pokémon de tipo ${format(type)}.`);
    } catch (error) {
      if (requestId !== typeRequest) return;
      fillSelect(pokemonSelect, "No disponible", []);
      setStatus("No se pudieron cargar los Pokémon. Inténtalo de nuevo.");
      console.error(error);
    }
  });

  /* ---------- Resultado del segundo select ---------- */

  function renderPokemon(pokemon) {
    const sprite = pokemon.sprites && pokemon.sprites.front_default;
    const types = pokemon.types.map((entry) => format(entry.type.name)).join(", ");

    const nodes = [];
    if (sprite) {
      const image = el("img");
      image.src = sprite;
      image.alt = `Sprite de ${format(pokemon.name)}`;
      nodes.push(image);
    }

    const info = el("div", "pokemon-info");
    info.append(
      el("h3", "", format(pokemon.name)),
      el("p", "", `Tipos: ${types}`),
      el("p", "", `Altura: ${pokemon.height / 10} m`),
      el("p", "", `Peso: ${pokemon.weight / 10} kg`)
    );
    nodes.push(info);

    result.replaceChildren(...nodes);
    result.hidden = false;
  }

  let pokemonRequest = 0;

  pokemonSelect.addEventListener("change", async () => {
    const name = pokemonSelect.value;
    const requestId = ++pokemonRequest;

    resetResult();
    if (!name) return;

    setStatus(`Cargando ${format(name)}…`);

    try {
      const pokemon = await getJson(`${API_URL}/pokemon/${name}`);
      if (requestId !== pokemonRequest) return;
      renderPokemon(pokemon);
      setStatus("");
    } catch (error) {
      if (requestId !== pokemonRequest) return;
      setStatus("No se pudo cargar el detalle del Pokémon.");
      console.error(error);
    }
  });

  loadTypes();
})();

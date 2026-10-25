(function () {
  "use strict";

  const API_URL = "https://pokeapi.co/api/v2";
  const HIDDEN_TYPES = ["unknown", "shadow", "stellar"];

  const TYPE_ES = {
    normal: "Normal", fire: "Fuego", water: "Agua", grass: "Planta",
    electric: "Eléctrico", ice: "Hielo", fighting: "Lucha", poison: "Veneno",
    ground: "Tierra", flying: "Volador", psychic: "Psíquico", bug: "Bicho",
    rock: "Roca", ghost: "Fantasma", dragon: "Dragón", dark: "Siniestro",
    steel: "Acero", fairy: "Hada",
  };

  const STAT_ES = {
    hp: "PS", attack: "Ataque", defense: "Defensa",
    "special-attack": "At. especial", "special-defense": "Def. especial",
    speed: "Velocidad",
  };

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

  function typeLabel(name) {
    return TYPE_ES[name] || format(name);
  }

  function cleanText(text) {
    return text.replace(/[\n\f\r]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function shorten(text, max) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    return `${cut.slice(0, cut.lastIndexOf(" ")).trim()}…`;
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
  const typeLabelEl = el("label", "", "1. Tipo de Pokémon");
  typeLabelEl.htmlFor = "pokemon-type";
  const typeSelect = el("select");
  typeSelect.id = "pokemon-type";
  typeSelect.disabled = true;
  typeField.append(typeLabelEl, typeSelect);

  const pokemonField = el("div", "cascade-field");
  const pokemonLabelEl = el("label", "", "2. Pokémon");
  pokemonLabelEl.htmlFor = "pokemon-name";
  const pokemonSelect = el("select");
  pokemonSelect.id = "pokemon-name";
  pokemonSelect.disabled = true;
  pokemonField.append(pokemonLabelEl, pokemonSelect);

  grid.append(typeField, pokemonField);

  const status = el("p", "cascade-status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  // La tarjeta del resultado es un botón: al pulsarla se abre el modal.
  const result = el("button", "pokemon-result");
  result.type = "button";
  result.hidden = true;
  result.setAttribute("aria-haspopup", "dialog");

  root.append(grid, status, result);

  let currentDetail = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function resetResult() {
    currentDetail = null;
    result.hidden = true;
    result.replaceChildren();
  }

  result.addEventListener("click", () => {
    if (!currentDetail) return;
    // La ventana modal (PAG-21) escucha este evento.
    document.dispatchEvent(
      new CustomEvent("pokemon:select", { detail: currentDetail })
    );
  });

  fillSelect(typeSelect, "Cargando…", []);
  fillSelect(pokemonSelect, "Primero elige un tipo", []);

  /* ---------- Select 1: tipos ---------- */

  async function loadTypes() {
    setStatus("Cargando tipos…");
    try {
      const data = await getJson(`${API_URL}/type`);
      const items = data.results
        .filter((type) => !HIDDEN_TYPES.includes(type.name))
        .map((type) => ({ value: type.name, label: typeLabel(type.name) }));
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
    setStatus(`Cargando Pokémon de tipo ${typeLabel(type)}…`);

    try {
      const data = await getJson(`${API_URL}/type/${type}`);
      if (requestId !== typeRequest) return; // llegó una respuesta vieja

      const items = data.pokemon
        .map((entry) => entry.pokemon.name)
        .sort()
        .map((name) => ({ value: name, label: format(name) }));

      fillSelect(pokemonSelect, "Elige un Pokémon…", items);
      pokemonSelect.disabled = false;
      setStatus(`${items.length} Pokémon de tipo ${typeLabel(type)}.`);
    } catch (error) {
      if (requestId !== typeRequest) return;
      fillSelect(pokemonSelect, "No disponible", []);
      setStatus("No se pudieron cargar los Pokémon. Inténtalo de nuevo.");
      console.error(error);
    }
  });

  /* ---------- Detalle del Pokémon elegido ---------- */

  function pickByLanguage(entries, field) {
    for (const language of ["es", "en"]) {
      const matches = entries.filter(
        (entry) => entry.language.name === language && entry[field]
      );
      if (matches.length) return cleanText(matches[matches.length - 1][field]);
    }
    return "";
  }

  async function loadSpecies(pokemon) {
    try {
      const species = await getJson(pokemon.species.url);
      return {
        description: pickByLanguage(species.flavor_text_entries, "flavor_text"),
        genus: pickByLanguage(species.genera, "genus"),
      };
    } catch (error) {
      console.error(error);
      return { description: "", genus: "" };
    }
  }

  function buildDetail(pokemon, species) {
    const sprites = pokemon.sprites || {};
    const artwork =
      sprites.other &&
      sprites.other["official-artwork"] &&
      sprites.other["official-artwork"].front_default;

    return {
      id: pokemon.id,
      name: format(pokemon.name),
      image: artwork || sprites.front_default || "",
      description: species.description || "Esta especie no tiene descripción disponible.",
      genus: species.genus,
      types: pokemon.types.map((entry) => typeLabel(entry.type.name)),
      height: pokemon.height / 10,
      weight: pokemon.weight / 10,
      abilities: pokemon.abilities.map((entry) => format(entry.ability.name)),
      baseExperience: pokemon.base_experience,
      stats: pokemon.stats.map((entry) => ({
        label: STAT_ES[entry.stat.name] || format(entry.stat.name),
        value: entry.base_stat,
      })),
    };
  }

  function renderPokemon(detail) {
    const nodes = [];

    if (detail.image) {
      const image = el("img");
      image.src = detail.image;
      image.alt = `Imagen de ${detail.name}`;
      nodes.push(image);
    }

    const badges = el("div", "type-badges");
    detail.types.forEach((type) => badges.append(el("span", "badge", type)));

    const info = el("div", "pokemon-info");
    info.append(
      el("h3", "", detail.name),
      badges,
      el("p", "pokemon-summary", shorten(detail.description, 150)),
      el("p", "pokemon-hint", "Haz clic para ver el detalle")
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

      const species = await loadSpecies(pokemon);
      if (requestId !== pokemonRequest) return;

      currentDetail = buildDetail(pokemon, species);
      renderPokemon(currentDetail);
      setStatus("");
    } catch (error) {
      if (requestId !== pokemonRequest) return;
      setStatus("No se pudo cargar el detalle del Pokémon.");
      console.error(error);
    }
  });

  loadTypes();
})();

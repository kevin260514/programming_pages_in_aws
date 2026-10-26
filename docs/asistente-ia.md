# Asistente de IA en la Página 2 (PAG-30)

Un chat flotante en la Página 2 donde el usuario puede preguntar sobre lo que está viendo (el personaje de Rick & Morty o el Pokémon seleccionado). Las respuestas las genera la API de Gemini.

## Cómo funciona

```
Navegador                     Backend (Spring Boot)                 Google
┌──────────────┐  POST        ┌──────────────────────┐   HTTPS      ┌────────┐
│ Chat flotante│ /api/assistant│ AssistantController  │ ───────────► │ Gemini │
│ + contexto   │ ───────────► │ → AssistantService   │              │  API   │
│ (Pokémon o   │ {question,   │ → GeminiHttpClient   │ ◄─────────── │        │
│  personaje)  │  context}    │   (clave GEMINI_API_KEY)            └────────┘
│              │ ◄─────────── │                      │
└──────────────┘  {answer}    └──────────────────────┘
```

## Decisiones de diseño

| Decisión | Motivo |
|---|---|
| El navegador nunca llama a Gemini | La clave de API viviría en el JavaScript y cualquiera podría robarla. |
| La clave está en la variable `GEMINI_API_KEY` del backend | No se sube a Git (`.env` está en `.gitignore`). |
| Toda la comunicación con Gemini está en `GeminiHttpClient` | Si Google cambia su API, solo se modifica ese archivo. |
| No se envían datos de estudiantes | Cédula, email y teléfono son datos personales: el asistente solo recibe datos públicos de la Página 2. |
| Límite de preguntas por cliente y por minuto | Protege la cuota gratuita cuando la página está publicada en AWS. |
| El contexto y la pregunta se tratan como datos | El prompt le indica al modelo que ignore órdenes que vengan dentro de ellos. |

## Subtareas

| Ticket | Contenido | Archivos principales |
|---|---|---|
| PAG-31 | Endpoint `POST /api/assistant` con Gemini | `backend/.../assistant/*`, `docker-compose.yml` |
| PAG-32 | Chat flotante en la Página 2 | `frontend/js/assistant.js`, `frontend/css/assistant.css`, `pagina2.html` |
| PAG-33 | Contexto seleccionado y documentación de la configuración | `frontend/js/assistant-context.js`, `.env.example`, `README.md` |

## Configuración

Variables de entorno del backend (se definen en el archivo `.env` de la raíz):

| Variable | Obligatoria | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Sí, para usar el asistente | Clave creada en Google AI Studio |
| `GEMINI_MODEL` | No | Modelo de Gemini. Por defecto `gemini-3.8-flash`; si Google lo renombra, se cambia aquí sin tocar el código |

Sin `GEMINI_API_KEY` el resto de la aplicación funciona igual; el asistente responde que no está configurado.

# Documentacion del proyecto PAG

Indice de la documentacion tecnica. Cada documento se incorpora con su subtarea.

## PAG-14 · Responsive, MCP y AWS

| Subtarea | Documento | Que contiene |
|---|---|---|
| PAG-23 | `frontend/css/responsive.css` | Hoja de estilos responsive compartida por todas las paginas (telefono, tablet, escritorio) |
| PAG-24 | [mcp-diagnostico.md](mcp-diagnostico.md) | Configuracion de los servidores MCP y prompts de diagnostico |
| PAG-24 | [reporte-diagnostico-ui.md](reporte-diagnostico-ui.md) | Primer reporte de diagnostico de la interfaz (antes y despues) |
| PAG-25 | [despliegue-aws.md](despliegue-aws.md) | Guia paso a paso para desplegar con Docker Compose en AWS EC2 |

### Puntos de quiebre responsive

| Rango | Dispositivo | Diseno |
|---|---|---|
| 0 - 599 px | Telefono | 1 columna, controles de 44 px, personajes en 2 columnas |
| 600 - 899 px | Tablet vertical | Desde 700 px: formulario y lista lado a lado |
| 900 - 1279 px | Tablet horizontal / portatil | Dos paneles con mas espacio |
| 1280 px o mas | Escritorio | Contenido centrado (max. 1400 px); Pagina 2 en dos columnas desde 1100 px |

### Como verificar el responsive

```powershell
cd tools\ui-audit
npm install
npx playwright install chromium
npm run audit
```

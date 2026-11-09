# Prueba de carga con k6 (PAG-38)

## Objetivo
Comprobar cómo responde el sistema, a través del API Gateway, con varios usuarios simultáneos.

## Escenario
- Herramienta: k6 (grafana/k6 en Docker).
- 20 usuarios virtuales durante 30 segundos, con pausa de 1 s entre peticiones.
- Petición: GET /api/students por el gateway (puerto 80).
- Criterios: menos del 1 % de fallos y p(95) menor a 500 ms.
- Script: load-test/prueba.js

## Cómo ejecutarla
Get-Content load-test\prueba.js | docker run --rm -i -e BASE_URL=http://host.docker.internal grafana/k6 run -

## Resultados
| Métrica | Valor |
|---|---|
| Peticiones totales | 580 (19 por segundo) |
| Peticiones fallidas | 0,00 % |
| Checks correctos | 580 de 580 |
| Tiempo de respuesta promedio | 47,73 ms |
| Mediana | 20,78 ms |
| p(95) | 59,21 ms |
| Máximo | 731,91 ms |

## Conclusión
Con 20 usuarios simultáneos el sistema respondió sin errores y muy por debajo del umbral de 500 ms. El valor máximo fue una petición aislada. Esta prueba mide el comportamiento bajo carga moderada, no el límite máximo.
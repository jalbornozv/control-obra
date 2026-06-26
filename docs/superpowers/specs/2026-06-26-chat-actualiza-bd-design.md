# Feature 1: Chat que actualiza BD — Diseño

**Fecha:** 2026-06-26

## Contexto

El dashboard ya tiene un `ChatAgente` que usa Claude Haiku para responder preguntas sobre la obra. Esta feature extiende el chat para que también pueda actualizar el avance de partidas en Supabase directamente desde el browser, sin necesidad de ir a Claude Code.

## Comportamiento

El usuario escribe o habla en el chat del dashboard. Claude Haiku analiza el mensaje y decide:
- Si es una **pregunta** → responde normalmente (comportamiento actual)
- Si es un **reporte de avance** → invoca la tool `actualizar_partida` para cada partida mencionada
- Si hay **ambigüedad** → responde pidiendo aclaración, no actualiza nada

Ejemplos de input que disparan actualizaciones:
- "Terminé la demolición de pisos"
- "Tabiquería TV3 va al 60%"
- "Hoy avanzamos bien en cielos, diría 40%"
- "Terminé demolición y tabiquería va al 60%" (actualiza 2 partidas)

## Arquitectura

```
Usuario escribe/habla en ChatAgente
       ↓
Claude Haiku API con tool definida:
  tool: actualizar_partida(partida_id, avance_pct, nota?)
       ↓
Claude retorna tool_use block(s)
       ↓
App ejecuta para cada tool_use:
  1. PATCH /rest/v1/partidas?id=eq.<partida_id>  { avance_pct }
  2. POST  /rest/v1/registros                    { partida_id, dia_obra, avance_pct, nota }
       ↓
Chat muestra: "✅ Actualizado: [nombre] → [X]%"
       ↓
usePartidas re-fetches inmediatamente (sin esperar los 30s)
```

## Cambios en código

**`src/components/ChatAgente.jsx`** — único archivo a modificar:

1. Definir la tool `actualizar_partida` con schema JSON:
```json
{
  "name": "actualizar_partida",
  "description": "Actualiza el porcentaje de avance de una partida de obra en la base de datos",
  "input_schema": {
    "type": "object",
    "properties": {
      "partida_id": { "type": "string", "description": "UUID de la partida a actualizar" },
      "avance_pct": { "type": "number", "description": "Porcentaje de avance 0-100" },
      "nota": { "type": "string", "description": "Observación opcional" }
    },
    "required": ["partida_id", "avance_pct"]
  }
}
```

2. Incluir en el system prompt la lista de partidas con sus IDs y nombres (ya se hace para el contexto de preguntas)

3. Detectar `response.stop_reason === 'tool_use'` y ejecutar los PATCHes a Supabase

4. Agregar prop `onAvanceUpdated` callback para triggear re-fetch inmediato en `usePartidas`

5. Mostrar mensaje de confirmación en el chat con las actualizaciones realizadas

## Prop interface

```jsx
// App.jsx pasa un callback al ChatAgente:
<ChatAgente obra={obra} partidas={partidas} onAvanceUpdated={refetchPartidas} />
```

`refetchPartidas` es una función que llama inmediatamente al fetch de partidas sin esperar el intervalo de 30s.

## Error handling

- Si Supabase retorna error en el PATCH: mostrar en chat "❌ Error al actualizar [nombre]: [mensaje]"
- Si Claude no encuentra la partida por el nombre dado: Claude responde pidiendo más precisión (no hay código de error, Claude lo maneja en lenguaje natural)
- Si `avance_pct` > 100 o < 0: rechazar en el schema de la tool (validación automática)

## Scope fuera de v1

- Historial de cambios visible en el chat
- Deshacer última actualización
- Actualizar campos distintos a avance_pct (fecha real de término, cantidad real)

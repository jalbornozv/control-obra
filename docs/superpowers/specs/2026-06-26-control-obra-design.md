# Control Obra — Diseño de Sistema

**Fecha:** 2026-06-26  
**Proyecto piloto:** Doña Carne Manquehue 1  
**Usuario:** Jefe de obra (uso personal, single-user)

---

## Contexto

Sistema de gestión de obra diseñado para proyectos de construcción de plazos ajustados. El proyecto piloto es una remodelación comercial de 60 días corridos, ~50 partidas, 13 cuadrillas, presupuesto de $163M CLP. El sistema es genérico y reutilizable para cualquier obra futura.

La fuente de verdad es siempre la Carta Gantt y el Presupuesto importados al inicio del proyecto. Todo el seguimiento se cruza contra esa línea base.

---

## Arquitectura

```
Usuario (voz o texto)
       │
       ▼
Claude Code (agente)
  - Interpreta lenguaje natural
  - Identifica partidas a actualizar
  - Llama REST API de Supabase
       │
       ▼
Supabase (PostgreSQL)
  - obras
  - partidas
  - registros
       │
       ▼
Dashboard React (Netlify)
  - Auto-polling cada 30s
  - Chat con Claude API (Haiku)
  - Voz con Web Speech API
```

**Stack:**
- Frontend: React + Vite, desplegado en Netlify (free)
- Base de datos: Supabase PostgreSQL (free tier)
- Chat IA en dashboard: Claude API modelo Haiku (bajo costo)
- Reconocimiento de voz: Web Speech API (nativa del browser, sin costo)
- Agente de actualización: Claude Code vía REST API de Supabase

---

## Modelo de Datos

### Tabla `obras`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| nombre | text | Nombre del proyecto |
| fecha_inicio | date | Día 0 de la obra |
| total_dias | int | Duración total (ej: 60) |
| presupuesto_neto | numeric | Total neto CLP |
| created_at | timestamp | |

### Tabla `partidas`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| obra_id | uuid | FK → obras |
| cuadrilla | text | Ej: "T5. Tabiquería / Drywall" |
| seccion | text | Ej: "B. ESTRUCTURA Y TABIQUERÍA NUEVA" |
| numero | text | Número de item |
| nombre | text | Descripción de la partida |
| unidad | text | m2, ml, kg, gl, etc. |
| cantidad | numeric | |
| precio_unit | numeric | CLP |
| subtotal | numeric | CLP |
| dia_ini | int | Día inicio según Gantt |
| dia_fin | int | Día fin según Gantt |
| avance_pct | numeric | 0–100, actualizado por el agente |

### Tabla `registros`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| partida_id | uuid | FK → partidas |
| dia_obra | int | Día de obra al momento del registro |
| avance_pct | numeric | Avance reportado ese día |
| nota | text | Observación libre |
| created_at | timestamp | |

**Datos importados al inicio:**
- `Carta_Gantt_60dias_v4.xlsx` → campos: cuadrilla, seccion, numero, nombre, unidad, cantidad, dia_ini, dia_fin
- `1100 Presupuesto doña carne JA.xlsx` → campos: precio_unit, subtotal (cruzado por numero de partida)

---

## Módulos del Dashboard

### 1. Resumen General (Home)
- Día actual de obra y días restantes
- % avance global real vs planificado
- Semáforo general: verde (≤5% atraso), amarillo (5–15%), rojo (>15%)
- Dotación esperada hoy según Gantt
- Últimos registros del agente

### 2. Gantt + Avance por Partida
- Barras horizontales por partida con ventana planificada (dia_ini → dia_fin)
- Barra de progreso real superpuesta (avance_pct)
- Color por estado (basado en avance esperado = `(dia_actual - dia_ini) / (dia_fin - dia_ini) × 100`):
  - Verde: avance_pct ≥ avance_esperado
  - Amarillo: avance_pct entre 70–99% del avance_esperado
  - Rojo: avance_pct < 70% del avance_esperado
  - Gris: partida aún no iniciada (dia_actual < dia_ini)
- Filtro por cuadrilla o sección

### 3. Financiero / Flujo de Caja
- Avance valorizado: `SUM(avance_pct/100 × subtotal)` por partida
- Estimación de próximo estado de pago (monto cobrable según avance actual)
- Curva S: gasto acumulado planificado vs real por semana
- Proyección de término según ritmo actual

### 4. Chat con Agente
- Caja de texto + botón de voz (Web Speech API)
- El chat envía a Claude API (Haiku) con contexto completo:
  - Datos de todas las partidas con avance actual
  - Día de obra actual
  - Montos presupuestados
- Ejemplos de consultas:
  - "¿Cuánto puedo cobrar en el próximo estado de pago?"
  - "¿Qué partidas van más atrasadas?"
  - "Si sigo a este ritmo, ¿termino a tiempo?"
  - "Proyecta el flujo de caja para las próximas 2 semanas"

---

## Interacción con Claude Code (agente)

El usuario reporta avances en lenguaje natural desde Claude Code. El agente:

1. Identifica las partidas mencionadas (por nombre, cuadrilla o número)
2. Extrae el porcentaje de avance
3. Hace PATCH a Supabase REST API para actualizar `avance_pct`
4. Inserta un registro en `registros` con el día actual y nota
5. Confirma al usuario qué se actualizó

**Ejemplos de input:**
- "Terminé la demolición de pisos 1er nivel" → avance_pct = 100 para partida A.1
- "Tabiquería TV3 va en un 60%" → avance_pct = 60 para partida B.1
- "Hoy avanzamos bien en cielos, diría que vamos en un 40%" → actualiza grupo T8

---

## Voz

Disponible en dos lugares:
1. **Reporte de avance:** desde Claude Code con transcripción → yo proceso el texto
2. **Chat del dashboard:** botón de micrófono en la UI → Web Speech API transcribe → envía al chat de Claude API

---

## Despliegue

1. Supabase: crear proyecto, tablas, obtener URL y anon key
2. Script de importación: lee los xlsx y puebla `obras` y `partidas`
3. React app: configura variables de entorno con credenciales Supabase y Claude API key
4. Netlify: conecta al repo GitHub, auto-deploy en cada push
5. Variables de entorno en Netlify: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_CLAUDE_API_KEY`

---

## Consideraciones de Seguridad

- La `anon key` de Supabase solo tiene permisos de lectura/escritura sobre las tablas de esta app (Row Level Security desactivado para single-user)
- La Claude API key se usa solo en el frontend del dashboard (aceptable para uso personal)
- No hay autenticación de usuarios (single-user, uso personal)

---

## Alcance Fuera de Scope (v1)

- Multi-usuario / autenticación
- Gestión de subcontratistas
- Upload de fotos o documentos
- Notificaciones push
- Exportación a PDF

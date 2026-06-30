# Diseño: Multi-usuario — Panel Cliente + Registro en Terreno

**Fecha:** 2026-06-30  
**Estado:** Aprobado por usuario, pendiente de implementación

## Resumen

Agregar soporte multi-usuario a Control Obra con tres roles: admin, trabajador y mandante. El objetivo es permitir que maestros/capataces reporten avance desde terreno y que el mandante pueda ver el estado de su obra, todo gestionable desde la app sin tocar configuración externa.

---

## Roles

| Rol | Acceso | Auth |
|-----|--------|------|
| Admin (Javier) | Todo — igual que hoy más gestión de usuarios | PIN propio en tabla `usuarios` |
| Trabajador | Todas las partidas sin datos financieros, puede actualizar avance y adjuntar foto | Nombre + PIN personal en tabla `usuarios` |
| Mandante | Panel de solo lectura: avance global + semáforo + lista de partidas sin precios | PIN de obra en tabla `obras` |

---

## Modelo de datos

### Tabla `usuarios` (nueva)
```sql
CREATE TABLE usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  pin_hash text NOT NULL,
  rol text NOT NULL CHECK (rol IN ('admin', 'trabajador')),
  obra_id uuid REFERENCES obras(id) ON DELETE CASCADE, -- null para admin
  created_at timestamptz DEFAULT now()
);
```

### Tabla `obras` — agregar campo
```sql
ALTER TABLE obras ADD COLUMN IF NOT EXISTS pin_cliente text;
```

### Tabla `registros` — agregar campos
```sql
ALTER TABLE registros ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id);
ALTER TABLE registros ADD COLUMN IF NOT EXISTS foto_url text;
```

### Supabase Storage
- Bucket: `fotos-obra` (público para lectura, autenticado para escritura)
- Path: `fotos-obra/{obra_id}/{partida_id}/{timestamp}.jpg`

### Seed inicial (ejecutar una vez)
```sql
-- Crear admin inicial con PIN "1234" (SHA-256 pre-calculado). Cambiar desde la app después.
-- SHA-256("1234") = 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
INSERT INTO usuarios (nombre, pin_hash, rol)
VALUES ('Admin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'admin');
```

---

## Flujo de auth

Sesión guardada en `localStorage` con: `{ rol, nombre, obraId, usuarioId }`. Sin JWT ni tokens complejos. Se borra al cerrar sesión manualmente.

**Pantalla de login → tres caminos:**
1. **Admin** → ingresa PIN → valida contra `usuarios` con `rol: 'admin'` → acceso total
2. **Trabajador** → ingresa nombre + PIN → valida contra `usuarios` con `rol: 'trabajador'` → `VistaTerreno`
3. **Mandante** → ingresa PIN → valida contra `obras.pin_cliente` → `PanelCliente`

PIN se hashea en el browser con SHA-256 antes de comparar. PIN incorrecto muestra mensaje de error, sin bloqueo por intentos (equipo pequeño y de confianza).

---

## Componentes nuevos

### `LoginScreen.jsx`
- Tres botones de selección de rol
- Formulario dinámico según rol seleccionado
- Manejo de error con mensaje inline

### `PanelCliente.jsx`
- Avance global en % con barra de progreso
- Semáforo con color y estado
- Nombre de obra + día actual / total días
- Lista de partidas: nombre, cuadrilla, avance % (sin subtotales ni precios)
- Sin rail lateral ni topbar completa — pantalla limpia

### `VistaTerreno.jsx`
- Lista completa de partidas con nombre, cuadrilla, avance actual
- Input numérico (0–100) por partida para actualizar avance
- Botón de cámara opcional por partida → sube foto a Supabase Storage → guarda URL en `registros`
- Botón "Guardar" único al final que envía en batch solo las partidas que el trabajador modificó (las no tocadas no generan registro)
- Al guardar: inserta en `registros` con `usuario_id` para trazabilidad

### Cambios en `GestionProyectos.jsx`
Agregar dos secciones nuevas al tab de proyectos (solo visible para admin):
- **Trabajadores:** lista de trabajadores de la obra, botón crear (nombre + PIN), botón borrar
- **Acceso mandante:** campo para configurar o cambiar PIN de cliente de la obra
- **Mi PIN:** formulario para que el admin cambie su propio PIN

---

## Manejo de errores

- PIN incorrecto → mensaje "PIN incorrecto" inline, sin lockout
- Error al subir foto → avance igual se guarda, foto se descarta silenciosamente con aviso al usuario
- Error de red al guardar avance → mensaje de error, datos del formulario se mantienen para reintentar

---

## Lo que NO cambia

- El flujo de admin es idéntico al actual una vez autenticado
- El modelo de partidas, obras y cálculos no se toca
- El chat IA sigue funcionando igual para el admin
- No hay roles intermedios (ej: "supervisor") en esta versión

---

## Fuera de alcance (para después)

- Notificaciones push / email cuando una partida se pone en rojo
- Historial de fotos por partida en una galería
- Múltiples admins
- Reporte automático diario al mandante

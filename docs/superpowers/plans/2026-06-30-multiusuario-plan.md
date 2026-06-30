# Multi-usuario: Panel Cliente + Registro en Terreno — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar auth con tres roles (admin, trabajador, mandante) para que maestros reporten avance desde terreno y mandantes vean el estado de su obra, todo gestionable desde la app.

**Architecture:** Sesión liviana en `localStorage`. `LoginScreen` muestra selector de rol; según el rol, App renderiza la vista correcta. PINs de trabajador/admin hasheados con SHA-256 en el browser; PIN de mandante en texto plano en `obras.pin_cliente`. Gestión de usuarios completa desde el tab Proyectos del admin.

**Tech Stack:** React 19, Supabase (PostgreSQL + Storage), Web Crypto API (SHA-256), Vitest

## Global Constraints

- JavaScript, sin TypeScript
- CSS con variables — nunca colores hardcodeados; usar `var(--gold)`, `var(--s1)`, etc.
- PIN trabajador/admin: hash SHA-256 via `crypto.subtle.digest` antes de guardar y comparar
- PIN mandante: texto plano en `obras.pin_cliente`
- Sesión en `localStorage` clave `co_session` como JSON: `{ rol, nombre, obraId, usuarioId }`
- El setter de estado de sesión en App.jsx se llama `setSessionState` (evita conflicto con `setSession` importado de auth)
- Fotos: Supabase Storage bucket `fotos-obra`, path `{obraId}/{partidaId}/{timestamp}.{ext}`
- Ejecutar tests: `npx vitest run`
- Build: `npm run build`

---

### Task 1: Migraciones SQL en Supabase

**Files:**
- Sin archivos de código — ejecutar SQL en el Dashboard de Supabase

**Interfaces:**
- Produce: tabla `usuarios`, campo `obras.pin_cliente`, campos `registros.usuario_id` y `registros.foto_url`, bucket `fotos-obra`

- [ ] **Step 1: Ejecutar en Supabase → SQL Editor**

```sql
-- Campo PIN de cliente en obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS pin_cliente text;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL,
  pin_hash   text NOT NULL,
  rol        text NOT NULL CHECK (rol IN ('admin', 'trabajador')),
  obra_id    uuid REFERENCES obras(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Campos adicionales en registros
ALTER TABLE registros ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES usuarios(id);
ALTER TABLE registros ADD COLUMN IF NOT EXISTS foto_url   text;

-- Admin inicial (PIN: 1234 — cambiar desde la app después)
-- SHA-256("1234") = 03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4
INSERT INTO usuarios (nombre, pin_hash, rol)
VALUES ('Admin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', 'admin')
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Crear bucket de Storage**

En Supabase → Storage → New bucket:
- Name: `fotos-obra`
- Public bucket: ✓ (sí)

- [ ] **Step 3: Verificar**

En SQL Editor: `SELECT id, nombre, rol FROM usuarios;` debe mostrar la fila del Admin.
En Storage: debe existir el bucket `fotos-obra`.

---

### Task 2: Utilidades de auth — `src/lib/auth.js`

**Files:**
- Create: `src/lib/auth.js`
- Create: `tests/auth.test.js`

**Interfaces:**
- Consumes: `supabase` de `./supabase`
- Produce:
  - `hashPin(pin: string): Promise<string>` — hex SHA-256
  - `loginAdmin(pin: string): Promise<Session|null>`
  - `loginTrabajador(nombre: string, pin: string): Promise<Session|null>`
  - `loginMandante(pin: string): Promise<Session|null>`
  - `getSession(): Session|null`
  - `setSession(session: Session): void`
  - `clearSession(): void`
  - `Session = { rol, nombre, obraId, usuarioId }`

- [ ] **Step 1: Escribir tests que fallan**

```js
// tests/auth.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: vi.fn() }
}))

import { hashPin, loginAdmin, loginTrabajador, loginMandante, getSession, setSession, clearSession } from '../src/lib/auth'
import { supabase } from '../src/lib/supabase'

function mockChain(data, error = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  }
  supabase.from.mockReturnValue(chain)
  return chain
}

describe('hashPin', () => {
  it('retorna string hex de 64 caracteres', async () => {
    const h = await hashPin('1234')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]+$/)
  })

  it('retorna el hash conocido para "1234"', async () => {
    expect(await hashPin('1234')).toBe('03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
  })

  it('hashes distintos para PINs distintos', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('5678'))
  })
})

describe('loginAdmin', () => {
  it('retorna sesión cuando PIN es correcto', async () => {
    mockChain({ id: 'uid-1', nombre: 'Admin', rol: 'admin' })
    expect(await loginAdmin('1234')).toEqual({ rol: 'admin', nombre: 'Admin', usuarioId: 'uid-1', obraId: null })
  })

  it('retorna null cuando PIN es incorrecto', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginAdmin('wrong')).toBeNull()
  })
})

describe('loginTrabajador', () => {
  it('retorna sesión cuando nombre y PIN coinciden', async () => {
    mockChain({ id: 'uid-2', nombre: 'Juan', rol: 'trabajador', obra_id: 'obra-1' })
    expect(await loginTrabajador('Juan', '4321')).toEqual({ rol: 'trabajador', nombre: 'Juan', usuarioId: 'uid-2', obraId: 'obra-1' })
  })

  it('retorna null cuando no hay coincidencia', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginTrabajador('Juan', 'bad')).toBeNull()
  })
})

describe('loginMandante', () => {
  it('retorna sesión cuando PIN de obra coincide', async () => {
    mockChain({ id: 'obra-1', nombre: 'Obra Test' })
    expect(await loginMandante('9999')).toEqual({ rol: 'mandante', nombre: 'Obra Test', obraId: 'obra-1', usuarioId: null })
  })

  it('retorna null si PIN no coincide', async () => {
    mockChain(null, { message: 'No rows' })
    expect(await loginMandante('0000')).toBeNull()
  })
})

describe('session (localStorage)', () => {
  beforeEach(() => localStorage.clear())

  it('getSession retorna null si no hay sesión', () => {
    expect(getSession()).toBeNull()
  })

  it('setSession y getSession son inversos', () => {
    const s = { rol: 'admin', nombre: 'Admin', obraId: null, usuarioId: 'uid-1' }
    setSession(s)
    expect(getSession()).toEqual(s)
  })

  it('clearSession elimina la sesión', () => {
    setSession({ rol: 'admin', nombre: 'Admin', obraId: null, usuarioId: 'uid-1' })
    clearSession()
    expect(getSession()).toBeNull()
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
npx vitest run tests/auth.test.js
```
Esperado: FAIL — "Cannot find module '../src/lib/auth'"

- [ ] **Step 3: Implementar `src/lib/auth.js`**

```js
import { supabase } from './supabase'

export async function hashPin(pin) {
  const data   = new TextEncoder().encode(pin)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function loginAdmin(pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol')
    .eq('rol', 'admin')
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  return { rol: 'admin', nombre: data.nombre, usuarioId: data.id, obraId: null }
}

export async function loginTrabajador(nombre, pin) {
  const pin_hash = await hashPin(pin)
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, obra_id')
    .eq('rol', 'trabajador')
    .eq('nombre', nombre)
    .eq('pin_hash', pin_hash)
    .single()
  if (error || !data) return null
  return { rol: 'trabajador', nombre: data.nombre, usuarioId: data.id, obraId: data.obra_id }
}

export async function loginMandante(pin) {
  const { data, error } = await supabase
    .from('obras')
    .select('id, nombre')
    .eq('pin_cliente', pin)
    .single()
  if (error || !data) return null
  return { rol: 'mandante', nombre: data.nombre, obraId: data.id, usuarioId: null }
}

const SESSION_KEY = 'co_session'

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) } catch { return null }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
npx vitest run tests/auth.test.js
```
Esperado: todos PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.js tests/auth.test.js
git commit -m "feat: auth utilities — hashPin, login por rol, sesión localStorage"
```

---

### Task 3: `LoginScreen.jsx` + estilos

**Files:**
- Create: `src/components/LoginScreen.jsx`
- Modify: `src/App.css` (agregar sección login al final)

**Interfaces:**
- Consumes: `loginAdmin`, `loginTrabajador`, `loginMandante`, `setSession` de `../lib/auth`; `sismia-logo.png`
- Produce: `<LoginScreen onLogin={fn} />` — llama `onLogin(session)` al autenticarse exitosamente

- [ ] **Step 1: Agregar estilos al final de `src/App.css`** (antes del cierre del último bloque `}`)

```css
/* ── LOGIN ──────────────────────────────────────────────── */
.login-screen {
  min-height: 100svh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.login-card {
  background: var(--s1);
  border: 1px solid var(--border);
  border-radius: var(--rl);
  padding: 40px 32px;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.login-title {
  font-family: var(--disp);
  font-size: 1.6rem;
  letter-spacing: 0.08em;
  color: var(--text-h);
}

.login-roles { display: flex; flex-direction: column; gap: 10px; width: 100%; }

.login-rol-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--r);
  border: 1px solid var(--border-h);
  background: var(--s2);
  color: var(--text-m);
  font-family: var(--font);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.12s;
  text-align: left;
}
.login-rol-btn:hover { background: var(--s3); color: var(--text-h); border-color: var(--gold-bdr); }

.login-form { display: flex; flex-direction: column; gap: 12px; width: 100%; }

.login-input {
  padding: 11px 14px;
  border-radius: var(--r);
  background: var(--s2);
  border: 1px solid var(--border);
  color: var(--text-h);
  font-size: 16px;
  font-family: var(--font);
  outline: none;
  transition: border-color 0.15s;
  width: 100%;
  box-sizing: border-box;
}
.login-input:focus { border-color: var(--gold-bdr); }
.login-input::placeholder { color: var(--text); }

.login-submit {
  padding: 12px;
  border-radius: var(--r);
  border: none;
  background: var(--gold);
  color: #07080F;
  font-family: var(--font);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s;
  width: 100%;
}
.login-submit:disabled { background: var(--s3); color: var(--text); cursor: default; }
.login-submit:not(:disabled):hover { background: var(--gold-l); }

.login-error {
  color: var(--rojo);
  font-size: 0.78rem;
  font-family: var(--mono);
  text-align: center;
}

.login-back {
  background: none;
  border: none;
  color: var(--text);
  font-size: 0.78rem;
  font-family: var(--mono);
  cursor: pointer;
  align-self: flex-start;
  padding: 0;
  letter-spacing: 0.06em;
}
.login-back:hover { color: var(--text-m); }
```

- [ ] **Step 2: Crear `src/components/LoginScreen.jsx`**

```jsx
import { useState } from 'react'
import sismiaLogo from '../assets/sismia-logo.png'
import { loginAdmin, loginTrabajador, loginMandante, setSession } from '../lib/auth'

const ROLES = [
  { id: 'admin',      label: 'Administrador' },
  { id: 'trabajador', label: 'Trabajador'     },
  { id: 'mandante',   label: 'Mandante'       },
]

export default function LoginScreen({ onLogin }) {
  const [rol, setRol]       = useState(null)
  const [nombre, setNombre] = useState('')
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [cargando, setCargando] = useState(false)

  function volver() { setRol(null); setNombre(''); setPin(''); setError('') }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setCargando(true)
    let session = null
    if (rol === 'admin')      session = await loginAdmin(pin)
    if (rol === 'trabajador') session = await loginTrabajador(nombre.trim(), pin)
    if (rol === 'mandante')   session = await loginMandante(pin)
    setCargando(false)
    if (!session) { setError('PIN incorrecto'); return }
    setSession(session)
    onLogin(session)
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src={sismiaLogo} alt="Sismia" style={{ height: 48, opacity: 0.9 }} />
        <p className="login-title">CONTROL OBRA</p>

        {!rol
          ? (
            <div className="login-roles">
              {ROLES.map(r => (
                <button key={r.id} className="login-rol-btn" onClick={() => setRol(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <>
              <button className="login-back" onClick={volver}>← Volver</button>
              <form className="login-form" onSubmit={handleSubmit}>
                {rol === 'trabajador' && (
                  <input
                    className="login-input"
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                    autoComplete="off"
                  />
                )}
                <input
                  className="login-input"
                  type="password"
                  inputMode="numeric"
                  placeholder="PIN"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  required
                />
                {error && <p className="login-error">{error}</p>}
                <button className="login-submit" type="submit" disabled={cargando}>
                  {cargando ? 'Verificando...' : 'Entrar'}
                </button>
              </form>
            </>
          )
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar compilación**

```bash
npm run dev
```
Abrir http://localhost:5173 — la app todavía no muestra LoginScreen (eso va en Task 4). Verificar que no hay errores en consola.

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginScreen.jsx src/App.css
git commit -m "feat: LoginScreen — selector de rol y formulario de PIN"
```

---

### Task 4: Auth gate en `App.jsx`

**Files:**
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `getSession`, `clearSession` de `./lib/auth`; `LoginScreen`
- Produce: app protegida por login; si sin sesión → LoginScreen; si mandante → placeholder; si trabajador → placeholder

Nota: los roles mandante y trabajador muestran un placeholder en este task; sus vistas reales llegan en Tasks 5 y 6.

- [ ] **Step 1: Agregar imports en `src/App.jsx`**

Agregar después de la línea `import GestionProyectos from './components/GestionProyectos'`:

```js
import { getSession, clearSession } from './lib/auth'
import LoginScreen from './components/LoginScreen'
```

- [ ] **Step 2: Agregar estado de sesión en App()**

Dentro de `export default function App()`, agregar **después** de las líneas `const [tab, setTab]` y `const [obraSeleccionadaId, ...]` y `const [mostrarNueva, ...]`:

```js
const [sessionState, setSessionState] = useState(() => getSession())
```

- [ ] **Step 3: Agregar auth gate**

Agregar **inmediatamente después** de `if (isPreviewRoute) return <ReportePDF />`:

```js
if (!sessionState) return <LoginScreen onLogin={s => setSessionState(s)} />

if (sessionState.rol === 'mandante')
  return <div style={{ padding: 24, color: 'var(--text-h)' }}>Panel Mandante — próximamente</div>

if (sessionState.rol === 'trabajador')
  return <div style={{ padding: 24, color: 'var(--text-h)' }}>Vista Terreno — próximamente</div>
```

- [ ] **Step 4: Verificar en browser**

```bash
npm run dev
```
- Abrir http://localhost:5173 → debe aparecer LoginScreen con tres botones
- Entrar como Administrador con PIN `1234` → debe cargar la app normal
- Recargar → entra directo (sesión guardada)
- En consola: `localStorage.removeItem('co_session')` + F5 → vuelve a LoginScreen
- Entrar como Mandante con cualquier PIN → debe mostrar "Panel Mandante — próximamente"

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: auth gate en App — LoginScreen si sin sesión, despacho por rol"
```

---

### Task 5: `PanelCliente.jsx`

**Files:**
- Create: `src/components/PanelCliente.jsx`
- Modify: `src/App.jsx` (reemplazar placeholder mandante)

**Interfaces:**
- Consumes: `supabase`, `calcDiaActual`, `calcAvanceEsperado`, `calcSemaforo` de `../lib/calculations`, `clearSession` de `../lib/auth`
- Props: `{ obraId: string, onLogout: fn }`

- [ ] **Step 1: Crear `src/components/PanelCliente.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearSession } from '../lib/auth'
import { calcDiaActual, calcAvanceEsperado, calcSemaforo } from '../lib/calculations'

export default function PanelCliente({ obraId, onLogout }) {
  const [obra, setObra]         = useState(null)
  const [partidas, setPartidas] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function cargar() {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from('obras').select('*').eq('id', obraId).single(),
        supabase.from('partidas')
          .select('id, numero, nombre, cuadrilla, dia_ini, dia_fin, avance_pct')
          .eq('obra_id', obraId).order('numero'),
      ])
      setObra(o)
      setPartidas(p || [])
      setLoading(false)
    }
    cargar()
  }, [obraId])

  if (loading) return <div className="loading">Cargando</div>

  const dia          = calcDiaActual(obra.fecha_inicio)
  const diaLabel     = Math.min(Math.max(1, dia), obra.total_dias)
  const avanceGlobal = partidas.length ? partidas.reduce((s, p) => s + (p.avance_pct || 0), 0) / partidas.length : 0
  const avanceEsp    = partidas.length ? partidas.reduce((s, p) => s + calcAvanceEsperado(dia, p.dia_ini, p.dia_fin), 0) / partidas.length : 0
  const sem          = calcSemaforo(avanceGlobal, avanceEsp)

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '28px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <h1 style={{ fontFamily: 'var(--disp)', fontSize: '1.8rem', letterSpacing: '0.06em', color: 'var(--text-h)', lineHeight: 1 }}>
          {obra.nombre.toUpperCase()}
        </h1>
        <button className="btn" onClick={() => { clearSession(); onLogout() }} style={{ flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.75rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 28 }}>
        DÍA {diaLabel} / {obra.total_dias}
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Avance Global
          </span>
          <span className={sem} style={{ fontFamily: 'var(--disp)', fontSize: '2.4rem', lineHeight: 1 }}>
            {avanceGlobal.toFixed(1)}%
          </span>
        </div>
        <div style={{ background: 'var(--s4)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
          <div style={{ background: `var(--${sem})`, height: 8, width: `${avanceGlobal}%`, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Partida</th>
              <th>Cuadrilla</th>
              <th style={{ textAlign: 'right' }}>Avance</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map(p => (
              <tr key={p.id}>
                <td className="m">{p.numero}</td>
                <td>{p.nombre}</td>
                <td style={{ color: 'var(--text)' }}>{p.cuadrilla}</td>
                <td className="m" style={{ textAlign: 'right' }}>{(p.avance_pct || 0).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Conectar en `src/App.jsx`**

Agregar import:
```js
import PanelCliente from './components/PanelCliente'
```

Reemplazar el placeholder de mandante:
```js
// Antes:
if (sessionState.rol === 'mandante')
  return <div style={{ padding: 24, color: 'var(--text-h)' }}>Panel Mandante — próximamente</div>

// Después:
if (sessionState.rol === 'mandante')
  return <PanelCliente obraId={sessionState.obraId} onLogout={() => setSessionState(null)} />
```

- [ ] **Step 3: Configurar PIN de prueba para mandante**

En Supabase SQL Editor:
```sql
UPDATE obras SET pin_cliente = '9999' WHERE nombre = 'Doña Carne Manquehue 1';
```

- [ ] **Step 4: Verificar**

```bash
npm run dev
```
- Entrar como Mandante con PIN `9999`
- Debe mostrar: nombre de obra, día actual/total, avance global con barra de color y semáforo, tabla de partidas sin precios
- Botón Salir → vuelve a LoginScreen

- [ ] **Step 5: Commit**

```bash
git add src/components/PanelCliente.jsx src/App.jsx
git commit -m "feat: PanelCliente — vista de solo lectura para mandante"
```

---

### Task 6: `VistaTerreno.jsx`

**Files:**
- Create: `src/components/VistaTerreno.jsx`
- Modify: `src/App.jsx` (reemplazar placeholder trabajador)

**Interfaces:**
- Consumes: `supabase`, `calcDiaActual` de `../lib/calculations`, `clearSession` de `../lib/auth`
- Props: `{ obraId: string, usuario: Session, onLogout: fn }`

- [ ] **Step 1: Crear `src/components/VistaTerreno.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { clearSession } from '../lib/auth'
import { calcDiaActual } from '../lib/calculations'

async function subirFoto(file, obraId, partidaId) {
  const ext  = file.name.split('.').pop() || 'jpg'
  const path = `${obraId}/${partidaId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('fotos-obra').upload(path, file, { contentType: file.type })
  if (error) throw error
  return supabase.storage.from('fotos-obra').getPublicUrl(path).data.publicUrl
}

export default function VistaTerreno({ obraId, usuario, onLogout }) {
  const [obra, setObra]           = useState(null)
  const [partidas, setPartidas]   = useState([])
  const [avances, setAvances]     = useState({})  // { [id]: number }
  const [fotos, setFotos]         = useState({})  // { [id]: File }
  const [loading, setLoading]     = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado]   = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')

  useEffect(() => {
    async function cargar() {
      const [{ data: o }, { data: p }] = await Promise.all([
        supabase.from('obras').select('id, nombre, fecha_inicio, total_dias').eq('id', obraId).single(),
        supabase.from('partidas')
          .select('id, numero, nombre, cuadrilla, dia_ini, dia_fin, avance_pct')
          .eq('obra_id', obraId).order('numero'),
      ])
      setObra(o)
      setPartidas(p || [])
      setLoading(false)
    }
    cargar()
  }, [obraId])

  function setAvance(id, val) {
    setAvances(prev => ({ ...prev, [id]: Math.min(100, Math.max(0, Number(val) || 0)) }))
  }

  async function guardar() {
    setGuardando(true)
    setErrorGuardar('')
    const diaActual  = calcDiaActual(obra.fecha_inicio)
    const modificadas = partidas.filter(p =>
      avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)
    )

    try {
      for (const partida of modificadas) {
        const nuevoAvance = avances[partida.id]
        let foto_url = null

        if (fotos[partida.id]) {
          try { foto_url = await subirFoto(fotos[partida.id], obraId, partida.id) } catch { /* foto falla silenciosamente */ }
        }

        await supabase.from('partidas').update({ avance_pct: nuevoAvance }).eq('id', partida.id)
        await supabase.from('registros').insert({
          partida_id: partida.id,
          dia_obra:   diaActual,
          avance_pct: nuevoAvance,
          usuario_id: usuario.usuarioId,
          foto_url,
        })
        setPartidas(prev => prev.map(p => p.id === partida.id ? { ...p, avance_pct: nuevoAvance } : p))
      }
      setAvances({})
      setFotos({})
      setGuardado(true)
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      setErrorGuardar('Error al guardar: ' + e.message)
    }
    setGuardando(false)
  }

  const hayModificaciones = partidas.some(p =>
    avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)
  )

  if (loading) return <div className="loading">Cargando</div>

  const dia      = calcDiaActual(obra.fecha_inicio)
  const diaLabel = Math.min(Math.max(1, dia), obra.total_dias)

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 120px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--disp)', fontSize: '1.6rem', letterSpacing: '0.06em', color: 'var(--text-h)', lineHeight: 1, marginBottom: 4 }}>
            {obra.nombre.toUpperCase()}
          </h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '0.68rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {usuario.nombre} · DÍA {diaLabel} / {obra.total_dias}
          </p>
        </div>
        <button className="btn" onClick={() => { clearSession(); onLogout() }} style={{ flexShrink: 0 }}>
          Salir
        </button>
      </div>

      <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 16, marginBottom: 20 }}>
        Actualiza el avance y guarda al terminar
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {partidas.map(p => {
          const avanceActual = avances[p.id] ?? (p.avance_pct || 0)
          const modificada   = avances[p.id] !== undefined && avances[p.id] !== (p.avance_pct || 0)

          return (
            <div key={p.id} className="card" style={{ borderColor: modificada ? 'var(--gold-bdr)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
                    N° {p.numero} · {p.cuadrilla}
                  </p>
                  <p style={{ color: 'var(--text-h)', fontSize: '0.9rem', fontWeight: 500 }}>{p.nombre}</p>
                </div>
                <span style={{ fontFamily: 'var(--disp)', fontSize: '1.6rem', color: modificada ? 'var(--gold)' : 'var(--text-m)', flexShrink: 0, marginLeft: 12 }}>
                  {avanceActual}%
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <input
                  type="range" min="0" max="100" step="5"
                  value={avanceActual}
                  onChange={e => setAvance(p.id, e.target.value)}
                  style={{ flex: 1, accentColor: 'var(--gold)' }}
                />
                <input
                  type="number" min="0" max="100"
                  value={avanceActual}
                  onChange={e => setAvance(p.id, e.target.value)}
                  style={{ width: 56, padding: '5px 8px', borderRadius: 'var(--r)', border: '1px solid var(--border)', background: 'var(--s2)', color: 'var(--text-h)', fontFamily: 'var(--mono)', fontSize: 16, textAlign: 'center' }}
                />
              </div>

              <label style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r)', background: 'var(--s2)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                📷 {fotos[p.id] ? fotos[p.id].name.slice(0, 22) + '…' : 'Foto (opcional)'}
                <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) setFotos(prev => ({ ...prev, [p.id]: e.target.files[0] })) }}
                />
              </label>
            </div>
          )
        })}
      </div>

      {errorGuardar && (
        <p style={{ color: 'var(--rojo)', fontFamily: 'var(--mono)', fontSize: '0.78rem', marginTop: 12 }}>{errorGuardar}</p>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '16px', background: 'var(--s1)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <button
          onClick={guardar}
          disabled={!hayModificaciones || guardando}
          style={{
            padding: '14px 40px',
            borderRadius: 'var(--r)',
            border: 'none',
            background: (!hayModificaciones || guardando) ? 'var(--s3)' : guardado ? 'var(--verde)' : 'var(--gold)',
            color: (!hayModificaciones || guardando) ? 'var(--text)' : '#07080F',
            fontFamily: 'var(--font)',
            fontSize: '0.95rem',
            fontWeight: 700,
            cursor: (!hayModificaciones || guardando) ? 'default' : 'pointer',
            transition: 'all 0.2s',
            minWidth: 200,
          }}
        >
          {guardando ? 'Guardando...' : guardado ? '✓ Guardado' : 'Guardar avances'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Conectar en `src/App.jsx`**

Agregar import:
```js
import VistaTerreno from './components/VistaTerreno'
```

Reemplazar el placeholder de trabajador:
```js
// Antes:
if (sessionState.rol === 'trabajador')
  return <div style={{ padding: 24, color: 'var(--text-h)' }}>Vista Terreno — próximamente</div>

// Después:
if (sessionState.rol === 'trabajador')
  return <VistaTerreno obraId={sessionState.obraId} usuario={sessionState} onLogout={() => setSessionState(null)} />
```

- [ ] **Step 3: Crear trabajador de prueba**

En Supabase SQL Editor:
```sql
INSERT INTO usuarios (nombre, pin_hash, rol, obra_id)
SELECT 'Juan Pérez',
       '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
       'trabajador',
       id
FROM obras LIMIT 1;
```

- [ ] **Step 4: Verificar**

```bash
npm run dev
```
- Entrar como Trabajador, nombre "Juan Pérez", PIN `1234`
- Debe mostrar lista de partidas con slider, input numérico y botón de foto por cada una
- Mover el slider de una partida → el porcentaje cambia y el card resalta en dorado
- Botón "Guardar avances" se activa → pulsar → se pone verde "✓ Guardado"
- Verificar en Supabase: `SELECT * FROM registros ORDER BY created_at DESC LIMIT 5;` debe mostrar filas con `usuario_id` no nulo

- [ ] **Step 5: Commit**

```bash
git add src/components/VistaTerreno.jsx src/App.jsx
git commit -m "feat: VistaTerreno — actualización de avances con foto opcional"
```

---

### Task 7: Gestión de usuarios en `GestionProyectos.jsx`

**Files:**
- Modify: `src/components/GestionProyectos.jsx`

**Interfaces:**
- Consumes: `hashPin` de `../lib/auth`, `supabase`
- Nada nuevo en props — usa `obras` que ya recibe

- [ ] **Step 1: Agregar import de `hashPin`**

En la primera línea de imports de `GestionProyectos.jsx`, agregar:
```js
import { hashPin } from '../lib/auth'
```

- [ ] **Step 2: Agregar nuevo componente `SeccionAccesos` antes de `export default function GestionProyectos`**

```jsx
function SeccionAccesos({ obras }) {
  const [obraId, setObraId]           = useState(null)
  const [trabajadores, setTrabajadores] = useState([])
  const [nuevoNombre, setNuevoNombre]   = useState('')
  const [nuevoPin, setNuevoPin]         = useState('')
  const [pinCliente, setPinCliente]     = useState('')
  const [adminPin, setAdminPin]         = useState('')
  const [adminPinNuevo, setAdminPinNuevo] = useState('')
  const [adminPinConf, setAdminPinConf]   = useState('')
  const [msg, setMsg]     = useState('')
  const [msgAdmin, setMsgAdmin] = useState('')

  async function abrirObra(obra) {
    if (obraId === obra.id) { setObraId(null); return }
    setObraId(obra.id)
    setPinCliente(obra.pin_cliente || '')
    setMsg('')
    const { data } = await supabase.from('usuarios').select('id, nombre').eq('obra_id', obra.id).eq('rol', 'trabajador')
    setTrabajadores(data || [])
  }

  async function crearTrabajador() {
    if (!nuevoNombre.trim() || nuevoPin.length < 4) { setMsg('Nombre y PIN mínimo 4 dígitos'); return }
    const pin_hash = await hashPin(nuevoPin)
    const { error } = await supabase.from('usuarios').insert({ nombre: nuevoNombre.trim(), pin_hash, rol: 'trabajador', obra_id: obraId })
    if (error) { setMsg('Error: ' + error.message); return }
    const { data } = await supabase.from('usuarios').select('id, nombre').eq('obra_id', obraId).eq('rol', 'trabajador')
    setTrabajadores(data || [])
    setNuevoNombre(''); setNuevoPin(''); setMsg('Trabajador creado')
  }

  async function borrarTrabajador(id) {
    await supabase.from('usuarios').delete().eq('id', id)
    setTrabajadores(prev => prev.filter(t => t.id !== id))
  }

  async function guardarPinCliente() {
    if (!pinCliente.trim()) { setMsg('Ingresa un PIN'); return }
    const { error } = await supabase.from('obras').update({ pin_cliente: pinCliente }).eq('id', obraId)
    setMsg(error ? 'Error: ' + error.message : 'PIN mandante guardado')
  }

  async function cambiarPinAdmin() {
    if (adminPinNuevo.length < 4) { setMsgAdmin('PIN mínimo 4 dígitos'); return }
    if (adminPinNuevo !== adminPinConf) { setMsgAdmin('Los PINs no coinciden'); return }
    const hashActual = await hashPin(adminPin)
    const { data } = await supabase.from('usuarios').select('id').eq('rol', 'admin').eq('pin_hash', hashActual).single()
    if (!data) { setMsgAdmin('PIN actual incorrecto'); return }
    const nuevoHash = await hashPin(adminPinNuevo)
    await supabase.from('usuarios').update({ pin_hash: nuevoHash }).eq('rol', 'admin')
    setAdminPin(''); setAdminPinNuevo(''); setAdminPinConf('')
    setMsgAdmin('PIN de administrador actualizado')
  }

  const inStyle = { padding: '8px 12px', borderRadius: 'var(--r)', background: 'var(--s2)', border: '1px solid var(--border)', color: 'var(--text-h)', fontSize: 16, fontFamily: 'var(--font)', boxSizing: 'border-box', width: '100%' }

  return (
    <div style={{ marginTop: 40 }}>
      <h2 style={{ marginBottom: 16 }}>ACCESOS</h2>

      {obras.map(obra => (
        <div key={obra.id} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-h)', fontWeight: 500 }}>{obra.nombre}</span>
            <button className="btn" onClick={() => abrirObra(obra)}>
              {obraId === obra.id ? 'Cerrar' : 'Gestionar'}
            </button>
          </div>

          {obraId === obra.id && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* PIN mandante */}
              <div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>PIN Mandante</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...inStyle, maxWidth: 180 }} placeholder="PIN para el mandante" value={pinCliente} onChange={e => setPinCliente(e.target.value)} />
                  <button className="btn btn-gold" onClick={guardarPinCliente}>Guardar</button>
                </div>
              </div>

              {/* Trabajadores */}
              <div>
                <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Trabajadores</p>
                {trabajadores.length === 0
                  ? <p style={{ color: 'var(--text)', fontSize: '0.82rem', marginBottom: 8 }}>Sin trabajadores asignados</p>
                  : trabajadores.map(t => (
                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-h)' }}>{t.nombre}</span>
                      <button className="btn" onClick={() => borrarTrabajador(t.id)} style={{ color: 'var(--rojo)', borderColor: 'var(--rojo-bdr)', fontSize: '0.72rem' }}>Eliminar</button>
                    </div>
                  ))
                }
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <input style={{ ...inStyle, flex: 1 }} placeholder="Nombre" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
                  <input style={{ ...inStyle, width: 90, flex: 'none' }} type="password" inputMode="numeric" placeholder="PIN" value={nuevoPin} onChange={e => setNuevoPin(e.target.value)} />
                  <button className="btn btn-gold" onClick={crearTrabajador}>Agregar</button>
                </div>
              </div>

              {msg && <p style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontSize: '0.72rem' }}>{msg}</p>}
            </div>
          )}
        </div>
      ))}

      {/* Cambiar PIN admin */}
      <div className="card" style={{ marginTop: 24 }}>
        <p style={{ fontFamily: 'var(--mono)', fontSize: '0.6rem', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
          Cambiar PIN Administrador
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 280 }}>
          <input style={inStyle} type="password" inputMode="numeric" placeholder="PIN actual" value={adminPin} onChange={e => setAdminPin(e.target.value)} />
          <input style={inStyle} type="password" inputMode="numeric" placeholder="PIN nuevo" value={adminPinNuevo} onChange={e => setAdminPinNuevo(e.target.value)} />
          <input style={inStyle} type="password" inputMode="numeric" placeholder="Confirmar PIN nuevo" value={adminPinConf} onChange={e => setAdminPinConf(e.target.value)} />
          <button className="btn btn-gold" onClick={cambiarPinAdmin}>Cambiar PIN</button>
        </div>
        {msgAdmin && <p style={{ color: 'var(--gold)', fontFamily: 'var(--mono)', fontSize: '0.72rem', marginTop: 10 }}>{msgAdmin}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Usar `SeccionAccesos` en el componente principal**

En `export default function GestionProyectos`, agregar al final del JSX, justo antes del `</div>` de cierre del return:

```jsx
<SeccionAccesos obras={obras} />
```

- [ ] **Step 4: Verificar**

```bash
npm run dev
```
- Entrar como Admin → ir a tab Proyectos
- Al fondo debe aparecer sección "ACCESOS"
- Abrir "Gestionar" en una obra → sección se expande
- Crear un trabajador (nombre + PIN) → aparece en la lista
- Eliminar un trabajador → desaparece de la lista
- Guardar PIN mandante → mensaje "PIN mandante guardado"
- Cambiar PIN admin → requiere PIN actual correcto y PINs nuevos coincidentes → cerrar sesión y volver a entrar con el nuevo PIN para confirmar

- [ ] **Step 5: Commit**

```bash
git add src/components/GestionProyectos.jsx
git commit -m "feat: gestión de trabajadores y PINs de acceso desde Proyectos"
```

---

### Task 8: Tests finales + deploy

**Files:** ninguno nuevo

- [ ] **Step 1: Correr todos los tests**

```bash
npx vitest run
```
Esperado: todos PASS (incluyendo los tests existentes de importar y calculations)

- [ ] **Step 2: Build de producción**

```bash
npm run build
```
Esperado: sin errores, genera `dist/`

- [ ] **Step 3: Push a producción**

```bash
git push origin main
```
Vercel detecta el push y despliega automáticamente en https://control-obra-nine.vercel.app

- [ ] **Step 4: Verificar en producción**

- Abrir https://control-obra-nine.vercel.app → debe aparecer LoginScreen
- Login Admin PIN `1234` → app funciona igual que antes
- Login Mandante PIN `9999` → PanelCliente visible con datos reales
- Login Trabajador "Juan Pérez" PIN `1234` → VistaTerreno, guardar un avance
- Ir a Proyectos → crear un trabajador nuevo, cambiar PIN mandante

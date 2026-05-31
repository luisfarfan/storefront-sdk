---
name: debug-storefront
description: >
  Diagnosticar y arreglar problemas en un storefront Proxima. Usar cuando: "la página
  X no funciona", "se ve mal", "[object Object]", "la página está vacía", "no muestra
  productos", "el carrito da error", "no puedo agregar al carrito", "500 en X", "el
  menú muestra categorías incorrectas", "no se ven las imágenes", "login no funciona",
  "las cookies no sirven", "el storefront muestra el demo en vez del comercio", "data
  desactualizada", "no se reflejan los cambios". Triage sistemático síntoma → causa → fix.
---

# Skill: debug-storefront

Triage de problemas en un storefront Proxima (apps Astro que consumen la API). Patrón
**síntoma → verificación → root cause → fix**. Este skill es autocontenido: los ~10
patrones de mayor frecuencia están embebidos abajo con sus comandos de diagnóstico.

> **Regla de oro:** verificá el root cause **antes** de tocar código. El mismo síntoma
> (página vacía) tiene 3 causas distintas (prerender / datos / cache). Un fix aplicado a
> la causa equivocada agrega ruido sin resolver. Ejecutá el comando de verificación primero.

Reemplazá en los comandos: `<WID>` = website_id, `<BIZ>` = business_id, `<slug>` = nombre
de la app, `<PORT>` = puerto del dev server. La API local corre en `http://localhost:8000`.

---

## Cómo uso esta skill

1. **Clasifico el síntoma** con la tabla de abajo.
2. **Ejecuto el diagnóstico** (el comando de verificación) para confirmar el root cause.
3. **Aplico el fix** del patrón.
4. **Verifico** que se resolvió, incluyendo flush de cache si aplica.

---

## Clasificador de síntomas

| Síntoma | Patrón |
|---------|--------|
| `[object Object]` en el texto | §1 |
| Página `/categoria/<slug>` o `/marca/<slug>` vacía (200) | §2 |
| Cart `422 NOT_STOREFRONT_SELLABLE` con stock > 0 | §3 |
| `POST /api/buyer/cart/add` → 500 `server_error` | §4 |
| Productos sin imágenes (solo glyphs / placeholders) | §5 |
| `422 CAPTCHA_REQUIRED` en login/register | §6 |
| `403 Token missing required scope` | §7 |
| Cambio admin no se refleja (data desactualizada) | §8 |
| Set-Cookie viene pero el browser no guarda (localhost) | §9 |
| Ruta `[slug]` prerendereada queda vacía (página en blanco) | §10 |

---

## §1 — `[object Object]` en el render

**Síntoma:** un texto que debería ser localizado renderea literal `[object Object]`.

**Verificar:**
```bash
curl -s "http://localhost:8000/api/v1/storefront/cms/websites/<WID>/pages/composition?path=/&locale=es&business_id=<BIZ>" \
  -H "X-Business-ID: <BIZ>" | python -m json.tool | grep -A2 '"es"'
```
Si ves `{"es": "..."}` crudo dentro de items de un `array` o de un `object` anidado → la
composición no está desenvolviendo el wrapper localizable en recursiones profundas.

**Root cause:** la Composition API desenvuelve `{ "es": "..." }` en el nivel top pero no
recursivamente dentro de atributos `array`/`object`.

**Fix:**
- Si el bug es del **storefront** (mapper/render): el componente está pintando el objeto sin
  elegir el locale. Resolvé `value.es ?? value[fallbackLocale]` antes de renderizar.
- Si es de la **API** (`composition_attribute_resolution.py`): pasar `locale_candidates` en
  **todas** las recursiones object+array, no solo en el top level.

---

## §2 — Página de categoría/marca vacía (200)

**Síntoma:** `/categoria/<slug>` responde 200 pero sin productos.

**Verificar:**
```bash
curl -s "http://localhost:8000/api/v1/storefront/categories/<slug>/products?page_size=24" \
  -H "X-Business-ID: <BIZ>" | python -c "import json,sys; print('items:', len(json.load(sys.stdin)['items']))"
```

**Root cause + fix según el resultado:**
- `items > 0` pero la página vacía → bug del storefront, casi siempre `prerender=true` en
  `[slug].astro` dejando `Astro.params.slug = ""`. **Fix:** `export const prerender = false`
  en la ruta dinámica (ver §10).
- `items = 0` → la categoría no tiene productos linkeados. **No es bug de código** — falta
  seed. Ver skill `seed-merchant-catalog`.

---

## §3 — Cart 422 NOT_STOREFRONT_SELLABLE con stock > 0

**Síntoma:** agregar al carrito falla con 422 aunque el producto tiene stock.

**Verificar:**
```bash
SESSION=$(uuidgen)
curl -s -X POST "http://localhost:8000/api/v1/cart/items" \
  -H "X-Business-ID: <BIZ>" -H "Content-Type: application/json" -H "X-Session-ID: $SESSION" \
  -d '{"product_variant_id": <ID>, "quantity": 1}'
# {"detail":{"code":"NOT_STOREFRONT_SELLABLE","missing_fields":["stock"]}}
```

**Root cause:** falta una row en `inventory_balances` para esa variante (inventory v2 gate).
El stock "legacy" del producto no cuenta; la sellability mira `inventory_balances`.

**Fix:** backfill de `inventory_balances` para las variantes. Ver skill `seed-merchant-catalog`
para el backfill. `missing_fields` te dice qué falta (`stock`, `price`, etc.).

---

## §4 — POST cart → 500 server_error (sin detalle)

**Síntoma:** `POST /api/buyer/cart/add` (o cualquier ruta) devuelve 500 `server_error`
genérico, sin pista del error real.

**Root cause:** el `catch` del handler está colapsando el error real en un 500 genérico.

**Fix:** agregá logging al catch para ver el error real antes de seguir:
```ts
} catch (err) {
  console.error("[ruta] failed", {
    error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5).join(" | ") : undefined,
  });
  // ...
}
```
Después de ver el error real, routeá al patrón específico: `Request failed: 422` → §3
(sellability), `401` → token de buyer, `403` → §7 (scope).

> Gotchas relacionados de cart: usá **form-encoded**, no JSON, en las rutas `/api/buyer/cart/*`
> (un JSON body produce `500 TypeError`). Para cross-site POST puede faltar el header `Origin`
> (`403 Cross-site POST`). Guest checkout necesita `cart_session_id`.

---

## §5 — Productos sin imágenes

**Síntoma:** las cards muestran un glyph/placeholder en vez de la foto del producto.

**Verificar:**
```bash
curl -s "http://localhost:8000/api/v1/storefront/products?page_size=4" \
  -H "X-Business-ID: <BIZ>" | python -m json.tool | grep -iE "image|imageUrl|media"
```

**Root cause (dos variantes):**
1. El componente `ProductImage` ignora el campo que trae la API (ej. lee `p.image` cuando la
   API manda `p.imageUrl`).
2. Mismatch de forma: el mapper espera un **objeto** `{ url }` pero la API manda un **string**
   (o viceversa).

**Fix:** alineá el mapper/componente con la forma real del payload (mirala con el curl). Si la
API no trae ninguna URL → los productos no tienen media subida (seed), no es bug de render.

---

## §6 — 422 CAPTCHA_REQUIRED en login/register

**Síntoma:** login o register devuelve `422 CAPTCHA_REQUIRED`.

**Root cause:** `TURNSTILE_ENABLED=true` en el entorno, pero el form no manda el token de
Turnstile.

**Fix:**
- En dev: setear `TURNSTILE_ENABLED=false` en el `.env` de la API/storefront para saltar el captcha.
- En prod: el form debe renderizar el widget de Turnstile y enviar el token en el payload.

---

## §7 — 403 Token missing required scope

**Síntoma:** un fetch a la API devuelve `403 Token missing required scope`.

**Root cause:** el service account token usado por el storefront no tiene el scope necesario
(`storefront:read` / `composition:read` para lecturas públicas; `cms:websites:write` para deploy).

**Verificar/Fix:** revisá los scopes del token. El storefront en runtime solo necesita lecturas
(`storefront:read`, `composition:read`). Si falta, regenerá el token con los scopes correctos
(`POST /api/v1/admin/developer/service-accounts/{id}/tokens`) y actualizá la env var.

---

## §8 — Cambio admin no se refleja (cache stale)

**Síntoma:** editaste algo en el Admin/Builder (o vía API) y el storefront sigue mostrando lo viejo.

**Root cause (en orden de probabilidad):**
1. **Cache Redis** de composición/storefront (`cms:comp:*`, `cms:*`, `sf:*`).
2. **Cache in-memory** del dev server (`websiteCache`) — una mutación API no invalida la memoria del proceso.
3. **Vite HMR** no recargó un `.ts`.

**Fix (de menos a más agresivo):**
```bash
# 1. Flush Redis
redis-cli --scan --pattern "cms:*" | xargs -r redis-cli del
redis-cli --scan --pattern "sf:*"  | xargs -r redis-cli del

# 2/3. Reiniciar el dev server (limpia cache in-memory + fuerza recompilación Vite)
pkill -f "astro dev --port <PORT>"
cd apps/<slug> && npm run dev -- --host 127.0.0.1
```
Si un `console.error` nuevo no aparece en logs → Vite no recargó; touch el archivo o reiniciá.

---

## §9 — Set-Cookie viene pero el browser no guarda (localhost)

**Síntoma:** el login responde con `Set-Cookie` pero la sesión no persiste; el siguiente request
llega sin cookie (`customer_id: null`).

**Root cause (en localhost):**
- Cookie con flag `Secure` servida sobre **http** → el browser la descarta.
- `Domain=` que no matchea el host real (`localhost` vs `127.0.0.1`).

**Verificar:**
```bash
# La sesión por curl necesita cookie jar
curl -c /tmp/cj.txt -b /tmp/cj.txt -s -X POST "http://localhost:<PORT>/api/buyer/login" ...
```
Si curl **sí** mantiene sesión con `--cookie-jar`/`--cookie` pero el browser no → es flag de cookie.

**Fix:**
- En dev sobre http: la cookie de buyer **no** debe llevar `Secure`. Verificá la config de cookies del entorno.
- Usá **un solo** host de forma consistente (todo `localhost` o todo `127.0.0.1`), no los mezcles.
- Confirmá `BUYER_COOKIE_NAME === "buyer_token"` (el middleware lee ese nombre exacto).

---

## §10 — Ruta `[slug]` prerendereada queda vacía (página en blanco)

**Síntoma:** una ruta dinámica `[slug].astro` responde 200 pero la página está en blanco; el
slug que probás existe en el catálogo.

**Root cause:** la ruta tiene `export const prerender = true` (a veces con `getStaticPaths()`
leyendo fixtures). En SSG, `Astro.params.slug` queda `""` → la sección no encuentra la entidad →
página vacía. Los slugs son del catálogo del merchant, no del build.

**Verificar:** abrí la ruta `.astro` y mirá el valor de `prerender`. Confirmá con un log:
```astro
console.log("slug:", Astro.params.slug, "mode:", Astro.locals.catalogSource?.mode);
```
Si `slug` sale vacío en una ruta dinámica → es esto.

**Fix:** `export const prerender = false` en **toda** ruta `[slug]` de merchant. Así
`Astro.params.slug` y `Astro.locals.catalogSource` per-request quedan poblados. (Ver skill `add-page`,
Decisión 2.)

---

## Herramientas de diagnóstico

```bash
# Logs del dev server (ver errores SSR)
tail -30 /tmp/<slug>-dev.log | grep -iE "error|fail"

# Flush de cache (cuando los cambios no se reflejan)
redis-cli --scan --pattern "cms:*" | xargs -r redis-cli del
redis-cli --scan --pattern "sf:*"  | xargs -r redis-cli del

# Reiniciar dev (cache in-memory o Vite no toma cambios)
pkill -f "astro dev --port <PORT>"
cd apps/<slug> && npm run dev -- --host 127.0.0.1
```

---

## Heurísticas (cuando ningún patrón matchea exacto)

1. **Página 200 pero vacía** → log `Astro.params`, `Astro.locals.catalogSource?.mode`, y el
   lookup que debería traer el dato. Identificá dónde se pierde (§2, §10).
2. **API correcta en curl pero storefront no la ve** → el SDK pega al endpoint equivocado o el
   mapper descarta items. Log antes/después del fetch en la live-source.
3. **Funciona en demo pero no en live** → algún componente importa fixtures directo en vez de
   leer `Astro.locals.catalogSource`. `grep -rn "fixture-catalog" src/`.
4. **Mutación admin no se refleja** → cache (§8). Flush + reiniciar.
5. **`console.error` nuevo no aparece** → Vite no recargó. Touch el archivo o reiniciar.
6. **Cart `customer_id` null con cookie presente** → middleware no corre o cookie name mal (§9).
   Verificá `BUYER_COOKIE_NAME === "buyer_token"`.

---

## Cuándo escalar a otra skill

| Si el problema es… | Usar skill |
|---|---|
| Falta catálogo / inventory del comercio | `seed-merchant-catalog` |
| Falta una página | `add-page` |
| Falta/rota una smart collection | `add-smart-collection` |
| Falta una sección o el Builder no la muestra | `add-section` / `wire-cms-sections` |
| Crear el website del comercio desde un template | `new-merchant-website` |
| Crear un app Astro nuevo (código) | `new-storefront-app` |

> Si trabajás dentro del monorepo Proxima, hay un catálogo más completo (~25 patrones) en
> `proxima-storefronts/docs/debugging.md`, más `docs/architecture.md` (cómo debería funcionar),
> `docs/pages.md` (implementación por página) y `docs/sdk-helpers.md`. Si instalaste este skill
> via `proxima skills install`, este skill es autocontenido y cubre los patrones de alta frecuencia.

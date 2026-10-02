# AGENTS.md — Finanzas Personales (PWA 100% local)

PWA estática. Sin backend, sin framework, sin build, sin package.json, sin test runner.

## Ejecución
- Servir por HTTP (el Service Worker falla con `file://`):
  `python3 -m http.server 8765` → `http://localhost:8765/index.html`
- No se requiere ni se espera `node`/`npm`.

## Estructura
- `index.html` — único punto de entrada; el orden de scripts importa: `vendor-chart.umd.min.js` antes de `app.js`, luego el registro del SW.
- `app.js` — toda la lógica (estado, validación, render, backup). Clave: `STORAGE_KEY='finanzas_movimientos_v1'`.
- `sw.js` — caché offline-first. `CACHE='finanzas-v2'` + lista `ASSETS[]` del shell.
- `manifest.webmanifest` — `start_url: ./index.html`, iconos `icon-192.png` / `icon-512.png` / `icon.svg`.
- `vendor-chart.umd.min.js` — Chart.js 4.4.1 vendorizado. Nunca reemplazar por CDN; offline es requisito.

## Reglas que rompen cosas
- Mantener todas las URLs de assets relativas (`./`). Las absolutas `/` rompen el scope del manifest + SW al servir desde subruta.
- Ante cualquier cambio en `index.html`/`styles.css`/`app.js`/`vendor-chart.umd.min.js`/`manifest`/`icon.svg`: subir la versión de `CACHE` en `sw.js` o los clientes quedan con shell viejo.
- Archivo nuevo cacheable → agregarlo también a `ASSETS[]`.
- Forma de datos fija: `{id:string, tipo:'ingreso'|'gasto', monto:number>0, detalle:string no vacío, fecha:'YYYY-MM-DD'}`. `monto` siempre positivo; el signo se aplica solo al renderizar (`ing - gas`). Validar imports con `isValidMovimiento` antes de sobrescribir `localStorage`.
- Colores del gráfico por especificación: ingresos `#22c55e`, gastos `#ef4444`. Tipo dona.
- Editar/borrar no tiene restricción de tiempo por diseño; los `confirm()` de borrar/limpiar/reemplazar por import deben mantenerse.

## Verificación (no hay suite; hacer esto)
- `curl -s -o /dev/null -w "%{http_code}\n" localhost:8765/{index.html,app.js,vendor-chart.umd.min.js,sw.js,manifest.webmanifest}` — todos 200.
- Guardas con grep: sin `cdn.jsdelivr`/`unpkg` en `index.html`/`app.js`; `caches.match` + `skipWaiting` en `sw.js`.

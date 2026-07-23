# TrivoxChat Widget

Widget de chat web embebible construido con **Vanilla JS + Web Components**. Se integra en cualquier sitio con una sola etiqueta `<script>` y ofrece mensajería en tiempo real (Socket.IO), captura de leads, formulario pre-chat, encuesta de satisfacción (CSAT), envío de archivos y persistencia de sesión — todo aislado del sitio anfitrión mediante **Shadow DOM**.

> Sin dependencias en tiempo de ejecución. El widget se distribuye como un único bundle estático (`dist/widget.min.js`) que pesa poco y no interfiere con el CSS ni el DOM de la página donde se incrusta.

---

## Características

- 🧩 **Web Component aislado** — Custom Element `<chat-platform-widget>` con Shadow DOM; ni el CSS del sitio afecta al widget ni viceversa.
- 💬 **Mensajería en tiempo real** — Cliente Socket.IO cargado de forma diferida (solo al abrir el chat). Eventos de `new:message`, `typing:start/stop`, asignación y resolución de conversación.
- 🔁 **Reconexión automática** — Reintentos infinitos con backoff, re-unión a la sala de conversación tras reconectar y reenvío de mensajes pendientes.
- ⚡ **Mensajes optimistas** — El mensaje del visitante aparece de inmediato y se confirma/elimina según la respuesta del backend.
- 🕵️ **Detección de leads** — Analiza el texto del visitante para extraer automáticamente **email**, **teléfono** y **nombre** y los envía al backend.
- 📝 **Formulario pre-chat** — Recopila teléfono, correo e identificación antes de iniciar (configurable por workspace).
- ⭐ **Encuesta CSAT** — Al resolverse una conversación se muestra una encuesta de 1 a 5 estrellas con comentario opcional.
- 📎 **Adjuntos** — Subida de imágenes y documentos (`image/*`, `.pdf`, `.doc`, `.docx`).
- 🔔 **Contador de no leídos** — Badge animado en el botón lanzador cuando llegan mensajes con el panel cerrado.
- 💾 **Sesión persistente** — `session_id`, conversación, contacto y últimos 50 mensajes se guardan en `localStorage` (con prefijo por workspace).
- 🎨 **Personalizable** — Color primario, posición (izquierda/derecha), tamaño del lanzador, radio de bordes, tipografía y logo, todo desde la configuración remota del workspace.
- 🌙 **Modo oscuro** y diseño **responsive** (pantalla completa en móvil).
- 🌐 **API pública en JavaScript** — `window.ChatWidget` para controlar el widget desde el sitio anfitrión.

---

## Instalación / Embebido

Agrega esta etiqueta antes de cerrar `</body>` en tu sitio:

```html
<script
  src="https://tu-cdn.com/widget.min.js"
  data-workspace="tu-workspace-slug">
</script>
```

El widget se auto-inicializa leyendo el atributo `data-workspace` del `<script>`. Con eso carga la configuración del workspace desde el backend y monta el botón lanzador en la esquina inferior derecha.

### Inicialización manual (opcional)

También puedes inicializarlo por código en lugar de por atributo:

```html
<script src="https://tu-cdn.com/widget.min.js"></script>
<script>
  TrivoxWidget.init({
    workspace: 'tu-workspace-slug',
    position: 'left',      // opcional: 'left' | (por defecto derecha)
    color: '#4F46E5',      // opcional: color primario
  });
</script>
```

---

## API pública (`window.ChatWidget`)

Una vez inicializado, el objeto global `window.ChatWidget` queda disponible:

| Método | Descripción |
|---|---|
| `ChatWidget.open()` | Abre el panel de chat. |
| `ChatWidget.close()` | Cierra el panel. |
| `ChatWidget.toggle()` | Alterna abierto/cerrado. |
| `ChatWidget.identify(data)` | Asocia datos del visitante: `{ name, email, phone }`. |
| `ChatWidget.sendMessage(text)` | Envía un mensaje mediante programación. |
| `ChatWidget.on(event, cb)` | Se suscribe a eventos internos del widget (devuelve función para desuscribirse). |
| `ChatWidget.destroy()` | Desconecta el socket y elimina el widget del DOM. |
| `ChatWidget.isOpen` | Getter booleano — indica si el panel está abierto. |

Ejemplo:

```js
ChatWidget.identify({ name: 'Carlos', email: 'carlos@demo.com' });
ChatWidget.on('message:received', ({ message }) => console.log('Nuevo mensaje', message));
ChatWidget.open();
```

---

## Arquitectura

El widget separa **lógica** (sin UI) de **presentación** (Web Components).

```
src/
├── index.js                 # Punto de entrada: lee data-workspace y arranca el widget
├── core.js                  # "Cerebro": máquina de estados + coordinador (Session, Api, Socket, LeadDetector)
├── session.js               # Identidad persistente del visitante (localStorage)
├── config.js                # Carga y cachea la configuración del workspace
│
├── services/
│   ├── api.js               # Wrapper de fetch con reintentos hacia el backend
│   ├── socket.js            # Cliente Socket.IO (carga diferida de la librería)
│   └── lead-detector.js     # Detección de email / teléfono / nombre en el texto
│
├── components/              # Custom Elements y vistas (Shadow DOM)
│   ├── widget-root.js       # <chat-platform-widget>: raíz, CSS aislado, une Core + UI
│   ├── launcher-button.js   # Botón flotante con badge de no leídos
│   ├── chat-panel.js        # Panel: home, pre-chat, chat, encuesta
│   ├── message-list.js      # Lista de mensajes + quick replies
│   ├── message-bubble.js    # Burbuja individual (texto, imagen, archivo)
│   ├── message-input.js     # Textarea con autoexpansión, adjuntos y envío
│   └── typing-indicator.js  # Indicador "escribiendo…"
│
├── utils/
│   ├── format.js            # Formato de tiempo relativo, tamaños, linkify
│   └── patterns.js          # Expresiones regulares para detección de leads
│
└── styles/                  # CSS base y temas (light / dark)
```

### Máquina de estados (`core.js`)

El `Core` coordina todo sin renderizar y expone eventos que la UI escucha. Estados posibles:

`UNINITIALIZED · LOADING · IDLE · OPEN · CONNECTING · RECONNECTING · UPLOADING · RECORDING · ERROR`

### Persistencia de sesión (`session.js`)

Cada visitante recibe un `session_id` (UUID) guardado en `localStorage` con prefijo `trivox_<workspaceId>_`. Se persisten: conversación activa, contacto, estado abierto/cerrado, contador de no leídos, caché de los últimos 50 mensajes, encuesta pendiente y datos del formulario pre-chat. Al resolverse una conversación se genera un nuevo `session_id` para que el siguiente visitante sea un contacto distinto.

---

## Backend / API

El widget se comunica con un backend HTTP + WebSocket. La URL se inyecta **en tiempo de build** (`__BACKEND_URL__`). Todas las peticiones incluyen la cabecera `x-session-id` y se reintentan hasta 3 veces ante errores de servidor (5xx).

Endpoints consumidos:

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/widget/config/:slug` | Configuración del workspace (colores, textos, formularios). |
| `POST` | `/widget/conversations` | Crear una conversación. |
| `GET` | `/widget/conversations/:id/messages` | Historial de mensajes. |
| `POST` | `/widget/messages` | Enviar un mensaje de texto. |
| `POST` | `/widget/messages/upload` | Subir un archivo (multipart). |
| `POST` | `/widget/messages/read` | Marcar como leído. |
| `POST` | `/widget/survey` | Enviar la encuesta CSAT. |
| `PATCH` | `/widget/contacts/:sessionId` | Actualizar datos del contacto (leads detectados). |

WebSocket: namespace `/widget`, autenticado solo con `session_id`.

---

## Desarrollo

### Requisitos

- Node.js
- El bundle se genera con [Rollup](https://rollupjs.org/).

### Scripts (`package.json`)

| Comando | Descripción |
|---|---|
| `npm run build` | Genera `dist/` apuntando al backend local (`http://localhost:4000`). |
| `npm run dev` | Igual que `build` en modo `--watch`. |
| `npm run build:prod` | Build de producción minificado (`NODE_ENV=production`). |
| `npm run mock` | Arranca el servidor mock de demo en `http://localhost:3099`. |
| `npm run demo` | Build en modo watch para trabajar con el demo. |

### Salidas del build (`dist/`)

- `widget.min.js` — formato **IIFE** (global `TrivoxWidget`), con sourcemap. Minificado solo en producción.
- `widget.esm.js` — formato **ES Module**, con sourcemap.

La URL del backend se controla con la variable de entorno `BACKEND_URL` en tiempo de build (por defecto `https://backend.chat.nexoradeveloper.com`).

---

## Demo local

El proyecto incluye una página de demostración y un **servidor mock** que simula el backend (sin necesidad del backend real):

```bash
npm run build      # genera dist/
npm run mock       # levanta el mock en http://localhost:3099
```

Luego abre en el navegador:

```
http://localhost:3099/demo/index.html
```

- `demo/index.html` — sitio de ejemplo ("Nordex Solutions") con el widget integrado y botones para probar `open()` e `identify()`.
- `demo/mock-server.cjs` — servidor HTTP en el puerto **3099** que responde configuración, conversaciones, mensajes (con respuestas de bot simuladas), subida de archivos y un stub de Socket.IO.

---

## Despliegue

Como el widget es un bundle estático, basta con servir `dist/widget.min.js` desde un CDN o servidor de archivos y referenciarlo con la etiqueta `<script>`. El archivo `ecosystem.config.js` (PM2) se incluye únicamente para regenerar el build en producción cuando sea necesario.

# 🎵 Impostor Musical 🕵️‍♀️

Un juego de fiesta tipo "el impostor" con dos modos:

- **Impostor Musical**: los civiles reciben la misma canción y los impostores
  no reciben ninguna. Cada uno baila su canción con auriculares y el grupo
  tiene que adivinar quién está fingiendo.
- **Impostor Clásico**: los civiles reciben la misma palabra y los impostores
  reciben una pista ambigua relacionada con ella.

🌐 **Jugar online**: <https://jdslearning.github.io/impostor/>

La app es 100 % web estática (HTML + CSS + JS), sin backend ni dependencias.
Funciona perfectamente en el móvil y se puede añadir a la pantalla de inicio
como aplicación.

---

## 🕹️ Cómo se juega

Necesitas:
- Un solo móvil (lo iréis pasando entre los jugadores).
- Que cada jugador tenga su propio móvil con auriculares y acceso a
  Spotify, YouTube o cualquier reproductor de música.
- 3 jugadores como mínimo, ideal de 5 a 10.

### 1. Configuración
1. Abre la app en el móvil "del director del juego".
2. Pulsa el título para alternar entre **Impostor Musical** e
   **Impostor Clásico**.
3. Indica:
   - **Número de jugadores** (3–20).
   - **Número de impostores** (te muestra la cifra recomendada según el
     tamaño del grupo).
   - **Duración de la ronda** en segundos. En modo clásico se calcula por
     defecto a 30 segundos por jugador.
   - En modo clásico, si los impostores reciben o no una pista ambigua.
   - **Nombres** de los participantes.
4. Pulsa **Empezar partida**.

### 2. Reparto de roles (pasar el móvil)
La app va indicando a quién le toca con un mensaje "Pasa el móvil a …".
Cuando recibas el móvil:
1. Pulsa **Soy yo, dame el móvil**.
2. Toca tu nombre en la tarjeta morada: **gira y muestra tu secreto**.
   - Si eres **civil**, ves la **canción secreta** (título, artista y emoji).
   - Si eres **impostor**, ves "🤫 Eres el impostor".
3. Memorízalo y vuelve a tocar la tarjeta para ocultarlo.
4. Pulsa **Siguiente jugador** y pasa el móvil al siguiente.

> El botón "Siguiente" solo se activa después de tocar dos veces (ver y
> esconder). Así nadie ve por accidente la canción del anterior.

### 3. Pista de baile (temporizador)
Cuando todos hayan visto su rol:
1. Cada jugador busca **su** canción en su móvil y se pone los auriculares.
   - Los **civiles** buscan exactamente la canción secreta que les ha tocado.
   - Los **impostores** ponen lo que quieran (otra canción cualquiera) e
     intentan disimular.
2. Pulsa **Empezar a bailar**: arranca un temporizador (1 minuto por
   defecto).
3. Todos bailan a la vez. ¡Observa al resto! ¿Quién no parece seguir el
   ritmo, o se mueve al ritmo equivocado?

En el modo clásico, la pantalla de tiempo elige al azar quién empieza hablando.

Botones disponibles durante la ronda:
- **Pausar / Reanudar**.
- **Saltar a votación**.

### 4. Acusaciones
Cuando termina el tiempo (o pulsáis "saltar a votación"):
1. Discutid en grupo a quién creéis que es impostor.
2. En la app aparecen los jugadores vivos en una rejilla. Pulsad sobre el
   acusado.
3. La app revela si esa persona era **civil** o **impostor**, y queda
   eliminada.
4. Pulsad **Continuar**.

### 5. Siguientes rondas y final
- Si quedan impostores vivos y suficientes civiles, vuelve a empezar otra
  ronda de baile.
- **Ganan los civiles** cuando todos los impostores han sido eliminados.
- **Ganan los impostores** cuando igualan o superan en número a los civiles
  vivos.

Al terminar verás un resumen con la canción secreta y el destino de cada
jugador. Puedes:
- **Jugar otra vez** (mismos jugadores, nuevos roles y canción).
- **Configurar nueva partida** desde cero.

---

## 🎵 Editor de canciones

La app trae canciones bailables por defecto (en `songs.txt`) y palabras con
pistas ambiguas para el modo clásico (en `words.txt`). Si quieres usar las
tuyas:

1. En la pantalla de configuración, pulsa **✏️ Editar canciones** o
   **✏️ Editar palabras**, según el modo activo.
2. Verás un cuadro de texto con la lista, una entrada por línea.
3. Añade, edita o borra líneas en el formato correspondiente:

   ```
   Título - Artista
   Palabra | pista ambigua
   ```

4. Pulsa **Guardar** para que la app use tu lista en las próximas
   partidas (se guarda en este dispositivo).
5. Si te lías o quieres volver a la lista original, pulsa
   **Restaurar lista por defecto**.

> **Almacenamiento local**: las canciones personalizadas se guardan en el
> `localStorage` del navegador del dispositivo donde uses la app. Si juegas
> desde otro móvil, la lista vuelve a ser la de por defecto.

---

## 📱 Instalar como aplicación

### iPhone / iPad
1. Abre <https://jdslearning.github.io/impostor/> en Safari.
2. Pulsa el botón **Compartir** ⬆️ y elige **Añadir a pantalla de inicio**.

### Android
1. Abre la URL en Chrome.
2. Menú **⋮** → **Añadir a pantalla de inicio** o **Instalar app**.

Aparecerá con el icono de la mujer detective 🕵️‍♀️.

---

## 🛠️ Desarrollo

Estructura del proyecto:

```
.
├── index.html              # Pantalla del juego
├── app.js                  # Lógica del juego
├── editor.html             # Editor de canciones (acceso protegido)
├── editor.js               # Lógica del editor
├── songs.txt               # Catálogo de canciones por defecto
├── words.txt               # Catálogo de palabras y pistas por defecto
├── styles.css              # Estilos compartidos
├── icon.svg                # Icono (favicon + PWA)
├── manifest.webmanifest    # Manifest PWA
└── .github/workflows/
    └── pages.yml           # Despliegue automático a GitHub Pages
```

### Probar en local
Cualquier servidor estático sirve. Por ejemplo:

```bash
python3 -m http.server 8000
# luego abre http://localhost:8000
```

> Abrir `index.html` directamente con `file://` también funciona, pero
> algunos navegadores son más estrictos con `localStorage` y el manifest
> bajo `file://`. Mejor con un servidor local.

### Despliegue
Cada `git push` a la rama `main` (o a la rama de feature) ejecuta el
workflow `.github/workflows/pages.yml` y publica en GitHub Pages.

URL pública: <https://jdslearning.github.io/impostor/>

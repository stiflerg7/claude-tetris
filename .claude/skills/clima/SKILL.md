---
name: clima
description: Muestra el clima actual de Guayaquil, Ecuador (ciudad por defecto del usuario) o de otra ciudad si se especifica, usando wttr.in. Úsala cuando el usuario pida el clima, la temperatura o el pronóstico actual, o invoque /clima.
---

# Clima

Obtiene el clima actual vía `curl` contra `wttr.in`, sin necesidad de API key. Ciudad por defecto: **Guayaquil, Ecuador**.

## Uso

- `/clima` — clima de Guayaquil, Ecuador.
- `/clima <ciudad>` — clima de una ciudad específica (ej: `/clima Bogota`, `/clima "Buenos Aires"`).

## Pasos

1. Determina la ciudad a partir del argumento recibido. Si el usuario no dio ninguno, usa `Guayaquil` por defecto (no dejes el campo vacío).
2. Ejecuta el comando, con la ciudad codificada para URL si tiene espacios o tildes:

```bash
curl -s "wttr.in/<ciudad>?format=3"
```

   Ejemplo por defecto: `curl -s "wttr.in/Guayaquil?format=3"`. Esto da una línea compacta: `Ciudad: ☀️ +25°C`.

3. Si el usuario pide más detalle (pronóstico, humedad, viento), usa en su lugar:

```bash
curl -s "wttr.in/<ciudad>?0"
```

   Esto devuelve un reporte ASCII más completo del día actual.

4. Reporta el resultado al usuario en texto plano, sin reformatear de más. Si `curl` falla (sin conexión, timeout), informa el error directamente en vez de inventar datos.

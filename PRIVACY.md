# Política de Privacidad — Focus Goat

**Última actualización:** 20 de octubre de 2026

Focus Goat ("la Extensión") ha sido desarrollada con un compromiso absoluto hacia la privacidad y el control total del usuario sobre sus datos. Esta política de privacidad describe cómo se gestiona la información al utilizar nuestra extensión para Google Chrome.

---

### 1. Recopilación y Uso de Datos

**Focus Goat NO recopila, transmite, vende ni comparte ningún tipo de dato personal, financiero ni de navegación del usuario.**

Toda la información necesaria para el funcionamiento de la extensión se almacena de forma **100% local** en el navegador del usuario utilizando la API `chrome.storage.local`:
* **Lista de sitios bloqueados:** Los dominios que el usuario decide añadir a su lista de bloqueo.
* **Rutinas y horarios:** Las franjas horarias y días de la semana configurados para sesiones automáticas.
* **Historial de estudio local:** Minutos de estudio completados, racha de días y nivel de gamificación para mostrar el progreso personal.
* **Preferencias:** Configuración de sonido, modo estricto y tiempo exacto.

Ninguno de estos datos abandona jamás el dispositivo del usuario ni se envía a servidores externos o bases de datos de terceros.

---

### 2. Permisos del Navegador y su Finalidad

Para cumplir exclusivamente con su función de bloqueo de distracciones, la extensión solicita los siguientes permisos:

* **`storage`**: Guardar de forma local las configuraciones, preferencias y estadísticas de estudio.
* **`tabs`**: Consultar la URL de la pestaña activa para verificar si coincide con los sitios que el usuario ha decidido bloquear y redirigirla a la pantalla de enfoque, así como cerrar pestañas prohibidas al activar Clean Sweep.
* **`alarms`**: Ejecutar de manera eficiente el temporizador de cuenta atrás de las sesiones y la activación de rutinas semanales.
* **`notifications`**: Mostrar una alerta de escritorio cuando finaliza la sesión de estudio o descanso.
* **`offscreen`**: Reproducir el sonido de finalización de forma nativa bajo el estándar de Google Chrome Manifest V3.
* **Permiso de host (`<all_urls>`)**: Permitir que el usuario pueda añadir cualquier sitio web personalizado a su lista de bloqueo sin limitaciones de dominio.

---

### 3. Código Remoto y Dependencias de Terceros

La extensión cumple estrictamente con las políticas de Google Chrome Web Store y la arquitectura Manifest V3:
* **No utiliza código alojado de forma remota.** Todo el código JavaScript, estilos e imágenes están empaquetados e incluidos directamente en la extensión.
* **No incluye rastreadores, herramientas de analítica ni publicidad de terceros.**

---

### 4. Seguridad de los Datos

Dado que no operamos servidores centrales ni almacenamos información del usuario en la nube, no existe riesgo de filtraciones de datos externos. Toda la configuración reside en el almacenamiento privado y aislado de Google Chrome en su ordenador.

---

### 5. Modificaciones y Contacto

Nos reservamos el derecho de actualizar esta política de privacidad si se introducen nuevas funcionalidades en la extensión. Cualquier cambio será reflejado en este documento con su fecha de actualización correspondiente.

Si tienes alguna pregunta sobre esta política de privacidad o sobre el funcionamiento de Focus Goat, puedes ponerte en contacto a través de GitHub o mediante el correo de contacto facilitado en la ficha oficial de Chrome Web Store.

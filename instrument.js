// Inicialización de Sentry — DEBE importarse lo primero de todo en server.js.
// El DSN viene de la variable de entorno SENTRY_DSN (configúrala en Railway).
// Si no hay DSN (ej. en local), Sentry queda inactivo y no molesta.
import * as Sentry from "@sentry/node";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    // Entorno: distingue producción de local en el panel de Sentry
    environment: process.env.NODE_ENV || "production",
    // Enviar logs estructurados a Sentry
    enableLogs: true,
    // No enviar datos de salud del paciente en los errores (privacidad RGPD):
    // Sentry no debe recibir el contenido clínico de las consultas.
    sendDefaultPii: false,
    // Muestreo de errores: capturamos el 100% (a tu escala no hay riesgo de cuota)
    tracesSampleRate: 0,
  });
  console.log("✓ Sentry activado");
}

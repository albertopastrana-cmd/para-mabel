/* ══════════════════════════════════════════════════════════════════
   sw.js — Service Worker para notificaciones de recordatorios
   Mabel × Alberto
   ══════════════════════════════════════════════════════════════════ */

const SW_VERSION = 'mabel-sw-v1';

/* ── Ciclo de vida ─────────────────────────────────────────────── */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

/* ── Timers activos en el SW ───────────────────────────────────── */
const _timers = {};

/* ── Mensajes desde la página principal ────────────────────────── */
self.addEventListener('message', e => {
  const { type } = e.data || {};

  if (type === 'SCHEDULE_REMINDER') {
    scheduleReminder(e.data.reminder);

  } else if (type === 'CANCEL_REMINDER') {
    cancelReminder(e.data.id);

  } else if (type === 'SYNC_REMINDERS') {
    /* La página envía todos los recordatorios activos al
       registrar el SW o cuando el controller cambia */
    (e.data.reminders || []).forEach(scheduleReminder);
  }
});

/* ── Lógica de scheduling ──────────────────────────────────────── */
function scheduleReminder(reminder) {
  if (!reminder?.fireAt) return;

  /* Cancelar timer previo para este ID si existía */
  cancelReminder(reminder.id);

  const delay = reminder.fireAt - Date.now();

  if (delay <= 0) {
    /* Ya venció — disparar inmediatamente */
    fireNotification(reminder);
    return;
  }

  /* setTimeout tiene límite de ~24.8 días (2^31 ms).
     Para fechas muy lejanas el SW se reactivará antes
     y la página también re-sincroniza al abrirse. */
  if (delay > 2_147_483_647) return;

  _timers[reminder.id] = setTimeout(() => {
    fireNotification(reminder);
    delete _timers[reminder.id];
  }, delay);
}

function cancelReminder(id) {
  if (_timers[id]) {
    clearTimeout(_timers[id]);
    delete _timers[id];
  }
}

function fireNotification(reminder) {
  const profileName = reminder.profile === 'mabel' ? 'Mabel' : 'Alberto';

  self.registration.showNotification('🍿 ¡Llegó el día del estreno!', {
    body: `Hola ${profileName}, ya está disponible: ${reminder.title}. ¡Prepara los snacks!`,
    icon: './img/logo-notificacion.png',
    badge: './img/logo-notificacion.png',
    tag: reminder.id,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { reminderId: reminder.id, scope: self.registration.scope },
  });
}

/* ── Click en la notificación → abrir/enfocar la app ──────────── */
self.addEventListener('notificationclick', e => {
  e.notification.close();

  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        /* Si ya hay una pestaña abierta, enfocarla */
        for (const client of clientList) {
          if (client.url.includes('index.html') && 'focus' in client) {
            return client.focus();
          }
        }
        /* Sino, abrir una nueva */
        const appUrl = self.registration.scope + 'index.html';
        return self.clients.openWindow(appUrl);
      })
  );
});

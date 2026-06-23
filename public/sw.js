// Service worker mínimo: existe para tornar o app instalável (critério do Chrome
// para o evento beforeinstallprompt). Não faz cache offline por enquanto.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
// Handler de fetch presente (necessário para a instalação); deixa a rede agir.
self.addEventListener("fetch", () => {});

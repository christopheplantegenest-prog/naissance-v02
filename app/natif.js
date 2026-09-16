// === DEBUT_NATIF ===
// Accès aux modules natifs de l'APK (Capacitor), sans outil de construction.
// Dans la PWA, estNatif() renvoie false et rien n'est appelé.

export function estNatif() {
  const c = globalThis.Capacitor;
  if (!c) return false;
  if (typeof c.isNativePlatform === 'function') return !!c.isNativePlatform();
  if (typeof c.getPlatform === 'function') return c.getPlatform() !== 'web';
  return typeof c.nativePromise === 'function';
}

export async function appelNatif(plugin, methode, options = {}) {
  const c = globalThis.Capacitor;
  if (c && typeof c.nativePromise === 'function') {
    return c.nativePromise(plugin, methode, options);
  }
  const module = c && c.Plugins && c.Plugins[plugin];
  if (module && typeof module[methode] === 'function') {
    return module[methode](options);
  }
  throw new Error(`Module natif « ${plugin} » indisponible dans cette version de l'appli.`);
}
// === FIN_NATIF ===

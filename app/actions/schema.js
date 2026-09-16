// === DEBUT_SCHEMA_ACTIONS ===
// Contrôle générique d'un objet de paramètres selon le schéma déclaré
// (types, champs obligatoires, champs inconnus refusés, valeurs énumérées).
export function controlerSchema(schema, valeurs) {
  if (!valeurs || typeof valeurs !== 'object' || Array.isArray(valeurs)) {
    return { ok: false, raison: 'Paramètres absents ou mal formés.' };
  }
  const proprietes = schema.properties || {};
  for (const cle of Object.keys(valeurs)) {
    if (!Object.hasOwn(proprietes, cle)) return { ok: false, raison: `Paramètre inconnu : ${cle}.` };
  }
  for (const cle of schema.required || []) {
    if (valeurs[cle] === undefined || valeurs[cle] === null || valeurs[cle] === '') {
      return { ok: false, raison: `Paramètre obligatoire manquant : ${cle}.` };
    }
  }
  for (const [cle, def] of Object.entries(proprietes)) {
    const v = valeurs[cle];
    if (v === undefined || v === null) continue;
    if (def.type === 'string' && typeof v !== 'string') return { ok: false, raison: `${cle} doit être un texte.` };
    if (def.type === 'integer' && !Number.isInteger(v)) {
      return { ok: false, raison: `${cle} doit être un nombre entier.` };
    }
    if (def.enum && !def.enum.includes(v)) return { ok: false, raison: `${cle} doit valoir : ${def.enum.join(', ')}.` };
  }
  return { ok: true };
}
// === FIN_SCHEMA_ACTIONS ===

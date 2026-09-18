package fr.naissance.moteurlocal;

import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Moteur local de Naissance (Capacitor).
 * L'appli ne fait qu'appeler ces méthodes : elles téléchargent, vérifient, chargent le modèle
 * et génèrent du texte. Rien ici ne touche à la mémoire ni à l'identité de Naissance.
 * Les opérations longues tournent en arrière-plan ; l'appli interroge leur état.
 */
@CapacitorPlugin(name = "MoteurLocal")
public class MoteurLocalPlugin extends Plugin {

    private static final long MEMOIRE_MINIMALE = 280L * 1024 * 1024;
    private static final String PREFS = "naissance-moteur-local";

    private final ExecutorService calcul = Executors.newSingleThreadExecutor();

    // Téléchargement
    private volatile String telEtat = "inactif";
    private volatile long telRecu = 0;
    private volatile long telTotal = 0;
    private volatile String telErreur = "";
    private volatile String telFichier = "";
    private volatile boolean telAnnuler = false;

    // Modèle et génération
    private volatile long modele = 0;
    private volatile String fichierCharge = "";
    private volatile boolean genEnCours = false;
    private final ByteArrayOutputStream genTexte = new ByteArrayOutputStream();
    private volatile String genFin = null;

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void etape(String s) {
        prefs().edit().putString("etape", s).commit();
    }

    private File dossierModeles() {
        File d = new File(getContext().getFilesDir(), "modeles");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private File dossierCache(String fichier) {
        File d = new File(getContext().getCacheDir(), "moteur-local/" + fichier);
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private static boolean nomValide(String fichier) {
        return fichier != null && fichier.matches("[A-Za-z0-9._-]{1,80}\\.gguf");
    }

    private static void supprimerDossier(File d) {
        File[] enfants = d.listFiles();
        if (enfants != null) for (File f : enfants) {
            if (f.isDirectory()) supprimerDossier(f);
            f.delete();
        }
        d.delete();
    }

    private long memoireLibre() {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        return mi.availMem;
    }

    private long memoireTotale() {
        ActivityManager am = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
        am.getMemoryInfo(mi);
        return mi.totalMem;
    }

    private static boolean enteteGguf(File f) {
        try (InputStream in = new FileInputStream(f)) {
            byte[] b = new byte[4];
            return in.read(b) == 4 && b[0] == 'G' && b[1] == 'G' && b[2] == 'U' && b[3] == 'F';
        } catch (Exception e) {
            return false;
        }
    }

    private static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] tampon = new byte[256 * 1024];
            int n;
            while ((n = in.read(tampon)) > 0) md.update(tampon, 0, n);
        }
        StringBuilder s = new StringBuilder();
        for (byte b : md.digest()) s.append(String.format("%02x", b));
        return s.toString();
    }

    // ------------------------------------------------------------------ état

    @PluginMethod
    public void infos(PluginCall call) {
        JSObject r = new JSObject();
        r.put("natif", Natif.disponible());
        r.put("erreurNatif", Natif.erreurChargement == null ? "" : Natif.erreurChargement);
        r.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "?");
        String systeme = "";
        if (Natif.disponible()) {
            try { systeme = Natif.infosSysteme(); } catch (Throwable t) { systeme = "erreur : " + t; }
        }
        r.put("systeme", systeme);
        JSArray fichiers = new JSArray();
        File[] liste = dossierModeles().listFiles();
        if (liste != null) for (File f : liste) {
            if (!f.getName().endsWith(".gguf")) continue;
            JSObject o = new JSObject();
            o.put("nom", f.getName());
            o.put("taille", f.length());
            o.put("verifie", prefs().getLong("taille:" + f.getName(), -1) == f.length());
            o.put("sha256", prefs().getString("sha256:" + f.getName(), ""));
            fichiers.put(o);
        }
        r.put("fichiers", fichiers);
        r.put("charge", modele != 0 ? fichierCharge : "");
        r.put("arretBrutal", prefs().getString("etape", ""));
        r.put("memoireLibre", memoireLibre());
        r.put("memoireTotale", memoireTotale());
        call.resolve(r);
    }

    @PluginMethod
    public void acquitterArret(PluginCall call) {
        etape("");
        call.resolve();
    }

    @PluginMethod
    public void journal(PluginCall call) {
        JSObject r = new JSObject();
        r.put("journal", Natif.disponible() ? Natif.journal() : "");
        call.resolve(r);
    }

    // ------------------------------------------------------------------ fichier du modèle

    @PluginMethod
    public void telecharger(PluginCall call) {
        final String adresse = call.getString("url", "");
        final String fichier = call.getString("fichier", "");
        if (!adresse.startsWith("https://") || !nomValide(fichier)) {
            call.reject("Adresse ou nom de fichier invalide.", "invalide");
            return;
        }
        if ("encours".equals(telEtat) || "verification".equals(telEtat)) {
            call.reject("Un téléchargement est déjà en cours.", "occupe");
            return;
        }
        telEtat = "encours";
        telRecu = 0;
        telTotal = 0;
        telErreur = "";
        telFichier = fichier;
        telAnnuler = false;
        new Thread(() -> telechargerFond(adresse, fichier), "telechargement-modele").start();
        call.resolve();
    }

    private void telechargerFond(String adresse, String fichier) {
        File cible = new File(dossierModeles(), fichier);
        File partiel = new File(cible.getPath() + ".part");
        HttpURLConnection c = null;
        try {
            long deja = partiel.exists() ? partiel.length() : 0;
            c = (HttpURLConnection) new URL(adresse).openConnection();
            c.setInstanceFollowRedirects(true);
            c.setConnectTimeout(20000);
            c.setReadTimeout(30000);
            c.setRequestProperty("User-Agent", "naissance-ia");
            if (deja > 0) c.setRequestProperty("Range", "bytes=" + deja + "-");
            int code = c.getResponseCode();
            boolean reprise = code == 206;
            if (code != 200 && code != 206) throw new Exception("réponse HTTP " + code);
            if (!reprise) deja = 0;
            long longueur = c.getContentLengthLong();
            telTotal = longueur > 0 ? longueur + deja : 0;
            telRecu = deja;
            try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(partiel, reprise)) {
                byte[] tampon = new byte[64 * 1024];
                int n;
                while ((n = in.read(tampon)) > 0) {
                    if (telAnnuler) throw new Exception("annulé (reprise possible)");
                    out.write(tampon, 0, n);
                    telRecu += n;
                }
            }
            if (telTotal > 0 && partiel.length() != telTotal) {
                throw new Exception("fichier incomplet (" + partiel.length() + " / " + telTotal + " octets)");
            }
            telEtat = "verification";
            if (!enteteGguf(partiel)) {
                partiel.delete();
                throw new Exception("fichier invalide (ce n'est pas un modèle GGUF)");
            }
            String empreinte = sha256(partiel);
            if (cible.exists()) cible.delete();
            if (!partiel.renameTo(cible)) throw new Exception("impossible d'enregistrer le fichier");
            prefs().edit()
                .putLong("taille:" + fichier, cible.length())
                .putString("sha256:" + fichier, empreinte)
                .apply();
            telEtat = "termine";
        } catch (Exception e) {
            telErreur = e.getMessage() == null ? e.toString() : e.getMessage();
            telEtat = telAnnuler ? "annule" : "erreur";
        } finally {
            if (c != null) c.disconnect();
        }
    }

    @PluginMethod
    public void etatTelechargement(PluginCall call) {
        JSObject r = new JSObject();
        r.put("etat", telEtat);
        r.put("recu", telRecu);
        r.put("total", telTotal);
        r.put("erreur", telErreur);
        r.put("fichier", telFichier);
        call.resolve(r);
    }

    @PluginMethod
    public void annulerTelechargement(PluginCall call) {
        telAnnuler = true;
        call.resolve();
    }

    @PluginMethod
    public void supprimer(PluginCall call) {
        final String fichier = call.getString("fichier", "");
        if (!nomValide(fichier)) {
            call.reject("Nom de fichier invalide.", "invalide");
            return;
        }
        if (genEnCours) {
            call.reject("Une réponse locale est en cours.", "occupe");
            return;
        }
        calcul.execute(() -> {
            if (modele != 0 && fichier.equals(fichierCharge)) {
                Natif.decharger(modele);
                modele = 0;
                fichierCharge = "";
            }
            File f = new File(dossierModeles(), fichier);
            boolean ok = !f.exists() || f.delete();
            new File(f.getPath() + ".part").delete();
            supprimerDossier(new File(getContext().getCacheDir(), "moteur-local/" + fichier));
            prefs().edit().remove("taille:" + fichier).remove("sha256:" + fichier).apply();
            JSObject r = new JSObject();
            r.put("supprime", ok);
            call.resolve(r);
        });
    }

    // ------------------------------------------------------------------ modèle en mémoire

    @PluginMethod
    public void charger(PluginCall call) {
        final String fichier = call.getString("fichier", "");
        final boolean forcer = Boolean.TRUE.equals(call.getBoolean("forcer", false));
        if (!Natif.disponible()) {
            call.reject("Moteur local indisponible sur cet appareil : " + Natif.erreurChargement, "natif");
            return;
        }
        if (!nomValide(fichier)) {
            call.reject("Nom de fichier invalide.", "invalide");
            return;
        }
        calcul.execute(() -> {
            if (modele != 0 && fichier.equals(fichierCharge)) {
                JSObject r = new JSObject();
                r.put("dejaCharge", true);
                call.resolve(r);
                return;
            }
            File f = new File(dossierModeles(), fichier);
            if (!f.exists()) { call.reject("Le modèle n'est pas installé.", "absent"); return; }
            long attendu = prefs().getLong("taille:" + fichier, -1);
            if (attendu != f.length() || !enteteGguf(f)) {
                call.reject("Le fichier du modèle est incomplet ou abîmé : supprime-le et télécharge-le à nouveau.", "corrompu");
                return;
            }
            long libre = memoireLibre();
            if (!forcer && libre < MEMOIRE_MINIMALE) {
                call.reject("Mémoire insuffisante pour le moteur local (" + (libre / (1024 * 1024)) + " Mo libres).", "memoire");
                return;
            }
            if (modele != 0) {
                Natif.decharger(modele);
                modele = 0;
                fichierCharge = "";
            }
            etape("chargement de " + fichier);
            long t0 = SystemClock.elapsedRealtime();
            long h = Natif.charger(f.getAbsolutePath());
            etape("");
            if (h == 0) {
                call.reject("Le moteur local n'a pas pu charger le modèle.", "echec");
                return;
            }
            modele = h;
            fichierCharge = fichier;
            JSObject r = new JSObject();
            r.put("chargeEnMs", SystemClock.elapsedRealtime() - t0);
            r.put("description", Natif.description(h));
            r.put("memoireLibre", memoireLibre());
            call.resolve(r);
        });
    }

    @PluginMethod
    public void decharger(PluginCall call) {
        calcul.execute(() -> {
            if (modele != 0) {
                Natif.decharger(modele);
                modele = 0;
                fichierCharge = "";
            }
            call.resolve();
        });
    }

    // ------------------------------------------------------------------ génération

    @PluginMethod
    public void generer(PluginCall call) {
        final String prefixe = call.getString("prefixe", "");
        final String suite = call.getString("suite", "");
        final int nCtx = call.getInt("nCtx", 1024);
        final int nMax = call.getInt("nMax", 120);
        final int nFils = call.getInt("nFils", 4);
        if (modele == 0) {
            call.reject("Le modèle local n'est pas chargé.", "absent");
            return;
        }
        if (genEnCours) {
            call.reject("Une réponse locale est déjà en cours.", "occupe");
            return;
        }
        genEnCours = true;
        genFin = null;
        synchronized (genTexte) {
            genTexte.reset();
        }
        final long h = modele;
        final String dossier = dossierCache(fichierCharge).getAbsolutePath();
        calcul.execute(() -> {
            etape("génération locale");
            try {
                Natif.generer(h, prefixe, suite, nCtx, nMax, nFils, dossier, new Natif.Rappel() {
                    @Override
                    public void morceau(byte[] octets) {
                        synchronized (genTexte) {
                            genTexte.write(octets, 0, octets.length);
                        }
                    }

                    @Override
                    public void fin(String json) {
                        genFin = json;
                    }
                });
            } catch (Throwable t) {
                genFin = "{\"ok\":false,\"code\":\"natif\",\"message\":\"" + t.toString().replace('"', '\'') + "\"}";
            } finally {
                if (genFin == null) genFin = "{\"ok\":false,\"code\":\"natif\",\"message\":\"fin inattendue\"}";
                etape("");
                genEnCours = false;
            }
        });
        call.resolve();
    }

    @PluginMethod
    public void lireGeneration(PluginCall call) {
        JSObject r = new JSObject();
        String texte;
        synchronized (genTexte) {
            texte = new String(genTexte.toByteArray(), StandardCharsets.UTF_8);
        }
        r.put("texte", texte);
        String fin = genFin;
        r.put("fini", fin != null && !genEnCours);
        r.put("resultat", fin == null ? "" : fin);
        call.resolve(r);
    }

    @PluginMethod
    public void arreter(PluginCall call) {
        if (Natif.disponible()) Natif.arreter();
        call.resolve();
    }
}

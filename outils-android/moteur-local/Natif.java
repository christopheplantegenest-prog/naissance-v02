package fr.naissance.moteurlocal;

import java.nio.charset.StandardCharsets;

/** Accès à la bibliothèque native du moteur local (llama.cpp, armeabi-v7a). */
public final class Natif {

    public static String erreurChargement = null;

    static {
        try {
            System.loadLibrary("naissance_llm");
        } catch (Throwable t) {
            erreurChargement = t.toString();
        }
    }

    private Natif() { }

    public interface Rappel {
        void morceau(byte[] octets);
        void fin(String json);
    }

    public static boolean disponible() {
        return erreurChargement == null;
    }

    public static native String infosSysteme();
    public static native String journal();
    public static native long charger(String chemin);
    public static native String description(long modele);
    public static native void decharger(long modele);
    public static native void arreter();
    public static native void generer(long modele, String prefixe, String suite,
                                      int nCtx, int nMax, int nFils, String dossierCache, Rappel rappel);

    public static String decoder(byte[] octets) {
        return new String(octets, StandardCharsets.UTF_8);
    }

    public static byte[] encoder(String texte) {
        return texte == null ? new byte[0] : texte.getBytes(StandardCharsets.UTF_8);
    }
}

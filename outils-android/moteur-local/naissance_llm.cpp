// Moteur local de Naissance — llama.cpp (armeabi-v7a).
// Repris du banc d'essai banc-llm, avec en plus :
//  - une invite en deux parties : un PRÉFIXE stable (identité) et une SUITE (le reste) ;
//  - la mise en cache de l'état du modèle après le préfixe (en mémoire et dans un fichier),
//    pour ne pas relire l'identité à chaque message.
// Aucune action, aucune écriture dans la mémoire de Naissance : ce code ne fait que générer du texte.

#include <jni.h>
#include <android/log.h>

#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <deque>
#include <mutex>
#include <string>
#include <vector>
#include <algorithm>

#include "llama.h"

#define TAG "naissance-llm"

static std::atomic<bool> g_arret{false};
static std::mutex g_journal_mutex;
static std::deque<std::string> g_journal;
static bool g_backend_pret = false;

// Instantané de l'état après le préfixe (un seul à la fois).
static llama_model * g_instantane_modele = nullptr;
static uint64_t g_instantane_cle = 0;
static std::vector<uint8_t> g_instantane;

static void noter(const std::string & ligne) {
    std::lock_guard<std::mutex> verrou(g_journal_mutex);
    g_journal.push_back(ligne);
    while (g_journal.size() > 60) g_journal.pop_front();
}

static void rappel_journal(enum ggml_log_level niveau, const char * texte, void *) {
    if (texte == nullptr) return;
    int prio = ANDROID_LOG_INFO;
    if (niveau == GGML_LOG_LEVEL_ERROR) prio = ANDROID_LOG_ERROR;
    else if (niveau == GGML_LOG_LEVEL_WARN) prio = ANDROID_LOG_WARN;
    else if (niveau == GGML_LOG_LEVEL_DEBUG) return;
    __android_log_print(prio, TAG, "%s", texte);
    std::string t(texte);
    while (!t.empty() && (t.back() == '\n' || t.back() == '\r')) t.pop_back();
    if (!t.empty()) noter(t);
}

static void initialiser() {
    if (g_backend_pret) return;
    llama_log_set(rappel_journal, nullptr);
    llama_backend_init();
    g_backend_pret = true;
}

static double maintenant_ms() {
    using namespace std::chrono;
    return duration<double, std::milli>(steady_clock::now().time_since_epoch()).count();
}

static uint64_t empreinte(const std::string & s) {
    uint64_t h = 1469598103934665603ULL;
    for (unsigned char c : s) { h ^= c; h *= 1099511628211ULL; }
    return h;
}

static jstring vers_java(JNIEnv * env, const std::string & s) {
    jbyteArray octets = env->NewByteArray((jsize) s.size());
    env->SetByteArrayRegion(octets, 0, (jsize) s.size(), (const jbyte *) s.data());
    jclass cls = env->FindClass("fr/naissance/moteurlocal/Natif");
    jmethodID m = env->GetStaticMethodID(cls, "decoder", "([B)Ljava/lang/String;");
    jstring res = (jstring) env->CallStaticObjectMethod(cls, m, octets);
    env->DeleteLocalRef(octets);
    env->DeleteLocalRef(cls);
    return res;
}

static std::string depuis_java(JNIEnv * env, jstring js) {
    if (js == nullptr) return std::string();
    jclass cls = env->FindClass("fr/naissance/moteurlocal/Natif");
    jmethodID m = env->GetStaticMethodID(cls, "encoder", "(Ljava/lang/String;)[B");
    jbyteArray octets = (jbyteArray) env->CallStaticObjectMethod(cls, m, js);
    jsize n = env->GetArrayLength(octets);
    std::string s((size_t) n, '\0');
    if (n > 0) env->GetByteArrayRegion(octets, 0, n, (jbyte *) &s[0]);
    env->DeleteLocalRef(octets);
    env->DeleteLocalRef(cls);
    return s;
}

// Échappement minimal pour produire du JSON.
static std::string json_texte(const std::string & s) {
    std::string r = "\"";
    for (unsigned char c : s) {
        if (c == '"' || c == '\\') { r += '\\'; r += (char) c; }
        else if (c == '\n') r += "\\n";
        else if (c < 0x20) r += ' ';
        else r += (char) c;
    }
    return r + "\"";
}

static bool decoder_par_morceaux(llama_context * ctx, std::vector<llama_token> & jetons, int taille_lot) {
    int n = (int) jetons.size();
    for (int i = 0; i < n; i += taille_lot) {
        if (g_arret.load()) return false;
        int k = std::min(taille_lot, n - i);
        if (llama_decode(ctx, llama_batch_get_one(jetons.data() + i, k)) != 0) return false;
    }
    return true;
}

static std::vector<llama_token> decouper(const llama_vocab * vocab, const std::string & texte) {
    int32_t n = -llama_tokenize(vocab, texte.c_str(), (int32_t) texte.size(), nullptr, 0, false, true);
    if (n <= 0) return {};
    std::vector<llama_token> jetons((size_t) n);
    if (llama_tokenize(vocab, texte.c_str(), (int32_t) texte.size(), jetons.data(), n, false, true) < 0) return {};
    return jetons;
}

static llama_context * nouveau_contexte(llama_model * modele, int nCtx, int nFils) {
    llama_context_params cp = llama_context_default_params();
    cp.n_ctx = (uint32_t) nCtx;
    cp.n_batch = (uint32_t) nCtx;
    cp.n_ubatch = (uint32_t) (nCtx < 512 ? nCtx : 512);
    cp.n_seq_max = 1;
    cp.n_threads = nFils;
    cp.n_threads_batch = nFils;
    cp.no_perf = false;
    return llama_init_from_model(modele, cp);
}

static void capturer(llama_context * ctx, llama_model * modele, uint64_t cle) {
    size_t taille = llama_state_seq_get_size(ctx, 0);
    if (taille == 0) { noter("Instantané du préfixe indisponible (taille nulle)"); return; }
    std::vector<uint8_t> donnees(taille);
    size_t ecrits = llama_state_seq_get_data(ctx, donnees.data(), donnees.size(), 0);
    if (ecrits == 0) { noter("Instantané du préfixe indisponible (lecture impossible)"); return; }
    donnees.resize(ecrits);
    g_instantane.swap(donnees);
    g_instantane_cle = cle;
    g_instantane_modele = modele;
}

extern "C" {

JNIEXPORT jstring JNICALL
Java_fr_naissance_moteurlocal_Natif_infosSysteme(JNIEnv * env, jclass) {
    initialiser();
    std::string s = llama_print_system_info();
#if defined(__aarch64__)
    s += " | compilé pour : arm64-v8a";
#elif defined(__arm__)
    s += " | compilé pour : armeabi-v7a";
#else
    s += " | compilé pour : autre";
#endif
    return vers_java(env, s);
}

JNIEXPORT jstring JNICALL
Java_fr_naissance_moteurlocal_Natif_journal(JNIEnv * env, jclass) {
    std::string s;
    {
        std::lock_guard<std::mutex> verrou(g_journal_mutex);
        for (const auto & l : g_journal) { s += l; s += '\n'; }
    }
    return vers_java(env, s);
}

JNIEXPORT jlong JNICALL
Java_fr_naissance_moteurlocal_Natif_charger(JNIEnv * env, jclass, jstring jchemin) {
    initialiser();
    std::string chemin = depuis_java(env, jchemin);
    llama_model_params mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    mp.use_mmap = true;
    mp.use_mlock = false;
    llama_model * modele = llama_model_load_from_file(chemin.c_str(), mp);
    if (modele == nullptr) {
        noter("ÉCHEC du chargement du modèle : " + chemin);
        return 0;
    }
    return (jlong) (intptr_t) modele;
}

JNIEXPORT jstring JNICALL
Java_fr_naissance_moteurlocal_Natif_description(JNIEnv * env, jclass, jlong jmodele) {
    llama_model * modele = (llama_model *) (intptr_t) jmodele;
    if (modele == nullptr) return vers_java(env, "aucun modèle");
    char desc[256];
    desc[0] = '\0';
    llama_model_desc(modele, desc, sizeof(desc));
    char ligne[512];
    snprintf(ligne, sizeof(ligne), "%s — %.1f M paramètres — %.0f Mo",
             desc, (double) llama_model_n_params(modele) / 1e6,
             (double) llama_model_size(modele) / (1024.0 * 1024.0));
    return vers_java(env, ligne);
}

JNIEXPORT void JNICALL
Java_fr_naissance_moteurlocal_Natif_decharger(JNIEnv *, jclass, jlong jmodele) {
    llama_model * modele = (llama_model *) (intptr_t) jmodele;
    if (modele == nullptr) return;
    if (g_instantane_modele == modele) {
        g_instantane.clear();
        g_instantane.shrink_to_fit();
        g_instantane_modele = nullptr;
        g_instantane_cle = 0;
    }
    llama_model_free(modele);
}

JNIEXPORT void JNICALL
Java_fr_naissance_moteurlocal_Natif_arreter(JNIEnv *, jclass) {
    g_arret.store(true);
}

// Génère une réponse. rappel : morceau(byte[]) pendant l'écriture, fin(String json) à la fin (toujours appelé).
JNIEXPORT void JNICALL
Java_fr_naissance_moteurlocal_Natif_generer(JNIEnv * env, jclass, jlong jmodele,
                                           jstring jprefixe, jstring jsuite,
                                           jint nCtx, jint nMax, jint nFils,
                                           jfloat temperature, jint topK, jfloat minP, jfloat penalite,
                                           jstring jdossierCache, jobject rappel) {
    g_arret.store(false);
    jclass cls = env->GetObjectClass(rappel);
    jmethodID surMorceau = env->GetMethodID(cls, "morceau", "([B)V");
    jmethodID surFin = env->GetMethodID(cls, "fin", "(Ljava/lang/String;)V");
    auto finir = [&](const std::string & json) {
        jstring js = vers_java(env, json);
        env->CallVoidMethod(rappel, surFin, js);
        env->DeleteLocalRef(js);
    };
    auto echec = [&](const std::string & code, const std::string & message) {
        noter("ERREUR " + code + " : " + message);
        finir("{\"ok\":false,\"code\":" + json_texte(code) + ",\"message\":" + json_texte(message) + "}");
    };

    llama_model * modele = (llama_model *) (intptr_t) jmodele;
    if (modele == nullptr) { echec("absent", "aucun modèle chargé"); return; }
    const llama_vocab * vocab = llama_model_get_vocab(modele);
    std::string prefixe = depuis_java(env, jprefixe);
    std::string suite = depuis_java(env, jsuite);
    std::string dossier = depuis_java(env, jdossierCache);

    double t0 = maintenant_ms();
    std::vector<llama_token> jp = decouper(vocab, prefixe);
    std::vector<llama_token> js = decouper(vocab, suite);
    if (jp.empty() || js.empty()) { echec("jetons", "découpage en jetons impossible"); return; }
    if ((int) (jp.size() + js.size()) + 8 >= nCtx) {
        char m[160];
        snprintf(m, sizeof(m), "invite trop longue (%d + %d jetons) pour un contexte de %d",
                 (int) jp.size(), (int) js.size(), (int) nCtx);
        echec("trop-long", m);
        return;
    }
    int limite = std::min((int) nMax, (int) nCtx - (int) (jp.size() + js.size()) - 1);

    llama_context * ctx = nouveau_contexte(modele, nCtx, nFils);
    if (ctx == nullptr) { echec("memoire", "impossible de créer le contexte (mémoire insuffisante ?)"); return; }

    // 1) Préfixe : instantané en mémoire, puis fichier, sinon calcul.
    uint64_t cle = empreinte(prefixe);
    std::string cache = "calculé";
    bool pret = false;
    if (g_instantane_modele == modele && g_instantane_cle == cle && !g_instantane.empty()) {
        if (llama_state_seq_set_data(ctx, g_instantane.data(), g_instantane.size(), 0) > 0) {
            pret = true;
            cache = "mémoire";
        } else {
            llama_free(ctx);
            ctx = nouveau_contexte(modele, nCtx, nFils);
            if (ctx == nullptr) { echec("memoire", "contexte impossible après échec du cache"); return; }
        }
    }
    char nomFichier[64];
    snprintf(nomFichier, sizeof(nomFichier), "/prefixe-%016llx.etat", (unsigned long long) cle);
    std::string chemin = dossier.empty() ? std::string() : dossier + nomFichier;
    if (!pret && !chemin.empty()) {
        FILE * f = fopen(chemin.c_str(), "rb");
        if (f != nullptr) {
            fclose(f);
            std::vector<llama_token> lus(jp.size() + 16);
            size_t nLus = 0;
            size_t ok = llama_state_seq_load_file(ctx, chemin.c_str(), 0, lus.data(), lus.size(), &nLus);
            if (ok > 0 && nLus == jp.size() && std::equal(jp.begin(), jp.end(), lus.begin())) {
                pret = true;
                cache = "fichier";
                capturer(ctx, modele, cle);
            } else {
                noter("Cache du préfixe ignoré (fichier périmé)");
                remove(chemin.c_str());
                llama_free(ctx);
                ctx = nouveau_contexte(modele, nCtx, nFils);
                if (ctx == nullptr) { echec("memoire", "contexte impossible après cache périmé"); return; }
            }
        }
    }
    int lot = (int) (nCtx < 512 ? nCtx : 512);
    if (!pret) {
        if (!decoder_par_morceaux(ctx, jp, lot)) {
            llama_free(ctx);
            if (g_arret.load()) echec("annule", "arrêt demandé");
            else echec("lecture", "échec de la lecture de l'identité");
            return;
        }
        capturer(ctx, modele, cle);
        if (!chemin.empty()) {
            if (llama_state_seq_save_file(ctx, chemin.c_str(), 0, jp.data(), jp.size()) == 0) {
                noter("Cache du préfixe non enregistré");
            }
        }
    }
    double t_prefixe = maintenant_ms();

    // 2) Suite (contexte du moment, conversation, message).
    if (!decoder_par_morceaux(ctx, js, lot)) {
        llama_free(ctx);
        if (g_arret.load()) echec("annule", "arrêt demandé");
        else echec("lecture", "échec de la lecture du message");
        return;
    }
    double t_suite = maintenant_ms();

    // 3) Écriture.
    llama_sampler * ech = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(ech, llama_sampler_init_penalties(64, penalite > 0 ? penalite : 1.05f, 0.0f, 0.0f));
    llama_sampler_chain_add(ech, llama_sampler_init_top_k(topK > 0 ? topK : 40));
    llama_sampler_chain_add(ech, llama_sampler_init_min_p(minP > 0 ? minP : 0.15f, 1));
    llama_sampler_chain_add(ech, llama_sampler_init_temp(temperature > 0 ? temperature : 0.3f));
    llama_sampler_chain_add(ech, llama_sampler_init_dist((uint32_t) (t0) ^ 0x5eed));

    int produits = 0;
    double t_premier = -1;
    std::string fin = "limite";
    char morceau[512];
    for (int i = 0; i < limite; i++) {
        if (g_arret.load()) { fin = "annule"; break; }
        llama_token id = llama_sampler_sample(ech, ctx, -1);
        if (llama_vocab_is_eog(vocab, id)) { fin = "naturelle"; break; }
        if (t_premier < 0) t_premier = maintenant_ms();
        produits++;
        int32_t n = llama_token_to_piece(vocab, id, morceau, sizeof(morceau), 0, false);
        if (n > 0) {
            jbyteArray octets = env->NewByteArray(n);
            env->SetByteArrayRegion(octets, 0, n, (const jbyte *) morceau);
            env->CallVoidMethod(rappel, surMorceau, octets);
            env->DeleteLocalRef(octets);
        }
        llama_token suivant = id;
        if (llama_decode(ctx, llama_batch_get_one(&suivant, 1)) != 0) { fin = "echec"; break; }
    }
    double t_fin = maintenant_ms();
    llama_sampler_free(ech);
    llama_free(ctx);

    if (fin == "annule") { echec("annule", "arrêt demandé"); return; }
    if (fin == "echec") { echec("ecriture", "échec pendant l'écriture"); return; }

    double lecture_ms = (pret ? 0.0 : (t_prefixe - t0)) + (t_suite - t_prefixe);
    int lus = (pret ? 0 : (int) jp.size()) + (int) js.size();
    double ecriture_s = t_premier < 0 ? 0 : (t_fin - t_premier) / 1000.0;
    char json[1024];
    snprintf(json, sizeof(json),
             "{\"ok\":true,\"cache\":%s,\"jetonsPrefixe\":%d,\"jetonsSuite\":%d,"
             "\"prefixeMs\":%.0f,\"suiteMs\":%.0f,\"premierMotMs\":%.0f,"
             "\"lectureJps\":%.2f,\"jetonsEcrits\":%d,\"ecritureJps\":%.2f,"
             "\"fin\":%s,\"contexte\":%d,\"limite\":%d,\"fils\":%d,\"temperature\":%.2f}",
             json_texte(cache).c_str(), (int) jp.size(), (int) js.size(),
             t_prefixe - t0, t_suite - t_prefixe, t_premier < 0 ? (t_fin - t0) : (t_premier - t0),
             lecture_ms > 0 ? lus / (lecture_ms / 1000.0) : 0.0,
             produits, ecriture_s > 0 ? produits / ecriture_s : 0.0,
             json_texte(fin).c_str(), (int) nCtx, (int) nMax, (int) nFils, (double) temperature);
    finir(json);
}

} // extern "C"

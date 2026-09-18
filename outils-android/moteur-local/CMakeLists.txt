# Moteur local de Naissance — llama.cpp en armeabi-v7a (Android 32 bits, Cortex-A53, NEON + VFPv4)
# Repris du banc d'essai banc-llm (validé sur le TCL T431D le 17/09).
cmake_minimum_required(VERSION 3.18)
project(naissance_llm C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(NOT LLAMA_DIR)
  message(FATAL_ERROR "LLAMA_DIR non défini (dossier des sources de llama.cpp)")
endif()

# llama.cpp en bibliothèques statiques, sans outils, sans réseau, sans accélérations risquées
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_COMMON OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(LLAMA_BUILD_SERVER OFF CACHE BOOL "" FORCE)
set(LLAMA_CURL OFF CACHE BOOL "" FORCE)
set(GGML_NATIVE OFF CACHE BOOL "" FORCE)            # jamais -march=native (compilation croisée)
set(GGML_OPENMP OFF CACHE BOOL "" FORCE)            # fils d'exécution internes de ggml
set(GGML_LLAMAFILE OFF CACHE BOOL "" FORCE)         # noyaux sgemm : évités en 32 bits
set(GGML_CPU_KLEIDIAI OFF CACHE BOOL "" FORCE)
set(GGML_BACKEND_DL OFF CACHE BOOL "" FORCE)
set(GGML_CPU_ALL_VARIANTS OFF CACHE BOOL "" FORCE)
set(GGML_VULKAN OFF CACHE BOOL "" FORCE)
set(GGML_OPENCL OFF CACHE BOOL "" FORCE)

# Cortex-A53 en mode 32 bits : NEON + VFPv4 (demi-précision), rien de plus récent.
if(ANDROID_ABI STREQUAL "armeabi-v7a")
  add_compile_options(-mfpu=neon-vfpv4)
endif()

add_subdirectory(${LLAMA_DIR} llama-build)

add_library(naissance_llm SHARED naissance_llm.cpp)
target_link_libraries(naissance_llm PRIVATE llama android log)
target_compile_options(naissance_llm PRIVATE -O2)

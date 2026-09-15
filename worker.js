export default {
  async fetch(request, env) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "Réponds uniquement : Naissance fonctionne."
            }]
          }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return Response.json({
        ok: false,
        status: response.status,
        erreur: data
      });
    }

    return Response.json({
      ok: true,
      reponse: data.candidates?.[0]?.content?.parts?.[0]?.text
    });
  }
};

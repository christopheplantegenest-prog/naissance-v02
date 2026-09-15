export default {
  async fetch(request, env) {
    const headers = {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Naissance-Assistant"
    };

    const response = await fetch(
      "https://api.github.com/repos/christopheplantegenest-prog/naissance-v02",
      { headers }
    );

    if (!response.ok) {
      const erreur = await response.text();

      return new Response(
        `GitHub inaccessible : ${response.status}\n${erreur}`,
        {
          headers: { "Content-Type": "text/plain; charset=UTF-8" }
        }
      );
    }

    const repo = await response.json();

    return Response.json({
      ok: true,
      github: "connecte",
      depot: repo.full_name
    });
  }
};

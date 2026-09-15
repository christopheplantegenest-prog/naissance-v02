
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
      return new Response(`GitHub inaccessible : ${response.status}`);
    }

    const repo = await response.json();

    return Response.json({
      ok: true,
      github: "connecte",
      depot: repo.full_name
    });
  }
};


const allowedMethods = new Set(["GET", "HEAD"]);

export default function handler(request, response) {
  if (!allowedMethods.has(request.method)) {
    response.setHeader("Allow", "GET, HEAD");
    response.status(405).end();
    return;
  }

  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.status(410);

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  response.end(`<!doctype html>
<html lang="en-AU">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow,noarchive" />
    <title>Retired public route | Fenrua</title>
  </head>
  <body>
    <main>
      <h1>This legacy route has been permanently retired.</h1>
      <p>It is not part of the current Fenrua public service or product boundary.</p>
      <p><a href="https://fenrua.ai/">Current website</a> · <a href="https://fenrua.ai/legal">Legal and company boundary</a></p>
    </main>
  </body>
</html>`);
}

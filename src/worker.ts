interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({
          error: 'API belum dikonfigurasi',
          path: url.pathname,
        }),
        {
          status: 501,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return env.ASSETS.fetch(request);
  },
};
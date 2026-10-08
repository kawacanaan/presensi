const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

export default async function handler(_req: any, res: any) {
  return json(res, 403, {
    ok: false,
    error: 'Endpoint setup Super Admin telah dinonaktifkan secara permanen untuk keamanan production.',
  });
}

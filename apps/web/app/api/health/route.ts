export function GET(): Response {
  return Response.json({ service: 'tradenest-web', status: 'ok' });
}

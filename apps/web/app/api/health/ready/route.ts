const API_READY_TIMEOUT_MS = 3_000;

export async function GET(): Promise<Response> {
  const baseUrl = process.env.TRADENEST_API_INTERNAL_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return Response.json(
      { service: "tradenest-web", status: "not-ready", dependencies: { api: "unconfigured" } },
      { status: 503 },
    );
  }

  try {
    const response = await fetch(`${baseUrl}/health/ready`, {
      cache: "no-store",
      signal: AbortSignal.timeout(API_READY_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`API readiness returned ${response.status}`);
    const payload = (await response.json()) as { status?: string };
    if (payload.status !== "ready") throw new Error("API readiness payload was not ready");

    return Response.json({
      service: "tradenest-web",
      status: "ready",
      dependencies: { api: "ready" },
    });
  } catch {
    return Response.json(
      { service: "tradenest-web", status: "not-ready", dependencies: { api: "not-ready" } },
      { status: 503 },
    );
  }
}

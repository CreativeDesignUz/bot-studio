const LEGACY_DISABLED_MESSAGE = "Legacy avatar storage is disabled.";

function legacyDisabled() {
  return Response.json(
    { error: LEGACY_DISABLED_MESSAGE },
    {
      status: 410,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function GET() {
  return legacyDisabled();
}

export async function POST() {
  return legacyDisabled();
}

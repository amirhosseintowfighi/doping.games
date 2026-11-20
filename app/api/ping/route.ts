// Tiny endpoint the browser times to measure its round trip to our edge.
export const dynamic = 'force-dynamic';
export const GET = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
export const HEAD = GET;

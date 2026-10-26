import { accessStatus, handleAccessRequest } from '../../../lib/access-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET(request) { return accessStatus(request); }
export function POST(request) { return handleAccessRequest(request); }

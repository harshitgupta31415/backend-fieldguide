import { handleSearchRequest, searchStatus } from '../../../lib/search-server.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;

export function GET(request) { return searchStatus(request); }
export function POST(request) { return handleSearchRequest(request); }

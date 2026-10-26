import { handleTutorRequest, tutorStatus } from '../../../lib/tutor-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export function GET(request) { return tutorStatus(request); }
export function POST(request) { return handleTutorRequest(request); }

import { voiceHandlers } from '../../../../lib/voice-server.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export function GET(request) { return voiceHandlers.status(request); }
export function POST(request) { return voiceHandlers.transcribe(request); }

export const runtime='nodejs';
export const maxDuration=120;
import { handlePlanning } from '../../../lib/agents/http';
export async function POST(request:Request){return handlePlanning(request);}

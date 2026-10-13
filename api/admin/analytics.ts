import { handle } from '../../server/control/handler.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
export default function handler(req: IncomingMessage, res: ServerResponse) { return handle(req, res, false); }

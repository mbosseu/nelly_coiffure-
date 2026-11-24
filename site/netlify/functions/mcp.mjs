import handler from '../../api/mcp.mjs';
import { adapter } from '../adapter.mjs';

export default adapter(handler);
export const config = { path: '/api/mcp' };

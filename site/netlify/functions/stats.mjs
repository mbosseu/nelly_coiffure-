import handler from '../../api/stats.mjs';
import { adapter } from '../adapter.mjs';

export default adapter(handler);
export const config = { path: '/api/stats' };

import handler from '../../api/admin.mjs';
import { adapter } from '../adapter.mjs';

export default adapter(handler);
export const config = { path: '/api/admin' };

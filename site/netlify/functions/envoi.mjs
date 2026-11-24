import handler from '../../api/envoi.mjs';
import { adapter } from '../adapter.mjs';

// Sur Vercel, /envoi était réécrit vers /api/envoi : les deux adresses mènent ici.
export default adapter(handler);
export const config = { path: ['/api/envoi', '/envoi'] };

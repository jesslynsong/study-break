import { getStore } from '@netlify/blobs';
import { createHandler } from '../../server/handler.mjs';
import { organiserVerifier } from '../../server/access-verifier.mjs';

export default createHandler({
  getStore: () => getStore({ name: 'study-break-event-v2', consistency: 'strong' }),
  getSecret: () => organiserVerifier
});
export const config = { path: '/api/*' };

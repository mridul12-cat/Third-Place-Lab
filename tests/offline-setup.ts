import { vi } from 'vitest';
// A missing fixture injection must fail, never contact the real Qloo service.
vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new Error('External HTTP is forbidden in the pre-API test suite. Inject a synthetic fetcher.'))));

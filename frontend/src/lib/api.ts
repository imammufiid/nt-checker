// Backwards-compatibility shim. New code should import from `lib/api/scans`
// (and friends) directly. This re-export keeps existing pages compiling while
// the M1 refactor lands page-by-page.
export { scansApi as api } from './api/scans';

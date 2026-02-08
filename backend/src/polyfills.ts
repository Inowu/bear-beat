/*
  Runtime polyfills for production stability.

  Node.js (newer versions) may not expose buffer.SlowBuffer anymore, but some
  transitive dependencies (e.g. buffer-equal-constant-time via jwa/jws) still
  reference it at require-time.
*/

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bufferMod: any = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('buffer');
  } catch {
    return null;
  }
})();

if (bufferMod && !bufferMod.SlowBuffer) {
  bufferMod.SlowBuffer = bufferMod.Buffer;
}


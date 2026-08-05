/**
 * No-op stand-in for the `server-only` package, for the standalone verification scripts.
 *
 * `server-only` is Next's build-time tripwire: importing it from a module that ends up in
 * a client bundle is a hard error. It is supplied by the bundler, so it does not resolve
 * under plain ts-node, and a script that imports a server-only data-access module dies at
 * require time with "Cannot find module 'server-only'".
 *
 * Mapping it here (see the `paths` entry in scripts/tsconfig.json) lets the scripts
 * exercise the REAL data-access layer — the same functions the app calls — instead of
 * re-implementing its queries and then verifying the re-implementation. The guarantee is
 * untouched: the shim is scoped to scripts/tsconfig.json and never reaches a Next build,
 * so a genuine client-side import of a server-only module still fails exactly as before.
 */
export {};

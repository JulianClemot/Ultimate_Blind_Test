/**
 * Hexagonal architecture guard rails for apps/server.
 *   domain          → depends on nothing
 *   application     → depends on domain only
 *   infrastructure  → may depend on application and domain
 *   compositionRoot → the only module wiring infrastructure together
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'domain-is-pure',
      comment: 'The domain must not depend on application, infrastructure or any npm package.',
      severity: 'error',
      from: { path: '^apps/server/src/domain' },
      to: {
        pathNot: ['^apps/server/src/domain'],
      },
    },
    {
      name: 'application-depends-on-domain-only',
      comment: 'Use cases talk to the outside world through ports, never through adapters.',
      severity: 'error',
      from: { path: '^apps/server/src/application', pathNot: '\\.test\\.ts$' },
      to: {
        pathNot: ['^apps/server/src/(application|domain)'],
      },
    },
    {
      name: 'infrastructure-is-only-wired-by-the-composition-root',
      severity: 'error',
      from: {
        path: '^apps/server/src/(domain|application|config)',
        pathNot: '\\.test\\.ts$',
      },
      to: { path: '^apps/server/src/infrastructure' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'apps/server/tsconfig.json' },
    exclude: { path: '(^|/)(dist|test)/' },
  },
};

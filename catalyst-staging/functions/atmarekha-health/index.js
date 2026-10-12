'use strict';

/**
 * Development-only liveness probe.
 *
 * This function intentionally:
 * - does not read or write the Data Store;
 * - does not return project IDs, secrets, configuration values, or user data;
 * - does not route any traffic or modify production systems.
 *
 * Create/deploy this function only in the Atmarekha Development environment.
 */
module.exports = (context, basicIO) => {
  const response = {
    service: 'atma-rekha-catalyst-staging',
    status: 'ok',
    environment: 'development',
    readiness: 'schema-staged-not-migration-ready',
    productionRouting: 'disabled',
  };

  basicIO.write(JSON.stringify(response));
  context.close();
};

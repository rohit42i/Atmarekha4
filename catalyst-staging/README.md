# Atma Rekha Catalyst staging bundle

This directory is intentionally separate from the Vite website build and the production deployment configuration. It is prepared for the dedicated Zoho Catalyst **Development** project:

- Project: `Atmarekha`
- Project ID: `81164000000013050`
- Environment: `Development`
- Domain: `https://atmarekha-60091620701.development.catalystserverless.in`

## Included now

`functions/atmarekha-health` is a dependency-free Basic I/O liveness probe. It reports only static staging status. It does not connect to the Data Store, process identities, read secrets, use production resources, or enable API Gateway.

## Important

- The function source is **not deployed**. The available Zoho Catalyst MCP has no function-source creation/upload/deploy action.
- The Catalyst console/CLI must create or import this function into the **Development** environment, then test its invocation and log behavior.
- The checked-in function bundle uses the documented Catalyst Basic I/O bundle structure and Node.js 22 configuration. Verify against the generated console bundle before deployment; don't change the stack/type in only one config.
- Do not include production secrets in this directory or in GitHub. Use Development-only environment variables configured in Catalyst.
- Do not change root website deployment workflows or route the live site to Catalyst as part of this staging phase.
- The health probe is not an API for reading or writing content and does not make the backend ready for migration.

Official guidance: [Basic I/O Functions](https://docs.catalyst.zoho.com/en/serverless/help/functions/basic-io/), [Function directory structure](https://docs.catalyst.zoho.com/en/cli/v1/project-directory-structure/functions-directory/), and [Catalyst SDK release notes](https://docs.catalyst.zoho.com/en/release-notes/sdk/).

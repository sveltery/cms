/**
 * Public types for the experimental plugin registry.
 *
 * Kept in their own module so they don't get re-bundled into the
 * `astro/integration/runtime.ts` chunk's dist output. tsdown / rolldown
 * are sensitive to which top-level types live alongside `definePlugin`'s
 * overloads, and pulling these types into the integration module
 * affected downstream `definePlugin()` overload resolution for trusted
 * plugins built against core's dist (see commit history for the
 * detailed write-up).
 */
export {};

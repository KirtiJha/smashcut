/**
 * Dynamically load the producer module. tsup inlines @smashcut/producer
 * via noExternal so this resolves in the published bundle.
 */
export async function loadProducer() {
  return await import("@smashcut/producer");
}

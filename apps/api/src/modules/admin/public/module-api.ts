/**
 * Public inter-module contract for AdminModule.
 *
 * It is deliberately method-free in this module. Adding methods before the
 * relevant feature implementation would invent internal contracts not locked by the
 * blueprint. Separate implementation work may extend this interface when a concrete,
 * blueprint-supported interaction is implemented.
 */
export interface AdminModuleApi {}

export const ADMIN_MODULE_API = Symbol('ADMIN_MODULE_API');

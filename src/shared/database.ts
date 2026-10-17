import { PrismaClient as NativeClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
export const databaseContext = new AsyncLocalStorage<{ jwt?: string; worker?: boolean }>();
let base: NativeClient | undefined;
let worker: NativeClient | undefined;
let auth: NativeClient | undefined;
let scoped: NativeClient | undefined;
function client(url?: string) { return new NativeClient(url ? { datasources: { db: { url } } } : undefined); }
function application() { return base ||= client(process.env.DATABASE_URL); }
function workerClient() {
  if (!process.env.WORKER_DATABASE_URL) throw new Error('Worker database access is not configured');
  return worker ||= client(process.env.WORKER_DATABASE_URL);
}
export function authenticationClient(): NativeClient {
  if (process.env.NODE_ENV === 'test') return client(process.env.AUTH_DATABASE_URL);
  if (!process.env.AUTH_DATABASE_URL) throw new Error('Authentication database access is not configured');
  return auth ||= client(process.env.AUTH_DATABASE_URL);
}
export function inWorkerContext<T>(operation: () => T): T { return databaseContext.run({ worker: true }, operation); }
function makeClient(): NativeClient {
  // Unit mocks still use the generated Prisma surface. Database RLS itself has no test bypass.
  if (process.env.NODE_ENV === 'test') return client(process.env.DATABASE_URL);
  if (scoped) return scoped;
  const raw = application();
  const extended = raw.$extends({ query: { $allOperations({ model, operation, args, query }: any) {
    const context = databaseContext.getStore();
    if (context?.worker) {
      const target: any = workerClient();
      return model ? target[model[0].toLowerCase()+model.slice(1)][operation](args) : (Array.isArray(args) ? target[operation](...args) : target[operation](args));
    }
    return raw.$transaction([
      raw.$queryRaw`SELECT set_config('app.jwt', ${context?.jwt || ''}, true)`,
      query(args),
    ]).then(results => results[1]);
  } } });
  scoped = new Proxy(extended, { get(target: any, property: string) {
    if (property === '$transaction') return (operation: any, options?: any) => {
      if (typeof operation !== 'function') throw new Error('Use an interactive transaction for tenant-scoped operations');
      const context = databaseContext.getStore();
      const connection = context?.worker ? workerClient() : raw;
      return connection.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT set_config('app.jwt', ${context?.worker ? '' : context?.jwt || ''}, true)`;
        return operation(tx);
      }, options);
    };
    const value = target[property];
    return typeof value === 'function' ? value.bind(target) : value;
  } }) as unknown as NativeClient;
  return scoped;
}
export type PrismaClient = NativeClient;
export const PrismaClient = function() { return makeClient(); } as unknown as typeof NativeClient;
export async function verifyDatabaseRoles() {
  if (process.env.DATABASE_ISOLATION_REQUIRED !== 'true') return;
  for (const [connection, name, bypass] of [[application(), 'servicing_crm_runtime', false], [authenticationClient(), 'servicing_crm_auth', false], [workerClient(), 'servicing_crm_worker', true]] as const) {
    const rows = await connection.$queryRaw<any[]>`SELECT current_user AS name, r.rolsuper, r.rolbypassrls FROM pg_roles r WHERE r.rolname = current_user`;
    if (rows[0]?.name !== name || rows[0]?.rolsuper || rows[0]?.rolbypassrls !== bypass) throw new Error('Unsafe database role configuration');
  }
}

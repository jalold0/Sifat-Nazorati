/**
 * Tranzaksiya chegarasi (application qatlamida belgilanadi, infrastructure amalga oshiradi).
 *
 *   await deps.uow.run(async (tx) => {
 *     const id = await deps.audits(tx).create(...);   // hamma repozitoriylar BITTA tranzaksiyada
 *     await deps.journal(tx).write(...);
 *   });
 *
 * `Tx` — shaffof tutqich: faqat infrastructure uni ochadi.
 */
declare const txBrand: unique symbol;
export interface Tx {
  readonly [txBrand]: true;
}

export interface UnitOfWork {
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

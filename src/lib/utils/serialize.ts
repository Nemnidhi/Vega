/**
 * What a value actually looks like after a JSON round-trip.
 *
 * `Date` becomes an ISO string, `ObjectId` and `Buffer` become whatever their `toJSON`
 * produces, and `undefined` members disappear. Declaring the return type as `T` claimed none
 * of that happened, so a caller could write `serializeForJson(task).dueAt.getTime()` and have
 * it typecheck cleanly, then fail at runtime on a string. Mapping the type here moves that
 * failure to compile time.
 */
export type Serialized<T> = T extends Date
  ? string
  : T extends { toHexString(): string } // ObjectId and friends
    ? string
    : T extends (infer Item)[]
      ? Serialized<Item>[]
      : T extends readonly (infer Item)[]
        ? readonly Serialized<Item>[]
        : T extends object
          ? { [Key in keyof T]: Serialized<T[Key]> }
          : T;

/**
 * Deep-clone a value into plain JSON, for handing Mongoose documents to a Response or a
 * client component. See `Serialized` for what the round-trip changes.
 *
 * Values JSON cannot represent are dropped rather than converted - functions, symbols and
 * `undefined` members vanish, `Map` and `Set` become `{}`, and a cyclic object throws. None
 * of those appear in the lean documents this is used on.
 */
export function serializeForJson<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value)) as Serialized<T>;
}

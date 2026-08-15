import { ValueTransformer } from "typeorm";

/**
 * Postgres NUMERIC/DECIMAL columns come back from `pg` as strings (to avoid
 * silent float precision loss). We want plain JS numbers in the app layer,
 * so every decimal column uses this transformer.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : parseFloat(value),
};

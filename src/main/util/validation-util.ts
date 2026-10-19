import { type ZodType, type z } from 'zod'

export const validationUtil = {
  parse: <T extends ZodType>(objectToValidate: unknown, schema: T): z.infer<T> => {
    return schema.parse(objectToValidate)
  },
  safeParse: <T extends ZodType>(objectToValidate: unknown, schema: T): z.ZodSafeParseResult<z.output<T>> => {
    return schema.safeParse(objectToValidate)
  },
}

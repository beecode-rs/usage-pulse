import { type ZodType, type z } from 'zod'

export const validationUtil = {
  parse: <T extends ZodType>(objectToValidate: unknown, schema: T): z.infer<T> => {
    return schema.parse(objectToValidate)
  },
}

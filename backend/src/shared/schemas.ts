import { z } from 'zod';

const ID_INVALIDO = 'El ID tiene que ser un número entero positivo';

// Uso: const { id } = idParamSchema.parse(req.params)
export const idParamSchema = z.object({
  id: z.coerce.number({ error: ID_INVALIDO }).int({ error: ID_INVALIDO }).positive({ error: ID_INVALIDO }),
});

import { describe, expect, it } from 'vitest';
import { idParamSchema } from './schemas';

describe('idParamSchema', () => {
  it('convierte el :id de texto a número', () => {
    expect(idParamSchema.parse({ id: '7' })).toEqual({ id: 7 });
  });

  it.each(['abc', '0', '-3', '1.5'])('rechaza el id %j con un mensaje en español', (id) => {
    const result = idParamSchema.safeParse({ id });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['id'],
      message: 'El ID tiene que ser un número entero positivo',
    });
  });
});

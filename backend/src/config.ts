// El compose pasa PORT=4000 (§5.2). Las variables PG* las lee pg solo (ver db/pool.ts).
export const config = {
  port: Number(process.env.PORT) || 4000,
};

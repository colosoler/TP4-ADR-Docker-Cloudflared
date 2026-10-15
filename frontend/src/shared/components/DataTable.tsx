import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'Todavía no hay registros.',
}: DataTableProps<T>) {
  const data = rows ?? [];

  return (
    // En pantallas chicas la tabla scrollea dentro de su contenedor, no la página.
    <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm tabular-nums" aria-busy={loading}>
        <thead className="border-b border-borde bg-hundido font-display text-[0.8125rem] font-semibold tracking-wider text-tinta-suave uppercase">
          <tr>
            {columns.map((col) => (
              <th key={col.header} scope="col" className="px-4 py-3 whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-tinta-suave">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-tinta-suave">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)} className="border-t border-borde hover:bg-fondo">
                {columns.map((col) => (
                  <td key={col.header} className="px-4 py-3 align-middle">
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

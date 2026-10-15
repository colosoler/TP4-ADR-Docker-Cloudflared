export function DbDownBanner({ visible }: { visible: boolean }) {
  return (
    // El contenedor con role="status" siempre está en el DOM para que el lector de pantalla anuncie el cambio.
    <div role="status">
      {visible && (
        <div className="border-b border-peligro/30 bg-peligro-claro">
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-sm font-medium text-peligro sm:px-6">
            <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-peligro" />
            La base de datos no responde. Reintentamos cada 5 segundos.
          </p>
        </div>
      )}
    </div>
  );
}

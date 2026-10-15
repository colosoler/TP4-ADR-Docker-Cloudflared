import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="py-10">
      <h1 className="titulo-pagina">Página no encontrada</h1>
      <p className="mt-2 text-tinta-suave">La dirección que abriste no existe.</p>
      <Link to="/autos" className="btn-secundario mt-6">
        Volver a Autos
      </Link>
    </section>
  );
}

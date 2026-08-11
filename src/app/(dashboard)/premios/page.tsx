import { getPremios } from '@/lib/db/premios';
import { PremiosList } from './premios-list';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ estado?: string; page?: string }>;
}

export default async function PremiosPage({ searchParams }: Props) {
  const sp = await searchParams;
  const estado = (sp.estado === 'entregado' ? 'entregado' : 'pendiente') as
    | 'pendiente'
    | 'entregado';
  const page = Math.max(1, parseInt(sp.page || '1'));

  const { premios, total } = await getPremios(estado, page);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Premios {total > 0 && <span className="text-base font-normal text-zinc-400">({total})</span>}
      </h1>

      <PremiosList premios={premios} total={total} estadoInicial={estado} page={page} />
    </div>
  );
}

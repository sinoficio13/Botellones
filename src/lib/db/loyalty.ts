// ── Shared loyalty detection ──
// Used by the single-flow `registrarRecarga` and the batch-flow `registrarCarga`.
// Runs premio (every 100 recargas) + premio_cerca (5 before next level) checks
// once per distinct client, with unique-index idempotency on premios.

export const REALIZADA_POR_PLACEHOLDER = '00000000-0000-0000-0000-000000000000';

export type PremioGenerado = { nivel: number; id: string };

export type LoyaltyResult = { premios: PremioGenerado[] };

function getSupabase() {
  return import('@supabase/supabase-js').then(({ createClient }) => {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      '';
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  });
}

export async function procesarLoyalty(
  clientIds: string[],
  realizadaPor: string = REALIZADA_POR_PLACEHOLDER
): Promise<LoyaltyResult> {
  const premios: PremioGenerado[] = [];
  const distinctClientIds = [...new Set(clientIds)];

  if (distinctClientIds.length === 0) return { premios };

  const supabase = await getSupabase();

  for (const clienteId of distinctClientIds) {
    const { count } = await supabase
      .from('recargas')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId);

    const totalRecargas = count ?? 0;

    // ── Premio: every 100 recargas ──
    // Unique index uq_premios_cliente_nivel makes this idempotent: a duplicate
    // insert (23505) means another request already handled it, so we skip.
    if (totalRecargas > 0 && totalRecargas % 100 === 0) {
      const { data: premioData, error: premioError } = await supabase
        .from('premios')
        .insert({
          cliente_id: clienteId,
          nivel_recargas: totalRecargas,
          estado: 'pendiente',
          fecha_alcanzado: new Date().toISOString().slice(0, 10),
        })
        .select('id')
        .single();

      if (premioError) {
        if (premioError.code === '23505') {
          // Duplicate — already handled in another request, do nothing
        } else {
          console.error('Error inserting premio:', premioError);
        }
      } else if (premioData) {
        premios.push({ nivel: totalRecargas, id: premioData.id });

        const { data: clienteData } = await supabase
          .from('clientes')
          .select('nombre')
          .eq('id', clienteId)
          .single();

        const clienteName = clienteData?.nombre || 'Cliente';

        await supabase.from('notificaciones').insert({
          tipo: 'premio',
          titulo: `¡${clienteName} alcanzó ${totalRecargas} recargas!`,
          mensaje: `Premio pendiente — nivel ${totalRecargas}`,
          usuario_id: realizadaPor,
          cliente_id: clienteId,
        });
      }
    }

    // ── premio_cerca: notify when client is 5 recargas away from next prize ──
    // Triggered at 95, 195, 295, 395, etc. (not at exact multiples of 100)
    if (totalRecargas > 0 && (totalRecargas + 5) % 100 === 0 && totalRecargas % 100 !== 0) {
      const nextLevel = Math.ceil(totalRecargas / 100) * 100;
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nombre')
        .eq('id', clienteId)
        .single();

      const clienteNombre = clienteData?.nombre || 'Cliente';

      // Query all profiles — small user base (EPIC-1 will add role filtering)
      const { data: perfiles } = await supabase.from('perfiles').select('id');

      if (perfiles?.length) {
        const inserts = perfiles.map((p) =>
          supabase.from('notificaciones').insert({
            tipo: 'premio_cerca',
            titulo: `¡${clienteNombre} está a 5 recargas del premio!`,
            mensaje: `${clienteNombre} tiene ${totalRecargas} recargas. Le faltan 5 para el nivel ${nextLevel}.`,
            usuario_id: p.id,
            cliente_id: clienteId,
          })
        );
        await Promise.all(inserts);
      }
    }
  }

  return { premios };
}
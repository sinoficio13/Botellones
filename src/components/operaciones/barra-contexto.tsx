export type BarraContextoProps = {
  clientes: number;
  botellones: number;
};

/**
 * BarraContexto — queue context bar (REQ-COS-17): "N clientes · N botellones
 * · más antiguo arriba". Singular/plural in Spanish; tokens only.
 */
export function BarraContexto({ clientes, botellones }: BarraContextoProps) {
  const textoClientes = clientes === 1 ? '1 cliente' : `${clientes} clientes`;
  const textoBotellones = botellones === 1 ? '1 botellón' : `${botellones} botellones`;
  return (
    <p className="text-xs text-text-muted">
      {textoClientes} · {textoBotellones} · más antiguo arriba
    </p>
  );
}
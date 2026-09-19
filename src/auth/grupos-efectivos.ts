export type GrupoEfectivo =
  | 'jugadores'
  | 'editores'
  | 'administradores';

const GRUPOS_CONOCIDOS: readonly GrupoEfectivo[] = [
  'jugadores',
  'editores',
  'administradores',
];

export function obtenerGruposEfectivos(
  claim: unknown,
): GrupoEfectivo[] {
  if (claim === undefined) {
    return ['jugadores'];
  }

  if (!Array.isArray(claim)) {
    return [];
  }

  if (claim.length === 0) {
    return ['jugadores'];
  }

  if (
    claim.some((grupo) => typeof grupo !== 'string')
  ) {
    return [];
  }

  const gruposConocidos = claim.filter(
    (grupo): grupo is GrupoEfectivo =>
      GRUPOS_CONOCIDOS.includes(
        grupo as GrupoEfectivo,
      ),
  );

  return [...new Set(gruposConocidos)];
}

// ─────────────────────────────────────────────────────────────
// QUÉ HACE: Compara un valor con el capturado del código ANTES de un refactor. Si todavía
//           no se capturó, lo imprime ("SNAP nombre {...}") y falla, para copiarlo al
//           archivo *.spec.expected.ts correspondiente.
// POR QUÉ:  Los tests de caracterización fijan lo que el código hace hoy, no lo que
//           "debería" hacer: los números salen de una corrida real, no se calculan a mano.
// ─────────────────────────────────────────────────────────────
export function matchCaptured(
  expected: Record<string, unknown>,
  name: string,
  actual: unknown,
): void {
  // Pasar por JSON descarta las propiedades undefined (igual que el archivo capturado).
  const plain = actual === undefined ? undefined : JSON.parse(JSON.stringify(actual));
  if (!(name in expected)) {
    console.log(`SNAP ${name} ${JSON.stringify(plain)}`);
    fail(`falta el valor capturado de "${name}"`);
    return;
  }
  expect(plain).toEqual(expected[name]);
}

// Prueba temporal que falla a propósito para demostrar que CI bloquea el merge (HU-38). No se fusiona.
describe('CI failure proof', () => {
  it('always fails', () => {
    expect(1).toBe(2);
  });
});

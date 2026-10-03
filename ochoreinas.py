class OchoReinas:
    def __init__(self, n=8):
        self.n = n
        self.tablero = [-1] * n
        self.soluciones = []

    def es_seguro(self, fila, col):
        for f in range(fila):
            c = self.tablero[f]
            if c == col or abs(c - col) == abs(f - fila):
                return False
        return True

    def resolver(self, fila=0):
        if fila == self.n:
            self.soluciones.append(list(self.tablero))
            return True

        for col in range(self.n):
            if self.es_seguro(fila, col):
                self.tablero[fila] = col
                if self.resolver(fila + 1):
                    return True
                self.tablero[fila] = -1

        return False

    def imprimir_solucion(self, indices_solucion=0):
        if not self.soluciones:
            print("No hay soluciones.")
            return

        sol = self.soluciones[indices_solucion]
        print(f"Solución vectorial: {sol}")
        print("  " + " ".join([str(i) for i in range(self.n)]))
        for f in range(self.n):
            fila_repr = [("Q" if sol[f] == c else ".") for c in range(self.n)]
            print(f"{f} " + " ".join(fila_repr))
        print()


if __name__ == "__main__":
    print("=== PROBLEMA DE LAS 8 REINAS ===")
    reinas8 = OchoReinas(n=8)
    reinas8.resolver()
    reinas8.imprimir_solucion()

    print("=== PRUEBA TABLERO 4x4 ===")
    reinas4 = OchoReinas(n=4)
    reinas4.resolver()
    reinas4.imprimir_solucion()
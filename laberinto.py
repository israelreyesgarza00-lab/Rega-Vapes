class LaberintoSolver:
    def __init__(self, laberinto):
        self.grid = [fila[:] for fila in laberinto]
        self.filas = len(laberinto)
        self.columnas = len(laberinto[0])

    def resolver(self, x, y):
        if x < 0 or x >= self.filas or y < 0 or y >= self.columnas:
            return False

        if self.grid[x][y] == 'E':
            return True

        if self.grid[x][y] != '.' and self.grid[x][y] != 'S':
            return False

        es_inicio = (self.grid[x][y] == 'S')
        if not es_inicio:
            self.grid[x][y] = '*'

        direcciones = [(1, 0), (0, 1), (-1, 0), (0, -1)]
        for dx, dy in direcciones:
            if self.resolver(x + dx, y + dy):
                return True

        if not es_inicio:
            self.grid[x][y] = 'x'
        return False

    def imprimir(self):
        for fila in self.grid:
            print(" ".join(fila))
        print()


if __name__ == "__main__":
    laberinto_1 = [
        ['S', '.', '#', '#', '#'],
        ['#', '.', '.', '.', '#'],
        ['#', '#', '#', '.', '#'],
        ['#', '.', '.', '.', '.'],
        ['#', '#', '#', '#', 'E']
    ]

    print("=== LABERINTO 1 ===")
    solver1 = LaberintoSolver(laberinto_1)
    if solver1.resolver(0, 0):
        solver1.imprimir()
    else:
        print("No existe salida.")

    laberinto_2 = [
        ['S', '.', '#'],
        ['#', '#', '#'],
        ['.', '.', 'E']
    ]

    print("=== LABERINTO 2 ===")
    solver2 = LaberintoSolver(laberinto_2)
    if solver2.resolver(0, 0):
        solver2.imprimir()
    else:
        print("No existe salida para este laberinto.")
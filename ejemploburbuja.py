def ordenamiento_burbuja(lista):
    n = len(lista)
    
    # Recorremos todos los elementos de la lista
    for i in range(n):
        # Bandera para optimizar: si no hay intercambios, la lista ya está ordenada
        intercambio = False
        
        # Los últimos i elementos ya están en su posición correcta
        for j in range(0, n - i - 1):
            # Comparamos elementos adyacentes
            if lista[j] > lista[j + 1]:
                # Intercambiamos si el elemento actual es mayor que el siguiente
                lista[j], lista[j + 1] = lista[j + 1], lista[j]
                intercambio = True
        
        # Si no hubo intercambios en esta pasada, terminamos antes
        if not intercambio:
            break
            
    return lista

# Ejemplo de uso:
numeros = [64, 100, 25, 12, 22, 11, 90]
print("Lista original:", numeros)

numeros_ordenados = ordenamiento_burbuja(numeros)
print("Lista ordenada:", numeros_ordenados)


catalogo = [
    {"codigo": "apple-macbook", "marca": "Apple", "modelo": "MacBook", "precio": 22999},
    {"codigo": "apple-imac",    "marca": "Apple", "modelo": "iMac",    "precio": 29999},
    {"codigo": "hp-pavilion",   "marca": "HP",    "modelo": "Pavilion 15", "precio": 12999},
    {"codigo": "hp-elitebook",  "marca": "HP",    "modelo": "EliteBook 840", "precio": 21999},
    {"codigo": "dell-inspiron", "marca": "Dell",  "modelo": "Inspiron 14", "precio": 11999},
]

ordenes = []
contador_pedido = 1  


def buscar_computadora(codigo):
    """Busca una computadora en el catálogo por su código."""
    for comp in catalogo:
        if comp["codigo"] == codigo:
            return comp
    return None


def mostrar_catalogo():
    print("\n--- CATÁLOGO DE COMPUTADORAS ---")
    for comp in catalogo:
        print(f"[{comp['codigo']}] {comp['marca']} {comp['modelo']} "
              f"- ${comp['precio']:,}")


def crear_orden():
    global contador_pedido

    numero_pedido = f"PED-{contador_pedido:03d}"
    contador_pedido += 1

    cliente = input("Nombre del cliente: ")

    orden = {
        "numero_pedido": numero_pedido,
        "cliente": cliente,
        "items": [] 
    }
    while True:
        mostrar_catalogo()
        codigo = input("\nCódigo de la computadora a agregar "
                        "(Enter para terminar): ")

        if codigo == "":
            break

        comp = buscar_computadora(codigo)
        if comp is None:
            print("Ese código no existe en el catálogo.")
            continue

        cantidad = int(input("Cantidad: "))

        # Agregamos el item a la orden
        orden["items"].append({
            "marca": comp["marca"],
            "modelo": comp["modelo"],
            "precio": comp["precio"],
            "cantidad": cantidad
        })

    ordenes.append(orden)
    print(f"\nOrden {numero_pedido} creada con éxito.")
    return orden


def calcular_total(orden):
    total = 0
    for item in orden["items"]:
        total += item["precio"] * item["cantidad"]
    return total


def imprimir_orden(orden):
    print("\n" + "=" * 40)
    print("ORDEN DE COMPRA".center(40))
    print("=" * 40)
    print(f"Número de pedido: {orden['numero_pedido']}")
    print(f"Cliente: {orden['cliente']}")
    print("-" * 40)

    if len(orden["items"]) == 0:
        print("(Esta orden no tiene artículos)")
    else:
        for item in orden["items"]:
            subtotal = item["precio"] * item["cantidad"]
            print(f"{item['marca']} {item['modelo']} x{item['cantidad']} "
                  f"= ${subtotal:,}")

    print("-" * 40)
    print(f"TOTAL: ${calcular_total(orden):,}")
    print("=" * 40)


def buscar_orden(numero_pedido):
    for orden in ordenes:
        if orden["numero_pedido"] == numero_pedido:
            return orden
    return None


def listar_ordenes():
    if len(ordenes) == 0:
        print("\nNo hay órdenes generadas todavía.")
        return

    print("\n--- ÓRDENES GENERADAS ---")
    for orden in ordenes:
        print(f"{orden['numero_pedido']} - {orden['cliente']} "
              f"- Total: ${calcular_total(orden):,}")


def menu():
    while True:
        print("\n===== MENÚ =====")
        print("1. Ver catálogo")
        print("2. Crear nueva orden de compra")
        print("3. Ver todas las órdenes")
        print("4. Imprimir una orden")
        print("5. Salir")

        opcion = input("Elige una opción: ")

        if opcion == "1":
            mostrar_catalogo()

        elif opcion == "2":
            crear_orden()

        elif opcion == "3":
            listar_ordenes()

        elif opcion == "4":
            listar_ordenes()
            numero = input("\nNúmero de pedido a imprimir: ")
            orden = buscar_orden(numero)
            if orden is None:
                print("No se encontró esa orden.")
            else:
                imprimir_orden(orden)

        elif opcion == "5":
            print("¡Hasta luego!")
            break

        else:
            print("Opción no válida.")


if __name__ == "__main__":
    menu()
razon_social = input("Ingrese la razón social: ")
direccion = input("Ingrese la dirección: ")
telefono = input("Ingrese el teléfono: ")

n=int(input("Ingrese el número de articulos a ingresar: "))

articulos = []
subtotal = 0.0

for i in range(n):
    nombre = input("Ingrese el nombre del artículo: ")
    cantidad = int(input("Ingrese la cantidad del artículo: "))
    precio = float(input("Ingrese el precio del artículo: "))
    importe= cantidad * precio
    subtotal += importe
    articulos.append([nombre,cantidad,precio,importe])

iva= subtotal * 0.15
total= subtotal + iva

print("/n " + "="* 40)
print(razon_social)
print(direccion)
print("Telefono:", telefono)
print("="* 40)

print("Descripcion\tCant\tP.unit\tImporte")
print("-"*40)

for articulo in articulos:
    print(f"{articulo[0]}\t{articulo[1]}\t{articulo[2]:.2f}\t{articulo[3]:.2f}")

    print("-"*40)
    print(f"Subtotal: ${subtotal:.2f}")
    print(f"IVA (15%): ${iva:.2f}")
    print(f"Total: ${total:.2f}")
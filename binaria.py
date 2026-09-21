def busquedaBinaria(a,n,bajo,alto):
    if(alto < bajo):
          return -1
    else:
     mitad =(bajo  + alto) //2

    if(n == a[mitad]):
        return mitad
    if(n < a[mitad]):
       return busquedaBinaria(a,n,bajo,mitad -1)
    else:
       return busquedaBinaria(a,n,mitad +1,alto)

if __name__ == "__main__":
   arreglo =[25,29,31,34,43,58,61,67,70,75,77,89,97,120,125]

   n=int(input("Llave a buscar:"))
   resultado= busquedaBinaria(arreglo, n , 0, len(arreglo) -1)
   print("El elemento",n,"esta en la celda,", resultado)
         
         
        


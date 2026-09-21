class Perro:
    especie= 'mamifero'
    def __init__ (self,nombre,raza):
       print(f"Creando perro{nombre},{raza}")
       self.nombre=nombre
       self.raza=raza

    def __str__ (self):
     return f"Perro{self.nombre}{self.raza}"

    def ladra(self):
       print("guau")

       def camina(self,pasos):
          print(f"Caminando{pasos}pasos")

if __name__==" __main__ ": 
   mi_perro = Perro("Toby","Bulldog")
   mi_perro.ladra()
   mi_perro.camina(10)
   print(mi_perro)
                  
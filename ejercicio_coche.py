class Coche:
    
    marca = ''
    modelo = ''
    color = ''
    numero_de_puertas = 0
    cuenta_kilometros = 0
    velocidad = 0
    arrancado = False

    def __init__(self, marca, modelo, color, puertas):
        self.marca = marca
        self.modelo = modelo
        self.color = color
        self.numero_de_puertas = puertas

    def arrancar(self):
        if not self.arrancado:
            print('Roarrrr')
            self.arrancado = True
        else: 
            print('Kriiiiiiiiiiicccc')
     
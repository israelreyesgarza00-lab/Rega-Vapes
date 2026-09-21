def hanoi(disco,inicio,final,auxiliar):
    if disco==1:
        print("Pasar el disco de {} a {}".format(inicio,final))
    else:
        hanoi(disco-1,inicio,auxiliar,final)
        print("Pasar el disco de {} a {}".format(inicio,final))
        hanoi(disco-1,auxiliar,final,inicio)

if __name__ == "__main__":
    n=int(input("Numero de Discos:"))
    hanoi(n,"A","C","B")
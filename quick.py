def quickSort(x,lb,ub):
    if (lb >= ub):
        return
    j = partition(x,lb,ub)
    quickSort(x,lb, j-1)
    quickSort(x, j+1, ub)

if __name__ =="__main__":
    x=[87,34,52,90,21,87,345,210,33,56]
    print("Numeros desordenados")
    print(x)
    quickSort(x, 0, len(x)-1)
    print("Numeros ordenados")
    print(x)

def partition(x,lb,ub):
    a = x[lb]
    up=ub
    down=lb
    while (down<up):
        while(x[down]<=a and down < ub):
            down+=1
        while(x[up]>a):
            up-=1
        if(down<up):
            temp=x[down]
            x[down]=x[up]
            x[up]=a
            return up











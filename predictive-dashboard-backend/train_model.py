import pandas as pd
import pickle
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split

# load NASA dataset
df = pd.read_csv("train_FD001.txt", sep=" ", header=None)

df = df[[0,1,6,10,14]]
df.columns = ["unit","cycle","s2","s11","s15"]

# create RUL
max_cycle = df.groupby("unit")["cycle"].max()

df["RUL"] = df.apply(lambda r: max_cycle[r["unit"]] - r["cycle"], axis=1)

X = df[["cycle","s2","s11","s15"]]
y = df["RUL"]

X_train,X_test,y_train,y_test = train_test_split(X,y,test_size=0.2)

model = RandomForestRegressor()
model.fit(X_train,y_train)

pickle.dump(model, open("rul_model.pkl","wb"))

print("MODEL TRAINED")
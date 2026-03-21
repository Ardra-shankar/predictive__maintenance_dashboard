import sys
import pickle
import numpy as np
import warnings

warnings.filterwarnings("ignore")

model = pickle.load(open("rul_model.pkl", "rb"))

cycle = float(sys.argv[1])
s2 = float(sys.argv[2])
s11 = float(sys.argv[3])
s15 = float(sys.argv[4])

X = np.array([[cycle, s2, s11, s15]])

rul = float(model.predict(X)[0])

print(rul)
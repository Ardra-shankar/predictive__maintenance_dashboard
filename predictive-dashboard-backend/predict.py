import joblib
import sys
import pandas as pd
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

model = joblib.load(
    os.path.join(BASE_DIR, "rul_model.pkl")
)

data = list(map(float, sys.argv[1:]))

feature_names = [
'op1','op2','op3',
's1','s2','s3','s4','s5','s6','s7','s8','s9','s10',
's11','s12','s13','s14','s15','s16','s17','s18','s19','s20','s21'

]

df = pd.DataFrame([data], columns=feature_names)

prediction = model.predict(df)

print(prediction[0])
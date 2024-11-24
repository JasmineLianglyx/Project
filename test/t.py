from flask import Flask, request, jsonify, send_from_directory
import pandas as pd
import shap
from sklearn.ensemble import GradientBoostingClassifier

app = Flask(__name__, static_folder='static')

# Example model setup
X_train = pd.DataFrame({
    'Gender': [0, 1, 1, 0],
    'Married': [1, 1, 0, 0],
    'Dependents': [0, 1, 0, 1],
    'Education': [0, 2, 1, 3],
    'Self_Employed': [0, 1, 0, 0],
    'ApplicantIncome': [5000, 6000, 2500, 4000],
    'CoapplicantIncome': [0, 1500, 3000, 1000],
    'LoanAmount': [200, 250, 150, 180],
    'Loan_Amount_Term': [360, 360, 120, 360],
    'Credit_History': [1, 0, 1, 1],
    'Property_Area': [2, 1, 0, 2],
})
y_train = [1, 0, 1, 1]

model = GradientBoostingClassifier()
model.fit(X_train, y_train)

explainer = shap.TreeExplainer(model)

# Example test dataset
test_data = pd.DataFrame({
    'Gender': [1, 0, 1],
    'Married': [0, 1, 1],
    'Dependents': [1, 0, 1],
    'Education': [2, 1, 3],
    'Self_Employed': [0, 1, 0],
    'ApplicantIncome': [7000, 5000, 8000],
    'CoapplicantIncome': [0, 2000, 1500],
    'LoanAmount': [250, 300, 220],
    'Loan_Amount_Term': [360, 360, 240],
    'Credit_History': [1, 1, 0],
    'Property_Area': [0, 2, 1]
})

current_index = 0

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/get_data', methods=['GET'])
def get_data():
    global current_index
    if current_index >= len(test_data):
        current_index = 0  # Reset index if it exceeds the dataset length

    data = test_data.iloc[current_index].to_dict()
    current_index += 1
    return jsonify(data)

@app.route('/predict', methods=['POST'])
def predict():
    # Receive feature values from the request
    features = request.json
    input_data = pd.DataFrame([features], columns=X_train.columns)  # Ensure column names match

    # Make prediction
    prediction = model.predict(input_data)[0]

    # Calculate SHAP values
    shap_values = explainer.shap_values(input_data)

    # Prepare the response
    response = {
        'prediction': int(prediction),
        'shap_values': [list(map(float, s)) for s in shap_values],  # Convert to float for JSON serialization
        'expected_value': float(explainer.expected_value)  # Convert to float for JSON serialization
    }

    return jsonify(response)

if __name__ == "__main__":
    app.run(debug=True)

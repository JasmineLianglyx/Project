from flask import Flask, request, jsonify, render_template, redirect, url_for
import pandas as pd
import numpy as np
import shap
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

app = Flask(__name__)

# Pre-experiment survey route
@app.route('/')
def survey():
    return render_template('survey.html') 

@app.route('/instruction')
def instruction():
    return render_template('instruction.html')

@app.route('/training')
def training():
    return render_template('training.html') 

@app.route('/explanations')
def explanations():
    reset_globals()
    return render_template('explanations.html')

@app.route('/final')
def final():
    return render_template('final.html')

# Handle survey form submission
participants_data = {}
@app.route('/submit_survey', methods=['POST'])
def submit_survey():

    age = request.form['age']
    gender = request.form['gender']
    education = request.form['education']
    ai_familiarity = request.form['ai_familiarity']

    # Store participant data (you can save this to a database if needed)
    participants_data['age'] = age
    participants_data['gender'] = gender
    participants_data['education'] = education
    participants_data['ai_familiarity'] = ai_familiarity

    # Redirect to the experiment page
    return redirect(url_for('instruction'))

def reset_globals():
    global current_index, a_index
    current_index = -1
    a_index = -1


def load_and_preprocess_data(data):
    data = data.drop(['Loan_ID'], axis=1)
    dataset = data.copy()

    # Transform Gender column from Categorical Data to Binary:
    dataset['Gender'] = LabelEncoder().fit_transform(data['Gender'])
    dataset['Married'] = LabelEncoder().fit_transform(data['Married'])
    dataset['Dependents'] = LabelEncoder().fit_transform(data['Dependents'])
    dataset['Education'] = LabelEncoder().fit_transform(data['Education'])
    dataset['Self_Employed'] = LabelEncoder().fit_transform(data['Self_Employed'])
    dataset['Property_Area'] = LabelEncoder().fit_transform(data['Property_Area'])
    dataset = dataset.dropna()

    final_df = dataset.copy()
    y = final_df['Loan_Status']
    X = final_df.drop(['Loan_Status'], axis=1)

    return X, y


def find_min_change(model, data_instance, feature_ranges, step_sizes, current_prediction):
    minimal_changes = {}
    
    # Iterate through each feature to find the minimal change that flips the prediction
    for idx, (feature, range_values) in enumerate(feature_ranges.items()):
        original_value = data_instance[feature]
        step_size = step_sizes[feature]
        
        # Initialize variables to track the minimal change in both directions
        min_change_value = None
        min_change_direction = None
        
        # Define two directions: one toward the min value and one toward the max value
        if isinstance(range_values, list):  # Categorical variables
            possible_values = range_values
        else:  # Continuous variables, generate values based on step size
            min_val, max_val = range_values
            possible_values = list(np.arange(min_val, max_val + 1, step_size))
        
        # Two-directional search (starting from original_value)
        for direction in ['min_to_original', 'original_to_max']:
            if direction == 'min_to_original':
                # Iterate from the current value down to the min value
                check_values = list(np.arange(original_value, range_values[0] - step_size, -step_size))
            else:
                # Iterate from the current value up to the max value
                check_values = list(np.arange(original_value, range_values[-1] + step_size, step_size))
            
            # Check each value in the selected direction
            for new_value in check_values:
                if new_value != original_value:  # Only change if the value is different
                    modified_instance = data_instance.copy()
                    modified_instance[feature] = new_value
                    
                    # Get the new prediction after changing the feature
                    new_prediction = model.predict(modified_instance.values.reshape(1, -1))[0]
                    
                    # If the prediction flips, record the minimal change
                    if new_prediction != current_prediction:
                        # Keep track of the first minimal change in either direction
                        if min_change_value is None or abs(new_value - original_value) < abs(min_change_value - original_value):
                            min_change_value = new_value
                            min_change_direction = direction
                        break  # Stop once we find the minimal change for this feature in this direction
        
        # If a minimal change was found, record it
        if min_change_value is not None:
            minimal_changes[feature] = min_change_value
    
    return minimal_changes


train_data = pd.read_csv('./data/train.csv')
test_data = pd.read_csv('./data/test.csv')

X_train, y_train = load_and_preprocess_data(train_data)
X_test, y_test = load_and_preprocess_data(test_data)

logistic = LogisticRegression(
    C=1, 
    penalty='l2', 
    solver='liblinear', 
    max_iter=100,
    multi_class='auto'
)

model1 = joblib.load('./model/model1.pkl')
model2 = joblib.load('./model/model2.pkl')
model3 = joblib.load('./model/model3.pkl')
model1.fit(X_train, y_train)
model2.fit(X_train, y_train)
model3.fit(X_train, y_train)
model = model1


explainer = shap.LinearExplainer(model,X_train)

current_index = -1
a_index = -1


feature_ranges = {
    'Gender': [0, 1], 
    'Married': [0, 1],
    'Dependents': [0, 1, 2, 3],
    'Education': [0, 1],
    'Self_Employed': [0, 1],
    'ApplicantIncome': [0, 20000],
    'CoapplicantIncome': [0, 20000],
    'LoanAmount': [10, 1000],
    'Loan_Amount_Term': [6, 540],
    'Credit_History': [0, 1],
    'Property_Area': [0, 1, 2]
}

step_sizes = {
    'Gender': 1,
    'Married': 1,
    'Dependents': 1,
    'Education': 1,
    'Self_Employed': 1,
    'ApplicantIncome': 100,
    'CoapplicantIncome': 100,
    'LoanAmount': 10,
    'Loan_Amount_Term': 6,
    'Credit_History': 1,
    'Property_Area': 1
}


@app.route('/get_data', methods=['GET'])
def get_data():
    global current_index

    if current_index >= len(X_test):
        current_index = -1
    
    if current_index == -1:
        data = X_test.iloc[0].to_dict()
    else:
        data = X_test.iloc[current_index].to_dict()

    current_index += 1

    return jsonify(data)

@app.route('/predict', methods=['POST'])
def predict():
    features = request.json
    input_data = pd.DataFrame([features], columns=X_train.columns)

    prediction = model.predict(input_data)[0]
    shap_values = explainer.shap_values(input_data)

    response = {
        'prediction': prediction,
        'shap_values': [list(map(float, s)) for s in shap_values],
        'expected_value': float(explainer.expected_value)
    }

    return jsonify(response)

@app.route('/get_accuracy', methods=['GET'])
def get_accuracy():
    # Make predictions on the test set
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    a = accuracy

    global a_index
    
    if a_index <4:
        a = 0.9
        model = model1
        a_index += 1
    elif 4<= a_index < 8:
        a = 0.7
        model = model2
        a_index += 1
    elif 8<= a_index < 12:
        a = 0.5
        model = model3
        a_index += 1
    else:
        a_index = -1
    
    # Return accuracy as a JSON response
    return jsonify({'accuracy': a * 100})

@app.route('/get_counterfactual', methods=['GET'])
def get_counterfactual():

    global current_index

    current_data = X_test.iloc[current_index-1]
    original_prediction = model.predict(current_data.values.reshape(1, -1))[0]
    
    min_changes = {}

    change = find_min_change(model, current_data, feature_ranges, step_sizes, original_prediction)

    return jsonify(change)

@app.route('/reset_visit_count', methods=['POST'])
def reset_visit_count():
    return "Visit count reset"



if __name__ == "__main__":
    app.run(debug=True)

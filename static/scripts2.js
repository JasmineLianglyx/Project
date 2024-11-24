let currentData = {};
let shapChart = null; // Variable to store the chart instance
let visitCount = 0;
let loopCount = 0;
const featureNameMap = {
        'Married': 'Married',
        'Dependents': 'Dependents',
        'Education': 'Education',
        'Self Employed': 'Self_Employed',
        'Applicant Income': 'ApplicantIncome',
        'Coapplicant Income': 'CoapplicantIncome',
        'Loan Amount': 'LoanAmount',
        'Loan Amount Term': 'Loan_Amount_Term',
        'Credit History': 'Credit_History',
        'Property Area': 'Property_Area'
    };

async function fetchData() {
    try {
        const response = await fetch('/get_data');
        const data = await response.json();
        currentData = data;

        // Only create controls if the controls section exists
        if (document.getElementById('controls')) {
            createControls(data);
        }

        displayDataInstance(data);
        //displayVisitCount(visitCount);
        //displayloopCount(loopCount);
        displayChart();
        updatePrediction();
        fetchCounterfactual();  // Fetch counterfactual based on the updated current data
        fetchAccuracy();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function fetchAccuracy() {
    try {
        const response = await fetch('/get_accuracy');
        const data = await response.json();
        if (data.accuracy > 90){
            document.getElementById('accuracy-result').textContent = `High`;
        }else if (data.accuracy < 90 && data.accuracy>=70){
            document.getElementById('accuracy-result').textContent = `Medium`;
        }else{
            document.getElementById('accuracy-result').textContent = `Low`;
        }
    } catch (error) {
        console.error('Error fetching accuracy:', error);
    }
}

async function fetchCounterfactual() {
    try {
        const response = await fetch('/get_counterfactual');
        const result = await response.json();
        
        // Ensure that you pass `currentData` or the relevant data object to displayCounterfactual
        displayCounterfactual(result, currentData);  // Pass currentData to ensure feature translation
    } catch (error) {
        console.error('Error fetching counterfactual data:', error);
    }
}


function displayDataInstance(data) {
    const table = document.getElementById('data-table');

    // Clear existing values
    table.rows[1].innerHTML = ''; // Clear the second row for values

    // Clear the explanations row if it exists
    const lastRow = table.rows[table.rows.length - 1];
    if (lastRow && lastRow.cells[0] && lastRow.cells[0].colSpan === 11) {
        table.deleteRow(table.rows.length - 1); // Remove the last row if it's the explanations row
    }

    // Populate feature names in the first row (already done in HTML)
    const featureLabels = {
        'Gender': data['Gender'] === 0 ? 'Female' : 'Male',
        'Married': data['Married'] === 0 ? 'No' : 'Yes',
        'Dependents': data['Dependents'],
        'Education': data['Education'] === 0 ? 'Graduate' : 'Not Graduate',
        'Self_Employed': data['Self_Employed'] === 0 ? 'No' : 'Yes',
        'ApplicantIncome': data['ApplicantIncome'],
        'CoapplicantIncome': data['CoapplicantIncome'],
        'LoanAmount': data['LoanAmount'],
        'Loan_Amount_Term': data['Loan_Amount_Term'],
        'Credit_History': data['Credit_History'] === 0 ? 'No' : 'Yes',
        'Property_Area': data['Property_Area'] === 0 ? 'Rural' : data['Property_Area'] === 1 ? 'Semiurban' : 'Urban'
    };

    table.rows[1].innerHTML = `
        <td>${featureLabels['Married']}</td>
        <td>${featureLabels['Dependents']}</td>
        <td>${featureLabels['Education']}</td>
        <td>${featureLabels['Self_Employed']}</td>
        <td>$${featureLabels['ApplicantIncome']}</td>
        <td>$${featureLabels['CoapplicantIncome']}</td>
        <td>$${featureLabels['LoanAmount']}k</td>
        <td>${featureLabels['Loan_Amount_Term']} Weeks</td>
        <td>${featureLabels['Credit_History']}</td>
        <td>${featureLabels['Property_Area']}</td>
    `;

    // Explanations for each feature
    const featureExplanations = {
        'Married': 'Whether the applicant is married.',
        'Dependents': 'Number of dependents the applicant has.',
        'Education': 'Education level of the applicant.',
        'Self Employed': 'Whether the applicant is self-employed.',
        'ApplicantIncome': 'Weekly income of the applicant.',
        'CoapplicantIncome': 'Weekly income of the coapplicant (if any).',
        'LoanAmount': 'Total loan amount requested.',
        'Loan Amount Term': 'Duration of the loan in weeks.',
        'Credit History': 'Whether the applicant has a credit history.',
        'Property Area': 'Type of area where the property is located (Rural, Semiurban, Urban).'
    };

    // Create explanations row
    const explanationsRow = document.createElement('tr');
    explanationsRow.innerHTML = `
        <td colspan="11" style="text-align: left;">
            <ul>
                ${Object.keys(featureExplanations).map(feature =>
                    `<li><strong>${feature}:</strong> ${featureExplanations[feature]}</li>`).join('')}
            </ul>
        </td>
    `;
    table.appendChild(explanationsRow);
}

async function displayChart(){

    const response = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData)
    });
    const result = await response.json();

    // Display SHAP values as a horizontal bar chart
    const shapValues = result.shap_values.flat();
    const featureNames = Object.keys(currentData);
    const ctx = document.getElementById('shap-bar').getContext('2d');

    if (shapChart) {
        shapChart.destroy(); // Destroy previous chart before creating a new one
    }

    // Determine colors based on SHAP value sign
    const colors = shapValues.map(value => value >= 0 ? 'rgba(75, 192, 192, 0.7)' : 'rgba(255, 99, 132, 0.7)');

    shapChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: featureNames,
            datasets: [{
                label: 'SHAP Values',
                data: shapValues,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value.toFixed(2);
                        }
                    }
                },
                y: {
                    ticks: {
                        autoSkip: false
                    }
                }
            }
        }
    });
}

function displayCounterfactual(counterfactualData, data) {
    const contentDiv = document.getElementById('counterfactual-content');
    contentDiv.innerHTML = ''; // Clear existing content

    // Define the feature label translation for current data
    const featureLabels = {
        'Gender': data['Gender'] === 0 ? 'Female' : 'Male',
        'Married': data['Married'] === 0 ? 'No' : 'Yes',
        'Dependents': data['Dependents'],
        'Education': data['Education'] === 0 ? 'Graduate' : 'Not Graduate',
        'Self_Employed': data['Self_Employed'] === 0 ? 'No' : 'Yes',
        'ApplicantIncome': data['ApplicantIncome'],
        'CoapplicantIncome': data['CoapplicantIncome'],
        'LoanAmount': data['LoanAmount'],
        'Loan_Amount_Term': data['Loan_Amount_Term'],
        'Credit_History': data['Credit_History'] === 0 ? 'No' : 'Yes',
        'Property_Area': data['Property_Area'] === 0 ? 'Rural' : data['Property_Area'] === 1 ? 'Semiurban' : 'Urban'
    };

    // Define how to translate feature values in the counterfactual data
    const featureValueTranslations = {
        'Gender': (value) => value === 0 ? 'Female' : 'Male',
        'Married': (value) => value === 0 ? 'No' : 'Yes',
        'Dependents': (value) => value,
        'Education': (value) => value === 0 ? 'Graduate' : 'Not Graduate',
        'Self_Employed': (value) => value === 0 ? 'No' : 'Yes',
        'ApplicantIncome': (value) => value,
        'CoapplicantIncome': (value) => value,
        'LoanAmount': (value) => value,
        'Loan_Amount_Term': (value) => value,
        'Credit_History': (value) => value === 0 ? 'No' : 'Yes',
        'Property_Area': (value) => value === 0 ? 'Rural' : value === 1 ? 'Semiurban' : 'Urban'
    };


    // Reverse map to find human-readable feature names
    const reverseFeatureNameMap = Object.entries(featureNameMap).reduce((acc, [displayName, datasetName]) => {
        acc[datasetName] = displayName;
        return acc;
    }, {});

    // Display each key-value pair in the counterfactual data
    for (const [feature, minChange] of Object.entries(counterfactualData)) {
        const humanReadableFeature = reverseFeatureNameMap[feature] || feature;
        
        // Use the featureValueTranslations mapping to correctly translate the minChange value
        const translatedValue = featureValueTranslations[feature] 
            ? featureValueTranslations[feature](minChange) 
            : minChange;

        // Create the `p` element
        const p = document.createElement('p');
        p.innerHTML = `Changing the value of <span style="color: #007bff;"><strong>${humanReadableFeature}</strong></span> to <span style="color: #007bff;"><strong>${translatedValue}</strong></span> will affect the prediction result.`;
        contentDiv.appendChild(p);
    }
}

function updateValue(displayFeature, value) {
    const datasetFeature = featureNameMap[displayFeature]; // Get the dataset feature name
    document.getElementById(`${displayFeature}-value`).textContent = value;
    currentData[datasetFeature] = parseFloat(value); // Update using the correct feature name
}

function updateDropdownValue(displayFeature, value) {
    const datasetFeature = featureNameMap[displayFeature]; // Get the dataset feature name
    currentData[datasetFeature] = parseFloat(value);
}

function createControls(data) {
    const features = {
        'Married': { type: 'dropdown', options: [[0, 'No'], [1, 'Yes']], value: data['Married'] },
        'Dependents': { type: 'dropdown', options: [[0, '0'], [1, '1'], [2, '2'], [3, '3+']], value: data['Dependents'] },
        'Education': { type: 'dropdown', options: [[0, 'Graduate'], [1, 'Not Graduate']], value: data['Education'] },
        'Self Employed': { type: 'dropdown', options: [[0, 'No'], [1, 'Yes']], value: data['Self_Employed'] },
        'Applicant Income': { type: 'slider', min: 0, max: 20000, value: data['ApplicantIncome'], step: 100 },
        'Coapplicant Income': { type: 'slider', min: 0, max: 20000, value: data['CoapplicantIncome'], step: 100 },
        'Loan Amount': { type: 'slider', min: 0, max: 1000, value: data['LoanAmount'], step: 10 },
        'Loan Amount Term': { type: 'slider', min: 6, max: 540, value: data['Loan_Amount_Term'], step: 6 },
        'Credit History': { type: 'dropdown', options: [[0, 'No'], [1, 'Yes']], value: data['Credit_History'] },
        'Property Area': { type: 'dropdown', options: [[0, 'Rural'], [1, 'Semiurban'], [2, 'Urban']], value: data['Property_Area'] }
    };

    const controlsDiv = document.getElementById('controls');
    controlsDiv.innerHTML = ''; // Clear existing controls

    for (const feature in features) {
        const controlContainer = document.createElement('div');

        if (features[feature].type === 'slider') {
            controlContainer.innerHTML = `
                <label for="${feature}">${feature}</label>
                <input type="range" id="${feature}" class="slider" min="${features[feature].min}" max="${features[feature].max}" value="${features[feature].value}" step="${features[feature].step}" oninput="updateValue('${feature}', this.value)">
                <span id="${feature}-value">${features[feature].value}</span>
            `;
        } else if (features[feature].type === 'dropdown') {
            const options = features[feature].options.map(([optionValue, label]) =>
                `<option value="${optionValue}" ${optionValue == features[feature].value ? 'selected' : ''}>${label}</option>`
            ).join('');
            controlContainer.innerHTML = `
                <label for="${feature}">${feature}</label>
                <select id="${feature}" class="dropdown" onchange="updateDropdownValue('${feature}', this.value)">
                    ${options}
                </select>
            `;
        }

        controlsDiv.appendChild(controlContainer);
    }
}

async function updatePrediction() {
    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentData)
        });
        const result = await response.json();
        // Translate the prediction result
        const predictionText = result.prediction === 'Y' ? 'Will Be Approved' : 'Will Not Be Approved';
        document.getElementById('prediction-result').textContent = `Prediction: ${predictionText}`;
        // Change the text color based on the prediction result
        document.getElementById('prediction-result').style.color = result.prediction === 'Y' ? '#4BC0C0' : '#FF6384';

    } catch (error) {
        console.error('Error updating prediction:', error);
    }
}

// Function to update the display of visit count on the page
function displayVisitCount(visitCount) {
    const visitCountDisplay = document.getElementById('visit-count-display');
    if (visitCountDisplay) {
        visitCountDisplay.textContent = `Visit Count: ${visitCount}`;
    }
}

// Function to update the display of visit count on the page
function displayloopCount(loopCount) {
    const loopCountDisplay = document.getElementById('loop-count-display');
    if (loopCountDisplay) {
        loopCountDisplay.textContent = `Loop Count: ${loopCount}`;
    }
}

// Function to increment the visit count and save it
function incrementVisitCount() {
    visitCount = visitCount + 1;
}

// Function to increment the visit count and save it
function incrementLoopCount() {
    loopCount = loopCount + 1;
}

// Function to update the visibility of sections based on visit count
function updatePageContent() {
    // Clear the prediction (uncheck all radio buttons)
    const predictionRadios = document.querySelectorAll('input[name="prediction"]');
    predictionRadios.forEach(radio => {
        radio.checked = false; // Uncheck all radio buttons
    });

    const accuracySection = document.getElementById('accuracy');
    const predictionSection = document.getElementById('prediction');
    const prediction1Section = document.getElementById('prediction1');

    const shapSection = document.getElementById('shap');
    const counterfactualSection = document.getElementById('counterfactual');
    const interactivePanel = document.getElementById('interactive-panel');
    const predictButton = document.getElementById('predict-button');

    const prediction2Section = document.getElementById('prediction2');
    const scoreSection = document.getElementById('score');

    // Reset visibility of sections
    accuracySection.style.display = 'none';
    predictionSection.style.display = 'none';
    prediction1Section.style.display = 'none';

    shapSection.style.display = 'none';
    counterfactualSection.style.display = 'none';
    interactivePanel.style.display = 'none';
    predictButton.style.display = 'none';

    prediction2Section.style.display = 'none';
    scoreSection.style.display = 'none';

    // Determine which sections to show based on visit count
    if (visitCount % 2 == 0) {
        // Odd visitCount: Show prediction1
        fetchData();
        prediction1Section.style.display = 'block';
    } else {
        predictionSection.style.display = 'block';
        accuracySection.style.display = 'block';
        prediction2Section.style.display = 'block';
        scoreSection.style.display = 'block';
    }
}

// Function to simulate clicking "Next"
function nextData() {
    const predictionSelected = document.querySelector('input[name="prediction"]:checked');
    if (!predictionSelected) {
        alert('Please make a prediction before proceeding.');
        return; // Stop moving to the next step if no prediction is selected
    }
    // Check if the slider is visible and its value is still at the initial 0 value
    const comprehensionOutput= document.getElementById('comprehension-output');
    const comprehensionSlider = document.getElementById('comprehension');
    const scoreSection = document.getElementById('score');
    if (scoreSection.style.display !== 'none' && comprehensionOutput.style.visibility == 'hidden') {
        alert('Please adjust the slider to reflect your understanding before proceeding.');
        return; // Stop moving to the next step if the slider is visible and not adjusted
    }
    // Reset the slider and output for the next page
    comprehensionSlider.value = '0';  // Reset slider to 0
    comprehensionOutput.value = '';   // Clear the output display
    comprehensionOutput.style.visibility = 'hidden';  // Hide the output until interaction

    if (loopCount < 3){
        incrementVisitCount(); // Increment visit count
        updatePageContent(); // Update sections based on the new count
    }else{
        window.location.href = '/final'; 
    }
}


document.addEventListener('DOMContentLoaded', () => {
    // Reset global variables by calling the Flask endpoint
    fetch('/reset_globals', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log(data.message);  // Log the response from the server
    })
    .catch(error => {
        console.error('Error resetting global variables:', error);
    });

    currentData = {};
    visitCount = 0;
    loopCount = 0;
    fetchData();  // Call your existing function to fetch data
    updatePageContent();
});

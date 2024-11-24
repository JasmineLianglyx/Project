from flask import Flask, request, jsonify, send_from_directory

app = Flask(__name__, static_folder='static')

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'untitled.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    data = request.json
    num1 = data.get('num1', 0)
    num2 = data.get('num2', 0)
    num3 = data.get('num3', 0)
    total_sum = num1 + num2 + num3
    return jsonify({'sum': total_sum})

if __name__ == '__main__':
    app.run(debug=True)


# ~/redmiedge/app/dashboard.py
from flask import Flask, render_template
from routes import bp as routes

app = Flask(__name__)
app.register_blueprint(routes)

@app.route('/')
def index():
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5050, threaded=True)

#!/usr/bin/env python3

from flask import Flask, jsonify
import psutil

app = Flask(__name__)

@app.route('/')
def get_storage_info():
    # Get storage information using psutil
    disk_usage = psutil.disk_usage('/home')

    # Format the information as a JSON response
    response = {
        'available_storage': disk_usage.free,
        'used_storage': disk_usage.used,
        'total_storage': disk_usage.total
    }

    # Send the JSON response
    return jsonify(response)

if __name__ == '__main__':
    app.run(port=8123)


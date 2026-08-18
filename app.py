import os
import json
import uuid
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')
DATA_DIR = os.path.join(BASE_DIR, 'data')
EVENTS_FILE = os.path.join(DATA_DIR, 'events.json')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
CORS(app)


def ensure_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.exists(EVENTS_FILE):
        with open(EVENTS_FILE, 'w') as f:
            json.dump([], f)
    if not os.path.exists(SETTINGS_FILE):
        default_settings = {
            "profile": {"name": "Admin User", "email": "admin@eventplanner.com"},
            "darkMode": False,
            "currency": "USD",
            "notifications": {
                "emailNotifications": True,
                "budgetAlerts": True,
                "eventReminders": True
            }
        }
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(default_settings, f, indent=2)


def read_events():
    try:
        with open(EVENTS_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return []


def write_events(events):
    with open(EVENTS_FILE, 'w') as f:
        json.dump(events, f, indent=2)


def read_settings():
    try:
        with open(SETTINGS_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def write_settings(settings):
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)


@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')


@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(STATIC_DIR, path)


# ── Events ────────────────────────────────────────────────────────────────────

@app.route('/ebp/events', methods=['GET'])
def get_events():
    return jsonify(read_events())


@app.route('/ebp/events', methods=['POST'])
def create_event():
    events = read_events()
    data = request.get_json()
    event = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', ''),
        'eventType': data.get('eventType', ''),
        'eventDate': data.get('eventDate', ''),
        'venue': data.get('venue', ''),
        'guestCount': data.get('guestCount', 0),
        'totalBudget': float(data.get('totalBudget', 0)),
        'description': data.get('description', ''),
        'status': data.get('status', 'Planning'),
        'expenses': [],
        'createdAt': datetime.now().isoformat()
    }
    events.append(event)
    write_events(events)
    return jsonify(event), 201


@app.route('/ebp/events/<event_id>', methods=['GET'])
def get_event(event_id):
    events = read_events()
    event = next((e for e in events if e['id'] == event_id), None)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(event)


@app.route('/ebp/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    events = read_events()
    idx = next((i for i, e in enumerate(events) if e['id'] == event_id), None)
    if idx is None:
        return jsonify({'error': 'Event not found'}), 404
    data = request.get_json()
    existing = events[idx]
    existing['name'] = data.get('name', existing['name'])
    existing['eventType'] = data.get('eventType', existing['eventType'])
    existing['eventDate'] = data.get('eventDate', existing['eventDate'])
    existing['venue'] = data.get('venue', existing['venue'])
    existing['guestCount'] = data.get('guestCount', existing['guestCount'])
    existing['totalBudget'] = float(data.get('totalBudget', existing['totalBudget']))
    existing['description'] = data.get('description', existing['description'])
    existing['status'] = data.get('status', existing['status'])
    existing['updatedAt'] = datetime.now().isoformat()
    events[idx] = existing
    write_events(events)
    return jsonify(existing)


@app.route('/ebp/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    events = read_events()
    events = [e for e in events if e['id'] != event_id]
    write_events(events)
    return jsonify({'success': True})


# ── Expenses ──────────────────────────────────────────────────────────────────

@app.route('/ebp/events/<event_id>/expenses', methods=['GET'])
def get_expenses(event_id):
    events = read_events()
    event = next((e for e in events if e['id'] == event_id), None)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(event.get('expenses', []))


@app.route('/ebp/events/<event_id>/expenses', methods=['POST'])
def create_expense(event_id):
    events = read_events()
    idx = next((i for i, e in enumerate(events) if e['id'] == event_id), None)
    if idx is None:
        return jsonify({'error': 'Event not found'}), 404
    data = request.get_json()
    expense = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', ''),
        'category': data.get('category', 'Miscellaneous'),
        'cost': float(data.get('cost', 0)),
        'date': data.get('date', ''),
        'createdAt': datetime.now().isoformat()
    }
    if 'expenses' not in events[idx]:
        events[idx]['expenses'] = []
    events[idx]['expenses'].append(expense)
    write_events(events)
    return jsonify(expense), 201


@app.route('/ebp/events/<event_id>/expenses/<expense_id>', methods=['PUT'])
def update_expense(event_id, expense_id):
    events = read_events()
    idx = next((i for i, e in enumerate(events) if e['id'] == event_id), None)
    if idx is None:
        return jsonify({'error': 'Event not found'}), 404
    expenses = events[idx].get('expenses', [])
    eidx = next((i for i, e in enumerate(expenses) if e['id'] == expense_id), None)
    if eidx is None:
        return jsonify({'error': 'Expense not found'}), 404
    data = request.get_json()
    existing = expenses[eidx]
    existing['name'] = data.get('name', existing['name'])
    existing['category'] = data.get('category', existing['category'])
    existing['cost'] = float(data.get('cost', existing['cost']))
    existing['date'] = data.get('date', existing['date'])
    existing['updatedAt'] = datetime.now().isoformat()
    expenses[eidx] = existing
    events[idx]['expenses'] = expenses
    write_events(events)
    return jsonify(existing)


@app.route('/ebp/events/<event_id>/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(event_id, expense_id):
    events = read_events()
    idx = next((i for i, e in enumerate(events) if e['id'] == event_id), None)
    if idx is None:
        return jsonify({'error': 'Event not found'}), 404
    events[idx]['expenses'] = [
        e for e in events[idx].get('expenses', []) if e['id'] != expense_id
    ]
    write_events(events)
    return jsonify({'success': True})


# ── Analytics ─────────────────────────────────────────────────────────────────

@app.route('/ebp/analytics', methods=['GET'])
def get_analytics():
    events = read_events()
    total_events = len(events)
    total_budget = sum(float(e.get('totalBudget', 0)) for e in events)
    all_expenses = [exp for e in events for exp in e.get('expenses', [])]
    total_spent = sum(float(exp.get('cost', 0)) for exp in all_expenses)

    by_status = {}
    for e in events:
        s = e.get('status', 'Planning')
        by_status[s] = by_status.get(s, 0) + 1

    by_type = {}
    for e in events:
        t = e.get('eventType', 'Other')
        by_type[t] = by_type.get(t, 0) + 1

    category_totals = {}
    for exp in all_expenses:
        cat = exp.get('category', 'Miscellaneous')
        category_totals[cat] = category_totals.get(cat, 0) + float(exp.get('cost', 0))

    monthly_spending = {}
    for exp in all_expenses:
        d = exp.get('date', '')
        if d and len(d) >= 7:
            month = d[:7]
            monthly_spending[month] = monthly_spending.get(month, 0) + float(exp.get('cost', 0))

    over_budget_events = []
    for e in events:
        spent = sum(float(x.get('cost', 0)) for x in e.get('expenses', []))
        budget = float(e.get('totalBudget', 0))
        if spent > budget:
            over_budget_events.append({'name': e.get('name', ''), 'over': spent - budget})

    return jsonify({
        'totalEvents': total_events,
        'totalBudget': total_budget,
        'totalSpent': total_spent,
        'remaining': total_budget - total_spent,
        'utilizationPercent': round((total_spent / total_budget * 100), 1) if total_budget > 0 else 0,
        'byStatus': by_status,
        'byType': by_type,
        'categoryTotals': category_totals,
        'monthlySpending': dict(sorted(monthly_spending.items())),
        'overBudgetEvents': over_budget_events,
        'totalExpenses': len(all_expenses)
    })


# ── Export ────────────────────────────────────────────────────────────────────

@app.route('/ebp/export/events/csv', methods=['GET'])
def export_events_csv():
    events = read_events()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Event Name', 'Type', 'Date', 'Venue', 'Guests',
        'Total Budget', 'Total Spent', 'Remaining', 'Utilization %', 'Status', 'Description'
    ])
    for e in events:
        spent = sum(float(x.get('cost', 0)) for x in e.get('expenses', []))
        budget = float(e.get('totalBudget', 0))
        remaining = budget - spent
        util = round(spent / budget * 100, 1) if budget > 0 else 0
        writer.writerow([
            e.get('name', ''),
            e.get('eventType', ''),
            e.get('eventDate', ''),
            e.get('venue', ''),
            e.get('guestCount', ''),
            budget,
            spent,
            remaining,
            f"{util}%",
            e.get('status', ''),
            e.get('description', '')
        ])
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=events_export.csv'}
    )


@app.route('/ebp/export/expenses/csv', methods=['GET'])
def export_expenses_csv():
    events = read_events()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['Event Name', 'Event Date', 'Expense Name', 'Category', 'Cost', 'Expense Date'])
    for e in events:
        for exp in e.get('expenses', []):
            writer.writerow([
                e.get('name', ''),
                e.get('eventDate', ''),
                exp.get('name', ''),
                exp.get('category', ''),
                exp.get('cost', 0),
                exp.get('date', '')
            ])
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename=expenses_export.csv'}
    )


# ── Settings ──────────────────────────────────────────────────────────────────

@app.route('/ebp/settings', methods=['GET'])
def get_settings():
    return jsonify(read_settings())


@app.route('/ebp/settings', methods=['PUT'])
def update_settings():
    settings = request.get_json()
    write_settings(settings)
    return jsonify(settings)


if __name__ == '__main__':
    ensure_data_dir()
    port = int(os.environ.get('PORT', 8000))
    print(f"Event Budget Planner running on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)

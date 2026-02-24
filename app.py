from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

app = Flask(__name__)
app.config['SECRET_KEY'] = 'nebula_secret_123'
# Configuração da Base de Dados SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nebula_chat.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# --- MODELO DA BASE DE DADOS ---
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), nullable=False)
    room = db.Column(db.String(50), nullable=False)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

# Cria a base de dados se não existir
with app.app_context():
    db.create_all()

rooms_members = {}

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('join')
def on_join(data):
    username = data['username']
    room = data['room']
    join_room(room)
    
    if room not in rooms_members:
        rooms_members[room] = []
    if username not in rooms_members[room]:
        rooms_members[room].append(username)
    
    # 1. CARREGAR HISTÓRICO: Procura as últimas 50 mensagens desta sala
    history = Message.query.filter_by(room=room).order_by(Message.timestamp.asc()).limit(50).all()
    for msg in history:
        # Envia apenas para o usuário que acabou de entrar
        emit('receive_message', {
            'username': msg.username,
            'message': msg.content,
            'time': msg.timestamp.strftime('%H:%M')
        })

    emit('receive_message', {
        'username': 'SISTEMA',
        'message': f'🚀 {username} entrou na órbita.'
    }, room=room)
    
    emit('update_members', {'members': rooms_members[room]}, room=room)
    emit('user_count', {'count': sum(len(m) for m in rooms_members.values())}, broadcast=True)

@socketio.on('send_message')
def handle_message(data):
    # 2. SALVAR NO BANCO: Cria um novo registo de mensagem
    new_msg = Message(
        username=data['username'],
        room=data['room'],
        content=data['message']
    )
    db.session.add(new_msg)
    db.session.commit()
    
    # Envia para todos na sala
    emit('receive_message', data, room=data['room'])

@socketio.on('typing')
def handle_typing(data):
    emit('display_typing', data, room=data['room'], include_self=False)

@socketio.on('stop_typing')
def handle_stop_typing(data):
    emit('hide_typing', room=data['room'], include_self=False)

@socketio.on('leave')
def on_leave(data):
    username = data['username']
    room = data['room']
    leave_room(room)
    
    if room in rooms_members and username in rooms_members[room]:
        rooms_members[room].remove(username)
        
    emit('update_members', {'members': rooms_members[room]}, room=room)

if __name__ == '__main__':
    socketio.run(app, debug=True)
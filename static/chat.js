var socket = io();
var username = "";
var room = "";
let picker;
let unreadCount = 0;
let isChatVisible = true;
let typingTimeout;

// --- 1. CONEXÃO E ENTRADA ---
function entrarNaSala() {
    var userInp = document.getElementById('username');
    var roomInp = document.getElementById('room');
    
    username = userInp.value.trim();
    room = roomInp.value.trim();

    if (username && room) {
        document.getElementById('login-area').style.display = 'none';
        document.getElementById('chat-area').style.display = 'flex';
        document.getElementById('room-display').innerText = "SALA: " + room.toUpperCase();
        
        socket.emit('join', {username: username, room: room});
        isChatVisible = true;
        
        if(typeof lucide !== 'undefined') lucide.createIcons();
    } else {
        alert("Preencha todos os campos, astronauta! 🚀");
    }
}

// --- 2. LOGICA DE MENSAGENS ---
function enviarMensagem() {
    var input = document.getElementById('message-input');
    var messageText = input.value.trim();

    if (messageText !== "") {
        socket.emit('send_message', {
            username: username, 
            room: room, 
            message: messageText
        });
        input.value = '';
        fecharEmojiPicker();
    }
}

socket.on('receive_message', function(data) {
    const isMe = (data.username === username);
    
    // Se o tempo vier do banco, usa ele. Se não, gera o atual.
    const timestamp = data.time || new Date().getHours() + ":" + new Date().getMinutes().toString().padStart(2, '0');

    renderizarMensagem(data, isMe, timestamp);

    if (!isChatVisible && !isMe) {
        unreadCount++;
        const badge = document.getElementById('notif-badge');
        badge.innerText = unreadCount;
        badge.style.display = 'block';
        showFloatingPreview(data.username, data.message || data.text);
    }
});

// Gera um gradiente bonito baseado no nome
// Gera gradientes bonitos em vez de cores sólidas chatas
function gerarGradiente(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `linear-gradient(135deg, hsl(${hue}, 80%, 60%), hsl(${(hue + 40) % 360}, 80%, 40%))`;
}

// Renderiza as mensagens na tela
function renderizarMensagem(data, isMe, time) {
    const messagesDiv = document.getElementById('messages');
    const messageRow = document.createElement('div');
    const isSystem = data.username === 'SISTEMA';

    // Define de quem é a mensagem
    messageRow.classList.add('message-row');
    if (isMe) messageRow.classList.add('me');
    if (isSystem) messageRow.classList.add('system');

    let htmlContent = '';

    // Se for o servidor falando (ex: "SISTEMA: Luiz entrou")
    if (isSystem) {
        htmlContent = `
            <div class="system-bubble">
                ${data.message || data.text} <span class="system-time">${time}</span>
            </div>
        `;
    } 
    // Se for um usuário real falando
    else {
        const inicial = data.username.charAt(0).toUpperCase();
        const gradiente = gerarGradiente(data.username);

        htmlContent = `
            <div class="avatar" style="background: ${gradiente}">${inicial}</div>
            <div class="message-bubble">
                <span class="msg-username">${data.username}</span>
                <div class="msg-text">${data.message || data.text}</div>
                <div class="msg-meta">
                    ${time} ${isMe ? '<i data-lucide="check-check"></i>' : ''}
                </div>
            </div>
        `;
    }

    messageRow.innerHTML = htmlContent;
    messagesDiv.appendChild(messageRow);
    
    // Atualiza os ícones (como o check duplo)
    if(typeof lucide !== 'undefined') lucide.createIcons();
    
    // Rola para o final suavemente
    messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' });

    // Som de notificação para mensagens de outras pessoas
    if (!isMe && !isSystem && typeof notificationSound !== 'undefined') {
        notificationSound.play().catch(() => {});
    }
}

// --- 3. STATUS E SIDEBAR ---
socket.on('user_count', function(data) {
    const countEl = document.getElementById('user-count');
    if (countEl) countEl.innerText = data.count;
});

socket.on('update_members', function(data) {
    const memberList = document.getElementById('member-list');
    memberList.innerHTML = '';
    data.members.forEach(member => {
        const li = document.createElement('li');
        li.style.listStyle = "none";
        li.style.padding = "8px 0";
        li.style.fontSize = "13px";
        li.style.color = member === username ? "var(--accent)" : "#e2e8f0";
        li.innerHTML = `● ${member} ${member === username ? '(Você)' : ''}`;
        memberList.appendChild(li);
    });
});

// --- 4. NAVEGAÇÃO E INTERFACE ---
function minimizarChat() {
    document.getElementById('chat-widget').style.display = 'none';
    document.getElementById('minimized-icon').style.display = 'flex';
    isChatVisible = false;
}

function maximizarChat() {
    document.getElementById('chat-widget').style.display = 'flex';
    document.getElementById('minimized-icon').style.display = 'none';
    isChatVisible = true;
    unreadCount = 0;
    document.getElementById('notif-badge').style.display = 'none';
    if(typeof lucide !== 'undefined') lucide.createIcons();
}

function fecharChat() {
    if(confirm("Deseja sair da missão?")) location.reload();
}

function toggleSidebar() {
    document.getElementById('members-sidebar').classList.toggle('open');
}

function showFloatingPreview(user, msg) {
    const preview = document.getElementById('floating-preview');
    preview.innerText = `${user}: ${msg.substring(0, 20)}${msg.length > 20 ? '...' : ''}`;
    preview.style.display = 'block';
    setTimeout(() => { preview.style.display = 'none'; }, 3500);
}

function voltarParaLogin() {
    if(confirm("Sair da sala atual?")) {
        socket.emit('leave', {username: username, room: room});
        document.getElementById('chat-area').style.display = 'none';
        document.getElementById('login-area').style.display = 'flex';
        document.getElementById('messages').innerHTML = '';
    }
}

// --- 5. EMOJIS E DIGITAÇÃO (COM AUTO-CLOSE) ---
function toggleEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (container.style.display === 'block') {
        fecharEmojiPicker();
        return;
    }
    if (!picker) {
        picker = new EmojiMart.Picker({
            onEmojiSelect: (emoji) => {
                const input = document.getElementById('message-input');
                input.value += emoji.native;
                input.focus();
                fecharEmojiPicker(); // Fecha ao escolher
            },
            theme: 'dark', set: 'native', locale: 'pt'
        });
        container.appendChild(picker);
    }
    container.style.display = 'block';
    setTimeout(() => { document.addEventListener('click', cliqueForaEmoji); }, 10);
}

function fecharEmojiPicker() {
    const container = document.getElementById('emoji-picker-container');
    if (container) {
        container.style.display = 'none';
        document.removeEventListener('click', cliqueForaEmoji);
    }
}

function cliqueForaEmoji(e) {
    const container = document.getElementById('emoji-picker-container');
    const btn = document.querySelector('.emoji-btn');
    if (container && !container.contains(e.target) && !btn.contains(e.target)) {
        fecharEmojiPicker();
    }
}

// Eventos de Input
document.getElementById('message-input').addEventListener('input', () => {
    socket.emit('typing', {username: username, room: room});
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => { socket.emit('stop_typing', {room: room}); }, 2500);
});

socket.on('display_typing', (data) => {
    if (data.username !== username) {
        document.getElementById('typing-user').innerText = data.username;
        document.getElementById('typing-indicator').style.display = 'block';
    }
});

socket.on('hide_typing', () => { document.getElementById('typing-indicator').style.display = 'none'; });

document.getElementById('message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        enviarMensagem();
    }
});

const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

function gerarCor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 60%, 60%)`;
}


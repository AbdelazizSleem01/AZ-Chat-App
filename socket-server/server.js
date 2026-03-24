import { createServer } from 'http';
import { Server } from 'socket.io';

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: [
      "https://az-chat-app.vercel.app",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});

const users = new Map();
const whiteboardStates = new Map(); 
const codeStates = new Map(); 
const whiteboardPermissions = new Map(); 
const codePermissions = new Map(); 
const normalizeId = (value) => String(value ?? '');

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', (userId) => {
    const normalizedUserId = normalizeId(userId);
    users.set(normalizedUserId, socket.id);
    socket.userId = normalizedUserId;
    console.log(`User ${normalizedUserId} registered with socket ${socket.id}`);
  });

  socket.on('message', (data) => {
    const { receiverId, message } = data;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('message', message);
    }
  });

  socket.on('typing', (data) => {
    const { receiverId, userId, isTyping } = data;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('typing', { userId, isTyping });
    }
  });

  socket.on('collab-join', (data) => {
    const { chatId } = data || {};
    if (!chatId) return;
    socket.join(chatId);
  });

  socket.on('collab-leave', (data) => {
    const { chatId } = data || {};
    if (!chatId) return;
    socket.leave(chatId);
  });

  socket.on('collab-open', (data) => {
    const { chatId, receiverId, senderId } = data || {};
    if (!chatId || !receiverId) return;
    const normalizedSenderId = normalizeId(senderId);
    whiteboardPermissions.set(chatId, {
      ownerId: normalizedSenderId,
      allowPeerControl: true
    });
    codePermissions.set(chatId, {
      ownerId: normalizedSenderId,
      allowPeerControl: true
    });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('collab-open', {
        chatId,
        senderId: normalizedSenderId
      });
      io.to(receiverSocketId).emit('wb-permission-state', {
        chatId,
        ownerId: normalizedSenderId,
        allowPeerControl: true
      });
    }
    socket.emit('wb-permission-state', {
      chatId,
      ownerId: normalizedSenderId,
      allowPeerControl: true
    });
    socket.emit('code-permission-state', {
      chatId,
      ownerId: normalizedSenderId,
      allowPeerControl: true
    });
  });

  socket.on('collab-close', (data) => {
    const { chatId, receiverId, senderId } = data || {};
    if (!chatId || !receiverId) return;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('collab-close', {
        chatId,
        senderId: normalizeId(senderId)
      });
    }
  });

  socket.on('wb-request-state', (data) => {
    const { chatId } = data || {};
    if (!chatId) return;
    const elements = whiteboardStates.get(chatId) || [];
    const permission = whiteboardPermissions.get(chatId) || { ownerId: '', allowPeerControl: true };
    socket.emit('wb-state', { chatId, elements });
    socket.emit('wb-permission-state', { chatId, ...permission });
  });

  const canEditWhiteboard = (chatId) => {
    const permission = whiteboardPermissions.get(chatId);
    if (!permission || !permission.ownerId) return true;
    if (permission.allowPeerControl) return true;
    return normalizeId(socket.userId) === normalizeId(permission.ownerId);
  };

  socket.on('wb-segment', (data) => {
    const { chatId, receiverId, ...segment } = data || {};
    if (!chatId) return;
    if (!canEditWhiteboard(chatId)) return;
    socket.to(chatId).emit('wb-segment', { chatId, ...segment });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('wb-segment', { chatId, ...segment });
    }
  });

  socket.on('wb-stroke-commit', (data) => {
    const { chatId, receiverId, stroke } = data || {};
    if (!chatId || !stroke) return;
    if (!canEditWhiteboard(chatId)) return;
    const current = whiteboardStates.get(chatId) || [];
    const next = [...current, stroke];
    whiteboardStates.set(chatId, next);
    socket.to(chatId).emit('wb-stroke-commit', { chatId, stroke });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('wb-stroke-commit', { chatId, stroke });
    }
  });

  socket.on('wb-set-state', (data) => {
    const { chatId, receiverId, elements } = data || {};
    if (!chatId || !Array.isArray(elements)) return;
    if (!canEditWhiteboard(chatId)) return;
    whiteboardStates.set(chatId, elements);
    io.to(chatId).emit('wb-state', { chatId, elements });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('wb-state', { chatId, elements });
    }
  });

  socket.on('wb-text-add', (data) => {
    const { chatId, receiverId, textElement } = data || {};
    if (!chatId || !textElement) return;
    if (!canEditWhiteboard(chatId)) return;
    const current = whiteboardStates.get(chatId) || [];
    const next = [...current, textElement];
    whiteboardStates.set(chatId, next);
    socket.to(chatId).emit('wb-text-add', { chatId, textElement });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('wb-text-add', { chatId, textElement });
    }
  });

  socket.on('wb-permission-set', (data) => {
    const { chatId, receiverId, ownerId, allowPeerControl } = data || {};
    if (!chatId) return;
    const previous = whiteboardPermissions.get(chatId) || { ownerId: '', allowPeerControl: true };
    if (previous.ownerId && normalizeId(socket.userId) !== normalizeId(previous.ownerId)) {
      return;
    }
    const next = {
      ownerId: normalizeId(ownerId || previous.ownerId),
      allowPeerControl: Boolean(allowPeerControl)
    };
    whiteboardPermissions.set(chatId, next);
    io.to(chatId).emit('wb-permission-state', { chatId, ...next });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('wb-permission-state', { chatId, ...next });
    }
  });

  socket.on('code-request-state', (data) => {
    const { chatId } = data || {};
    if (!chatId) return;
    const state = codeStates.get(chatId);
    if (state) {
      socket.emit('code-state', { chatId, ...state });
    } else {
      socket.emit('code-state', {
        chatId,
        files: [
          { id: 'file-index-ts', name: 'index.ts', language: 'typescript', content: '' },
          { id: 'file-styles-css', name: 'styles.css', language: 'css', content: '' }
        ],
        activeFileId: 'file-index-ts'
      });
    }
    const permission = codePermissions.get(chatId) || { ownerId: '', allowPeerControl: true };
    socket.emit('code-permission-state', { chatId, ...permission });
  });

  const canEditCode = (chatId) => {
    const permission = codePermissions.get(chatId);
    if (!permission || !permission.ownerId) return true;
    if (permission.allowPeerControl) return true;
    return normalizeId(socket.userId) === normalizeId(permission.ownerId);
  };

  socket.on('code-update-room', (data) => {
    const { chatId, receiverId, files, activeFileId } = data || {};
    if (!chatId) return;
    if (!canEditCode(chatId)) return;
    const next = {
      files: Array.isArray(files) ? files : [],
      activeFileId: activeFileId || (Array.isArray(files) && files[0] ? files[0].id : '')
    };
    codeStates.set(chatId, next);
    socket.to(chatId).emit('code-state', { chatId, ...next });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('code-state', { chatId, ...next });
    }
  });

  socket.on('code-permission-set', (data) => {
    const { chatId, receiverId, ownerId, allowPeerControl } = data || {};
    if (!chatId) return;
    const previous = codePermissions.get(chatId) || { ownerId: '', allowPeerControl: true };
    if (previous.ownerId && normalizeId(socket.userId) !== normalizeId(previous.ownerId)) {
      return;
    }
    const next = {
      ownerId: normalizeId(ownerId || previous.ownerId),
      allowPeerControl: Boolean(allowPeerControl)
    };
    codePermissions.set(chatId, next);
    io.to(chatId).emit('code-permission-state', { chatId, ...next });
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('code-permission-state', { chatId, ...next });
    }
  });

  socket.on('draw', (data) => {
    const { receiverId, ...pos } = data;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('draw', pos);
    }
  });

  socket.on('clear-whiteboard', (data) => {
    const { receiverId } = data;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('clear-whiteboard');
    }
  });

  socket.on('code-update', (data) => {
    const { receiverId, ...codeData } = data;
    const receiverSocketId = users.get(normalizeId(receiverId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('code-update', codeData);
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of users.entries()) {
      if (socketId === socket.id) {
        users.delete(userId);
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on http://localhost:${PORT}`);
});

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import {
  FiCode,
  FiCopy,
  FiDownload,
  FiEdit3,
  FiFolder,
  FiMinusCircle,
  FiPlay,
  FiRotateCcw,
  FiRotateCw,
  FiSave,
  FiTrash2,
  FiTerminal,
  FiType,
  FiX
} from 'react-icons/fi';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

type UserInfo = { id: string; username: string };

type Point = { x: number; y: number };

type StrokeElement = {
  kind: 'stroke';
  id: string;
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  points: Point[];
};

type TextElement = {
  kind: 'text';
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
};

type BoardElement = StrokeElement | TextElement;

type PermissionState = {
  ownerId: string;
  allowPeerControl: boolean;
};

type CollaborationToolsProps = {
  currentUser: UserInfo;
  receiverId: string;
  isDarkMode: boolean;
  onClose: () => void;
};

type WhiteboardProps = {
  chatId: string;
  currentUserId: string;
  receiverId: string;
  isDarkMode: boolean;
  socket: Socket;
};

type CodeEditorProps = {
  chatId: string;
  currentUserId: string;
  receiverId: string;
  isDarkMode: boolean;
  socket: Socket;
};

const normalizeId = (value: string | number | null | undefined) => String(value ?? '');
const getChatId = (a: string, b: string) => [normalizeId(a), normalizeId(b)].sort().join('__');

const DEFAULT_PERMISSION: PermissionState = {
  ownerId: '',
  allowPeerControl: true
};

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: StrokeElement) => {
  if (!stroke.points.length) return;
  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  const pts = stroke.points;
  if (pts.length === 1) {
    ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i += 1) {
    const xc = (pts[i].x + pts[i + 1].x) / 2;
    const yc = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
};

const drawText = (ctx: CanvasRenderingContext2D, textItem: TextElement) => {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = textItem.color;
  ctx.font = `${textItem.fontSize}px "Segoe UI", Tahoma, sans-serif`;
  ctx.textBaseline = 'top';
  const lines = textItem.text.split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line, textItem.x, textItem.y + index * (textItem.fontSize + 4));
  });
  ctx.restore();
};

const drawElement = (ctx: CanvasRenderingContext2D, item: BoardElement) => {
  if (item.kind === 'stroke') {
    drawStroke(ctx, item);
  } else {
    drawText(ctx, item);
  }
};

const Whiteboard = ({ chatId, currentUserId, receiverId, isDarkMode, socket }: WhiteboardProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<StrokeElement | null>(null);
  const elementsRef = useRef<BoardElement[]>([]);
  const draftRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Point | null>(null);

  const [elements, setElements] = useState<BoardElement[]>([]);
  const [undone, setUndone] = useState<BoardElement[]>([]);
  const [permission, setPermission] = useState<PermissionState>(DEFAULT_PERMISSION);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'text'>('pen');
  const [color, setColor] = useState('#4f46e5');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(24);
  const [cursor, setCursor] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
  const [draftText, setDraftText] = useState('');
  const [draftPosition, setDraftPosition] = useState<Point | null>(null);
  const [isEditingText, setIsEditingText] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);

  const isOwner = permission.ownerId === currentUserId;
  const canDraw = !permission.ownerId || isOwner || permission.allowPeerControl;
  const isLockedForPeer = !isOwner && permission.ownerId && !permission.allowPeerControl;

  const redrawAll = useCallback((data: BoardElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    data.forEach((item) => drawElement(ctx, item));
  }, []);

  const setBoardState = useCallback((next: BoardElement[]) => {
    setElements(next);
    socket.emit('wb-set-state', { chatId, receiverId, elements: next });
  }, [chatId, receiverId, socket]);

  const announcePermission = useCallback((next: PermissionState) => {
    setPermission(next);
    socket.emit('wb-permission-set', {
      chatId,
      receiverId,
      ownerId: next.ownerId,
      allowPeerControl: next.allowPeerControl
    });
  }, [chatId, receiverId, socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const nextWidth = container.clientWidth;
      const nextHeight = container.clientHeight;
      if (!nextWidth || !nextHeight) return;
      const prev = canvas.toDataURL('image/png');
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = prev;
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    redrawAll(elements);
  }, [elements, redrawAll]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  useEffect(() => {
    const onSegment = (payload: { chatId: string; strokeId: string; from: Point; to: Point; color: string; width: number; tool: 'pen' | 'eraser' }) => {
      if (payload.chatId !== chatId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawStroke(ctx, {
        kind: 'stroke',
        id: payload.strokeId,
        color: payload.color,
        width: payload.width,
        tool: payload.tool,
        points: [payload.from, payload.to]
      });
    };

    const onCommit = (payload: { chatId: string; stroke: StrokeElement }) => {
      if (payload.chatId !== chatId) return;
      setElements((prev) => [...prev, payload.stroke]);
      setUndone([]);
    };

    const onState = (payload: { chatId: string; elements: BoardElement[] }) => {
      if (payload.chatId !== chatId) return;
      setElements(Array.isArray(payload.elements) ? payload.elements : []);
      setUndone([]);
    };

    const onText = (payload: { chatId: string; textElement: TextElement }) => {
      if (payload.chatId !== chatId) return;
      setElements((prev) => [...prev, payload.textElement]);
      setUndone([]);
    };

    const onPermission = (payload: { chatId: string; ownerId: string; allowPeerControl: boolean }) => {
      if (payload.chatId !== chatId) return;
      setPermission({
        ownerId: normalizeId(payload.ownerId),
        allowPeerControl: Boolean(payload.allowPeerControl)
      });
    };

    socket.on('wb-segment', onSegment);
    socket.on('wb-stroke-commit', onCommit);
    socket.on('wb-state', onState);
    socket.on('wb-text-add', onText);
    socket.on('wb-permission-state', onPermission);
    socket.emit('wb-request-state', { chatId, receiverId });

    return () => {
      socket.off('wb-segment', onSegment);
      socket.off('wb-stroke-commit', onCommit);
      socket.off('wb-state', onState);
      socket.off('wb-text-add', onText);
      socket.off('wb-permission-state', onPermission);
    };
  }, [chatId, receiverId, socket]);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const getTextBounds = (ctx: CanvasRenderingContext2D, item: TextElement) => {
    ctx.save();
    ctx.font = `${item.fontSize}px "Segoe UI", Tahoma, sans-serif`;
    const lines = item.text.split('\n');
    const maxWidth = Math.max(
      1,
      ...lines.map((line) => ctx.measureText(line).width)
    );
    const height = lines.length * (item.fontSize + 4);
    ctx.restore();
    return { x: item.x, y: item.y, width: maxWidth, height };
  };

  const findTextAtPoint = useCallback((point: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    for (let i = elementsRef.current.length - 1; i >= 0; i -= 1) {
      const item = elementsRef.current[i];
      if (item.kind !== 'text') continue;
      const bounds = getTextBounds(ctx, item);
      const inside =
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height;
      if (inside) return item;
    }
    return null;
  }, []);

  const commitDraftText = useCallback(() => {
    if (!canDraw || !draftPosition) {
      setIsEditingText(false);
      setDraftPosition(null);
      setDraftText('');
      return;
    }
    const value = (draftRef.current?.innerText ?? draftText).replace(/\r/g, '').trim();
    if (!value) {
      setIsEditingText(false);
      setDraftPosition(null);
      setDraftText('');
      return;
    }
    const textElement: TextElement = {
      kind: 'text',
      id: `txt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      x: draftPosition.x,
      y: draftPosition.y,
      text: value,
      color,
      fontSize
    };
    setIsEditingText(false);
    setDraftPosition(null);
    setDraftText('');
    setElements((prev) => [...prev, textElement]);
    setUndone([]);
    socket.emit('wb-text-add', { chatId, receiverId, textElement });
  }, [canDraw, chatId, color, draftPosition, draftText, fontSize, receiverId, socket]);


  const handleToolChange = (nextTool: 'pen' | 'eraser' | 'text') => {
    if (tool === 'text' && nextTool !== 'text' && isEditingText) {
      commitDraftText();
    }
    setTool(nextTool);
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const point = getPoint(e);

    if (tool === 'text') {
      if (isEditingText) {
        commitDraftText();
      }

      const hit = findTextAtPoint(point);
      if (hit) {
        setDraggingTextId(hit.id);
        dragOffsetRef.current = { x: point.x - hit.x, y: point.y - hit.y };
        return;
      }

      setDraftPosition(point);
      setIsEditingText(true);
      setDraftText('');
      requestAnimationFrame(() => {
        draftRef.current?.focus();
      });
      return;
    }

    drawingRef.current = true;
    const stroke: StrokeElement = {
      kind: 'stroke',
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      color,
      width: lineWidth,
      tool: tool === 'eraser' ? 'eraser' : 'pen',
      points: [point]
    };
    currentStrokeRef.current = stroke;
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getPoint(e);
    setCursor({ x: point.x, y: point.y, visible: true });

    if (!canDraw) return;
    if (tool === 'text') {
      if (draggingTextId) {
        const offset = dragOffsetRef.current ?? { x: 0, y: 0 };
        const next = elementsRef.current.map((item) => {
          if (item.kind !== 'text' || item.id !== draggingTextId) return item;
          return {
            ...item,
            x: point.x - offset.x,
            y: point.y - offset.y
          };
        });
        setElements(next);
        elementsRef.current = next;
      }
      return;
    }
    if (!drawingRef.current || !currentStrokeRef.current) return;

    const stroke = currentStrokeRef.current;
    const from = stroke.points[stroke.points.length - 1];
    stroke.points.push(point);

    redrawAll([...elementsRef.current, stroke]);

    socket.emit('wb-segment', {
      chatId,
      receiverId,
      strokeId: stroke.id,
      from,
      to: point,
      color: stroke.color,
      width: stroke.width,
      tool: stroke.tool
    });
  };

  const stopDrawing = () => {
    if (tool === 'text') {
      if (draggingTextId) {
        setDraggingTextId(null);
        dragOffsetRef.current = null;
        setUndone([]);
        setBoardState(elementsRef.current);
      }
      return;
    }
    if (!drawingRef.current || !currentStrokeRef.current) return;
    const stroke = currentStrokeRef.current;
    drawingRef.current = false;
    currentStrokeRef.current = null;
    if (stroke.points.length < 2) return;

    setElements((prev) => [...prev, stroke]);
    setUndone([]);
    socket.emit('wb-stroke-commit', { chatId, receiverId, stroke });
  };

  const clearBoard = () => {
    if (!canDraw) return;
    setUndone([]);
    setBoardState([]);
  };

  const undo = () => {
    if (!canDraw || !elements.length) return;
    const next = elements.slice(0, -1);
    const removed = elements[elements.length - 1];
    setUndone((prev) => [...prev, removed]);
    setBoardState(next);
  };

  const redo = () => {
    if (!canDraw || !undone.length) return;
    const restored = undone[undone.length - 1];
    setUndone((prev) => prev.slice(0, -1));
    const next = [...elements, restored];
    setBoardState(next);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `whiteboard-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.click();
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`px-4 py-3 border-b flex items-center gap-2 flex-wrap ${isDarkMode ? 'border-gray-800 bg-gray-950/90' : 'border-gray-200 bg-white/90'}`}>
        <button
          onClick={() => handleToolChange('pen')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${tool === 'pen' ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
        >
          <FiEdit3 /> Pen
        </button>
        <button
          onClick={() => handleToolChange('eraser')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${tool === 'eraser' ? 'bg-rose-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
        >
          <FiMinusCircle /> Eraser
        </button>
        <button
          onClick={() => handleToolChange('text')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${tool === 'text' ? 'bg-emerald-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
        >
          <FiType /> Text
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-9 h-9 rounded-md cursor-pointer"
          title="Brush color"
        />

        {tool !== 'text' ? (
          <div className="flex items-center gap-2 min-w-40">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Size</span>
            <input type="range" min={1} max={24} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="flex-1" />
            <span className={`text-xs w-6 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{lineWidth}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-40">
            <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Font</span>
            <input type="range" min={12} max={52} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="flex-1" />
            <span className={`text-xs w-6 text-right ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{fontSize}</span>
          </div>
        )}

        {isOwner && (
          <button
            onClick={() =>
              announcePermission({
                ownerId: currentUserId,
                allowPeerControl: !permission.allowPeerControl
              })
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${permission.allowPeerControl ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
            title="Allow partner editing"
          >
            {permission.allowPeerControl ? 'Partner Can Edit: ON' : 'Partner Can Edit: OFF'}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`} title="Undo">
            <FiRotateCcw />
          </button>
          <button onClick={redo} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`} title="Redo">
            <FiRotateCw />
          </button>
          <button onClick={clearBoard} className="p-2 rounded-lg bg-rose-600/15 text-rose-400 hover:bg-rose-600/25" title="Clear board">
            <FiTrash2 />
          </button>
          <button onClick={download} className={`p-2 rounded-lg ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`} title="Download PNG">
            <FiDownload />
          </button>
        </div>
      </div>

      <div ref={containerRef} className={`relative flex-1 ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
        {isLockedForPeer && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Presenter disabled your editing access
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none"
          style={{ cursor: 'none' }}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerLeave={() => {
            stopDrawing();
            setCursor((prev) => ({ ...prev, visible: false }));
          }}
        />

        {cursor.visible && (
          <div
            className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: cursor.x, top: cursor.y }}
          >
            {tool === 'eraser' ? (
              <span className="w-8 h-8 rounded-full  text-red-600 inline-flex items-center justify-center shadow-lg">
                <FiMinusCircle className="text-base" />
              </span>
            ) : tool === 'text' ? (
              <span className="w-8 h-8 rounded-full bg-emerald-500/90 text-white inline-flex items-center justify-center shadow-lg">
                <FiType className="text-base" />
              </span>
            ) : (
              <span className="w-8 h-8 rounded-full text-white inline-flex items-center justify-center shadow-lg">
                <FiEdit3 className="text-base" />
              </span>
            )}
          </div>
        )}

        {tool === 'text' && isEditingText && draftPosition && (
          <div
            className="absolute z-30"
            style={{ left: draftPosition.x, top: draftPosition.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div
              ref={draftRef}
              contentEditable
              suppressContentEditableWarning
              onInput={() => setDraftText(draftRef.current?.innerText ?? '')}
              onBlur={() => commitDraftText()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  setIsEditingText(false);
                  setDraftPosition(null);
                  setDraftText('');
                  return;
                }
                if (event.key === 'Enter' && event.ctrlKey) {
                  event.preventDefault();
                  commitDraftText();
                }
              }}
              className={`min-w-30 max-w-105 outline-none whitespace-pre-wrap ${isDarkMode ? 'text-white' : 'text-gray-900'}`}
              style={{
                color,
                fontSize,
                lineHeight: `${fontSize + 4}px`
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const CodeEditor = ({ chatId, currentUserId, receiverId, isDarkMode, socket }: CodeEditorProps) => {
  const initialFiles = useMemo(
    () => [
      {
        id: 'file-index-ts',
        name: 'index.ts',
        language: 'typescript',
        content: '// Collaborative editor\nfunction hello() {\n  return "Hello";\n}\n'
      },
      {
        id: 'file-styles-css',
        name: 'styles.css',
        language: 'css',
        content: 'body {\n  font-family: system-ui;\n}\n'
      }
    ],
    []
  );
  const [files, setFiles] = useState(initialFiles);
  const [activeFileId, setActiveFileId] = useState(initialFiles[0].id);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [output, setOutput] = useState('Ready.');
  const [showOutput, setShowOutput] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [showExplorer, setShowExplorer] = useState(true);
  const [panelTab, setPanelTab] = useState<'output' | 'terminal' | 'problems'>('output');
  const [newFileName, setNewFileName] = useState('');
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [permission, setPermission] = useState<PermissionState>(DEFAULT_PERMISSION);
  const runTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeFile = files.find((file) => file.id === activeFileId) ?? files[0];
  const activeLanguage = activeFile?.language || 'javascript';
  const activeCode = activeFile?.content || '';
  const isOwner = permission.ownerId === currentUserId;
  const canEdit = !permission.ownerId || isOwner || permission.allowPeerControl;
  const isLockedForPeer = !isOwner && permission.ownerId && !permission.allowPeerControl;

  useEffect(() => {
    const onState = (payload: { chatId: string; files?: Array<{ id: string; name: string; language: string; content: string }>; activeFileId?: string }) => {
      if (payload.chatId !== chatId) return;
      if (Array.isArray(payload.files) && payload.files.length > 0) {
        setFiles(payload.files);
        setActiveFileId(payload.activeFileId || payload.files[0].id);
      }
    };

    const onPermission = (payload: { chatId: string; ownerId: string; allowPeerControl: boolean }) => {
      if (payload.chatId !== chatId) return;
      setPermission({
        ownerId: normalizeId(payload.ownerId),
        allowPeerControl: Boolean(payload.allowPeerControl)
      });
    };

    socket.on('code-state', onState);
    socket.on('code-permission-state', onPermission);
    socket.emit('code-request-state', { chatId, receiverId });
    return () => {
      socket.off('code-state', onState);
      socket.off('code-permission-state', onPermission);
    };
  }, [chatId, receiverId, socket]);

  const emitUpdate = (nextFiles: Array<{ id: string; name: string; language: string; content: string }>, nextActiveId: string) => {
    socket.emit('code-update-room', { chatId, receiverId, files: nextFiles, activeFileId: nextActiveId });
  };

  const announcePermission = useCallback((next: PermissionState) => {
    setPermission(next);
    socket.emit('code-permission-set', {
      chatId,
      receiverId,
      ownerId: next.ownerId,
      allowPeerControl: next.allowPeerControl
    });
  }, [chatId, receiverId, socket]);

  useEffect(() => {
    if (!permission.ownerId) {
      announcePermission({ ownerId: currentUserId, allowPeerControl: true });
    }
  }, [announcePermission, currentUserId, permission.ownerId]);

  useEffect(() => {
    return () => {
      if (runTimerRef.current) {
        clearTimeout(runTimerRef.current);
      }
    };
  }, []);

  const runCode = () => {
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current);
    }
    setIsRunning(true);
    const timestamp = new Date().toLocaleTimeString();
    if (activeLanguage !== 'javascript') {
      setOutput(`Running ${activeLanguage}...\n\nRuntime is only available for JavaScript right now.`);
      runTimerRef.current = setTimeout(() => {
        setIsRunning(false);
        setOutput(
          `Run finished at ${timestamp}\nRuntime is only available for JavaScript right now.\nLines: ${activeCode.split('\\n').length}`
        );
      }, 400);
      return;
    }

    setOutput(`Running JavaScript...\n`);
    runTimerRef.current = setTimeout(() => {
      const logs: string[] = [];
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;

      const capture = (label: string, args: unknown[]) => {
        const text = args
          .map((value) => {
            if (typeof value === 'string') return value;
            try {
              return JSON.stringify(value, null, 2);
            } catch {
              return String(value);
            }
          })
          .join(' ');
        logs.push(label ? `${label} ${text}` : text);
      };

      console.log = (...args) => capture('', args);
      console.warn = (...args) => capture('warn:', args);
      console.error = (...args) => capture('error:', args);

      try {
        const fn = new Function(activeCode);
        const result = fn();
        if (typeof result !== 'undefined') {
          logs.push(`return: ${String(result)}`);
        }
        setOutput(
          `Run finished at ${timestamp}\n${logs.length ? logs.join('\n') : 'No output.'}`
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setOutput(`Run failed at ${timestamp}\nerror: ${message}`);
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
        setIsRunning(false);
      }
    }, 100);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setOutput('Code copied to clipboard.');
    } catch {
      setOutput('Failed to copy. Please copy manually.');
    }
  };

  const saveSnapshot = () => {
    const timestamp = new Date().toLocaleTimeString();
    setOutput(`Snapshot saved at ${timestamp} (local preview).`);
  };

  const updateCursorInfo = (line: number, col: number) => {
    setCursorInfo({ line, col });
  };

  const extensionToLanguage = (name: string) => {
    const parts = name.toLowerCase().split('.');
    const ext = parts.length > 1 ? parts.pop() : '';
    switch (ext) {
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'py':
        return 'python';
      case 'json':
        return 'json';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'md':
        return 'markdown';
      default:
        return 'plaintext';
    }
  };

  const createFile = () => {
    if (!canEdit) return;
    const trimmed = newFileName.trim();
    if (!trimmed) return;
    const exists = files.some((file) => file.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      setOutput('File name already exists.');
      return;
    }
    const nextFile = {
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      language: extensionToLanguage(trimmed),
      content: ''
    };
    const nextFiles = [...files, nextFile];
    setFiles(nextFiles);
    setActiveFileId(nextFile.id);
    setNewFileName('');
    emitUpdate(nextFiles, nextFile.id);
  };

  const startRename = (fileId: string, name: string) => {
    if (!canEdit) return;
    setRenamingFileId(fileId);
    setRenameValue(name);
  };

  const applyRename = () => {
    if (!canEdit) return;
    if (!renamingFileId) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    const exists = files.some((file) => file.name.toLowerCase() === trimmed.toLowerCase() && file.id !== renamingFileId);
    if (exists) {
      setOutput('File name already exists.');
      return;
    }
    const nextFiles = files.map((file) => {
      if (file.id !== renamingFileId) return file;
      return {
        ...file,
        name: trimmed,
        language: extensionToLanguage(trimmed)
      };
    });
    setFiles(nextFiles);
    setRenamingFileId(null);
    setRenameValue('');
    emitUpdate(nextFiles, activeFileId);
  };

  const removeFile = (fileId: string) => {
    if (!canEdit) return;
    if (files.length === 1) {
      setOutput('At least one file is required.');
      return;
    }
    const nextFiles = files.filter((file) => file.id !== fileId);
    const nextActiveId = fileId === activeFileId ? nextFiles[0].id : activeFileId;
    setFiles(nextFiles);
    setActiveFileId(nextActiveId);
    emitUpdate(nextFiles, nextActiveId);
  };

  return (
    <div className="h-full flex flex-col">
      <div className={`px-4 py-2 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800 bg-gray-950/90' : 'border-gray-200 bg-white/90'}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={`text-[11px] px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-gray-700'}`}>
            {activeLanguage.toUpperCase()}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
            {files.map((file) => (
              <button
                key={file.id}
                onClick={() => {
                  setActiveFileId(file.id);
                  emitUpdate(files, file.id);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] flex items-center gap-1 border ${file.id === activeFileId
                  ? 'bg-indigo-600/90 text-white border-indigo-400/40 shadow shadow-indigo-500/20'
                  : (isDarkMode ? 'bg-gray-900/70 text-gray-300 border-gray-800/60 hover:bg-gray-800' : 'bg-slate-100 text-gray-600 border-slate-200 hover:bg-slate-200')
                }`}
                title={file.name}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && permission.ownerId && (
            <button
              onClick={() =>
                announcePermission({
                  ownerId: currentUserId,
                  allowPeerControl: !permission.allowPeerControl
                })
              }
              className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold ${permission.allowPeerControl ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
              title="Allow partner editing"
            >
              {permission.allowPeerControl ? 'Partner Can Edit: ON' : 'Partner Can Edit: OFF'}
            </button>
          )}
          <button
            onClick={() => setShowExplorer((prev) => !prev)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${showExplorer ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-gray-600')}`}
            title="Explorer"
          >
            <FiFolder className="text-[11px]" />
          </button>
          <button
            onClick={runCode}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 ${isRunning ? 'bg-emerald-500/30 text-emerald-200' : 'bg-emerald-600 text-white'}`}
            title="Run"
          >
            <FiPlay className="text-[10px]" /> Run
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={copyCode}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
              title="Copy code"
            >
              <FiCopy className="text-[11px]" />
            </button>
            <button
              onClick={saveSnapshot}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
              title="Save snapshot"
            >
              <FiSave className="text-[11px]" />
            </button>
            <button
              onClick={() => setShowOutput((prev) => !prev)}
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${showOutput ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
              title="Toggle output"
            >تداد/mب
              <FiTerminal className="text-[11px]" />
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 relative min-h-130 ${isDarkMode ? 'bg-[#0b0f1f]' : 'bg-[#f7f8fb]'}`}>
        <div className={`absolute inset-0 pointer-events-none ${isDarkMode ? 'bg-linear-to-br from-indigo-900/20 via-transparent to-cyan-900/10' : 'bg-linear-to-br from-indigo-100/40 via-transparent to-cyan-100/40'}`} />
        <div className={`relative h-full min-h-130 ${showOutput ? 'grid grid-rows-[minmax(520px,1fr),160px]' : 'grid grid-rows-[minmax(680px,1fr)]'}`}>
          <div className={`grid ${showExplorer ? 'grid-cols-[220px,1fr]' : 'grid-cols-[1fr]'} h-full min-h-0`}>
            {showExplorer && (
              <div className={`h-full border-r ${isDarkMode ? 'border-gray-800 bg-gray-950/80' : 'border-gray-200 bg-white/90'}`}>
                <div className={`px-4 py-3 text-xs font-semibold uppercase tracking-widest flex items-center justify-between ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Explorer
                  <button
                    onClick={() => setShowExplorer(false)}
                    className={`text-[10px] px-2 py-1 rounded-full ${isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-slate-100 text-gray-600'}`}
                  >
                    Hide
                  </button>
                </div>
                <div className="px-3 pb-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={newFileName}
                      onChange={(e) => setNewFileName(e.target.value)}
                      placeholder="new-file.ts"
                      disabled={!canEdit}
                      className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs ${isDarkMode ? 'bg-gray-900 text-gray-200 border border-gray-800' : 'bg-slate-100 text-gray-700 border border-gray-200'}`}
                    />
                    <button
                      onClick={createFile}
                      disabled={!canEdit}
                      className="px-2 py-1.5 rounded-lg text-xs bg-emerald-600 text-white"
                    >
                      Add
                    </button>
                  </div>
                  {renamingFileId && (
                    <div className="flex items-center gap-2">
                      <input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        disabled={!canEdit}
                        className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs ${isDarkMode ? 'bg-gray-900 text-gray-200 border border-gray-800' : 'bg-slate-100 text-gray-700 border border-gray-200'}`}
                      />
                      <button
                        onClick={applyRename}
                        disabled={!canEdit}
                        className="px-2 py-1.5 rounded-lg text-xs bg-indigo-600 text-white"
                      >
                        Save
                      </button>
                    </div>
                  )}
                  <div className="space-y-1 text-sm">
                    {files.map((file) => (
                      <div key={file.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${file.id === activeFileId
                        ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-200' : 'bg-indigo-50 text-indigo-700')
                        : (isDarkMode ? 'text-gray-300 hover:bg-gray-900' : 'text-gray-700 hover:bg-slate-100')
                      }`}>
                        <button
                          onClick={() => {
                            setActiveFileId(file.id);
                            emitUpdate(files, file.id);
                          }}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left"
                        >
                          <FiCode className="text-xs" />
                          <span className="truncate">{file.name}</span>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startRename(file.id, file.name)}
                            disabled={!canEdit}
                            className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-800 text-slate-300' : 'hover:bg-slate-200 text-slate-600'}`}
                            title="Rename"
                          >
                            <FiEdit3 className="text-[11px]" />
                          </button>
                          <button
                            onClick={() => removeFile(file.id)}
                            disabled={!canEdit}
                            className={`p-1 rounded ${isDarkMode ? 'hover:bg-gray-800 text-rose-300' : 'hover:bg-slate-200 text-rose-600'}`}
                            title="Delete"
                          >
                            <FiTrash2 className="text-[11px]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="h-full code-scroll">
              {isLockedForPeer && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-xs bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Presenter disabled your editing access
                </div>
              )}
              <Editor
                height="100%"
                language={activeLanguage}
                value={activeCode}
                theme={isDarkMode ? 'vs-dark' : 'vs'}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  fontLigatures: true,
                  smoothScrolling: true,
                  cursorSmoothCaretAnimation: 'on',
                  renderLineHighlight: 'all',
                  wordWrap: 'on',
                  tabSize: 2,
                  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                  padding: { top: 16, bottom: 16 },
                  overviewRulerBorder: false,
                  readOnly: !canEdit
                }}
                onChange={(value) => {
                  if (!canEdit) return;
                  const nextCode = value ?? '';
                  const nextFiles = files.map((file) =>
                    file.id === activeFileId ? { ...file, content: nextCode } : file
                  );
                  setFiles(nextFiles);
                  emitUpdate(nextFiles, activeFileId);
                }}
                onMount={(editor) => {
                  editor.onDidChangeCursorPosition((e) => {
                    updateCursorInfo(e.position.lineNumber, e.position.column);
                  });
                  updateCursorInfo(
                    editor.getPosition()?.lineNumber || 1,
                    editor.getPosition()?.column || 1
                  );
                }}
              />
            </div>
          </div>

          {showOutput && (
            <div className={`border-t ${isDarkMode ? 'border-gray-800 bg-black/50' : 'border-gray-200 bg-white/90'} flex flex-col code-scroll`}>
              <div className="flex items-center gap-2 px-4 py-2 text-[11px] border-b border-gray-800/40">
                <button
                  onClick={() => setPanelTab('output')}
                  className={`px-2.5 py-1 rounded-md ${panelTab === 'output' ? 'bg-emerald-600 text-white' : (isDarkMode ? 'text-gray-300 hover:bg-gray-900' : 'text-gray-600 hover:bg-slate-100')}`}
                >
                  Output
                </button>
                <button
                  onClick={() => {
                    setPanelTab('terminal');
                    setShowOutput(true);
                  }}
                  className={`px-2.5 py-1 rounded-md ${panelTab === 'terminal' ? 'bg-indigo-600 text-white' : (isDarkMode ? 'text-gray-300 hover:bg-gray-900' : 'text-gray-600 hover:bg-slate-100')}`}
                >
                  Terminal
                </button>
                <button
                  onClick={() => {
                    setPanelTab('problems');
                    setShowOutput(true);
                  }}
                  className={`px-2.5 py-1 rounded-md ${panelTab === 'problems' ? 'bg-rose-600 text-white' : (isDarkMode ? 'text-gray-300 hover:bg-gray-900' : 'text-gray-600 hover:bg-slate-100')}`}
                >
                  Problems
                </button>
              </div>
              <div className={`flex-1 px-4 py-3 font-mono text-xs overflow-auto ${isDarkMode ? 'text-emerald-200' : 'text-emerald-700'}`}>
                {panelTab === 'output' && <pre className="whitespace-pre-wrap">{output}</pre>}
                {panelTab === 'terminal' && (
                  <div className={`space-y-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    <div className="text-[11px] opacity-70">Local terminal (preview)</div>
                    <div className={`${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>
                      $ ready
                    </div>
                    <div className="opacity-80">No runtime attached yet. This panel is ready for future wiring.</div>
                  </div>
                )}
                {panelTab === 'problems' && (
                  <div className={`space-y-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                    <div className="text-[11px] opacity-70">Problems</div>
                    <div className="opacity-80">No problems detected.</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`px-4 py-2 border-t flex items-center justify-between text-[11px] ${isDarkMode ? 'border-gray-800 bg-gray-950/80 text-gray-400' : 'border-gray-200 bg-white/90 text-gray-500'}`}>
        <span>{activeLanguage.toUpperCase()}</span>
        <span>
          Ln {cursorInfo.line}, Col {cursorInfo.col}
        </span>
      </div>

      <style jsx>{`
        .code-scroll :global(.monaco-scrollable-element),
        .code-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(99, 102, 241, 0.55) transparent;
        }
        .code-scroll :global(.monaco-scrollable-element::-webkit-scrollbar),
        .code-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .code-scroll :global(.monaco-scrollable-element::-webkit-scrollbar-track),
        .code-scroll::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.2);
          border-radius: 999px;
        }
        .code-scroll :global(.monaco-scrollable-element::-webkit-scrollbar-thumb),
        .code-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(99, 102, 241, 0.85), rgba(79, 70, 229, 0.6));
          border-radius: 999px;
          border: 1px solid rgba(30, 41, 59, 0.5);
        }
        .code-scroll :global(.monaco-scrollable-element::-webkit-scrollbar-thumb:hover),
        .code-scroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(129, 140, 248, 0.95), rgba(99, 102, 241, 0.7));
        }
      `}</style>
    </div>
  );
};

export const CollaborationTools = ({ currentUser, receiverId, isDarkMode, onClose }: CollaborationToolsProps) => {
  const [tab, setTab] = useState<'whiteboard' | 'code'>('whiteboard');
  const normalizedCurrentUserId = normalizeId(currentUser.id);
  const normalizedReceiverId = normalizeId(receiverId);
  const chatId = useMemo(() => getChatId(normalizedCurrentUserId, normalizedReceiverId), [normalizedCurrentUserId, normalizedReceiverId]);
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    socket.emit('collab-join', { chatId, userId: normalizedCurrentUserId });
    return () => {
      socket.emit('collab-leave', { chatId, userId: normalizedCurrentUserId });
    };
  }, [chatId, normalizedCurrentUserId, socket]);

  return (
    <div className="fixed inset-0 z-80 bg-black/75 backdrop-blur-sm overflow-y-auto p-4">
      <div className="min-h-full flex items-start justify-center py-4">
        <div className={`w-full max-w-6xl min-h-[86vh] max-h-none rounded-3xl overflow-hidden border shadow-2xl ${isDarkMode ? 'bg-gray-950 border-gray-800/70 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
        <div className={`px-5 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-800/70 bg-gray-900/90' : 'border-gray-200 bg-slate-50/90'}`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('whiteboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${tab === 'whiteboard' ? 'bg-indigo-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
            >
              <FiEdit3 /> Whiteboard
            </button>
            <button
              onClick={() => setTab('code')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 ${tab === 'code' ? 'bg-emerald-600 text-white' : (isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-slate-100 text-gray-700')}`}
            >
              <FiCode /> Code
            </button>
          </div>
          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-slate-100 text-gray-700 hover:bg-slate-200'}`}
            title="Close collaboration"
          >
            <FiX />
          </button>
        </div>

        <div className="min-h-[calc(86vh-65px)]">
          {tab === 'whiteboard' ? (
            <Whiteboard
              chatId={chatId}
              currentUserId={normalizedCurrentUserId}
              receiverId={normalizedReceiverId}
              isDarkMode={isDarkMode}
              socket={socket}
            />
          ) : (
            <CodeEditor chatId={chatId} currentUserId={normalizedCurrentUserId} receiverId={normalizedReceiverId} isDarkMode={isDarkMode} socket={socket} />
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

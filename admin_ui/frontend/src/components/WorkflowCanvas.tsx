import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, X, Save, Loader2,
  ZoomIn, ZoomOut, Maximize2, RotateCcw,
  RefreshCw, Settings, ArrowLeftRight, Code2, MoreHorizontal,
  ChevronDown,
} from 'lucide-react';

// ─── Types & constants ────────────────────────────────────────────────────────

const SNAP = 20;
const NODE_W = 300;

const NODE_TYPES = {
  conversation: {
    label: 'Conversation',
    color: '#3b82f6',
    bg: '#0f1e35',
    icon: '💬',
    iconBg: '#1d4ed8',
    shortcut: 'Ctrl+Shift+C',
  },
  api_request: {
    label: 'API Request',
    color: '#a855f7',
    bg: '#1a0f35',
    icon: '⚡',
    iconBg: '#7c3aed',
    shortcut: 'Ctrl+Shift+A',
  },
  transfer_call: {
    label: 'Transfer Call',
    color: '#22c55e',
    bg: '#0f2a1a',
    icon: '📞',
    iconBg: '#16a34a',
    shortcut: 'Ctrl+Shift+F',
  },
  end_call: {
    label: 'End call',
    color: '#ef4444',
    bg: '#2a0f0f',
    icon: '📵',
    iconBg: '#dc2626',
    shortcut: 'Ctrl+Shift+E',
  },
  tool: {
    label: 'Tool',
    color: '#f59e0b',
    bg: '#2a1f0f',
    icon: '🔧',
    iconBg: '#d97706',
    shortcut: 'Ctrl+Shift+O',
  },
};

function snap(v) { return Math.round(v / SNAP) * SNAP; }
function uid() { return Math.random().toString(36).slice(2, 9); }

function bezier(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const cy = Math.max(dy * 0.5, 60);
  return `M ${x1} ${y1} C ${x1} ${y1 + cy}, ${x2} ${y2 - cy}, ${x2} ${y2}`;
}

// ─── Tiny style helpers ───────────────────────────────────────────────────────

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginBottom: 4, letterSpacing: '0.02em' }}>
    {children}
  </div>
);

const textareaStyle = {
  width: '100%', background: 'transparent', border: 'none', outline: 'none',
  color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit', resize: 'none',
  lineHeight: 1.6, padding: 0, boxSizing: 'border-box',
};

const inputStyle = {
  width: '100%', background: '#ffffff08', border: '1px solid #1e2d3d',
  borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit',
  padding: '5px 8px', outline: 'none', boxSizing: 'border-box',
};

const iconBtnStyle = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#64748b', padding: 3, borderRadius: 4, lineHeight: 1,
  display: 'flex', alignItems: 'center',
};

// ─── Edge label ───────────────────────────────────────────────────────────────

const EdgeLabel = ({ x, y, label, onDelete }) => {
  const [hov, setHov] = useState(false);
  const text = hov ? '✕ delete' : (label || 'condition');
  const w = Math.max(text.length * 6.5 + 20, 80);
  return (
    <g>
      <rect
        x={x - w / 2} y={y - 11} width={w} height={22} rx={11}
        fill="#1e2d3d" stroke="#334155" strokeWidth={1}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={onDelete}
      />
      <text x={x} y={y + 4} textAnchor="middle"
        fill={hov ? '#ef4444' : '#94a3b8'} fontSize={10} fontFamily="inherit">
        {text}
      </text>
    </g>
  );
};

// ─── Node component ───────────────────────────────────────────────────────────

const VNode = ({
  node, selected, onSelect, onDragStart,
  onOutputMouseDown, onInputMouseUp,
  isConnecting, onDelete, onUpdateNode,
}) => {
  const t = NODE_TYPES[node.type] || NODE_TYPES.conversation;

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_W,
        userSelect: 'none',
        zIndex: selected ? 20 : 10,
      }}
    >
      {/* Start badge */}
      {node.isStart && (
        <div style={{
          position: 'absolute', top: -26, left: 0,
          background: '#10b981', color: '#fff',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
          padding: '2px 10px', borderRadius: 4,
        }}>
          ▶ Start Node
        </div>
      )}

      {/* Input port — top center */}
      {!node.isStart && (
        <div
          onMouseUp={e => { e.stopPropagation(); onInputMouseUp(node.id); }}
          style={{
            position: 'absolute', top: -8, left: '50%',
            transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: isConnecting ? t.color : '#1e293b',
            border: `2px solid ${isConnecting ? t.color : '#334155'}`,
            cursor: 'crosshair', zIndex: 30,
            boxShadow: isConnecting ? `0 0 8px ${t.color}` : 'none',
            transition: 'all 0.15s',
          }}
        />
      )}

      {/* Card */}
      <div
        onMouseDown={e => { if (e.button !== 0) return; e.stopPropagation(); onDragStart(e, node.id); onSelect(node.id); }}
        style={{
          background: t.bg,
          border: `1.5px solid ${selected ? t.color : t.color + '50'}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: selected
            ? `0 0 0 1px ${t.color}40, 0 12px 40px #0009`
            : '0 4px 24px #0007',
          cursor: 'grab',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 12px 9px',
          background: t.color + '18',
          borderBottom: `1px solid ${t.color}25`,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: t.iconBg, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 14, flexShrink: 0,
          }}>
            {t.icon}
          </div>
          <input
            value={node.label || ''}
            onChange={e => onUpdateNode(node.id, { label: e.target.value })}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', minWidth: 0,
            }}
          />
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button onMouseDown={e => e.stopPropagation()} style={iconBtnStyle}><RefreshCw size={11} /></button>
            <button onMouseDown={e => e.stopPropagation()} style={iconBtnStyle}><Settings size={11} /></button>
            <button onMouseDown={e => { e.stopPropagation(); onDelete(node.id); }} style={{ ...iconBtnStyle, color: '#475569' }}><X size={11} /></button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px 12px' }}>
          {(node.type === 'conversation' || !node.type) && (
            <>
              <FieldLabel>First Message:</FieldLabel>
              <textarea
                value={node.data?.firstMessage || ''}
                onChange={e => onUpdateNode(node.id, { data: { ...node.data, firstMessage: e.target.value } })}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                placeholder="What the AI says first…"
                rows={3}
                style={textareaStyle}
              />
              <div style={{ height: 10 }} />
              <FieldLabel>Prompt:</FieldLabel>
              <textarea
                value={node.data?.prompt || ''}
                onChange={e => onUpdateNode(node.id, { data: { ...node.data, prompt: e.target.value } })}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                placeholder=""
                rows={4}
                style={{
                  ...textareaStyle,
                  color: node.data?.prompt ? '#cbd5e1' : '#ef4444',
                }}
              />
              {!node.data?.prompt && (
                <div style={{ color: '#ef4444', fontSize: 10, marginTop: 2 }}>No Prompt Specified</div>
              )}
            </>
          )}
          {node.type === 'transfer_call' && (
            <>
              <FieldLabel>Transfer to:</FieldLabel>
              <input value={node.data?.destination || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, destination: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="+1 (555) 000-0000 or SIP URI" style={inputStyle} />
            </>
          )}
          {node.type === 'api_request' && (
            <>
              <FieldLabel>URL:</FieldLabel>
              <input value={node.data?.url || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, url: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="https://api.example.com/endpoint" style={inputStyle} />
              <div style={{ height: 8 }} />
              <FieldLabel>Method:</FieldLabel>
              <select value={node.data?.method || 'POST'} onChange={e => onUpdateNode(node.id, { data: { ...node.data, method: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} style={{ ...inputStyle, cursor: 'pointer' }}>
                {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
              </select>
            </>
          )}
          {node.type === 'end_call' && (
            <>
              <FieldLabel>Farewell message:</FieldLabel>
              <textarea value={node.data?.farewell || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, farewell: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="Goodbye! Have a great day." rows={2} style={textareaStyle} />
            </>
          )}
          {node.type === 'tool' && (
            <>
              <FieldLabel>Tool name:</FieldLabel>
              <input value={node.data?.toolName || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, toolName: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="e.g. check_availability" style={inputStyle} />
            </>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 12, paddingTop: 10,
            borderTop: `1px solid ${t.color}20`,
          }}>
            <span style={{ color: '#475569', fontSize: 10 }}>Cost: <span style={{ color: '#64748b' }}>$0.09/min ▶</span></span>
            <span style={{ color: '#475569', fontSize: 10 }}>Latency: <span style={{ color: '#64748b' }}>1.1s ▶</span></span>
          </div>
        </div>
      </div>

      {/* Output port — bottom center */}
      <div
        onMouseDown={e => { e.stopPropagation(); onOutputMouseDown(e, node.id); }}
        style={{
          position: 'absolute', bottom: -8, left: '50%',
          transform: 'translateX(-50%)',
          width: 16, height: 16, borderRadius: '50%',
          background: '#0f172a', border: `2px solid ${t.color}`,
          cursor: 'crosshair', zIndex: 30,
          transition: 'transform 0.1s, background 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = t.color; e.currentTarget.style.transform = 'translateX(-50%) scale(1.4)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; e.currentTarget.style.transform = 'translateX(-50%) scale(1)'; }}
      />
    </div>
  );
};

// ─── Add Node Panel ───────────────────────────────────────────────────────────

const AddPanel = ({ onAdd, onClose }) => (
  <div style={{
    position: 'absolute', left: 16, top: 56,
    width: 300, background: '#0d1520',
    border: '1px solid #1e2d3d', borderRadius: 12,
    boxShadow: '0 16px 48px #000c', zIndex: 150,
    fontFamily: 'inherit', overflow: 'hidden',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px 12px', borderBottom: '1px solid #1e2d3d',
    }}>
      <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Add a Node</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', lineHeight: 1 }}>
        <X size={16} />
      </button>
    </div>
    <div style={{ padding: '8px 0' }}>
      {Object.entries(NODE_TYPES).map(([type, meta]) => (
        <button
          key={type}
          onClick={() => { onAdd(type); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            width: '100%', padding: '10px 16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#cbd5e1', fontSize: 13, textAlign: 'left', fontFamily: 'inherit',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: meta.iconBg + 'cc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, flexShrink: 0,
          }}>
            {meta.icon}
          </div>
          <span style={{ flex: 1 }}>{meta.label}</span>
          <span style={{ fontSize: 10, color: '#2a3a4a', letterSpacing: '0.03em' }}>{meta.shortcut}</span>
        </button>
      ))}
    </div>
  </div>
);

// ─── Main Canvas ──────────────────────────────────────────────────────────────

const WorkflowCanvas = ({
  workflowName = 'Untitled Workflow',
  initialNodes,
  initialEdges,
  onSave,
  onClose,
}) => {
  const [nodes, setNodes] = useState(initialNodes || [
    {
      id: 'start',
      type: 'conversation',
      label: 'introduction',
      isStart: true,
      x: 460, y: 180,
      data: { firstMessage: "Hello! I'm your assistant. How can I help you today?", prompt: '' },
    },
  ]);
  const [edges, setEdges] = useState(initialEdges || []);
  const [selected, setSelected] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsaved, setUnsaved] = useState(false);

  const canvasRef = useRef(null);
  const mark = () => setUnsaved(true);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        const m = { c: 'conversation', a: 'api_request', f: 'transfer_call', e: 'end_call', o: 'tool' };
        if (m[e.key.toLowerCase()]) { addNode(m[e.key.toLowerCase()]); e.preventDefault(); }
      }
      if (e.key === 'Escape') { setConnecting(null); setSelected(null); setShowAddPanel(false); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && e.target === document.body) deleteNode(selected);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected]);

  const handleDragStart = useCallback((e, nodeId) => {
    if (connecting) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    const cx = (e.clientX - rect.left - pan.x) / zoom;
    const cy = (e.clientY - rect.top - pan.y) / zoom;
    setDragging({ nodeId, ox: cx - node.x, oy: cy - node.y });
  }, [nodes, pan, zoom, connecting]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    } else if (e.button === 0) {
      setSelected(null);
      setShowAddPanel(false);
      if (connecting) setConnecting(null);
    }
  }, [pan, connecting]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (dragging) {
      const cx = (e.clientX - rect.left - pan.x) / zoom;
      const cy = (e.clientY - rect.top - pan.y) / zoom;
      setNodes(prev => prev.map(n => n.id === dragging.nodeId
        ? { ...n, x: snap(cx - dragging.ox), y: snap(cy - dragging.oy) } : n));
      mark();
    }
    if (isPanning && panStart) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [dragging, isPanning, panStart, pan, zoom]);

  const handleMouseUp = useCallback(() => { setDragging(null); setIsPanning(false); }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.25), 2.5));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleOutputMouseDown = useCallback((e, fromId) => {
    e.stopPropagation();
    setConnecting({ fromId });
  }, []);

  const handleInputMouseUp = useCallback((toId) => {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return; }
    setEdges(prev => {
      if (prev.find(ed => ed.from === connecting.fromId && ed.to === toId)) return prev;
      return [...prev, { id: uid(), from: connecting.fromId, to: toId, label: '' }];
    });
    setConnecting(null);
    mark();
  }, [connecting]);

  const addNode = (type) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 300;
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 300;
    const id = uid();
    setNodes(prev => [...prev, {
      id, type, label: NODE_TYPES[type]?.label || type,
      x: snap(cx - NODE_W / 2 + (Math.random() * 80 - 40)),
      y: snap(cy - 120 + (Math.random() * 80 - 40)),
      data: {},
    }]);
    setSelected(id);
    mark();
  };

  const deleteNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
    mark();
  };

  const updateNode = (id, updates) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    mark();
  };

  const deleteEdge = (id) => { setEdges(prev => prev.filter(e => e.id !== id)); mark(); };

  const nodeH = (node) => ({ conversation: 300, api_request: 220, transfer_call: 180, end_call: 180, tool: 180 }[node.type] || 280);
  const outPos = (node) => ({ x: node.x + NODE_W / 2, y: node.y + nodeH(node) + 8 });
  const inPos = (node) => ({ x: node.x + NODE_W / 2, y: node.y - 8 });

  const draftPath = connecting ? (() => {
    const fn = nodes.find(n => n.id === connecting.fromId);
    if (!fn) return null;
    const fp = outPos(fn);
    return bezier(fp.x, fp.y, (mousePos.x - pan.x) / zoom, (mousePos.y - pan.y) / zoom);
  })() : null;

  const fitView = () => {
    if (!nodes.length || !canvasRef.current) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 80, minY = Math.min(...ys) - 80;
    const maxX = Math.max(...xs) + NODE_W + 80, maxY = Math.max(...ys) + 360;
    const vw = canvasRef.current.clientWidth, vh = canvasRef.current.clientHeight;
    const z = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.2);
    setZoom(z);
    setPan({ x: -minX * z + (vw - (maxX - minX) * z) / 2, y: -minY * z + (vh - (maxY - minY) * z) / 2 });
  };

  const handleSave = async () => {
    setSaving(true);
    const steps = nodes.filter(n => !n.isStart).map(n => ({
      id: n.id, type: n.type, label: n.label, ...n.data,
      next: edges.find(e => e.from === n.id)?.to,
    }));
    await onSave?.({ steps, nodes, edges });
    setSaving(false);
    setUnsaved(false);
  };

  const toolbarBtns = [
    { icon: '⚙', title: 'Settings' },
    { icon: '⊞', title: 'Grid' },
    { icon: <RotateCcw size={14} />, title: 'Undo' },
    { icon: '↻', title: 'Redo' },
    null,
    { icon: <ArrowLeftRight size={14} />, title: 'Auto-layout' },
    null,
    { icon: <ZoomOut size={14} />, title: 'Zoom out', action: () => setZoom(z => Math.max(z * 0.8, 0.25)) },
    { icon: <ZoomIn size={14} />, title: 'Zoom in', action: () => setZoom(z => Math.min(z * 1.2, 2.5)) },
    { icon: <Maximize2 size={14} />, title: 'Fit view', action: fitView },
    null,
    { icon: '↖', title: 'Select' },
    { icon: '✋', title: 'Pan' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080d14', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', height: 52, flexShrink: 0,
        background: '#0a0f1a', borderBottom: '1px solid #131d2b', zIndex: 200,
      }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px 8px', lineHeight: 1, borderRadius: 6, fontSize: 18 }}>
            ←
          </button>
        )}
        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{workflowName}</span>

        {unsaved && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1a120060', border: '1px solid #f59e0b40',
            borderRadius: 20, padding: '3px 12px',
            color: '#f59e0b', fontSize: 11, marginLeft: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
            Unsaved changes
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={{
            background: 'none', border: '1px solid #1e2d3d', borderRadius: 7,
            cursor: 'pointer', color: '#64748b', padding: '6px 12px',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
          }}>
            <Code2 size={13} />
          </button>
          <button style={{
            background: 'none', border: '1px solid #22c55e50', borderRadius: 7,
            cursor: 'pointer', color: '#22c55e', padding: '6px 14px',
            fontSize: 12, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
          }}>
            📞 Call <ChevronDown size={12} />
          </button>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              background: '#10b981', border: 'none', borderRadius: 7,
              cursor: 'pointer', color: '#fff', padding: '7px 18px',
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            Save
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 6 }}>
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* Add a Node button */}
        <button
          onClick={() => setShowAddPanel(v => !v)}
          style={{
            position: 'absolute', left: 16, top: 12, zIndex: 120,
            display: 'flex', alignItems: 'center', gap: 8,
            background: showAddPanel ? '#10b98118' : '#0d1a2a',
            border: `1px solid ${showAddPanel ? '#10b981' : '#1e2d3d'}`,
            borderRadius: 8, cursor: 'pointer',
            color: showAddPanel ? '#10b981' : '#94a3b8',
            padding: '8px 14px', fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          <Plus size={15} /> Add a Node
        </button>

        {showAddPanel && <AddPanel onAdd={addNode} onClose={() => setShowAddPanel(false)} />}

        {/* Bottom toolbar */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 2,
          background: '#0a0f1a', border: '1px solid #131d2b',
          borderRadius: 12, padding: '5px 8px', zIndex: 100,
        }}>
          {toolbarBtns.map((item, i) =>
            item === null
              ? <div key={i} style={{ width: 1, height: 18, background: '#1e2d3d', margin: '0 3px' }} />
              : (
                <button key={i} title={item.title} onClick={item.action}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#475569', padding: '5px 7px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, fontSize: 13,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = '#ffffff0a'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'none'; }}
                >
                  {item.icon}
                </button>
              )
          )}
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            width: '100%', height: '100%', overflow: 'hidden',
            cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'default',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Dot grid */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern
                id="dotgrid"
                x={pan.x % (16 * zoom)} y={pan.y % (16 * zoom)}
                width={16 * zoom} height={16 * zoom}
                patternUnits="userSpaceOnUse"
              >
                <circle cx={8 * zoom} cy={8 * zoom} r={0.7} fill="#1a2535" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
          </svg>

          {/* World transform */}
          <div style={{
            position: 'absolute', inset: 0, transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}>
            {/* Edges SVG */}
            <svg style={{ position: 'absolute', inset: 0, width: '9999px', height: '9999px', overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#2a3d52" />
                </marker>
                <marker id="arr-draft" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#475569" />
                </marker>
              </defs>

              {edges.map(edge => {
                const fn = nodes.find(n => n.id === edge.from);
                const tn = nodes.find(n => n.id === edge.to);
                if (!fn || !tn) return null;
                const fp = outPos(fn), tp = inPos(tn);
                const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
                const d = bezier(fp.x, fp.y, tp.x, tp.y);
                return (
                  <g key={edge.id} style={{ pointerEvents: 'all' }}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} onClick={() => deleteEdge(edge.id)} />
                    <path d={d} fill="none" stroke="#1e3a52" strokeWidth={1.5} markerEnd="url(#arr)" />
                    <EdgeLabel x={mx} y={my} label={edge.label} onDelete={() => deleteEdge(edge.id)} />
                  </g>
                );
              })}

              {draftPath && (
                <path d={draftPath} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="6 4" markerEnd="url(#arr-draft)" />
              )}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <VNode
                key={node.id}
                node={node}
                selected={selected === node.id}
                onSelect={setSelected}
                onDragStart={handleDragStart}
                onOutputMouseDown={handleOutputMouseDown}
                onInputMouseUp={handleInputMouseUp}
                isConnecting={!!connecting}
                onDelete={deleteNode}
                onUpdateNode={updateNode}
              />
            ))}
          </div>
        </div>

        {/* Zoom % */}
        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          background: '#0a0f1a', border: '1px solid #131d2b',
          borderRadius: 6, padding: '4px 10px',
          color: '#2a3d52', fontSize: 11, zIndex: 100,
        }}>
          {Math.round(zoom * 100)}%
        </div>

        {/* Mini-map */}
        <div style={{
          position: 'absolute', bottom: 16, right: 70,
          width: 100, height: 66,
          background: '#0a0f1a', border: '1px solid #131d2b',
          borderRadius: 8, overflow: 'hidden', zIndex: 100,
        }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {nodes.map((n, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: Math.max(0, Math.min(84, (n.x / 1400) * 100)),
                top: Math.max(0, Math.min(50, (n.y / 900) * 66)),
                width: 16, height: 10, borderRadius: 2,
                background: (NODE_TYPES[n.type]?.color || '#3b82f6') + '50',
              }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, X, Save, Loader2, ZoomIn, ZoomOut, Maximize2,
  RotateCcw, RefreshCw, ArrowLeftRight, Code2,
  MoreHorizontal, ChevronDown, Settings, Lock,
  Mic, Braces, MessageSquare,
} from 'lucide-react';

// ─── Config ───────────────────────────────────────────────────────────────────

const SNAP = 20;
const NODE_W = 360;

const NODE_DEFS = {
  conversation: {
    label: 'Conversation', color: '#3b82f6',
    bg: 'linear-gradient(160deg,#0f1e3a 0%,#0d1830 100%)',
    border: '#1e3a6a', shortcut: 'Ctrl+Shift+C',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    iconBg: '#1d4ed8',
  },
  api_request: {
    label: 'API Request', color: '#a855f7',
    bg: 'linear-gradient(160deg,#1a0f35 0%,#150c2e 100%)',
    border: '#3b1d6e', shortcut: 'Ctrl+Shift+A',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><polyline points="13 2 13 9 20 9"/><path d="M21 14a9 9 0 1 1-9-9"/><polyline points="3 12 7 8 3 4"/></svg>,
    iconBg: '#7c3aed',
  },
  transfer_call: {
    label: 'Transfer Call', color: '#22c55e',
    bg: 'linear-gradient(160deg,#0a2016 0%,#081a12 100%)',
    border: '#145228', shortcut: 'Ctrl+Shift+F',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.37 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    iconBg: '#16a34a',
  },
  end_call: {
    label: 'End call', color: '#ef4444',
    bg: 'linear-gradient(160deg,#2a0f0f 0%,#220c0c 100%)',
    border: '#5a1a1a', shortcut: 'Ctrl+Shift+E',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    iconBg: '#dc2626',
  },
  tool: {
    label: 'Tool', color: '#f59e0b',
    bg: 'linear-gradient(160deg,#2a1a08 0%,#221508 100%)',
    border: '#5a3a12', shortcut: 'Ctrl+Shift+O',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
    iconBg: '#d97706',
  },
};

function snp(v) { return Math.round(v / SNAP) * SNAP; }
function uid() { return Math.random().toString(36).slice(2, 9); }
function shortUuid() {
  return Array.from({ length: 8 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    + '-' + Array.from({ length: 4 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    + '-' + Array.from({ length: 4 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    + '-' + Array.from({ length: 4 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    + '-' + Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}

function bezier(x1, y1, x2, y2) {
  const dy = Math.abs(y2 - y1);
  const c = Math.max(dy * 0.55, 70);
  return `M ${x1} ${y1} C ${x1} ${y1 + c}, ${x2} ${y2 - c}, ${x2} ${y2}`;
}

// ─── Node ─────────────────────────────────────────────────────────────────────

const VNode = ({ node, selected, onSelect, onDragStart, onOutputMouseDown, onInputMouseUp, isConnecting, onDelete, onUpdateNode }) => {
  const def = NODE_DEFS[node.type] || NODE_DEFS.conversation;
  const [outputHovered, setOutputHovered] = useState(false);

  return (
    <div style={{ position: 'absolute', left: node.x, top: node.y, width: NODE_W, userSelect: 'none', zIndex: selected ? 20 : 10 }}>

      {/* Start badge */}
      {node.isStart && (
        <div style={{
          position: 'absolute', top: -30, left: 0,
          background: '#10b981', color: '#fff',
          fontSize: 11, fontWeight: 700, padding: '3px 12px',
          borderRadius: 5, display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="#fff"><polygon points="2,1 9,5 2,9"/></svg>
          Start Node
        </div>
      )}

      {/* Input port — top center, unfilled circle */}
      {!node.isStart && (
        <div
          onMouseUp={e => { e.stopPropagation(); onInputMouseUp(node.id); }}
          style={{
            position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)',
            width: 18, height: 18, borderRadius: '50%',
            background: '#0f172a',
            border: `2.5px solid ${isConnecting ? def.color : '#2a3d52'}`,
            cursor: 'crosshair', zIndex: 30,
            boxShadow: isConnecting ? `0 0 10px ${def.color}80` : 'none',
            transition: 'all 0.15s',
          }}
        />
      )}

      {/* Card */}
      <div
        onMouseDown={e => { if (e.button !== 0) return; e.stopPropagation(); onDragStart(e, node.id); onSelect(node.id); }}
        style={{
          background: def.bg, border: `1.5px solid ${selected ? def.color : def.border}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: selected ? `0 0 0 1.5px ${def.color}50, 0 16px 48px #000a` : '0 4px 28px #000a',
          cursor: 'grab', transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px 10px',
          borderBottom: `1px solid ${def.color}20`,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: def.iconBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', flexShrink: 0,
          }}>
            {def.icon}
          </div>
          <input
            value={node.label || ''}
            onChange={e => onUpdateNode(node.id, { label: e.target.value })}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', minWidth: 0,
            }}
          />
          {/* Header action icons — always visible, muted */}
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {[<RefreshCw size={12}/>, <Settings size={12}/>, <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>].map((ic, i) => (
              <button key={i} onMouseDown={e => e.stopPropagation()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 3, lineHeight: 1, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                onMouseLeave={e => e.currentTarget.style.color = '#334155'}
              >{ic}</button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 14px 14px' }}>
          {(node.type === 'conversation' || !node.type) && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 5 }}>First Message:</div>
                <textarea
                  value={node.data?.firstMessage || ''}
                  onChange={e => onUpdateNode(node.id, { data: { ...node.data, firstMessage: e.target.value } })}
                  onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
                  placeholder="What the AI says at the start of this node…"
                  rows={2}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', resize: 'none', lineHeight: 1.6, padding: 0, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 5 }}>Prompt:</div>
                {node.data?.prompt
                  ? <textarea value={node.data.prompt} onChange={e => onUpdateNode(node.id, { data: { ...node.data, prompt: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} rows={3} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', resize: 'none', lineHeight: 1.6, padding: 0, boxSizing: 'border-box' }} />
                  : <div style={{ color: '#ef4444', fontSize: 12 }} onClick={e => e.stopPropagation()} onMouseDown={e => { e.stopPropagation(); onUpdateNode(node.id, { data: { ...node.data, prompt: ' ' } }); }}>No Prompt Specified</div>
                }
              </div>
            </>
          )}
          {node.type === 'transfer_call' && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Transfer to:</div>
              <input value={node.data?.destination || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, destination: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="+1 (555) 000-0000" style={{ width: '100%', background: '#ffffff08', border: '1px solid #1e3a52', borderRadius: 6, color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          {node.type === 'api_request' && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Endpoint URL:</div>
              <input value={node.data?.url || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, url: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="https://api.example.com/endpoint" style={{ width: '100%', background: '#ffffff08', border: '1px solid #2a1d4e', borderRadius: 6, color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}
          {node.type === 'end_call' && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Farewell message:</div>
              <textarea value={node.data?.farewell || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, farewell: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="Goodbye! Have a great day." rows={2} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', resize: 'none', lineHeight: 1.6, padding: 0, boxSizing: 'border-box' }} />
            </div>
          )}
          {node.type === 'tool' && (
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 5 }}>Tool name:</div>
              <input value={node.data?.toolName || ''} onChange={e => onUpdateNode(node.id, { data: { ...node.data, toolName: e.target.value } })} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} placeholder="e.g. check_availability" style={{ width: '100%', background: '#ffffff08', border: '1px solid #3a2a12', borderRadius: 6, color: '#cbd5e1', fontSize: 12, fontFamily: 'inherit', padding: '6px 8px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: `1px solid ${def.color}18` }}>
            <span style={{ color: '#334155', fontSize: 10 }}>Cost: <span style={{ color: '#475569' }}>$0.09/min ▶</span></span>
            <span style={{ color: '#334155', fontSize: 10 }}>Latency: <span style={{ color: '#475569' }}>1.1s ▶</span></span>
          </div>
        </div>
      </div>

      {/* Output port — filled blue circle + green + button */}
      <div
        style={{ position: 'absolute', bottom: -9, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, zIndex: 30 }}
        onMouseEnter={() => setOutputHovered(true)}
        onMouseLeave={() => setOutputHovered(false)}
      >
        <div
          onMouseDown={e => { e.stopPropagation(); onOutputMouseDown(e, node.id); }}
          style={{
            width: 18, height: 18, borderRadius: '50%',
            background: '#3b82f6',
            border: '2.5px solid #1d4ed8',
            cursor: 'crosshair',
            boxShadow: outputHovered ? '0 0 12px #3b82f680' : 'none',
            transition: 'box-shadow 0.15s',
          }}
        />
        {outputHovered && (
          <div
            onMouseDown={e => { e.stopPropagation(); onOutputMouseDown(e, node.id); }}
            style={{
              marginTop: 8, width: 28, height: 28, borderRadius: '50%',
              background: '#10b981', border: '2px solid #059669',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 12px #10b98180',
              animation: 'fadeIn 0.1s ease',
            }}
          >
            <Plus size={14} color="#fff" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

const Sidebar = ({ onAddNode, showAddPanel, setShowAddPanel }) => {
  const sidebarBtns = [
    { label: 'Add a Node', icon: <Plus size={14}/>, primary: true, action: () => setShowAddPanel(v => !v) },
    { label: 'Global Prompt', icon: <MessageSquare size={14}/>, action: () => {} },
    { label: 'Global Voice', icon: <Mic size={14}/>, action: () => {} },
    { label: 'Variables', icon: <Braces size={14}/>, action: () => {} },
  ];

  return (
    <div style={{
      position: 'absolute', left: 16, top: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 110,
    }}>
      {sidebarBtns.map((btn, i) => (
        <button
          key={i}
          onClick={btn.action}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            background: (i === 0 && showAddPanel) ? '#10b98120' : '#0d1520',
            border: `1px solid ${(i === 0 && showAddPanel) ? '#10b981' : '#1e2d3d'}`,
            borderRadius: 8, cursor: 'pointer',
            color: (i === 0 && showAddPanel) ? '#10b981' : '#94a3b8',
            fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { if (!(i === 0 && showAddPanel)) e.currentTarget.style.borderColor = '#2a3d52'; }}
          onMouseLeave={e => { if (!(i === 0 && showAddPanel)) e.currentTarget.style.borderColor = '#1e2d3d'; }}
        >
          <span style={{ color: i === 0 ? (showAddPanel ? '#10b981' : '#10b981') : '#64748b' }}>{btn.icon}</span>
          {btn.label}
        </button>
      ))}

      {/* Add node dropdown */}
      {showAddPanel && (
        <div style={{
          position: 'absolute', left: 0, top: 48,
          width: 300, background: '#0d1520',
          border: '1px solid #1e2d3d', borderRadius: 12,
          boxShadow: '0 16px 48px #000c', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 12px', borderBottom: '1px solid #1e2d3d' }}>
            <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 600 }}>Add a Node</span>
            <button onClick={() => setShowAddPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', lineHeight: 1 }}><X size={15}/></button>
          </div>
          {Object.entries(NODE_DEFS).map(([type, meta]) => (
            <button
              key={type}
              onClick={() => { onAddNode(type); setShowAddPanel(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', fontSize: 13, textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <div style={{ width: 34, height: 34, borderRadius: 9, background: meta.iconBg + 'cc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                {meta.icon}
              </div>
              <span style={{ flex: 1 }}>{meta.label}</span>
              <span style={{ fontSize: 10, color: '#2a3a4a' }}>{meta.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Edge label ───────────────────────────────────────────────────────────────

const EdgeLabel = ({ x, y, label, onDelete }) => {
  const [hov, setHov] = useState(false);
  const text = hov ? '✕' : (label || 'condition');
  const w = hov ? 32 : Math.max(text.length * 7 + 20, 70);
  return (
    <g style={{ pointerEvents: 'all' }}>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill="#0d1520" stroke="#1e2d3d" strokeWidth={1} style={{ cursor: 'pointer' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onDelete} />
      <text x={x} y={y + 4} textAnchor="middle" fill={hov ? '#ef4444' : '#64748b'} fontSize={10} fontFamily="inherit" style={{ pointerEvents: 'none' }}>{text}</text>
    </g>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const WorkflowCanvas = ({ workflowName = 'Untitled Workflow', initialNodes, initialEdges, onSave, onClose }) => {
  const [wfId] = useState(() => shortUuid());
  const [nodes, setNodes] = useState(initialNodes || [{
    id: 'start', type: 'conversation', label: 'introduction', isStart: true,
    x: 320, y: 200, data: { firstMessage: '', prompt: '' },
  }]);
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

  useEffect(() => {
    const h = e => {
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

  const handleCanvasDown = useCallback(e => {
    if (e.button === 1 || e.altKey) {
      setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); e.preventDefault();
    } else if (e.button === 0) {
      setSelected(null); setShowAddPanel(false); if (connecting) setConnecting(null);
    }
  }, [pan, connecting]);

  const handleMouseMove = useCallback(e => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (dragging) {
      const cx = (e.clientX - rect.left - pan.x) / zoom, cy = (e.clientY - rect.top - pan.y) / zoom;
      setNodes(prev => prev.map(n => n.id === dragging.nodeId ? { ...n, x: snp(cx - dragging.ox), y: snp(cy - dragging.oy) } : n));
      mark();
    }
    if (isPanning && panStart) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [dragging, isPanning, panStart, pan, zoom]);

  const handleMouseUp = useCallback(() => { setDragging(null); setIsPanning(false); }, []);

  const handleWheel = useCallback(e => {
    e.preventDefault();
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.2), 3));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleOutputMouseDown = useCallback((e, fromId) => { e.stopPropagation(); setConnecting({ fromId }); }, []);
  const handleInputMouseUp = useCallback(toId => {
    if (!connecting || connecting.fromId === toId) { setConnecting(null); return; }
    setEdges(prev => {
      if (prev.find(ed => ed.from === connecting.fromId && ed.to === toId)) return prev;
      return [...prev, { id: uid(), from: connecting.fromId, to: toId, label: '' }];
    });
    setConnecting(null); mark();
  }, [connecting]);

  const addNode = type => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - pan.x) / zoom : 400;
    const cy = rect ? (rect.height / 2 - pan.y) / zoom : 300;
    const id = uid();
    setNodes(prev => [...prev, { id, type, label: NODE_DEFS[type]?.label || type, x: snp(cx - NODE_W / 2 + (Math.random() * 100 - 50)), y: snp(cy - 120 + (Math.random() * 100 - 50)), data: {} }]);
    setSelected(id); mark();
  };

  const deleteNode = id => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null); mark();
  };
  const updateNode = (id, updates) => { setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n)); mark(); };
  const deleteEdge = id => { setEdges(prev => prev.filter(e => e.id !== id)); mark(); };

  const nodeH = node => ({ conversation: 290, api_request: 210, transfer_call: 180, end_call: 180, tool: 180 }[node.type] || 260);
  const outPos = node => ({ x: node.x + NODE_W / 2, y: node.y + nodeH(node) + 9 });
  const inPos  = node => ({ x: node.x + NODE_W / 2, y: node.y - 9 });

  const draftPath = connecting ? (() => {
    const fn = nodes.find(n => n.id === connecting.fromId);
    if (!fn) return null;
    const fp = outPos(fn);
    return bezier(fp.x, fp.y, (mousePos.x - pan.x) / zoom, (mousePos.y - pan.y) / zoom);
  })() : null;

  const fitView = () => {
    if (!nodes.length || !canvasRef.current) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 100, minY = Math.min(...ys) - 100;
    const maxX = Math.max(...xs) + NODE_W + 100, maxY = Math.max(...ys) + 400;
    const vw = canvasRef.current.clientWidth, vh = canvasRef.current.clientHeight;
    const z = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.2);
    setZoom(z);
    setPan({ x: -minX * z + (vw - (maxX - minX) * z) / 2, y: -minY * z + (vh - (maxY - minY) * z) / 2 });
  };

  const handleSave = async () => {
    setSaving(true);
    const steps = nodes.filter(n => !n.isStart).map(n => ({ id: n.id, type: n.type, label: n.label, ...n.data, next: edges.find(e => e.from === n.id)?.to }));
    await onSave?.({ steps, nodes, edges });
    setSaving(false); setUnsaved(false);
  };

  const toolbarItems = [
    { icon: <Settings size={15}/>, title: 'Settings' },
    { icon: <Lock size={15}/>, title: 'Lock' },
    { icon: <RotateCcw size={15}/>, title: 'Undo' },
    { icon: <RefreshCw size={15}/>, title: 'Redo' },
    null,
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>, title: 'Node list' },
    { icon: <ArrowLeftRight size={15}/>, title: 'Auto-layout' },
    null,
    { icon: <ZoomOut size={15}/>, title: 'Zoom out', action: () => setZoom(z => Math.max(z * 0.8, 0.2)) },
    { icon: <ZoomIn size={15}/>, title: 'Zoom in', action: () => setZoom(z => Math.min(z * 1.2, 3)) },
    { icon: <Maximize2 size={15}/>, title: 'Fit view', action: fitView },
    null,
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>, title: 'Select' },
    { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>, title: 'Pan' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#080d14', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 52, flexShrink: 0, background: '#080d14', borderBottom: '1px solid #111a26', zIndex: 200 }}>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px 6px', fontSize: 18, lineHeight: 1 }}>←</button>
        )}
        <div>
          <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{workflowName}</div>
          <div style={{ color: '#2a3d52', fontSize: 10, letterSpacing: '0.02em' }}>{wfId}</div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {unsaved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1a120060', border: '1px solid #f59e0b40', borderRadius: 20, padding: '3px 12px', color: '#f59e0b', fontSize: 11 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b' }} />
              Unsaved changes
            </div>
          )}
          <button style={{ background: 'none', border: '1px solid #111a26', borderRadius: 7, cursor: 'pointer', color: '#475569', padding: '6px 10px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
            <Code2 size={13} />
          </button>
          <button style={{ background: 'none', border: '1px solid #22c55e40', borderRadius: 7, cursor: 'pointer', color: '#22c55e', padding: '6px 14px', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}>
            📞 Call <ChevronDown size={12}/>
          </button>
          <button onClick={handleSave} disabled={saving} style={{ background: '#10b981', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff', padding: '7px 18px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13}/>} Save
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: 4 }}><MoreHorizontal size={16}/></button>
        </div>
      </div>

      {/* Canvas + sidebar */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Sidebar onAddNode={addNode} showAddPanel={showAddPanel} setShowAddPanel={setShowAddPanel} />

        {/* Bottom toolbar */}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 1, background: '#080d14', border: '1px solid #111a26', borderRadius: 12, padding: '5px 8px', zIndex: 100 }}>
          {toolbarItems.map((item, i) =>
            item === null
              ? <div key={i} style={{ width: 1, height: 18, background: '#111a26', margin: '0 4px' }} />
              : (
                <button key={i} title={item.title} onClick={item.action} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', padding: '5px 7px', borderRadius: 6, display: 'flex', alignItems: 'center', lineHeight: 1 }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#ffffff08'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.background = 'none'; }}
                >{item.icon}</button>
              )
          )}
        </div>

        {/* Canvas */}
        <div ref={canvasRef} style={{ width: '100%', height: '100%', overflow: 'hidden', cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'default' }}
          onMouseDown={handleCanvasDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        >
          {/* Dot grid */}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="dg" x={pan.x % (18 * zoom)} y={pan.y % (18 * zoom)} width={18 * zoom} height={18 * zoom} patternUnits="userSpaceOnUse">
                <circle cx={9 * zoom} cy={9 * zoom} r={0.8} fill="#161f2e" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dg)" />
          </svg>

          <div style={{ position: 'absolute', inset: 0, transformOrigin: '0 0', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
            {/* Edges */}
            <svg style={{ position: 'absolute', inset: 0, width: '9999px', height: '9999px', overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                <marker id="arrw" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#1e3a52" />
                </marker>
                <marker id="arrw-d" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill="#334155" />
                </marker>
              </defs>
              {edges.map(edge => {
                const fn = nodes.find(n => n.id === edge.from), tn = nodes.find(n => n.id === edge.to);
                if (!fn || !tn) return null;
                const fp = outPos(fn), tp = inPos(tn);
                const d = bezier(fp.x, fp.y, tp.x, tp.y);
                const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
                return (
                  <g key={edge.id} style={{ pointerEvents: 'all' }}>
                    <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }} onClick={() => deleteEdge(edge.id)} />
                    <path d={d} fill="none" stroke="#1e3a52" strokeWidth={2} markerEnd="url(#arrw)" />
                    <EdgeLabel x={mx} y={my} label={edge.label} onDelete={() => deleteEdge(edge.id)} />
                  </g>
                );
              })}
              {draftPath && <path d={draftPath} fill="none" stroke="#334155" strokeWidth={2} strokeDasharray="6 4" markerEnd="url(#arrw-d)" />}
            </svg>

            {/* Nodes */}
            {nodes.map(node => (
              <VNode key={node.id} node={node} selected={selected === node.id} onSelect={setSelected} onDragStart={handleDragStart} onOutputMouseDown={handleOutputMouseDown} onInputMouseUp={handleInputMouseUp} isConnecting={!!connecting} onDelete={deleteNode} onUpdateNode={updateNode} />
            ))}
          </div>
        </div>

        {/* Zoom % + minimap */}
        <div style={{ position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'flex-end', gap: 8, zIndex: 100 }}>
          <div style={{ background: '#080d14', border: '1px solid #111a26', borderRadius: 8, overflow: 'hidden', width: 100, height: 66, position: 'relative' }}>
            {nodes.map((n, i) => (
              <div key={i} style={{ position: 'absolute', left: Math.max(2, Math.min(82, (n.x / 1400) * 100)), top: Math.max(2, Math.min(54, (n.y / 900) * 66)), width: 16, height: 10, borderRadius: 2, background: (NODE_DEFS[n.type]?.color || '#3b82f6') + '50' }} />
            ))}
            <div style={{ position: 'absolute', bottom: 4, right: 6, color: '#22c55e', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
              Composer
            </div>
          </div>
          <div style={{ background: '#080d14', border: '1px solid #111a26', borderRadius: 6, padding: '4px 10px', color: '#2a3d52', fontSize: 11 }}>
            {Math.round(zoom * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowCanvas;

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Trash2, Copy, X, Save, MessageSquare,
  ArrowRight, Zap, GitBranch, ChevronDown,
  Settings, Play, Loader2, AlertCircle, Check,
  MousePointer2, ZoomIn, ZoomOut, Maximize2, RotateCcw
} from 'lucide-react';

const NODE_WIDTH = 260;
const NODE_COLORS = {
  start:   { bg: '#0f4a3a', border: '#10b981', accent: '#10b981', label: 'Start' },
  prompt:  { bg: '#0d2d4a', border: '#3b82f6', accent: '#3b82f6', label: 'Prompt' },
  collect: { bg: '#2d1a4a', border: '#8b5cf6', accent: '#8b5cf6', label: 'Collect' },
  action:  { bg: '#3a2a0a', border: '#f59e0b', accent: '#f59e0b', label: 'Action' },
  branch:  { bg: '#0a3a1a', border: '#22c55e', accent: '#22c55e', label: 'Branch' },
};

const NODE_ICONS = {
  start:   <Play size={12} />,
  prompt:  <MessageSquare size={12} />,
  collect: <ArrowRight size={12} />,
  action:  <Zap size={12} />,
  branch:  <GitBranch size={12} />,
};

const SNAP_GRID = 20;

function snapToGrid(v) {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

function generateId() {
  return 'node_' + Math.random().toString(36).slice(2, 8);
}

function cubicPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1);
  const cx = Math.max(dx * 0.5, 80);
  return `M ${x1} ${y1} C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`;
}

const WorkflowNode = ({
  node, selected, onSelect, onDragStart,
  onPortMouseDown, onPortMouseUp,
  connectingFrom, onDelete, onDuplicate,
  onUpdateNode,
}) => {
  const col = NODE_COLORS[node.type] || NODE_COLORS.prompt;
  const isTarget = connectingFrom && connectingFrom.nodeId !== node.id;

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_WIDTH,
        zIndex: selected ? 20 : 10,
        fontFamily: "'IBM Plex Mono', monospace",
      }}
      onMouseDown={e => { e.stopPropagation(); onDragStart(e, node.id); onSelect(node.id); }}
    >
      <div style={{
        background: col.bg,
        border: `1.5px solid ${selected ? col.accent : col.border + '80'}`,
        borderRadius: 10,
        boxShadow: selected
          ? `0 0 0 1px ${col.accent}40, 0 8px 32px #0008`
          : '0 4px 20px #0006',
        overflow: 'visible',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        cursor: 'grab',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px 8px',
          borderBottom: `1px solid ${col.border}30`,
        }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: col.accent + '25', color: col.accent,
            borderRadius: 5, padding: '2px 8px 2px 6px',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
          }}>
            {NODE_ICONS[node.type]}
            {col.label.toUpperCase()}
          </span>
          <input
            value={node.id}
            onChange={e => onUpdateNode(node.id, { id: e.target.value })}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
              minWidth: 0,
            }}
          />
          {selected && (
            <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
              <button
                onMouseDown={e => { e.stopPropagation(); onDuplicate(node.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 3, borderRadius: 4, lineHeight: 1 }}
              >
                <Copy size={11} />
              </button>
              <button
                onMouseDown={e => { e.stopPropagation(); onDelete(node.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 3, borderRadius: 4, lineHeight: 1 }}
              >
                <X size={11} />
              </button>
            </div>
          )}
        </div>

        <div style={{ padding: '10px 12px 12px' }}>
          {node.type === 'start' && (
            <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>Entry point of the workflow</p>
          )}
          {(node.type === 'prompt' || node.type === 'collect') && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {node.type === 'collect' ? 'Ask' : 'Message'}
              </label>
              <textarea
                value={node.data?.prompt || ''}
                onChange={e => onUpdateNode(node.id, { data: { ...node.data, prompt: e.target.value } })}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                placeholder={node.type === 'collect' ? 'What to ask the caller…' : 'What the AI will say…'}
                rows={3}
                style={{
                  width: '100%', background: '#ffffff0a', border: '1px solid #ffffff15',
                  borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit',
                  padding: '6px 8px', resize: 'none', outline: 'none',
                  lineHeight: 1.5, marginTop: 4, boxSizing: 'border-box',
                }}
              />
              {node.type === 'collect' && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Entity</label>
                  <input
                    value={node.data?.entity || ''}
                    onChange={e => onUpdateNode(node.id, { data: { ...node.data, entity: e.target.value } })}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="e.g. customer_name"
                    style={{
                      width: '100%', background: '#ffffff0a', border: '1px solid #ffffff15',
                      borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit',
                      padding: '5px 8px', outline: 'none', marginTop: 4, boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          )}
          {node.type === 'action' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Tool</label>
              <input
                value={node.data?.tool || ''}
                onChange={e => onUpdateNode(node.id, { data: { ...node.data, tool: e.target.value } })}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                placeholder="e.g. blind_transfer, hangup_call"
                style={{
                  width: '100%', background: '#ffffff0a', border: '1px solid #ffffff15',
                  borderRadius: 6, color: '#cbd5e1', fontSize: 11, fontFamily: 'inherit',
                  padding: '5px 8px', outline: 'none', marginTop: 4, boxSizing: 'border-box',
                }}
              />
            </div>
          )}
          {node.type === 'branch' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Conditions ({node.data?.conditions?.length || 0})
              </label>
              {(node.data?.conditions || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  <input
                    value={c.if || ''}
                    onChange={e => {
                      const conds = [...(node.data?.conditions || [])];
                      conds[i] = { ...conds[i], if: e.target.value };
                      onUpdateNode(node.id, { data: { ...node.data, conditions: conds } });
                    }}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    placeholder="{{var}} == 'value'"
                    style={{
                      flex: 1, background: '#ffffff0a', border: '1px solid #ffffff15',
                      borderRadius: 5, color: '#cbd5e1', fontSize: 10, fontFamily: 'inherit',
                      padding: '4px 7px', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onMouseDown={e => { e.stopPropagation();
                      const conds = (node.data?.conditions || []).filter((_, j) => j !== i);
                      onUpdateNode(node.id, { data: { ...node.data, conditions: conds } });
                    }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '0 4px' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button
                onMouseDown={e => { e.stopPropagation();
                  const conds = [...(node.data?.conditions || []), { if: '', goto: '' }];
                  onUpdateNode(node.id, { data: { ...node.data, conditions: conds } });
                }}
                style={{
                  marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
                  color: '#22c55e', fontSize: 10, fontFamily: 'inherit', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <Plus size={10} /> Add condition
              </button>
            </div>
          )}
        </div>
      </div>

      {node.type !== 'branch' && (
        <div
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, 'output', 0); }}
          style={{
            position: 'absolute',
            right: -8, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: '#1e293b', border: `2px solid ${col.accent}`,
            cursor: 'crosshair', zIndex: 30,
            transition: 'transform 0.1s, background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = col.accent; e.currentTarget.style.transform = 'translateY(-50%) scale(1.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.transform = 'translateY(-50%) scale(1)'; }}
        />
      )}

      {node.type === 'branch' && (node.data?.conditions || []).map((c, i) => (
        <div
          key={i}
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, 'branch', i); }}
          style={{
            position: 'absolute',
            right: -8,
            top: `${110 + i * 32}px`,
            width: 14, height: 14, borderRadius: '50%',
            background: '#1e293b', border: '2px solid #22c55e',
            cursor: 'crosshair', zIndex: 30,
          }}
        />
      ))}
      {node.type === 'branch' && (
        <div
          onMouseDown={e => { e.stopPropagation(); onPortMouseDown(e, node.id, 'default', 0); }}
          style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            width: 14, height: 14, borderRadius: 3,
            background: '#1e293b', border: '2px solid #22c55e',
            cursor: 'crosshair', zIndex: 30,
          }}
        />
      )}

      {node.type !== 'start' && (
        <div
          onMouseUp={e => { e.stopPropagation(); onPortMouseUp(e, node.id); }}
          style={{
            position: 'absolute',
            left: -8, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: isTarget ? col.accent : '#1e293b',
            border: `2px solid ${isTarget ? col.accent : '#334155'}`,
            cursor: 'crosshair', zIndex: 30,
            transition: 'all 0.15s',
            boxShadow: isTarget ? `0 0 8px ${col.accent}` : 'none',
          }}
        />
      )}
    </div>
  );
};

const WorkflowCanvas = ({ workflowName = 'New Workflow', initialData, onSave, onClose }) => {
  const initialNodes = initialData?._canvas?.nodes || [
    { id: 'start', type: 'start', x: 120, y: 200, data: {} },
  ];
  const initialEdges = initialData?._canvas?.edges || [];

  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [selected, setSelected] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [saving, setSaving] = useState(false);

  const canvasRef = useRef(null);

  const toCanvas = useCallback((sx, sy) => ({
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  }), [pan, zoom]);

  const getNodeRect = (node) => ({
    x: node.x, y: node.y,
    w: NODE_WIDTH, h: 160,
    cx: node.x + NODE_WIDTH, cy: node.y + 80,
  });
  const handleDragStart = useCallback((e, nodeId) => {
    if (connectingFrom) return;
    const node = nodes.find(n => n.id === nodeId);
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left - pan.x) / zoom;
    const cy = (e.clientY - rect.top - pan.y) / zoom;
    setDragging({ nodeId, offsetX: cx - node.x, offsetY: cy - node.y });
  }, [nodes, pan, zoom, connectingFrom]);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2 || e.altKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      e.preventDefault();
    } else {
      setSelected(null);
      setShowAddMenu(false);
    }
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    setMousePos({ x: sx, y: sy });

    if (dragging) {
      const cx = (sx - pan.x) / zoom;
      const cy = (sy - pan.y) / zoom;
      setNodes(prev => prev.map(n =>
        n.id === dragging.nodeId
          ? { ...n, x: snapToGrid(cx - dragging.offsetX), y: snapToGrid(cy - dragging.offsetY) }
          : n
      ));
    }
    if (isPanning && panStart) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [dragging, isPanning, panStart, pan, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.3), 2.5));
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handlePortMouseDown = useCallback((e, nodeId, portType, portIndex) => {
    e.stopPropagation();
    setConnectingFrom({ nodeId, portType, portIndex });
  }, []);

  const handlePortMouseUp = useCallback((e, targetNodeId) => {
    if (!connectingFrom) return;
    if (connectingFrom.nodeId === targetNodeId) { setConnectingFrom(null); return; }
    setEdges(prev => {
      const existing = prev.find(ed =>
        ed.from === connectingFrom.nodeId &&
        ed.portType === connectingFrom.portType &&
        ed.portIndex === connectingFrom.portIndex
      );
      const newEdge = {
        id: generateId(),
        from: connectingFrom.nodeId,
        to: targetNodeId,
        portType: connectingFrom.portType,
        portIndex: connectingFrom.portIndex,
      };
      if (existing) return prev.map(ed => ed.id === existing.id ? newEdge : ed);
      return [...prev, newEdge];
    });
    setConnectingFrom(null);
  }, [connectingFrom]);

  const addNode = (type) => {
    const id = generateId();
    const center = toCanvas(
      canvasRef.current.clientWidth / 2,
      canvasRef.current.clientHeight / 2
    );
    setNodes(prev => [...prev, {
      id, type,
      x: snapToGrid(center.x - NODE_WIDTH / 2 + Math.random() * 60 - 30),
      y: snapToGrid(center.y - 80 + Math.random() * 60 - 30),
      data: type === 'branch' ? { conditions: [] } : {},
    }]);
    setSelected(id);
    setShowAddMenu(false);
  };

  const deleteNode = (id) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
  };

  const duplicateNode = (id) => {
    const node = nodes.find(n => n.id === id);
    if (!node) return;
    const newId = generateId();
    setNodes(prev => [...prev, { ...JSON.parse(JSON.stringify(node)), id: newId, x: node.x + 40, y: node.y + 40 }]);
    setSelected(newId);
  };

  const updateNode = (id, updates) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const getPortPos = (node, portType, portIndex) => {
    const h = node.type === 'branch'
      ? 80 + (node.data?.conditions?.length || 0) * 32 + 60
      : 160;
    if (portType === 'output') return { x: node.x + NODE_WIDTH + 8, y: node.y + h / 2 };
    if (portType === 'branch') return { x: node.x + NODE_WIDTH + 8, y: node.y + 110 + portIndex * 32 };
    if (portType === 'default') return { x: node.x + NODE_WIDTH / 2, y: node.y + h + 8 };
    return { x: node.x - 8, y: node.y + h / 2 };
  };

  const fitView = () => {
    if (nodes.length === 0) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 60, minY = Math.min(...ys) - 60;
    const maxX = Math.max(...xs) + NODE_WIDTH + 60, maxY = Math.max(...ys) + 200;
    const vw = canvasRef.current.clientWidth, vh = canvasRef.current.clientHeight;
    const z = Math.min(vw / (maxX - minX), vh / (maxY - minY), 1.5);
    setZoom(z);
    setPan({ x: -minX * z + (vw - (maxX - minX) * z) / 2, y: -minY * z + (vh - (maxY - minY) * z) / 2 });
  };

  const draftLine = connectingFrom ? (() => {
    const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
    if (!fromNode) return null;
    const fp = getPortPos(fromNode, connectingFrom.portType, connectingFrom.portIndex);
    const mx = (mousePos.x - pan.x) / zoom;
    const my = (mousePos.y - pan.y) / zoom;
    return cubicPath(fp.x, fp.y, mx, my);
  })() : null;

  const handleSave = async () => {
    setSaving(true);
    const steps = nodes
      .filter(n => n.type !== 'start')
      .map(n => {
        const outEdge = edges.find(e => e.from === n.id && e.portType === 'output');
        return {
          id: n.id,
          type: n.type,
          ...n.data,
          next: outEdge?.to,
        };
      });
    await onSave?.({ steps, _canvas: { nodes, edges } });
    setSaving(false);
  };

  const ADD_TYPES = ['prompt', 'collect', 'action', 'branch'];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#080d14', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'IBM Plex Mono', monospace",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');`}</style>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 16px', height: 52,
        background: '#0d1420', borderBottom: '1px solid #1e2d3d',
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 6, borderRadius: 6, lineHeight: 1 }}
        >
          <X size={16} />
        </button>
        <div style={{ width: 1, height: 24, background: '#1e2d3d' }} />
        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>{workflowName}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: 11 }}>
            {nodes.length} nodes · {edges.length} edges
          </span>
          <div style={{ width: 1, height: 24, background: '#1e2d3d' }} />
          <button
            onClick={fitView}
            style={{ background: '#0d1a2a', border: '1px solid #1e2d3d', cursor: 'pointer', color: '#64748b', padding: '6px 10px', borderRadius: 6, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Maximize2 size={12} /> Fit
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#10b981', border: 'none', cursor: 'pointer',
              color: '#fff', padding: '7px 16px', borderRadius: 7,
              fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
            Save
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <div style={{
          width: 52, background: '#0d1420', borderRight: '1px solid #1e2d3d',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '12px 0', gap: 6, flexShrink: 0,
        }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              title="Add Node"
              style={{
                width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                background: showAddMenu ? '#10b98120' : '#0d2035',
                border: `1px solid ${showAddMenu ? '#10b981' : '#1e2d3d'}`,
                color: showAddMenu ? '#10b981' : '#64748b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Plus size={16} />
            </button>
            {showAddMenu && (
              <div style={{
                position: 'absolute', left: 44, top: 0,
                background: '#0d1a2a', border: '1px solid #1e2d3d',
                borderRadius: 10, overflow: 'hidden', zIndex: 200,
                minWidth: 160, boxShadow: '0 8px 32px #000a',
              }}>
                {ADD_TYPES.map(type => {
                  const col = NODE_COLORS[type];
                  return (
                    <button
                      key={type}
                      onClick={() => addNode(type)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#cbd5e1', fontSize: 12, textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#ffffff08'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: 6,
                        background: col.accent + '20', color: col.accent,
                      }}>
                        {NODE_ICONS[type]}
                      </span>
                      {col.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{ height: 1, width: 28, background: '#1e2d3d', margin: '2px 0' }} />
          <button
            onClick={() => setZoom(z => Math.min(z * 1.2, 2.5))}
            title="Zoom in"
            style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: '#0d2035', border: '1px solid #1e2d3d', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))}
            title="Zoom out"
            style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: '#0d2035', border: '1px solid #1e2d3d', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            title="Reset view"
            style={{ width: 36, height: 36, borderRadius: 8, cursor: 'pointer', background: '#0d2035', border: '1px solid #1e2d3d', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div
          ref={canvasRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'default' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <pattern id="dotgrid" x={pan.x % (SNAP_GRID * zoom)} y={pan.y % (SNAP_GRID * zoom)} width={SNAP_GRID * zoom} height={SNAP_GRID * zoom} patternUnits="userSpaceOnUse">
                <circle cx={SNAP_GRID * zoom / 2} cy={SNAP_GRID * zoom / 2} r={0.8} fill="#1e2d3d" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />
          </svg>

          <div style={{
            position: 'absolute', inset: 0, transformOrigin: '0 0',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}>
            <svg style={{ position: 'absolute', inset: 0, width: '9999px', height: '9999px', overflow: 'visible', pointerEvents: 'none' }}>
              <defs>
                {Object.entries(NODE_COLORS).map(([type, col]) => (
                  <marker key={type} id={`arrow-${type}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L0,6 L8,3 z" fill={col.accent} />
                  </marker>
                ))}
                <marker id="arrow-default" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill="#475569" />
                </marker>
              </defs>

              {edges.map(edge => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                const fp = getPortPos(fromNode, edge.portType, edge.portIndex);
                const tp = getPortPos(toNode, 'input', 0);
                const col = NODE_COLORS[fromNode.type] || NODE_COLORS.prompt;
                return (
                  <g key={edge.id}>
                    <path
                      d={cubicPath(fp.x, fp.y, tp.x, tp.y)}
                      fill="none" stroke={col.accent + '40'} strokeWidth={6}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onClick={() => setEdges(prev => prev.filter(e => e.id !== edge.id))}
                    />
                    <path
                      d={cubicPath(fp.x, fp.y, tp.x, tp.y)}
                      fill="none" stroke={col.accent} strokeWidth={1.5}
                      strokeDasharray="0"
                      markerEnd={`url(#arrow-${fromNode.type})`}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}

              {draftLine && (
                <path d={draftLine} fill="none" stroke="#475569" strokeWidth={1.5} strokeDasharray="6 3" />
              )}
            </svg>

            {nodes.map(node => (
              <WorkflowNode
                key={node.id}
                node={node}
                selected={selected === node.id}
                onSelect={setSelected}
                onDragStart={handleDragStart}
                onPortMouseDown={handlePortMouseDown}
                onPortMouseUp={handlePortMouseUp}
                connectingFrom={connectingFrom}
                onDelete={deleteNode}
                onDuplicate={duplicateNode}
                onUpdateNode={updateNode}
              />
            ))}
          </div>

          <div style={{
            position: 'absolute', bottom: 16, right: 16,
            background: '#0d1a2a', border: '1px solid #1e2d3d',
            borderRadius: 6, padding: '4px 10px',
            color: '#475569', fontSize: 11,
          }}>
            {Math.round(zoom * 100)}%
          </div>

          {nodes.length <= 1 && (
            <div style={{
              position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
              color: '#334155', fontSize: 12, textAlign: 'center', pointerEvents: 'none',
            }}>
              Click <span style={{ color: '#10b981' }}>+</span> to add nodes · Drag ports to connect
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default WorkflowCanvas;
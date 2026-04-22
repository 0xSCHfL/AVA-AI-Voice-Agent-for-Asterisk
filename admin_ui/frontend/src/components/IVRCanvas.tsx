import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Undo2, Redo2, ChevronDown, Loader2,
  Plus, X, Save, Check, Globe, Phone, Clock,
  Calendar, Key, Trash2, Copy, MoreVertical, Edit,
  ChevronRight
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = 'hours' | 'date' | 'dtmf';

interface Branch {
  id: string;
  label: string;
  route?: string;
}

interface IVRNode {
  id: string;
  type: NodeType;
  timezone?: string;
  schedule?: string;
  dateTimezone?: string;
  branches: Branch[];
  inviteMessage?: string;
  inviteLanguage?: string;
  children: (string | null)[];
  next: string | null;
}

interface FlowState {
  nodes: Record<string, IVRNode>;
  rootHead: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NODE_META: Record<NodeType, { label: string; icon: React.ReactNode; desc: string; color: string }> = {
  hours: {
    label: 'Hours',
    icon: <Clock className="w-4 h-4" />,
    desc: 'Business hours and schedules',
    color: '#3b82f6',
  },
  date: {
    label: 'Date',
    icon: <Calendar className="w-4 h-4" />,
    desc: 'Normal dates / special dates',
    color: '#8b5cf6',
  },
  dtmf: {
    label: 'DTMF Menu',
    icon: <Key className="w-4 h-4" />,
    desc: 'Touch-tone menu selection',
    color: '#0d9488',
  },
};

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'French' },
  { code: 'nl', label: 'Dutch' },
  { code: 'lu', label: 'Luxembourgish' },
  { code: 'es', label: 'Spanish' },
  { code: 'de', label: 'German' },
  { code: 'pt', label: 'Portuguese' },
];

const TIMEZONES = [
  'Europe/Brussels',
  'Europe/Paris',
  'Europe/London',
  'America/New_York',
  'Asia/Tokyo',
];

const COL_WIDTH = 200;
const COL_GAP = 40;

// ── ID generation ─────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => `n${++_id}`;

function makeNode(type: NodeType): IVRNode {
  const base = { id: uid(), type, children: [], next: null };
  if (type === 'hours') {
    return { ...base, timezone: 'Europe/Brussels', schedule: 'Monday - Sunday 08:00 - 22:00' };
  }
  if (type === 'date') {
    return { ...base, dateTimezone: 'Europe/Brussels' };
  }
  return {
    ...base,
    branches: [{ id: uid(), label: 'Option 1' }],
    inviteMessage: '',
    inviteLanguage: 'en',
  };
}

function getBranchLabels(node: IVRNode): string[] {
  if (node.type === 'hours') {
    return [node.schedule || 'Business Hours', 'All other times'];
  }
  if (node.type === 'date') {
    return ['Normal date', 'No special date'];
  }
  return [
    ...(node.branches?.map(b => b.label) || []),
    'Missing or invalid input',
  ];
}

// ── Primitive connectors ───────────────────────────────────────────────────────

function VLine({ h = 20 }: { h?: number }) {
  return (
    <div
      className="w-0.5 flex-shrink-0"
      style={{ height: h, background: '#0d9488' }}
    />
  );
}

function StaticDot() {
  return (
    <div
      className="w-2.5 h-2.5 rounded-full border-2 border-teal-600 bg-white flex-shrink-0 z-10"
    />
  );
}

// ── InsertDot ────────────────────────────────────────────────────────────────

function InsertDot({ onAdd, isTop = false }: { onAdd: (t: NodeType) => void; isTop?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center" style={{ zIndex: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Insert node here"
        className="w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
        style={{
          background: open ? '#0d9488' : 'transparent',
          borderColor: '#0d9488',
          width: 18,
          height: 18,
        }}
      >
        <span
          style={{ color: open ? 'white' : '#0d9488', fontSize: 14, lineHeight: 1, marginTop: -2 }}
        >
          +
        </span>
      </button>

      {open && (
        <div
          className="absolute bg-card rounded-xl shadow-xl border border-border overflow-hidden"
          style={{
            minWidth: 220,
            top: isTop ? 'auto' : 'calc(100% + 6px)',
            bottom: isTop ? 'calc(100% + 6px)' : 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
        >
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Insert node
          </div>
          {(Object.keys(NODE_META) as NodeType[]).map(t => {
            const m = NODE_META[t];
            return (
              <button
                key={t}
                onClick={() => {
                  onAdd(t);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${m.color}20` }}
                >
                  <span style={{ color: m.color }}>{m.icon}</span>
                </span>
                <div>
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setOpen(false)}
            className="w-full text-center text-xs text-muted-foreground py-2 hover:text-foreground transition-colors border-t border-border"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── SVG branch fork ───────────────────────────────────────────────────────────

function BranchConnector({ count }: { count: number }) {
  const totalWidth = count * COL_WIDTH + (count - 1) * COL_GAP;
  const cx = totalWidth / 2;
  const stemH = 20;
  const barY = stemH;
  const branchH = 24;
  const svgH = stemH + branchH;
  const r = 8;
  const xs = Array.from(
    { length: count },
    (_, i) => i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2
  );

  const paths = xs.map(x => {
    if (Math.abs(x - cx) < 1) return `M ${cx} 0 L ${cx} ${svgH}`;
    const dir = x < cx ? -1 : 1;
    return (
      `M ${cx} 0 L ${cx} ${barY - r}` +
      ` Q ${cx} ${barY} ${cx + dir * r} ${barY}` +
      ` L ${x - dir * r} ${barY}` +
      ` Q ${x} ${barY} ${x} ${barY + r}` +
      ` L ${x} ${svgH}`
    );
  });

  return (
    <svg
      width={totalWidth}
      height={svgH}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="#0d9488"
          strokeWidth={2}
          strokeLinecap="round"
        />
      ))}
      {xs.map((x, i) => (
        <circle key={i} cx={x} cy={svgH} r={5} fill="white" stroke="#0d9488" strokeWidth={2} />
      ))}
    </svg>
  );
}

// ── Config panels ─────────────────────────────────────────────────────────────

function HoursPanel({
  node,
  onChange,
}: {
  node: IVRNode;
  onChange: (p: Partial<IVRNode>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Timezone
        </label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={node.timezone}
          onChange={e => onChange({ timezone: e.target.value })}
        >
          {TIMEZONES.map(tz => (
            <option key={tz}>{tz}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Business Hours
        </label>
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={node.schedule || ''}
          onChange={e => onChange({ schedule: e.target.value })}
          placeholder="e.g: Monday - Friday 09:00 - 18:00"
        />
      </div>
    </div>
  );
}

function DatePanel({
  node,
  onChange,
}: {
  node: IVRNode;
  onChange: (p: Partial<IVRNode>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Timezone
        </label>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={node.dateTimezone}
          onChange={e => onChange({ dateTimezone: e.target.value })}
        >
          {TIMEZONES.map(tz => (
            <option key={tz}>{tz}</option>
          ))}
        </select>
      </div>
      <div className="rounded-lg border border-dashed border-muted p-4">
        <div className="text-xs font-medium mb-1">Special Dates</div>
        <p className="text-xs text-muted-foreground mb-2">
          Configure holidays or closures.
        </p>
        <button className="text-xs text-teal-600 font-medium hover:underline">
          + Add special date
        </button>
      </div>
    </div>
  );
}

function DTMFPanel({
  node,
  onChange,
  allAgents,
}: {
  node: IVRNode;
  onChange: (p: Partial<IVRNode>) => void;
  allAgents?: string[];
}) {
  const addBranch = () => {
    const branches = [
      ...(node.branches || []),
      { id: uid(), label: `Option ${(node.branches?.length || 0) + 1}` },
    ];
    onChange({ branches });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold mb-2">Menu Options</div>
        <div className="space-y-2">
          {node.branches?.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">
                {i + 1}
              </span>
              <input
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={b.label}
                onChange={e =>
                  onChange({
                    branches: node.branches?.map(br =>
                      br.id === b.id ? { ...br, label: e.target.value } : br
                    ),
                  })
                }
              />
              {allAgents && (
                <select
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none"
                  value={b.route || ''}
                  onChange={e =>
                    onChange({
                      branches: node.branches?.map(br =>
                        br.id === b.id ? { ...br, route: e.target.value } : br
                      ),
                    })
                  }
                >
                  <option value="">Select agent...</option>
                  {allAgents.map(a => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() =>
                  onChange({
                    branches: node.branches?.filter(br => br.id !== b.id),
                  })
                }
                className="text-muted-foreground hover:text-destructive text-lg"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addBranch}
          className="mt-3 w-full border-2 border-dashed border-teal-200 rounded-lg py-2 text-sm text-teal-600 font-medium hover:border-teal-400 hover:text-teal-700 transition-colors"
        >
          + Add option
        </button>
      </div>
      <div className="border-t border-border pt-4">
        <div className="text-sm font-semibold mb-3">Welcome Message</div>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          rows={3}
          value={node.inviteMessage || ''}
          onChange={e => onChange({ inviteMessage: e.target.value })}
          placeholder="e.g: Press 1 for services, 2 for offers..."
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Language
            </label>
            <select
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={node.inviteLanguage}
              onChange={e => onChange({ inviteLanguage: e.target.value })}
            >
              {LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              Voice
            </label>
            <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
              <option>Default</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({
  node,
  onClose,
  onChange,
  onDelete,
  allAgents,
}: {
  node: IVRNode;
  onClose: () => void;
  onChange: (p: Partial<IVRNode>) => void;
  onDelete: () => void;
  allAgents?: string[];
}) {
  const m = NODE_META[node.type];
  return (
    <div className="w-80 border-l border-border bg-card h-full flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `${m.color}20` }}
          >
            <span style={{ color: m.color }}>{m.icon}</span>
          </span>
          <span className="font-semibold">{m.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="text-xs text-destructive hover:text-destructive/80 font-medium"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
          Settings
        </div>
        {node.type === 'hours' && <HoursPanel node={node} onChange={onChange} />}
        {node.type === 'date' && <DatePanel node={node} onChange={onChange} />}
        {node.type === 'dtmf' && (
          <DTMFPanel node={node} onChange={onChange} allAgents={allAgents} />
        )}
      </div>
    </div>
  );
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  isSelected,
  onClick,
  onDelete,
}: {
  node: IVRNode;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const m = NODE_META[node.type];
  const subtitle =
    node.type === 'hours'
      ? node.timezone
      : node.type === 'date'
      ? node.dateTimezone
      : `${node.branches?.length || 0} option(s)`;
  const active = isSelected || menuOpen;

  return (
    <div
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all shadow-sm cursor-pointer ${
        active ? 'border-teal-500 bg-teal-900' : 'border-border bg-card hover:border-teal-400 hover:shadow-md'
      }`}
      style={{ width: COL_WIDTH }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: active ? 'rgba(255,255,255,0.15)' : `${m.color}20` }}
      >
        <span style={{ color: active ? 'white' : m.color }}>{m.icon}</span>
      </span>
      <button onClick={onClick} className="flex-1 text-left min-w-0">
        <div className={`text-xs font-semibold truncate ${active ? 'text-white' : ''}`}>
          {m.label}
        </div>
        <div className={`text-[10px] truncate ${active ? 'text-teal-200' : 'text-muted-foreground'}`}>
          {subtitle}
        </div>
      </button>
      <div className="relative flex-shrink-0">
        <button
          onClick={e => {
            e.stopPropagation();
            setMenuOpen(o => !o);
          }}
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            active
              ? 'text-teal-200 hover:bg-teal-800 hover:text-white'
              : 'text-muted-foreground hover:bg-accent'
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2" r="1.3" />
            <circle cx="7" cy="7" r="1.3" />
            <circle cx="7" cy="12" r="1.3" />
          </svg>
        </button>
        {menuOpen && (
          <div
            className="absolute z-50 right-0 top-8 bg-card rounded-xl shadow-xl border border-border overflow-hidden"
            style={{ minWidth: 160 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
              onClick={() => setMenuOpen(false)}
            >
              <Copy className="w-4 h-4" /> Copy node
            </button>
            <div className="border-t border-border" />
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="w-4 h-4" /> Delete node
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Chain column ──────────────────────────────────────────────────────────────

function ChainColumn({
  headId,
  nodes,
  selectedId,
  onSelect,
  onInsertAfter,
  onInsertAtHead,
  onDeleteNode,
  onInsertBranchChild,
  allAgents,
}: {
  headId: string | null;
  nodes: Record<string, IVRNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInsertAfter: (afterId: string, type: NodeType) => void;
  onInsertAtHead: (type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  onInsertBranchChild: (parentId: string, branchIdx: number, type: NodeType) => void;
  allAgents?: string[];
}) {
  const chain: string[] = [];
  let cur = headId;
  while (cur && nodes[cur]) {
    chain.push(cur);
    cur = nodes[cur].next;
  }

  return (
    <div className="flex flex-col items-center">
      <InsertDot onAdd={onInsertAtHead} />

      {chain.map((nid, chainIdx) => {
        const node = nodes[nid];
        const branchLabels = getBranchLabels(node);
        const hasBranches = branchLabels.length > 0;

        return (
          <div key={nid} className="flex flex-col items-center w-full">
            <VLine h={14} />

            <NodeCard
              node={node}
              isSelected={selectedId === nid}
              onClick={() => onSelect(nid)}
              onDelete={() => onDeleteNode(nid)}
            />

            {hasBranches ? (
              <>
                <VLine h={12} />
                <StaticDot />
                <BranchConnector count={branchLabels.length} />
                <div className="flex items-start" style={{ gap: COL_GAP }}>
                  {branchLabels.map((label, idx) => {
                    const childHead = node.children[idx] ?? null;
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center"
                        style={{ width: COL_WIDTH }}
                      >
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white text-center"
                          style={{
                            background: '#1e293b',
                            whiteSpace: 'nowrap',
                            maxWidth: COL_WIDTH - 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {label}
                        </span>
                        <VLine h={12} />
                        <ChainColumn
                          headId={childHead}
                          nodes={nodes}
                          selectedId={selectedId}
                          onSelect={onSelect}
                          onInsertAtHead={t => onInsertBranchChild(nid, idx, t)}
                          onInsertAfter={onInsertAfter}
                          onDeleteNode={onDeleteNode}
                          onInsertBranchChild={onInsertBranchChild}
                          allAgents={allAgents}
                        />
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <InsertDot onAdd={t => onInsertAfter(nid, t)} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main IVRCanvas component ─────────────────────────────────────────────────

interface IVRCanvasProps {
  name: string;
  initialData?: any;
  allAgents?: string[];
  onSave?: (data: any) => void;
  onBack?: () => void;
}

export default function IVRCanvas({
  name,
  initialData,
  allAgents = [],
  onSave,
  onBack,
}: IVRCanvasProps) {
  const [flow, setFlow] = useState<FlowState>(
    initialData?.flow || { nodes: {}, rootHead: null }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>(
    initialData?.status || 'draft'
  );
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Handle wheel zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(z => Math.min(Math.max(0.25, z + delta), 2));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && e.target === canvasRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Update flow when initialData changes
  useEffect(() => {
    if (initialData?.flow) {
      setFlow(initialData.flow);
    }
  }, [initialData]);

  const insertAtRootHead = useCallback((type: NodeType) => {
    const node = makeNode(type);
    setFlow(f => ({
      nodes: { ...f.nodes, [node.id]: { ...node, next: f.rootHead } },
      rootHead: node.id,
    }));
  }, []);

  const insertAfter = useCallback((afterId: string, type: NodeType) => {
    const node = makeNode(type);
    setFlow(f => {
      const after = f.nodes[afterId];
      return {
        nodes: {
          ...f.nodes,
          [node.id]: { ...node, next: after.next },
          [afterId]: { ...after, next: node.id },
        },
        rootHead: f.rootHead,
      };
    });
  }, []);

  const insertBranchChild = useCallback(
    (parentId: string, branchIdx: number, type: NodeType) => {
      const node = makeNode(type);
      setFlow(f => {
        const parent = f.nodes[parentId];
        const newChildren = [...parent.children];
        const prevHead = newChildren[branchIdx] ?? null;
        newChildren[branchIdx] = node.id;
        return {
          nodes: {
            ...f.nodes,
            [node.id]: { ...node, next: prevHead },
            [parentId]: { ...parent, children: newChildren },
          },
          rootHead: f.rootHead,
        };
      });
    },
    []
  );

  const updateNode = useCallback((id: string, patch: Partial<IVRNode>) => {
    setFlow(f => ({
      ...f,
      nodes: { ...f.nodes, [id]: { ...f.nodes[id], ...patch } },
    }));
  }, []);

  const deleteNode = useCallback((id: string) => {
    setFlow(f => {
      const target = f.nodes[id];
      const updatedNodes: Record<string, IVRNode> = {};

      for (const [k, n] of Object.entries(f.nodes)) {
        if (k === id) continue;
        updatedNodes[k] = {
          ...n,
          next: n.next === id ? target.next : n.next,
          children: n.children.map(c => (c === id ? target.next : c)),
        };
      }

      return {
        nodes: updatedNodes,
        rootHead: f.rootHead === id ? target.next : f.rootHead,
      };
    });
    setSelectedId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ flow, status });
      toast.success('IVR flow saved');
    } catch {
      toast.error('Failed to save IVR flow');
    } finally {
      setSaving(false);
    }
  }, [flow, status, onSave]);

  const selectedNode = selectedId ? flow.nodes[selectedId] : null;

  return (
    <div className="fixed inset-0 bg-background z-[1000] flex flex-col font-sans dark:bg-slate-950">
      {/* Top navbar */}
      <header className="flex items-center justify-between px-5 py-3 bg-card border-b border-border shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Back to IVRs</span>
          </button>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <span className="text-sm font-semibold tracking-tight">
          {name} - IVR Editor
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'published'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => setStatus(s => (s === 'draft' ? 'published' : 'draft'))}
          >
            {status === 'published' ? (
              <Check className="w-4 h-4" />
            ) : null}
            {status === 'published' ? 'Published' : 'Draft'}
          </button>
        </div>
      </header>

      {/* Canvas + side panel row */}
      <div className="flex flex-1 overflow-hidden">
        <div 
          ref={canvasRef}
          className="flex-1 overflow-hidden flex flex-col items-center pt-12 pb-32 px-8 min-w-0 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div 
            className="flex flex-col items-center transition-transform origin-top"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            {/* Incoming call */}
            <div
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
              style={{ background: '#1e293b' }}
            >
              <Phone className="w-4 h-4" />
              Incoming Call
            </div>

            <VLine h={16} />

            {/* Root chain */}
            <ChainColumn
              headId={flow.rootHead}
              nodes={flow.nodes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onInsertAtHead={insertAtRootHead}
              onInsertAfter={insertAfter}
              onDeleteNode={deleteNode}
              onInsertBranchChild={insertBranchChild}
              allAgents={allAgents}
            />

            <VLine h={16} />
            <StaticDot />
            <VLine h={12} />

            {/* End call */}
            <div
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow"
              style={{ background: '#1e293b' }}
            >
              <ArrowLeft className="w-4 h-4" />
              End Call
            </div>
          </div>

          {/* Zoom controls */}
          <div className="fixed bottom-6 left-6 flex items-center gap-2 bg-card border border-border rounded-lg shadow px-3 py-1.5 z-10">
            <button 
              className="text-muted-foreground hover:text-foreground text-lg" 
              onClick={() => setZoom(z => Math.min(Math.max(0.25, z - 0.1), 2))}
            >−</button>
            <span className="text-xs text-muted-foreground font-medium w-9 text-center">{Math.round(zoom * 100)}%</span>
            <button 
              className="text-muted-foreground hover:text-foreground text-lg"
              onClick={() => setZoom(z => Math.min(Math.max(0.25, z + 0.1), 2))}
            >+</button>
            <span className="text-border mx-1">|</span>
            <button 
              className="text-muted-foreground hover:text-foreground text-sm"
              onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
            >⛶</button>
          </div>
        </div>

        {/* Side config panel */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onClose={() => setSelectedId(null)}
            onChange={patch => updateNode(selectedNode.id, patch)}
            onDelete={() => deleteNode(selectedNode.id)}
            allAgents={allAgents}
          />
        )}
      </div>
    </div>
  );
}

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ArrowLeft, Undo2, Redo2, Loader2,
  X, Save, Check, Phone, Clock,
  Calendar, Key, Trash2, Copy, MoreVertical
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = 'hours' | 'date' | 'dtmf' | 'action';

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

const NODE_META: Record<NodeType, { label: string; icon: React.ReactNode; desc: string; color: string; borderColor: string }> = {
  hours: {
    label: 'Hours',
    icon: <Clock className="w-4 h-4" />,
    desc: 'Business hours and schedules',
    color: '#f59e0b',
    borderColor: '#f59e0b',
  },
  date: {
    label: 'Date',
    icon: <Calendar className="w-4 h-4" />,
    desc: 'Normal dates / special dates',
    color: '#8b5cf6',
    borderColor: '#8b5cf6',
  },
  dtmf: {
    label: 'DTMF Menu',
    icon: <Key className="w-4 h-4" />,
    desc: 'Touch-tone menu selection',
    color: '#0d9488',
    borderColor: '#0d9488',
  },
  action: {
    label: 'Action',
    icon: <Phone className="w-4 h-4" />,
    desc: 'End call action',
    color: '#0d9488',
    borderColor: '#0d9488',
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

const NODE_W = 280;
const NODE_H = 64;
const LABEL_W = 120;

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

function ConnectorDot({ color = '#0d9488' }: { color?: string }) {
  return (
    <div
      className="w-3 h-3 rounded-full border-2 border-black bg-white flex-shrink-0"
      style={{ zIndex: 5 }}
    />
  );
}

function VLine({ h = 24, color = '#0d9488' }: { h?: number; color?: string }) {
  return (
    <div
      className="w-0.5 flex-shrink-0"
      style={{ height: h, background: color }}
    />
  );
}

// ── Node styles ───────────────────────────────────────────────────────────────

// Primary Action Node — dark navy rounded capsule
function PrimaryNode({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 rounded-full shadow-md"
      style={{ background: '#1e293b', minWidth: NODE_W }}
    >
      <span className="text-white">{icon}</span>
      <span className="text-white text-sm font-semibold">{label}</span>
    </div>
  );
}

// Logic/Decision Node — white rounded rectangle with colored border
function LogicNode({
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

  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
      style={{
        width: NODE_W,
        background: '#ffffff',
        border: `2px solid ${m.borderColor}`,
        boxShadow: isSelected ? `0 0 0 3px ${m.borderColor}40` : '0 1px 3px rgba(0,0,0,0.1)',
      }}
      onClick={onClick}
    >
      {/* Left icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${m.color}18` }}
      >
        <span style={{ color: m.color }}>{m.icon}</span>
      </div>

      {/* Center content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900 truncate">{m.label}</div>
        <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>
      </div>

      {/* Three-dot menu */}
      <button
        onClick={e => {
          e.stopPropagation();
          setMenuOpen(o => !o);
        }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.3" />
          <circle cx="7" cy="7" r="1.3" />
          <circle cx="7" cy="12" r="1.3" />
        </svg>
      </button>

      {menuOpen && (
        <div
          className="absolute z-50 right-0 top-12 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden"
          style={{ minWidth: 160 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50 transition-colors text-left"
            onClick={() => setMenuOpen(false)}
          >
            <Copy className="w-4 h-4 text-gray-500" /> Copy node
          </button>
          <div className="border-t border-gray-100" />
          <button
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
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
  );
}

// Action Card — solid teal-green wide rectangle
function ActionCard({ label }: { label: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className="relative flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all hover:brightness-105"
      style={{ width: NODE_W, background: '#0d9488' }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20">
        <Phone className="w-5 h-5 text-white" />
      </div>
      <span className="text-white text-sm font-semibold flex-1">{label}</span>
      <button
        onClick={e => {
          e.stopPropagation();
          setMenuOpen(o => !o);
        }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-white/70 hover:bg-white/10 transition-colors flex-shrink-0"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="7" cy="2" r="1.3" />
          <circle cx="7" cy="7" r="1.3" />
          <circle cx="7" cy="12" r="1.3" />
        </svg>
      </button>
    </div>
  );
}

// Condition Label — dark navy small rounded capsule on branch lines
function ConditionLabel({ label }: { label: string }) {
  return (
    <div
      className="px-3 py-1 rounded-full text-white text-xs font-semibold shadow-md whitespace-nowrap"
      style={{ background: '#1e293b' }}
    >
      {label}
    </div>
  );
}

// ── Config panels ─────────────────────────────────────────────────────────────

function HoursPanel({ node, onChange }: { node: IVRNode; onChange: (p: Partial<IVRNode>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Timezone</label>
        <select
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={node.timezone}
          onChange={e => onChange({ timezone: e.target.value })}
        >
          {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Business Hours</label>
        <input
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          value={node.schedule || ''}
          onChange={e => onChange({ schedule: e.target.value })}
          placeholder="e.g: Monday - Friday 09:00 - 18:00"
        />
      </div>
    </div>
  );
}

function DatePanel({ node, onChange }: { node: IVRNode; onChange: (p: Partial<IVRNode>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Timezone</label>
        <select
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
          value={node.dateTimezone}
          onChange={e => onChange({ dateTimezone: e.target.value })}
        >
          {TIMEZONES.map(tz => <option key={tz}>{tz}</option>)}
        </select>
      </div>
      <div className="rounded-xl border-2 border-dashed border-gray-200 p-4">
        <div className="text-xs font-semibold text-gray-700 mb-1">Special Dates</div>
        <p className="text-xs text-gray-400 mb-2">Configure holidays or closures.</p>
        <button className="text-xs text-teal-600 font-medium hover:underline">+ Add special date</button>
      </div>
    </div>
  );
}

function DTMFPanel({ node, onChange, allAgents }: { node: IVRNode; onChange: (p: Partial<IVRNode>) => void; allAgents?: string[] }) {
  const addBranch = () => {
    const branches = [...(node.branches || []), { id: uid(), label: `Option ${(node.branches?.length || 0) + 1}` }];
    onChange({ branches });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-gray-900 mb-2">Menu Options</div>
        <div className="space-y-2">
          {node.branches?.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <input
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={b.label}
                onChange={e => onChange({ branches: node.branches?.map(br => br.id === b.id ? { ...br, label: e.target.value } : br) })}
              />
              <button
                onClick={() => onChange({ branches: node.branches?.filter(br => br.id !== b.id) })}
                className="text-gray-400 hover:text-red-500 text-lg leading-none"
              >×</button>
            </div>
          ))}
        </div>
        <button
          onClick={addBranch}
          className="mt-3 w-full border-2 border-dashed border-teal-200 rounded-xl py-2 text-sm text-teal-600 font-medium hover:border-teal-400 transition-colors"
        >
          + Add option
        </button>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Welcome Message</div>
        <textarea
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          rows={3}
          value={node.inviteMessage || ''}
          onChange={e => onChange({ inviteMessage: e.target.value })}
          placeholder="e.g: Press 1 for services, 2 for offers..."
        />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Language</label>
            <select
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
              value={node.inviteLanguage}
              onChange={e => onChange({ inviteLanguage: e.target.value })}
            >
              {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Voice</label>
            <select className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400">
              <option>Default</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigPanel({ node, onClose, onChange, onDelete, allAgents }: {
  node: IVRNode; onClose: () => void; onChange: (p: Partial<IVRNode>) => void; onDelete: () => void; allAgents?: string[];
}) {
  const m = NODE_META[node.type];
  return (
    <div className="w-80 border-l border-gray-200 bg-white h-full flex flex-col shadow-xl">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}18` }}>
            <span style={{ color: m.color }}>{m.icon}</span>
          </div>
          <span className="font-semibold text-gray-900">{m.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onDelete} className="text-xs text-red-600 hover:text-red-700 font-medium">Delete</button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Settings</div>
        {node.type === 'hours' && <HoursPanel node={node} onChange={onChange} />}
        {node.type === 'date' && <DatePanel node={node} onChange={onChange} />}
        {node.type === 'dtmf' && <DTMFPanel node={node} onChange={onChange} allAgents={allAgents} />}
      </div>
    </div>
  );
}

// ── InsertDot ────────────────────────────────────────────────────────────────

function InsertDot({ onAdd }: { onAdd: (t: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center" style={{ zIndex: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Insert node here"
        className="w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer"
        style={{
          background: open ? '#0d9488' : 'transparent',
          borderColor: '#0d9488',
        }}
      >
        <span style={{ color: open ? 'white' : '#0d9488', fontSize: 16, lineHeight: 1 }}>+</span>
      </button>
      {open && (
        <div
          className="absolute bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden"
          style={{ minWidth: 220, top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}
        >
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Insert node</div>
          {(Object.keys(NODE_META) as NodeType[]).filter(t => t !== 'action').map(t => {
            const m = NODE_META[t];
            return (
              <button
                key={t}
                onClick={() => { onAdd(t); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${m.color}18` }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
              </button>
            );
          })}
          <button onClick={() => setOpen(false)} className="w-full text-center text-xs text-gray-400 py-2.5 hover:bg-gray-50 transition-colors border-t border-gray-100">Cancel</button>
        </div>
      )}
    </div>
  );
}

// ── Split-and-Merge Branch Section ─────────────────────────────────────────────

function BranchSection({
  branchLabels,
  nodeId,
  nodeChildren,
  nodes,
  selectedId,
  onSelect,
  onInsertBranchChild,
  onInsertAfter,
  onDeleteNode,
  allAgents,
}: {
  branchLabels: string[];
  nodeId: string;
  nodeChildren: (string | null)[];
  nodes: Record<string, IVRNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInsertBranchChild: (parentId: string, branchIdx: number, type: NodeType) => void;
  onInsertAfter: (afterId: string, type: NodeType) => void;
  onDeleteNode: (id: string) => void;
  allAgents?: string[];
}) {
  const count = branchLabels.length;
  // Two-column parallel layout
  const gap = 48;
  const colW = NODE_W;
  const totalW = count * colW + (count - 1) * gap;
  const cx = totalW / 2;

  // Branch section: split into parallel columns, then merge
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* SVG: split lines from center going to each column */}
      <svg width={totalW} height={20} style={{ display: 'block', flexShrink: 0 }}>
        {branchLabels.map((_, i) => {
          const x = i * (colW + gap) + colW / 2;
          if (Math.abs(x - cx) < 1) return null;
          return (
            <path
              key={i}
              d={`M ${cx} 0 L ${cx} 8 Q ${cx} 14 ${x} 14 L ${x} 20`}
              fill="none"
              stroke="#0d9488"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      {/* Condition labels row */}
      <div style={{ display: 'flex', gap, width: totalW, justifyContent: 'center' }}>
        {branchLabels.map((label, i) => (
          <div key={i} style={{ width: colW, display: 'flex', justifyContent: 'center' }}>
            <ConditionLabel label={label} />
          </div>
        ))}
      </div>

      {/* Parallel vertical lines */}
      <div style={{ display: 'flex', gap, alignItems: 'flex-start' }}>
        {branchLabels.map((_, idx) => {
          const childHead = nodeChildren[idx] ?? null;
          return (
            <div key={idx} style={{ width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <VLine h={16} />
              {/* Branch chain */}
              <ChainColumn
                headId={childHead}
                nodes={nodes}
                selectedId={selectedId}
                onSelect={onSelect}
                onInsertAtHead={t => onInsertBranchChild(nodeId, idx, t)}
                onInsertAfter={onInsertAfter}
                onDeleteNode={onDeleteNode}
                onInsertBranchChild={onInsertBranchChild}
                allAgents={allAgents}
              />
              {/* End of branch path — connector leads to merge */}
              <VLine h={16} />
            </div>
          );
        })}
      </div>

      {/* Merge SVG — lines converge from each column back to center */}
      <svg width={totalW} height={20} style={{ display: 'block', flexShrink: 0 }}>
        {branchLabels.map((_, i) => {
          const x = i * (colW + gap) + colW / 2;
          if (Math.abs(x - cx) < 1) return null;
          return (
            <path
              key={i}
              d={`M ${x} 0 L ${x} 6 Q ${x} 12 ${cx} 12 L ${cx} 20`}
              fill="none"
              stroke="#0d9488"
              strokeWidth={2}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <ConnectorDot />
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

      {chain.map(nid => {
        const node = nodes[nid];
        const branchLabels = getBranchLabels(node);
        const hasBranches = branchLabels.length > 0;

        return (
          <div key={nid} className="flex flex-col items-center">
            <VLine h={14} />
            <ConnectorDot />

            <LogicNode
              node={node}
              isSelected={selectedId === nid}
              onClick={() => onSelect(nid)}
              onDelete={() => onDeleteNode(nid)}
            />

            <VLine h={10} />
            <ConnectorDot />

            {hasBranches ? (
              <BranchSection
                branchLabels={branchLabels}
                nodeId={nid}
                nodeChildren={node.children}
                nodes={nodes}
                selectedId={selectedId}
                onSelect={onSelect}
                onInsertBranchChild={onInsertBranchChild}
                onInsertAfter={onInsertAfter}
                onDeleteNode={onDeleteNode}
                allAgents={allAgents}
              />
            ) : (
              <>
                <InsertDot onAdd={t => onInsertAfter(nid, t)} />
                {node.next && (
                  <>
                    <VLine h={14} />
                    <ConnectorDot />
                    <LogicNode
                      node={nodes[node.next]}
                      isSelected={selectedId === node.next}
                      onClick={() => onSelect(node.next)}
                      onDelete={() => onDeleteNode(node.next)}
                    />
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main IVRCanvas ─────────────────────────────────────────────────────────────

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
  const [flow, setFlow] = useState<FlowState>(initialData?.flow || { nodes: {}, rootHead: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'draft' | 'published'>(initialData?.status || 'draft');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const canvasRef = React.useRef<HTMLDivElement>(null);

  // Wheel zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(z => Math.min(Math.max(0.25, z + delta), 2));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  useEffect(() => {
    if (initialData?.flow) setFlow(initialData.flow);
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
        nodes: { ...f.nodes, [node.id]: { ...node, next: after.next }, [afterId]: { ...after, next: node.id } },
        rootHead: f.rootHead,
      };
    });
  }, []);

  const insertBranchChild = useCallback((parentId: string, branchIdx: number, type: NodeType) => {
    const node = makeNode(type);
    setFlow(f => {
      const parent = f.nodes[parentId];
      const newChildren = [...parent.children];
      newChildren[branchIdx] = node.id;
      return {
        nodes: { ...f.nodes, [node.id]: { ...node, next: null }, [parentId]: { ...parent, children: newChildren } },
        rootHead: f.rootHead,
      };
    });
  }, []);

  const updateNode = useCallback((id: string, patch: Partial<IVRNode>) => {
    setFlow(f => ({ ...f, nodes: { ...f.nodes, [id]: { ...f.nodes[id], ...patch } } }));
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
      return { nodes: updatedNodes, rootHead: f.rootHead === id ? target.next : f.rootHead };
    });
    setSelectedId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ flow, status });
    } finally {
      setSaving(false);
    }
  }, [flow, status, onSave]);

  const selectedNode = selectedId ? flow.nodes[selectedId] : null;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col font-sans bg-gray-100">
      {/* Top navbar */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <X className="w-4 h-4" />
            <span>Back to IVRs</span>
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors" title="Undo">
              <Undo2 className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors" title="Redo">
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <span className="text-sm font-semibold text-gray-900 tracking-tight">{name} — IVR Editor</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            onClick={() => setStatus(s => (s === 'draft' ? 'published' : 'draft'))}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === 'published' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {status === 'published' ? <Check className="w-4 h-4" /> : null}
            {status === 'published' ? 'Published' : 'Draft'}
          </button>
        </div>
      </header>

      {/* Canvas + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="absolute inset-0 overflow-auto flex items-start justify-center pt-12 pb-32 px-8">
            <div
              className="flex flex-col items-center transition-transform origin-top"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              {/* Incoming call — primary action node */}
              <PrimaryNode label="Appel entrant" icon={<Phone className="w-4 h-4" />} />

              <VLine h={20} />

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

              <VLine h={20} />
              <ConnectorDot />
              <VLine h={14} />

              {/* Root-level end */}
              <ActionCard label="Terminer l'appel" />
            </div>
          </div>

          {/* Zoom controls */}
          <div className="fixed bottom-6 left-6 flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-1.5 z-[1001]">
            <button className="text-gray-500 hover:text-gray-900 text-lg w-6 flex items-center justify-center" onClick={() => setZoom(z => Math.min(Math.max(0.25, z - 0.1), 2))}>−</button>
            <span className="text-xs text-gray-500 font-medium w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button className="text-gray-500 hover:text-gray-900 text-lg w-6 flex items-center justify-center" onClick={() => setZoom(z => Math.min(Math.max(0.25, z + 0.1), 2))}>+</button>
            <span className="text-gray-300 mx-0.5">|</span>
            <button className="text-gray-500 hover:text-gray-900 text-sm w-6 flex items-center justify-center" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}>⛶</button>
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
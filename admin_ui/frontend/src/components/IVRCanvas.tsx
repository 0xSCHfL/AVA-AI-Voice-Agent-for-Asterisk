import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, Undo2, Redo2, ChevronDown, Loader2,
  Plus, X, Save, Check, Globe, Phone, Clock,
  Calendar, Key, Trash2, Copy, MoreVertical, Edit,
<<<<<<< HEAD
  ChevronRight
=======
  ChevronRight, Play, Pause, Upload, Mic, FileAudio
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
=======
  retryCount?: number;
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
  children: (string | null)[];
  next: string | null;
}

interface FlowState {
  nodes: Record<string, IVRNode>;
  rootHead: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

<<<<<<< HEAD
=======
const TEAL = "#0d9488";
const DARK = "#1e293b";

>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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

<<<<<<< HEAD
=======
const VOICES = [
  'Default',
  'Cassidy (American)',
  'Léa (French)',
  'Conchita (Spanish)',
];

>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
    return { ...base, timezone: 'Europe/Brussels', schedule: 'Monday - Sunday 08:00 - 22:00' };
  }
  if (type === 'date') {
    return { ...base, dateTimezone: 'Europe/Brussels' };
=======
    return { ...base, timezone: 'Europe/Brussels', schedule: 'Monday - Sunday 08:00 - 22:00', retryCount: 3 };
  }
  if (type === 'date') {
    return { ...base, dateTimezone: 'Europe/Brussels', retryCount: 3 };
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
  }
  return {
    ...base,
    branches: [{ id: uid(), label: 'Option 1' }],
    inviteMessage: '',
    inviteLanguage: 'en',
<<<<<<< HEAD
=======
    retryCount: 3,
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
      style={{ height: h, background: '#0d9488' }}
=======
      style={{ height: h, background: TEAL }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
    />
  );
}

function StaticDot() {
  return (
    <div
<<<<<<< HEAD
      className="w-2.5 h-2.5 rounded-full border-2 border-teal-600 bg-white flex-shrink-0 z-10"
=======
      className="w-2.5 h-2.5 rounded-full border-2 border-white bg-teal-600 flex-shrink-0 z-10"
      style={{ boxShadow: '0 0 0 2px #0d9488' }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
          background: open ? '#0d9488' : 'transparent',
          borderColor: '#0d9488',
          width: 18,
          height: 18,
        }}
      >
        <span
          style={{ color: open ? 'white' : '#0d9488', fontSize: 14, lineHeight: 1, marginTop: -2 }}
=======
          background: open ? TEAL : 'white',
          borderColor: TEAL,
          width: 18,
          height: 18,
          boxShadow: open ? '0 2px 8px rgba(13, 148, 136, 0.4)' : '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <span
          style={{ color: open ? 'white' : TEAL, fontSize: 14, lineHeight: 1, marginTop: -2 }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
        >
          +
        </span>
      </button>

      {open && (
        <div
<<<<<<< HEAD
          className="absolute bg-card rounded-xl shadow-xl border border-border overflow-hidden"
=======
          className="absolute bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
          style={{
            minWidth: 220,
            top: isTop ? 'auto' : 'calc(100% + 6px)',
            bottom: isTop ? 'calc(100% + 6px)' : 'auto',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
          }}
        >
<<<<<<< HEAD
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
=======
          <div className="px-4 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${m.color}20` }}
=======
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-teal-50 transition-colors text-left"
              >
                <span
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: `${m.color}15` }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
                >
                  <span style={{ color: m.color }}>{m.icon}</span>
                </span>
                <div>
<<<<<<< HEAD
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
=======
                  <div className="text-sm font-medium text-slate-800">{m.label}</div>
                  <div className="text-xs text-slate-400">{m.desc}</div>
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
                </div>
              </button>
            );
          })}
          <button
            onClick={() => setOpen(false)}
<<<<<<< HEAD
            className="w-full text-center text-xs text-muted-foreground py-2 hover:text-foreground transition-colors border-t border-border"
=======
            className="w-full text-center text-xs text-slate-400 py-2 hover:text-slate-600 transition-colors border-t border-slate-100"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── SVG branch fork ───────────────────────────────────────────────────────────

<<<<<<< HEAD
function BranchConnector({ count }: { count: number }) {
  const totalWidth = count * COL_WIDTH + (count - 1) * COL_GAP;
  const cx = totalWidth / 2;
  const stemH = 20;
  const barY = stemH;
  const branchH = 24;
  const svgH = stemH + branchH;
  const r = 8;
=======
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
  const totalW = count * COL_WIDTH + (count - 1) * COL_GAP;
  const stemH = 16;
  const barH = 20;
  const r = 10;
  const svgH = stemH + barH;
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
  const xs = Array.from(
    { length: count },
    (_, i) => i * (COL_WIDTH + COL_GAP) + COL_WIDTH / 2
  );
<<<<<<< HEAD

  const paths = xs.map(x => {
    if (Math.abs(x - cx) < 1) return `M ${cx} 0 L ${cx} ${svgH}`;
    const dir = x < cx ? -1 : 1;
    return (
      `M ${cx} 0 L ${cx} ${barY - r}` +
      ` Q ${cx} ${barY} ${cx + dir * r} ${barY}` +
      ` L ${x - dir * r} ${barY}` +
      ` Q ${x} ${barY} ${x} ${barY + r}` +
=======
  const cx = totalW / 2;

  const paths = xs.map(x => {
    if (Math.abs(x - cx) < 1) return `M ${cx} 0 L ${cx} ${svgH}`;
    const goLeft = x < cx;
    const dxSign = goLeft ? -1 : 1;
    return (
      `M ${cx} 0 L ${cx} ${stemH - r}` +
      ` Q ${cx} ${stemH} ${cx + dxSign * r} ${stemH}` +
      ` L ${x - dxSign * r} ${stemH}` +
      ` Q ${x} ${stemH} ${x} ${stemH + r}` +
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
      ` L ${x} ${svgH}`
    );
  });

  return (
<<<<<<< HEAD
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
=======
    <div style={{ width: totalW, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* SVG fork */}
      <svg width={totalW} height={svgH} style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}>
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={TEAL}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={svgH} r={5} fill="white" stroke={TEAL} strokeWidth={2} />
        ))}
      </svg>

      {/* Columns */}
      <div style={{ width: totalW, display: 'flex', alignItems: 'flex-start', gap: COL_GAP }}>
        {branchLabels.map((label, idx) => {
          const childHead = nodeChildren[idx] ?? null;
          return (
            <div key={idx} style={{ width: COL_WIDTH, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white text-center"
                style={{
                  background: DARK,
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
                onInsertAtHead={t => onInsertBranchChild(nodeId, idx, t)}
                onInsertAfter={onInsertAfter}
                onDeleteNode={onDeleteNode}
                onInsertBranchChild={onInsertBranchChild}
                allAgents={allAgents}
              />
            </div>
          );
        })}
      </div>
    </div>
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
  );
}

// ── Config panels ─────────────────────────────────────────────────────────────

<<<<<<< HEAD
=======
type MsgType = 'synthese' | 'fichier' | 'enregistrement';

>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
function HoursPanel({
  node,
  onChange,
}: {
  node: IVRNode;
  onChange: (p: Partial<IVRNode>) => void;
}) {
<<<<<<< HEAD
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
=======
  const [retryOpen, setRetryOpen] = useState(false);

  return (
    <div className="space-y-0">
      <div className="pb-4 border-b border-slate-100">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Timezone
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            value={node.timezone}
            onChange={e => onChange({ timezone: e.target.value })}
          >
            {TIMEZONES.map(tz => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Business Hours
          </label>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            value={node.schedule || ''}
            onChange={e => onChange({ schedule: e.target.value })}
            placeholder="e.g: Monday - Friday 09:00 - 18:00"
          />
        </div>
      </div>

      {/* Retry management */}
      <div className="pt-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setRetryOpen(o => !o)}
        >
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">Retry Management</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Configure retry behavior when no input is received.
            </div>
          </div>
          <span className="text-slate-400 text-lg ml-2">{retryOpen ? "∧" : "∨"}</span>
        </button>
        {retryOpen && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Number of retries
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={node.retryCount ?? 3}
                onChange={e => onChange({ retryCount: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
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
=======
  const [retryOpen, setRetryOpen] = useState(false);

  return (
    <div className="space-y-0">
      <div className="pb-4 border-b border-slate-100">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">
            Timezone
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            value={node.dateTimezone}
            onChange={e => onChange({ dateTimezone: e.target.value })}
          >
            {TIMEZONES.map(tz => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 p-4 bg-slate-50">
          <div className="text-xs font-semibold text-slate-600 mb-1">Special Dates</div>
          <p className="text-xs text-slate-400 mb-2">
            Configure holidays or closures.
          </p>
          <button className="text-xs text-teal-600 font-semibold hover:underline">
            + Add special date
          </button>
        </div>
      </div>

      {/* Retry management */}
      <div className="pt-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setRetryOpen(o => !o)}
        >
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">Retry Management</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Configure retry behavior when no input is received.
            </div>
          </div>
          <span className="text-slate-400 text-lg ml-2">{retryOpen ? "∧" : "∨"}</span>
        </button>
        {retryOpen && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Number of retries
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={node.retryCount ?? 3}
                onChange={e => onChange({ retryCount: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
=======
  const [msgType, setMsgType] = useState<MsgType>('synthese');
  const [msgTypeOpen, setMsgTypeOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sectionOpen, setSectionOpen] = useState(true);
  const [retryOpen, setRetryOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const msgTypeLabels: Record<MsgType, { label: string; icon: React.ReactNode }> = {
    synthese: { label: 'Text-to-Speech', icon: <Globe className="w-4 h-4" /> },
    fichier: { label: 'Audio File', icon: <FileAudio className="w-4 h-4" /> },
    enregistrement: { label: 'Recording', icon: <Mic className="w-4 h-4" /> },
  };

>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
  const addBranch = () => {
    const branches = [
      ...(node.branches || []),
      { id: uid(), label: `Option ${(node.branches?.length || 0) + 1}` },
    ];
    onChange({ branches });
  };

  return (
<<<<<<< HEAD
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
=======
    <div className="space-y-0">
      {/* ── Menu Options ── */}
      <div className="pb-4 border-b border-slate-100">
        <div className="text-sm font-bold text-slate-700 mb-1">Menu Options</div>
        <p className="text-xs text-slate-400 mb-3">Define the menu options (e.g. "1 for support").</p>
        <div className="space-y-2">
          {node.branches?.map((b, i) => (
            <div key={b.id} className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
                {i + 1}
              </span>
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
                  className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none"
=======
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
                className="text-muted-foreground hover:text-destructive text-lg"
=======
                className="text-slate-300 hover:text-red-400 text-lg leading-none"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={addBranch}
<<<<<<< HEAD
          className="mt-3 w-full border-2 border-dashed border-teal-200 rounded-lg py-2 text-sm text-teal-600 font-medium hover:border-teal-400 hover:text-teal-700 transition-colors"
=======
          className="mt-3 w-full border-2 border-dashed border-teal-200 rounded-xl py-2 text-sm text-teal-500 font-semibold hover:border-teal-400 hover:text-teal-700 transition-colors"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
        >
          + Add option
        </button>
      </div>
<<<<<<< HEAD
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
=======

      {/* ── Welcome Message ── */}
      <div className="py-4 border-b border-slate-100">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setSectionOpen(o => !o)}
        >
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">Welcome Message</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Create a message to tell the caller what options to select.
            </div>
          </div>
          <span className="text-slate-400 text-lg ml-2">{sectionOpen ? "∧" : "∨"}</span>
        </button>

        {sectionOpen && (
          <div className="mt-4 space-y-3">
            {/* Message type selector */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Message Type</label>
              <div className="relative">
                <button
                  onClick={() => setMsgTypeOpen(o => !o)}
                  className="w-full flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-white hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {msgTypeLabels[msgType].icon}
                    <span>{msgTypeLabels[msgType].label}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>
                {msgTypeOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                    {(['synthese', 'fichier', 'enregistrement'] as MsgType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => { setMsgType(t); setMsgTypeOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {msgTypeLabels[t].icon}
                          {msgTypeLabels[t].label}
                        </div>
                        {msgType === t && (
                          <Check className="w-4 h-4" style={{ color: TEAL }} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Text-to-Speech */}
            {msgType === 'synthese' && (
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  rows={3}
                  value={node.inviteMessage ?? ''}
                  onChange={e => onChange({ inviteMessage: e.target.value })}
                  placeholder="e.g: Press 1 for support, 2 for sales."
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Language</label>
                    <select
                      className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
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
                    <label className="block text-xs text-slate-400 mb-1">Voice</label>
                    <select className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400">
                      {VOICES.map(v => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="w-full rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  <Play className="w-3 h-3" />
                  Test message
                </button>
              </div>
            )}

            {/* Audio File */}
            {msgType === 'fichier' && (
              <div className="space-y-2">
                {/* File row */}
                <div className="flex items-center justify-between border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
                  <span className="text-sm text-slate-700 font-medium">welcome.mp3</span>
                  <div className="flex items-center gap-2">
                    <button className="text-xs font-semibold text-teal-600 hover:underline">Rename</button>
                    <button className="w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-500 text-xs transition-colors">×</button>
                  </div>
                </div>
                {/* Audio player */}
                <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2.5 bg-white">
                  <button
                    onClick={() => setIsPlaying(p => !p)}
                    className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0 hover:bg-slate-700 transition-colors"
                  >
                    {isPlaying ? (
                      <Pause className="w-3 h-3 text-white" />
                    ) : (
                      <Play className="w-3 h-3 text-white ml-0.5" />
                    )}
                  </button>
                  {/* Progress bar */}
                  <div className="flex-1 h-1 bg-slate-200 rounded-full relative">
                    <div className="w-1 h-1 rounded-full bg-slate-700 absolute top-0 left-0" />
                  </div>
                  <span className="text-xs font-medium text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 flex-shrink-0">00:21</span>
                  <button className="text-slate-400 hover:text-slate-600">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
                <button className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2 text-xs font-medium text-slate-400 hover:border-teal-300 hover:text-teal-600 transition-colors flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  Import audio file
                </button>
              </div>
            )}

            {/* Recording */}
            {msgType === 'enregistrement' && (
              <div className="border border-slate-200 rounded-xl p-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto">
                  <Mic className="w-4 h-4 text-red-500" />
                </div>
                <div className="text-xs text-slate-500">Click to start recording</div>
                <button
                  onClick={() => setIsRecording(r => !r)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isRecording
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  {isRecording ? 'Stop Recording' : 'Record'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Retry Management ── */}
      <div className="pt-4">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setRetryOpen(o => !o)}
        >
          <div className="text-left">
            <div className="text-sm font-bold text-slate-800">Retry Management</div>
            <div className="text-xs text-slate-400 mt-0.5">
              Configure retry behavior when input is invalid or missing.
            </div>
          </div>
          <span className="text-slate-400 text-lg ml-2">{retryOpen ? "∧" : "∨"}</span>
        </button>
        {retryOpen && (
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Number of retries
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                value={node.retryCount ?? 3}
                onChange={e => onChange({ retryCount: parseInt(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
    <div style={{ width: 320, borderLeft: '1px solid #111a26', background: '#0d1520', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px #000e' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #111a26' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${m.color}20` }}
          >
            <span style={{ color: m.color }}>{m.icon}</span>
          </span>
          <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: 13 }}>{m.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onDelete}
            style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}
=======
    <div className="w-80 border-l border-slate-100 bg-white h-full flex flex-col shadow-xl">
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-slate-100"
        style={{ background: 'linear-gradient(to right, #f8fafc, #ffffff)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm"
            style={{ background: `${m.color}15` }}
          >
            <span style={{ color: m.color }}>{m.icon}</span>
          </span>
          <span className="font-bold text-slate-800">{m.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 font-medium"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
          >
            Delete
          </button>
          <button
            onClick={onClose}
<<<<<<< HEAD
            style={{ color: '#475569', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
=======
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
          >
            ×
          </button>
        </div>
      </div>
<<<<<<< HEAD
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
          Settings
        </div>
=======
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Settings</div>
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border transition-all shadow-sm cursor-pointer ${
        active ? 'border-teal-500 bg-teal-900' : 'border-border bg-card hover:border-teal-400 hover:shadow-md'
=======
      className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all shadow-sm ${
        active
          ? 'border-teal-500 bg-gradient-to-br from-teal-600 to-teal-700 shadow-lg'
          : 'border-slate-200 bg-white hover:border-teal-300 hover:shadow-md'
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
      }`}
      style={{ width: COL_WIDTH }}
    >
      <span
<<<<<<< HEAD
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: active ? 'rgba(255,255,255,0.15)' : `${m.color}20` }}
=======
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner"
        style={{ background: active ? 'rgba(255,255,255,0.2)' : `${m.color}15` }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
      >
        <span style={{ color: active ? 'white' : m.color }}>{m.icon}</span>
      </span>
      <button onClick={onClick} className="flex-1 text-left min-w-0">
<<<<<<< HEAD
        <div className={`text-xs font-semibold truncate ${active ? 'text-white' : ''}`}>
          {m.label}
        </div>
        <div className={`text-[10px] truncate ${active ? 'text-teal-200' : 'text-muted-foreground'}`}>
=======
        <div className={`text-xs font-semibold truncate ${active ? 'text-white' : 'text-slate-800'}`}>
          {m.label}
        </div>
        <div className={`text-[10px] truncate ${active ? 'text-teal-100' : 'text-slate-400'}`}>
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
          {subtitle}
        </div>
      </button>
      <div className="relative flex-shrink-0">
        <button
          onClick={e => {
            e.stopPropagation();
            setMenuOpen(o => !o);
          }}
<<<<<<< HEAD
          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
            active
              ? 'text-teal-200 hover:bg-teal-800 hover:text-white'
              : 'text-muted-foreground hover:bg-accent'
=======
          className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
            active
              ? 'text-teal-100 hover:bg-teal-500 hover:text-white'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
            className="absolute z-50 right-0 top-8 bg-card rounded-xl shadow-xl border border-border overflow-hidden"
            style={{ minWidth: 160 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent transition-colors text-left"
=======
            className="absolute z-50 right-0 top-8 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden"
            style={{ minWidth: 180 }}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
              onClick={() => setMenuOpen(false)}
            >
              <Copy className="w-4 h-4" /> Copy node
            </button>
<<<<<<< HEAD
            <div className="border-t border-border" />
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
=======
            <div className="border-t border-slate-100" />
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors text-left"
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
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
=======
                <VLine h={10} />
                <StaticDot />
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
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
    <div style={{ position: 'fixed', inset: 0, background: '#080d14', zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
      `}</style>
      {/* Top navbar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 52, flexShrink: 0, background: '#080d14', borderBottom: '1px solid #111a26' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{ background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 7, cursor: 'pointer', color: '#475569', padding: '6px 10px', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center' }}
          >
            ←
          </button>
          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, background: saving ? '#0d1520' : '#10b981', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', color: 'white', fontSize: 12, fontWeight: 500 }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => setStatus(s => (s === 'draft' ? 'published' : 'draft'))}
            style={{ padding: '6px 12px', borderRadius: 7, background: status === 'published' ? '#10b98120' : '#0d1520', border: status === 'published' ? '1px solid #10b981' : '1px solid #1e2d3d', cursor: 'pointer', color: status === 'published' ? '#10b981' : '#475569', fontSize: 12, fontWeight: 500 }}
          >
=======
    <div
      className="flex flex-col h-screen font-sans overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}
    >
      {/* Top navbar */}
      <header
        className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0"
        style={{ background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <span className="text-base font-medium">×</span>
            <span>Back to IVRs</span>
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
              title="Undo"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
              title="Redo"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <span className="text-sm font-bold text-slate-800 tracking-tight">IVR Editor</span>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Build from
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
              status === 'published'
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            {status === 'published' ? (
              <Check className="w-4 h-4" />
            ) : (
              <span className="w-4 h-4" />
            )}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
            {status === 'published' ? 'Published' : 'Draft'}
          </button>
        </div>
      </header>

      {/* Canvas + side panel row */}
<<<<<<< HEAD
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 48, paddingBottom: 100, paddingX: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Incoming call */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: '#1e293b', color: 'white', fontSize: 13, fontWeight: 600 }}
=======
      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-auto flex flex-col items-center pt-12 pb-32 px-8 min-w-0"
          style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)' }}
        >
          {/* Flow */}
          <div className="flex flex-col items-center">

            {/* Incoming call */}
            <div
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-lg"
              style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
              style={{ background: '#1e293b' }}
=======
              style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
            >
              <ArrowLeft className="w-4 h-4" />
              End Call
            </div>
          </div>

          {/* Zoom controls */}
<<<<<<< HEAD
          <div style={{ position: 'fixed', bottom: 24, left: 24, display: 'flex', alignItems: 'center', gap: 8, background: '#0d1520', border: '1px solid #1e2d3d', borderRadius: 10, padding: '6px 12px' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 16 }}>−</button>
            <span style={{ color: '#475569', fontSize: 11, fontWeight: 500, width: 36, textAlign: 'center' }}>100%</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 16 }}>+</button>
            <span style={{ color: '#1e2d3d', margin: '0 4px' }}>|</span>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', fontSize: 12 }}>⛶</button>
=======
          <div
            className="fixed bottom-6 left-6 flex items-center gap-2 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-1.5"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
          >
            <button className="text-slate-500 hover:text-slate-800 text-lg w-6 h-6 flex items-center justify-center">−</button>
            <span className="text-xs text-slate-500 font-medium w-9 text-center">100%</span>
            <button className="text-slate-500 hover:text-slate-800 text-lg w-6 h-6 flex items-center justify-center">+</button>
            <span className="text-slate-200 mx-1">|</span>
            <button className="text-slate-400 hover:text-slate-700 text-sm w-6 h-6 flex items-center justify-center">⛶</button>
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)
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
<<<<<<< HEAD
}
=======
}
>>>>>>> a1fae422 (feat(ivrs): implement IVR builder UI from reference design)

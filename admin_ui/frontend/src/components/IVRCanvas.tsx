import React, { useState, useCallback, useEffect } from 'react';
import {
  Undo2, Redo2, Loader2,
  X, Save, Check, Phone, Clock,
  Calendar, Key, Trash2, Copy,
  ChevronUp, ChevronDown, ChevronRight,
  Upload, FileAudio, CheckCircle2, ExternalLink,
  Volume2, Mic, File, UserCheck
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = 'hours' | 'date' | 'dtmf' | 'redirect' | 'action';

interface Branch {
  id: string;
  label: string;
  route?: string;
  dtmfDigit?: string;
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
  audioUrl?: string;
  audioType?: 'synthesized' | 'file' | 'recording';
  agentId?: string;
  agentName?: string;
  timeout?: number;
  retryMessage?: string;
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
    icon: <Volume2 className="w-4 h-4" />,
    desc: 'Play audio and collect DTMF',
    color: '#108A85',
    borderColor: '#108A85',
  },
  redirect: {
    label: 'Redirect',
    icon: <UserCheck className="w-4 h-4" />,
    desc: 'Redirect to AI agent',
    color: '#7c3aed',
    borderColor: '#7c3aed',
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

// ── ID generation ─────────────────────────────────────────────────────────────

let _id = 0;
const uid = () => `n${++_id}`;

function makeNode(type: NodeType): IVRNode {
  const base = { id: uid(), type, children: [], next: null };
  if (type === 'hours') {
    return { ...base, branches: [], timezone: 'Europe/Brussels', schedule: 'Monday - Sunday 08:00 - 22:00' };
  }
  if (type === 'date') {
    return { ...base, branches: [], dateTimezone: 'Europe/Brussels' };
  }
  if (type === 'svi_audio') {
    return {
      ...base,
      branches: [{ id: uid(), label: 'Option 1', dtmfDigit: '1' }],
      audioType: 'file',
      audioUrl: '',
      inviteLanguage: 'en',
      timeout: 5,
      retryMessage: '',
    };
  }
  if (type === 'redirect') {
    return {
      ...base,
      agentId: '',
      agentName: '',
      inviteMessage: '',
      timeout: 30,
    };
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
  if (node.type === 'svi_audio') {
    return [
      ...(node.branches?.map(b => `${b.dtmfDigit || ''} - ${b.label}`) || []),
      'Invalid / Timeout',
    ];
  }
  return [
    ...(node.branches?.map(b => b.label) || []),
    'Missing or invalid input',
  ];
}

// ── Primitive connectors ───────────────────────────────────────────────────────

// Clickable insertion point — dot + popup menu for inserting nodes
function InsertionPoint({
  onInsert,
  isTop = false,
}: {
  onInsert: (t: NodeType) => void;
  isTop?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex flex-col items-center" style={{ zIndex: 10 }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Insert node here"
        className="w-5 h-5 rounded-full border-2 border-teal-600 bg-white flex items-center justify-center transition-all cursor-pointer hover:bg-teal-50"
        style={{ zIndex: 5 }}
      >
        <span style={{ color: '#0d9488', fontSize: 12, lineHeight: 1, fontWeight: 700 }}>+</span>
      </button>
      {open && (
        <div
          className="absolute bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          style={{ minWidth: 200, top: isTop ? 'auto' : 'calc(100% + 6px)', bottom: isTop ? 'calc(100% + 6px)' : 'auto', left: '50%', transform: 'translateX(-50%)' }}
        >
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Insert node</div>
          {(Object.keys(NODE_META) as NodeType[]).filter(t => t !== 'action').map(t => {
            const m = NODE_META[t];
            return (
              <button
                key={t}
                onClick={() => { onInsert(t); setOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${m.color}18` }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
              </button>
            );
          })}
          <button onClick={() => setOpen(false)} className="w-full text-center text-xs text-gray-400 py-2 hover:bg-gray-50 transition-colors border-t border-gray-100">Cancel</button>
        </div>
      )}
    </div>
  );
}

// Static connector dot (non-clickable, for visual continuity)
function ConnectorDot() {
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
      className="relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:brightness-105"
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
            <Copy className="w-4 h-4 text-gray-500" /> Copy
          </button>
        </div>
      )}
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

function DTMFPanel({ node, onChange }: { node: IVRNode; onChange: (p: Partial<IVRNode>) => void }) {
  const [messageAccordionOpen, setMessageAccordionOpen] = useState(true);
  const [dtmfAccordionOpen, setDTMFAccordionOpen] = useState(false);
  const [audioTypeOpen, setAudioTypeOpen] = useState(true);
  const [selectedAudioType, setSelectedAudioType] = useState(node.audioType || 'file');

  const handleAudioTypeChange = (type: 'synthesized' | 'file' | 'recording') => {
    setSelectedAudioType(type);
    onChange({ audioType: type });
  };

  const addDTMFOption = () => {
    const nextDigit = String((node.branches?.length || 0) + 1);
    onChange({
      branches: [...(node.branches || []), { id: uid(), label: `Option ${nextDigit}`, dtmfDigit: nextDigit }],
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">

        {/* ── Accordion 1: Message d'invite ── */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setMessageAccordionOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-bold text-gray-900">Message d'invite</span>
            <ChevronUp className={`w-4 h-4 text-gray-400 transition-transform ${messageAccordionOpen ? '' : '-rotate-180'}`} />
          </button>

          {messageAccordionOpen && (
            <div className="px-4 pb-4 space-y-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                Créez un message pour indiquer à l'appelant quelle option sélectionner.
              </p>

              {/* Type de message dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Type de message</label>
                <div className="relative">
                  <button
                    onClick={() => setAudioTypeOpen(o => !o)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-left hover:border-gray-300 transition-colors"
                  >
                    <span className="text-gray-900">
                      {AUDIO_TYPES.find(t => t.value === selectedAudioType)?.label || 'Fichier personnalisé'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${audioTypeOpen ? '' : '-rotate-180'}`} />
                  </button>

                  {audioTypeOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
                      {AUDIO_TYPES.map(type => (
                        <button
                          key={type.value}
                          onClick={() => { handleAudioTypeChange(type.value as any); setAudioTypeOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span style={{ color: '#108A85' }}>{type.icon}</span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{type.label}</div>
                            <div className="text-xs text-gray-400">{type.desc}</div>
                          </div>
                          {selectedAudioType === type.value && (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#108A85' }} />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Synthesized text */}
              {selectedAudioType === 'synthesized' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Texte du message</label>
                  <textarea
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                    rows={3}
                    value={node.inviteMessage || ''}
                    onChange={e => onChange({ inviteMessage: e.target.value })}
                    placeholder="Bienvenue, merci de sélectionner une option..."
                  />
                  <div className="mt-2">
                    <label className="block text-xs text-gray-500 mb-1">Langue</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={node.inviteLanguage || 'fr'}
                      onChange={e => onChange({ inviteLanguage: e.target.value })}
                    >
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* File upload zone */}
              {selectedAudioType === 'file' && (
                <div>
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.mp3,.wav,.ogg';
                      input.onchange = (e: any) => {
                        const file = e.target.files?.[0];
                        if (file) onChange({ audioUrl: file.name, inviteMessage: file.name });
                      };
                      input.click();
                    }}
                  >
                    {node.audioUrl ? (
                      <>
                        <FileAudio className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-sm font-medium text-gray-700 mb-1">{node.inviteMessage || 'Fichier chargé'}</p>
                        <p className="text-xs text-gray-400">Cliquez pour remplacer</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-gray-300 mb-2" />
                        <p className="text-sm font-medium text-gray-500 mb-1">Déposez votre fichier, ou cliquez pour télécharger</p>
                        <p className="text-xs text-gray-400">Tout fichier .mp3, 10 Mo maximum</p>
                      </>
                    )}
                  </div>
                  {node.audioUrl && (
                    <button onClick={() => onChange({ audioUrl: '', inviteMessage: '' })} className="mt-2 text-xs text-red-500 hover:text-red-700">
                      Supprimer le fichier
                    </button>
                  )}
                </div>
              )}

              {/* Recording */}
              {selectedAudioType === 'recording' && (
                <div className="flex flex-col items-center py-4">
                  <button className="w-16 h-16 rounded-full bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors mb-3">
                    <Mic className="w-6 h-6 text-red-600" />
                  </button>
                  <p className="text-sm text-gray-500">Cliquez pour enregistrer</p>
                  <p className="text-xs text-gray-400 mt-1">Max. 60 secondes</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Accordion 2: Options DTMF ── */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <button
            onClick={() => setDTMFAccordionOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm font-bold text-gray-900">Options DTMF</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${dtmfAccordionOpen ? '' : '-rotate-180'}`} />
          </button>

          {dtmfAccordionOpen && (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-2">
                {node.branches?.map((branch, i) => (
                  <div key={branch.id} className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: '#108A85' }}>
                      {branch.dtmfDigit || i + 1}
                    </span>
                    <input
                      className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                      value={branch.label}
                      onChange={e => {
                        const updated = [...(node.branches || [])];
                        updated[i] = { ...updated[i], label: e.target.value };
                        onChange({ branches: updated });
                      }}
                      placeholder="Label de l'option..."
                    />
                    <button
                      onClick={() => onChange({ branches: (node.branches || []).filter(b => b.id !== branch.id) })}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >×</button>
                  </div>
                ))}
              </div>
              <button
                onClick={addDTMFOption}
                className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2 text-sm text-gray-500 font-medium hover:border-gray-300 hover:text-gray-700 transition-colors"
              >
                + Ajouter une option
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <a href="#" className="flex items-center gap-1 text-xs font-medium hover:underline" style={{ color: '#108A85' }} onClick={e => e.preventDefault()}>
          En savoir plus sur SVI standard <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SVI Panel — Professional SVI audio node configuration sidebar
// ─────────────────────────────────────────────────────────────────────────────

const AUDIO_TYPES = [
  {
    value: 'synthesized',
    label: 'Synthèse vocale',
    icon: <Volume2 className="w-4 h-4" />,
    desc: 'Convertir un texte en audio avec l’IA',
  },
  {
    value: 'file',
    label: 'Fichier personnalisé',
    icon: <File className="w-4 h-4" />,
    desc: 'Utiliser un fichier audio (.mp3, .wav)',
  },
  {
    value: 'recording',
    label: 'Enregistrement audio',
    icon: <Mic className="w-4 h-4" />,
    desc: 'Enregistrer directement dans le navigateur',
  },
];

// ─────────────────────────────────────────────────────────────────────────────

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
        {node.type === 'dtmf' && <DTMFPanel node={node} onChange={onChange} />}
        {node.type === 'redirect' && <DTMFPanel node={node} onChange={onChange} />}
      </div>
    </div>
  );
}
// ── Layout Engine — computes absolute X,Y positions for every node ────────────
//
// Philosophy: walk the tree recursively, measure the SUBTREE WIDTH of each node,
// then center-place it. No flex, no CSS layout — pure math.

const NODE_H = 56;        // card height
const NODE_W_CONST = 240; // card width (renamed to avoid conflict)
const H_GAP = 40;         // horizontal gap between sibling columns
const V_GAP_NODE = 24;    // vertical gap between node bottom and next element
const V_GAP_LABEL = 20;   // space for condition label
const DOT_H = 16;         // insert dot height
const LABEL_H = 24;       // condition label pill height
const FORK_H = 32;        // fork vertical space (from node bottom to branch labels)
const TEAL = '#0d9488';

// ── Measured layout node ──────────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  x: number;        // center x
  y: number;        // top y
  width: number;    // subtree width (for parent centering)
  height: number;   // subtree height
  branchIdx?: number;
  branchLabel?: string;
  isBranchHead?: boolean;
}

interface LayoutEdge {
  type: 'straight' | 'fork-h' | 'fork-v' | 'label';
  x1: number; y1: number;
  x2: number; y2: number;
  label?: string;
}

interface InsertSlot {
  id: string;          // unique key
  x: number; y: number;
  onInsert: (t: NodeType) => void;
}

interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  inserts: InsertSlot[];
  totalWidth: number;
  totalHeight: number;
}

// ── Measure subtree width ─────────────────────────────────────────────────────
// Returns the total pixel width the subtree of this chain-head needs

function measureChainWidth(
  headId: string | null,
  nodes: Record<string, IVRNode>
): number {
  if (!headId || !nodes[headId]) return NODE_W_CONST;
  let maxW = 0;
  let cur: string | null = headId;
  while (cur && nodes[cur]) {
    const node = nodes[cur];
    const branchLabels = getBranchLabels(node);
    if (branchLabels.length > 0) {
      // width = sum of branch subtree widths + gaps
      const branchWidths = branchLabels.map((_, i) => {
        const childHead = node.children[i] ?? null;
        return Math.max(NODE_W_CONST, measureChainWidth(childHead, nodes));
      });
      const total = branchWidths.reduce((a, b) => a + b, 0) + (branchLabels.length - 1) * H_GAP;
      maxW = Math.max(maxW, total);
    } else {
      maxW = Math.max(maxW, NODE_W_CONST);
    }
    cur = node.next;
  }
  return Math.max(maxW, NODE_W_CONST);
}

// ── Build layout ──────────────────────────────────────────────────────────────
// cx = horizontal center of this chain, startY = top y to begin placing

function buildChainLayout(
  headId: string | null,
  allNodes: Record<string, IVRNode>,
  cx: number,
  startY: number,
  layout: Layout,
  callbacks: {
    onInsertAtHead: (t: NodeType) => void;
    onInsertAfter: (id: string, t: NodeType) => void;
    onInsertBranchChild: (parentId: string, idx: number, t: NodeType) => void;
  }
): number /* returns bottom Y of entire chain */ {
  let y = startY;

  // Insert dot at top of chain
  const insertId = `ins_top_${headId || 'root'}_${cx}_${y}`;
  layout.inserts.push({ id: insertId, x: cx, y, onInsert: callbacks.onInsertAtHead });
  y += DOT_H + 4;

  // Walk the linked list
  let cur: string | null = headId;
  while (cur && allNodes[cur]) {
    const node = allNodes[cur];
    const branchLabels = getBranchLabels(node);
    const hasBranches = branchLabels.length > 0;

    // Line from insert dot (or previous) down to node
    if (layout.edges.length > 0 || y > startY + DOT_H + 4) {
      layout.edges.push({ type: 'straight', x1: cx, y1: y - 4, x2: cx, y2: y + V_GAP_NODE });
    }
    y += V_GAP_NODE;

    // Place node card
    layout.nodes.push({ id: node.id, x: cx, y, width: NODE_W_CONST, height: NODE_H });
    y += NODE_H;

    if (hasBranches) {
      // Fork: vertical line down from node center
      layout.edges.push({ type: 'straight', x1: cx, y1: y, x2: cx, y2: y + 10 });
      y += 10;

      // Dot at fork point
      layout.inserts.push({ id: `dot_${node.id}`, x: cx, y, onInsert: () => {} });
      y += 8;

      // Compute widths for each branch
      const branchWidths = branchLabels.map((_, i) => {
        const childHead = node.children[i] ?? null;
        return Math.max(NODE_W_CONST, measureChainWidth(childHead, allNodes));
      });
      const totalBranchW = branchWidths.reduce((a, b) => a + b, 0) + (branchLabels.length - 1) * H_GAP;

      // Branch center X positions
      const branchCXs: number[] = [];
      let bx = cx - totalBranchW / 2;
      for (let i = 0; i < branchLabels.length; i++) {
        branchCXs.push(bx + branchWidths[i] / 2);
        bx += branchWidths[i] + H_GAP;
      }

      // Horizontal bar line
      const leftX = branchCXs[0];
      const rightX = branchCXs[branchCXs.length - 1];
      if (branchCXs.length > 1) {
        layout.edges.push({ type: 'fork-h', x1: leftX, y1: y, x2: rightX, y2: y });
      }

      // Vertical drops to each branch + condition labels
      const branchStartY = y + FORK_H;
      let maxBranchBottomY = branchStartY;

      for (let i = 0; i < branchLabels.length; i++) {
        const bcx = branchCXs[i];
        // Vertical drop from horizontal bar
        layout.edges.push({ type: 'fork-v', x1: bcx, y1: y, x2: bcx, y2: branchStartY - LABEL_H - 4 });
        // Condition label
        layout.edges.push({ type: 'label', x1: bcx, y1: branchStartY - LABEL_H - 4, x2: bcx, y2: branchStartY - LABEL_H - 4, label: branchLabels[i] });
        // Short line below label
        layout.edges.push({ type: 'fork-v', x1: bcx, y1: branchStartY - 4, x2: bcx, y2: branchStartY });

        const childHead = node.children[i] ?? null;
        const childBottomY = buildChainLayout(
          childHead,
          allNodes,
          bcx,
          branchStartY,
          layout,
          {
            onInsertAtHead: t => callbacks.onInsertBranchChild(node.id, i, t),
            onInsertAfter: callbacks.onInsertAfter,
            onInsertBranchChild: callbacks.onInsertBranchChild,
          }
        );
        maxBranchBottomY = Math.max(maxBranchBottomY, childBottomY);
      }

      y = maxBranchBottomY + 8;
    } else {
      // Insert dot after node
      const afterInsertId = `ins_after_${node.id}`;
      layout.edges.push({ type: 'straight', x1: cx, y1: y, x2: cx, y2: y + 8 });
      y += 8;
      layout.inserts.push({
        id: afterInsertId, x: cx, y,
        onInsert: t => callbacks.onInsertAfter(node.id, t),
      });
      y += DOT_H + 4;
    }

    cur = node.next;
  }

  return y;
}

// ── InsertionPoint ─────────────────────────────────────────────────────────────

function InsertionDot({ x, y, onInsert }: { x: number; y: number; onInsert: (t: NodeType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <g style={{ zIndex: 10 }}>
      <foreignObject x={x - 9} y={y - 9} width={18} height={18} style={{ overflow: 'visible' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${TEAL}`,
              background: open ? TEAL : 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 13, color: open ? 'white' : TEAL,
              fontWeight: 700, lineHeight: 1,
            }}
          >+</button>
          {open && (
            <div style={{
              position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)',
              background: 'white', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              border: '1px solid #e5e7eb', minWidth: 200, zIndex: 100, overflow: 'hidden',
            }}>
              <div style={{ padding: '10px 14px 4px', fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Insert node
              </div>
              {(Object.keys(NODE_META) as NodeType[]).filter(t => t !== 'action').map(t => {
                const m = NODE_META[t];
                return (
                  <button key={t}
                    onClick={() => { onInsert(t); setOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 14px', background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: m.color }}>{m.icon}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{m.desc}</div>
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setOpen(false)}
                style={{ width: '100%', padding: '6px', fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', borderTop: '1px solid #f3f4f6', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

// ── SVG Canvas renderer ───────────────────────────────────────────────────────

function FlowCanvas({
  flow, selectedId, onSelect, onDeleteNode,
  onInsertAtHead, onInsertAfter, onInsertBranchChild, allAgents,
}: {
  flow: FlowState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onInsertAtHead: (t: NodeType) => void;
  onInsertAfter: (afterId: string, t: NodeType) => void;
  onInsertBranchChild: (parentId: string, idx: number, t: NodeType) => void;
  allAgents?: string[];
}) {
  const CANVAS_CX = 600;
  const TOP_Y = 80;

  // ── Fixed top node: Appel entrant ──
  const topNodeY = TOP_Y;
  const topNodeH = 44;

  // ── Build layout ──
  const layout: Layout = { nodes: [], edges: [], inserts: [], totalWidth: 0, totalHeight: 0 };
  const chainStartY = topNodeY + topNodeH + 20;

  const bottomY = buildChainLayout(
    flow.rootHead,
    flow.nodes,
    CANVAS_CX,
    chainStartY,
    layout,
    { onInsertAtHead, onInsertAfter, onInsertBranchChild }
  );

  // End call node
  const endY = bottomY + 16;
  const svgH = endY + 80;
  const svgW = Math.max(1200, ...layout.nodes.map(n => n.x + n.width / 2 + 60), ...layout.nodes.map(n => n.x - n.width / 2 - 60).map(x => x < 0 ? 1200 : 1200));

  // Compute actual bounds
  const allX = [CANVAS_CX, ...layout.nodes.map(n => n.x)];
  const minX = Math.min(...allX) - 200;
  const maxX = Math.max(...allX) + 200;
  const canvasW = Math.max(1200, maxX - minX);
  const offsetX = -minX;

  return (
    <svg
      width={canvasW}
      height={svgH + 80}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Edges */}
      {layout.edges.map((e, i) => {
        if (e.type === 'label') {
          return (
            <foreignObject key={i} x={e.x1 + offsetX - 80} y={e.y1 - 14} width={160} height={28}>
              <div style={{
                display: 'flex', justifyContent: 'center',
              }}>
                <div style={{
                  background: '#1e293b', color: 'white', fontSize: 10,
                  fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                  whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {e.label}
                </div>
              </div>
            </foreignObject>
          );
        }
        return (
          <line key={i}
            x1={e.x1 + offsetX} y1={e.y1}
            x2={e.x2 + offsetX} y2={e.y2}
            stroke={TEAL} strokeWidth={2} strokeLinecap="round"
          />
        );
      })}

      {/* Appel entrant */}
      <foreignObject x={CANVAS_CX + offsetX - NODE_W_CONST / 2} y={topNodeY} width={NODE_W_CONST} height={topNodeH}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 20px', height: topNodeH,
          background: '#1e293b', borderRadius: 99,
          color: 'white', fontSize: 14, fontWeight: 600,
        }}>
          <Phone style={{ width: 16, height: 16 }} />
          Appel entrant
        </div>
      </foreignObject>

      {/* Line from top node to chain */}
      <line x1={CANVAS_CX + offsetX} y1={topNodeY + topNodeH} x2={CANVAS_CX + offsetX} y2={chainStartY} stroke={TEAL} strokeWidth={2} />

      {/* Layout nodes — rendered as foreignObject cards */}
      {layout.nodes.map(n => {
        const node = flow.nodes[n.id];
        if (!node) return null;
        const m = NODE_META[node.type];
        const isSelected = selectedId === n.id;
        const subtitle = node.type === 'hours' ? node.timezone : node.type === 'date' ? node.dateTimezone : `${node.branches?.length || 0} option(s)`;
        return (
          <foreignObject key={n.id} x={n.x + offsetX - NODE_W_CONST / 2} y={n.y} width={NODE_W_CONST} height={NODE_H}>
            <NodeCardSVG
              node={node}
              isSelected={isSelected}
              onClick={() => onSelect(n.id)}
              onDelete={() => onDeleteNode(n.id)}
            />
          </foreignObject>
        );
      })}

      {/* Insert dots */}
      {layout.inserts.filter(s => s.onInsert.toString() !== '() => {}').map(s => (
        <InsertionDot key={s.id} x={s.x + offsetX} y={s.y} onInsert={s.onInsert} />
      ))}

      {/* Static dots (fork points) */}
      {layout.inserts.filter(s => s.onInsert.toString() === '() => {}').map(s => (
        <circle key={s.id} cx={s.x + offsetX} cy={s.y} r={5} fill="white" stroke={TEAL} strokeWidth={2} />
      ))}

      {/* Line to end call */}
      <line x1={CANVAS_CX + offsetX} y1={bottomY} x2={CANVAS_CX + offsetX} y2={endY} stroke={TEAL} strokeWidth={2} />
      <circle cx={CANVAS_CX + offsetX} cy={endY - 2} r={5} fill="white" stroke={TEAL} strokeWidth={2} />

      {/* Terminer l'appel */}
      <foreignObject x={CANVAS_CX + offsetX - NODE_W_CONST / 2} y={endY + 6} width={NODE_W_CONST} height={topNodeH}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 20px', height: topNodeH,
          background: '#0d9488', borderRadius: 99,
          color: 'white', fontSize: 14, fontWeight: 600,
        }}>
          <Phone style={{ width: 16, height: 16 }} />
          Terminer l'appel
        </div>
      </foreignObject>
    </svg>
  );
}

// ── Node card rendered inside SVG foreignObject ───────────────────────────────

function NodeCardSVG({ node, isSelected, onClick, onDelete }: {
  node: IVRNode; isSelected: boolean; onClick: () => void; onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const m = NODE_META[node.type];
  const subtitle = node.type === 'hours' ? node.timezone : node.type === 'date' ? node.dateTimezone : `${node.branches?.length || 0} option(s)`;

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', height: NODE_H,
        width: NODE_W_CONST, boxSizing: 'border-box',
        background: 'white', cursor: 'pointer',
        border: `2px solid ${isSelected ? m.borderColor : m.borderColor + '60'}`,
        borderRadius: 16,
        boxShadow: isSelected ? `0 0 0 3px ${m.borderColor}30` : '0 1px 4px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: m.color }}>{m.icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</div>
        <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
      </div>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="2" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="7" cy="12" r="1.3"/>
          </svg>
        </button>
        {menuOpen && (
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', right: 0, top: 28, background: 'white',
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb',
            minWidth: 150, zIndex: 100, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setMenuOpen(false); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <Copy style={{ width: 14, height: 14 }} /> Copy
            </button>
            <div style={{ borderTop: '1px solid #f3f4f6' }} />
            <button
              onClick={() => { setMenuOpen(false); onDelete(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#ef4444' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <Trash2 style={{ width: 14, height: 14 }} /> Delete
            </button>
          </div>
        )}
      </div>
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

  // Find last node in the chain for clickable insert point before ActionCard
  let lastChainNodeId: string | null = null;
  let cur: string | null = flow.rootHead;
  while (cur) {
    const node = flow.nodes[cur];
    if (!node.next) { lastChainNodeId = cur; break; }
    cur = node.next;
  }

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
              <FlowCanvas
                flow={flow}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDeleteNode={deleteNode}
                onInsertAtHead={insertAtRootHead}
                onInsertAfter={insertAfter}
                onInsertBranchChild={insertBranchChild}
                allAgents={allAgents}
              />
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
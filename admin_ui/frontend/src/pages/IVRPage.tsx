import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, MoreVertical,
  Loader2, Phone, ChevronDown, Pencil, Copy as CopyIcon,
  ArrowUpDown, Trash2, Edit,
} from 'lucide-react';
import IVRCanvas from '../components/IVRCanvas';

type SortOption = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'created_desc', label: 'Recently Created' },
  { value: 'created_asc', label: 'Oldest First' },
];

const IVRPage: React.FC = () => {
  const [ivrs, setIvrs] = useState<Record<string, any>>({});
  const [ivrNames, setIvrNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created_desc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [canvasIvr, setCanvasIvr] = useState<string | null>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchIvrs(); }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
        setMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchIvrs = async () => {
    try {
      const res = await axios.get('/api/ivrs');
      const names = res.data.ivrs || [];
      setIvrNames(names);
      const data: Record<string, any> = {};
      await Promise.all(names.map(async (name: string) => {
        try {
          const r = await axios.get(`/api/ivrs/${name}`);
          data[name] = r.data;
        } catch { }
      }));
      setIvrs(data);
    } catch {
      toast.error('Failed to load IVRs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    // Same exact pattern as WorkflowsPage: create in-memory name, show canvas immediately
    const name = `ivr_${Date.now()}`;
    setIvrs((d: Record<string, any>) => ({ ...d, [name]: {} }));
    setCanvasIvr(name);
  };

  const handleEdit = (name: string) => {
    setCanvasIvr(name);
  };

  const handleDeleteIvr = async (name: string) => {
    if (!confirm(`Delete IVR "${name}"?`)) return;
    try {
      await axios.delete(`/api/ivrs/${name}`);
      toast.success('IVR deleted');
      setMenuOpen(null);
      fetchIvrs();
    } catch {
      toast.error('Failed to delete IVR');
    }
  };

  const handleDuplicateIvr = async (name: string) => {
    const data = ivrs[name];
    if (!data) return;
    let newName = `${name}_copy`;
    let counter = 1;
    while (ivrNames.includes(newName)) {
      counter++;
      newName = `${name}_copy_${counter}`;
    }
    try {
      await axios.put(`/api/ivrs/${newName}`, { ...data, name: newName });
      toast.success('IVR duplicated');
      setMenuOpen(null);
      fetchIvrs();
    } catch {
      toast.error('Failed to duplicate IVR');
    }
  };

  const handleSaveIvr = async (name: string, data: any) => {
    const ivr = ivrs[name] || {};
    await axios.put(`/api/ivrs/${name}`, {
      ...ivr,
      name,
      flow: data.flow,
      status: data.status,
    });
    toast.success('IVR saved!');
    fetchIvrs();
  };

  const filteredIvrs = useMemo(() => {
    let list = ivrNames.map(name => ({ name, ...ivrs[name] }));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return (a.name || '').localeCompare(b.name || '');
        case 'name_desc': return (b.name || '').localeCompare(a.name || '');
        case 'created_desc': return ((b.created_at || '') > (a.created_at || '')) ? 1 : -1;
        case 'created_asc': return ((a.created_at || '') > (b.created_at || '')) ? 1 : -1;
        default: return 0;
      }
    });
    return list;
  }, [ivrNames, ivrs, searchQuery, sortBy]);

  // When canvasIvr is set, show IVRCanvas full page (same pattern as WorkflowsPage)
  if (canvasIvr !== null) {
    const ivrData = ivrs[canvasIvr] || {};
    return (
      <IVRCanvas
        key={canvasIvr}
        name={canvasIvr}
        initialData={ivrData}
        allAgents={['services', 'offers', 'meetings', 'support', 'other']}
        onSave={async (data) => {
          try {
            await axios.put(`/api/ivrs/${canvasIvr}`, {
              name: canvasIvr,
              description: ivrData.description || '',
              languages: ivrData.languages || ['en'],
              routes: ivrData.routes || {},
              greeting_audio: ivrData.greeting_audio || {},
              flow: data.flow,
              status: data.status,
            });
            toast.success('IVR saved!');
            fetchIvrs();
          } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to save IVR');
          }
        }}
        onBack={() => {
          setCanvasIvr(null);
          fetchIvrs();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">IVR Flows</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create multi-language IVR flows for call routing
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Create IVR
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search IVRs..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-md border border-input bg-background text-sm"
          />
        </div>
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => setSortMenuOpen(!sortMenuOpen)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-input bg-background text-sm hover:bg-accent transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort
            <ChevronDown className="w-4 h-4" />
          </button>
          {sortMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-md border bg-popover shadow-lg z-50 py-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSortBy(opt.value); setSortMenuOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-accent ${sortBy === opt.value ? 'text-primary' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IVR List */}
      {filteredIvrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
          <Phone className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No IVRs yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first IVR flow to get started</p>
          <button
            onClick={handleCreateNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Create IVR
          </button>
        </div>
      ) : (
        <div className="rounded-lg border">
          <div className="grid grid-cols-1 gap-4 p-4">
            {filteredIvrs.map((ivr) => (
              <div
                key={ivr.name}
                className="flex items-center justify-between p-4 rounded-lg bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{ivr.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {ivr.description || 'No description'}
                    </p>
                    {ivr.status && (
                      <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${
                        ivr.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {ivr.status}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(ivr.name)}
                    className="p-2 rounded-md hover:bg-accent transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicateIvr(ivr.name)}
                    className="p-2 rounded-md hover:bg-accent transition-colors"
                    title="Duplicate"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteIvr(ivr.name)}
                    className="p-2 rounded-md hover:bg-accent transition-colors text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === ivr.name ? null : ivr.name); }}
                      className="p-2 rounded-md hover:bg-accent transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen === ivr.name && (
                      <div className="absolute right-0 mt-2 w-40 rounded-md border bg-popover shadow-lg z-50 py-1">
                        <button
                          onClick={() => { handleEdit(ivr.name); setMenuOpen(null); }}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent"
                        >
                          <Edit className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteIvr(ivr.name)}
                          className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default IVRPage;

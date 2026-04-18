import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Filter, Code, MoreVertical, Loader2, Workflow as WorkflowIcon, ChevronDown, Pencil, Copy as CopyIcon, ArrowUpDown, Clock, BarChart3, X, Download, FileText, BookOpen, Upload } from 'lucide-react';
import WorkflowCanvas from '../components/WorkflowCanvas';

type SortOption = 'name_asc' | 'name_desc' | 'created_desc' | 'created_asc' | 'updated_desc' | 'updated_asc' | 'steps_desc' | 'steps_asc';

const SORT_OPTIONS: { value: SortOption; label: string; icon: React.ReactNode }[] = [
  { value: 'name_asc', label: 'Name (A-Z)', icon: <ArrowUpDown className="w-4 h-4" /> },
  { value: 'name_desc', label: 'Name (Z-A)', icon: <ArrowUpDown className="w-4 h-4" /> },
  { value: 'created_desc', label: 'Recently Created', icon: <Clock className="w-4 h-4" /> },
  { value: 'created_asc', label: 'Oldest First', icon: <Clock className="w-4 h-4" /> },
  { value: 'updated_desc', label: 'Recently Updated', icon: <Clock className="w-4 h-4" /> },
  { value: 'updated_asc', label: 'Least Recently Updated', icon: <Clock className="w-4 h-4" /> },
  { value: 'steps_desc', label: 'Most Steps', icon: <BarChart3 className="w-4 h-4" /> },
  { value: 'steps_asc', label: 'Fewest Steps', icon: <BarChart3 className="w-4 h-4" /> },
];

// JSON Syntax highlighting component
const JsonViewer = ({ data }: { data: any }) => {
  const jsonString = JSON.stringify(data, null, 2);
  const lines = jsonString.split('\n');

  const highlightLine = (line: string, i: number) => {
    // Syntax highlighting using theme colors
    let highlighted = line
      // Keys - cyan/blue
      .replace(/"([^"]+)":/g, '<span class="text-cyan-500 dark:text-cyan-400">"$1"</span>:')
      // Strings - green
      .replace(/: "([^"]+)"/g, ': <span class="text-green-600 dark:text-green-400">"$1"</span>')
      // Numbers - orange
      .replace(/: (-?\d+\.?\d*)/g, ': <span class="text-orange-500 dark:text-orange-400">$1</span>')
      // Booleans/null - pink/magenta
      .replace(/: (true|false|null)/g, ': <span class="text-pink-500 dark:text-pink-400">$1</span>');

    return (
      <div key={i} className="flex">
        <span className="text-muted-foreground select-none w-10 text-right pr-3 flex-shrink-0">{i + 1}</span>
        <span className="font-mono text-sm text-foreground" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    );
  };

  return (
    <div className="font-mono text-sm overflow-auto bg-muted/10 rounded-md p-2">
      {lines.map((line, i) => highlightLine(line, i))}
    </div>
  );
};

const WorkflowsPage = () => {
  const [workflowNames, setWorkflowNames] = useState([]);
  const [workflowsData, setWorkflowsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [canvasWorkflow, setCanvasWorkflow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('created_desc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false);
  const [jsonDrawerData, setJsonDrawerData] = useState<any>(null);
  const [jsonDrawerName, setJsonDrawerName] = useState('');
  const sortMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchWorkflows(); }, []);

  // Close sort menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await axios.get('/api/workflows');
      const names = res.data.workflows || [];
      setWorkflowNames(names);
      const data: Record<string, any> = {};
      await Promise.all(names.map(async (name: string) => {
        try {
          const r = await axios.get(`/api/workflows/${name}`);
          data[name] = r.data;
        } catch { }
      }));
      setWorkflowsData(data);
    } catch {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCanvas = async ({ steps, canvas, globalPrompt, globalVoiceProvider, globalVoiceName, context }: { steps: any[]; canvas: { nodes: any[]; edges: any[] }; globalPrompt?: string; globalVoiceProvider?: string; globalVoiceName?: string; context?: string }, name: string) => {
    const wf = {
      name,
      description: workflowsData[name]?.description || '',
      version: workflowsData[name]?.version || '1.0',
      variables: workflowsData[name]?.variables || {},
      steps,
      canvas,
      global_prompt: globalPrompt,
      global_voice_provider: globalVoiceProvider,
      global_voice_name: globalVoiceName,
      context: context || workflowsData[name]?.context,
    };
    try {
      await axios.put(`/api/workflows/${name}`, wf);
      toast.success('Workflow saved!');
      fetchWorkflows();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail?.errors && Array.isArray(detail.errors)) {
        toast.error(detail.errors.join(', '));
      } else {
        toast.error(detail || 'Failed to save workflow');
      }
    }
  };

  const handleRenameWorkflow = async (oldName: string, newName: string, data: any) => {
    if (!newName || newName.trim() === '') {
      toast.error('Invalid workflow name');
      return;
    }
    if (workflowNames.includes(newName)) {
      toast.error('Workflow name already exists');
      return;
    }
    try {
      await axios.put(`/api/workflows/${newName}`, {
        name: newName,
        ...data,
      });
      await axios.delete(`/api/workflows/${oldName}`);
      toast.success(`Workflow renamed to ${newName}`);
      setCanvasWorkflow(newName);
      fetchWorkflows();
    } catch (err: any) {
      toast.error('Failed to rename workflow');
    }
  };

  const handleDuplicate = async (name: string) => {
    const source = workflowsData[name];
    if (!source) {
      toast.error('Source workflow not found');
      return;
    }
    const newName = `${name}_copy`;
    if (workflowNames.includes(newName)) {
      toast.error('Duplicate name already exists');
      return;
    }
    try {
      await axios.put(`/api/workflows/${newName}`, {
        name: newName,
        description: source.description || '',
        version: source.version || '1.0',
        variables: source.variables || {},
        steps: source.steps || [],
        canvas: source.canvas || null,
        global_prompt: source.global_prompt || '',
        global_voice_provider: source.global_voice_provider || 'Vapi',
        global_voice_name: source.global_voice_name || 'Elliot',
        context: source.context || null,
      });
      toast.success(`Workflow duplicated as ${newName}`);
      setMenuOpen(null);
      fetchWorkflows();
    } catch (err: any) {
      console.error('Duplicate error:', err);
      const detail = err.response?.data?.detail;
      if (detail?.errors && Array.isArray(detail.errors)) {
        toast.error(detail.errors.join(', '));
      } else {
        toast.error(detail || 'Failed to duplicate workflow');
      }
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/workflows/${name}`);
      toast.success(`Deleted: ${name}`);
      fetchWorkflows();
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  const handleViewJson = (name: string, data: any) => {
    setJsonDrawerName(name);
    setJsonDrawerData(data);
    setJsonDrawerOpen(true);
    setMenuOpen(null);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(jsonDrawerData, null, 2));
    toast.success('Copied to clipboard');
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(jsonDrawerData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jsonDrawerName}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded JSON');
  };

  // Filter and sort workflows
  const filteredWorkflows = useMemo(() => {
    let result = workflowNames
      .map(name => ({ name, data: workflowsData[name] }))
      .filter(({ name }) => name.toLowerCase().includes(searchQuery.toLowerCase()));

    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'created_desc':
        result.sort((a, b) => (b.data?.created_at || getWorkflowDate(b.name)).localeCompare(a.data?.created_at || getWorkflowDate(a.name)));
        break;
      case 'created_asc':
        result.sort((a, b) => (a.data?.created_at || getWorkflowDate(a.name)).localeCompare(b.data?.created_at || getWorkflowDate(b.name)));
        break;
      case 'updated_desc':
        result.sort((a, b) => (b.data?.updated_at || getWorkflowDate(b.name)).localeCompare(a.data?.updated_at || getWorkflowDate(a.name)));
        break;
      case 'updated_asc':
        result.sort((a, b) => (a.data?.updated_at || getWorkflowDate(a.name)).localeCompare(b.data?.updated_at || getWorkflowDate(b.name)));
        break;
      case 'steps_desc':
        result.sort((a, b) => (b.data?.steps?.length || 0) - (a.data?.steps?.length || 0));
        break;
      case 'steps_asc':
        result.sort((a, b) => (a.data?.steps?.length || 0) - (b.data?.steps?.length || 0));
        break;
    }
    return result;
  }, [workflowNames, workflowsData, searchQuery, sortBy]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const getWorkflowDate = (name: string) => {
    const timestamp = name.replace('workflow_', '');
    if (/^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp)).toISOString();
    }
    return new Date().toISOString();
  };

  const getJsonLineCount = (data: any) => {
    return JSON.stringify(data, null, 2).split('\n').length;
  };

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';

  if (canvasWorkflow !== null) {
    const wf = workflowsData[canvasWorkflow] || {};
    return (
      <WorkflowCanvas
        workflowName={canvasWorkflow}
        initialNodes={wf.canvas?.nodes}
        initialEdges={wf.canvas?.edges}
        initialGlobalPrompt={wf.global_prompt}
        initialGlobalVoiceProvider={wf.global_voice_provider}
        initialGlobalVoiceName={wf.global_voice_name}
        initialContext={wf.context}
        onSave={(data) => {
          const { steps, nodes, edges, globalPrompt, globalVoiceProvider, globalVoiceName, context, name: newName } = data as { steps: any[]; nodes: any[]; edges: any[]; globalPrompt?: string; globalVoiceProvider?: string; globalVoiceName?: string; context?: string; name?: string };
          if (newName && newName !== canvasWorkflow) {
            handleRenameWorkflow(canvasWorkflow, newName, { steps, canvas: { nodes, edges }, globalPrompt, globalVoiceProvider, globalVoiceName, context });
          } else {
            handleSaveCanvas({ steps, canvas: { nodes, edges }, globalPrompt, globalVoiceProvider, globalVoiceName, context }, canvasWorkflow);
          }
        }}
        onClose={() => setCanvasWorkflow(null)}
      />
    );
  }

  return (
    <div className="p-6">
      {/* Header / Utility Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Workflows</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visual conversation flows that control what the AI says and does
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Upload JSON Button */}
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" />
            Upload JSON
          </button>
          {/* Docs Button */}
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-sm font-medium transition-colors">
            <BookOpen className="w-4 h-4" />
            Docs
          </button>
          {/* Create Workflow Button - Primary */}
          <button
            onClick={() => {
              const name = `workflow_${Date.now()}`;
              setWorkflowsData((d: Record<string, any>) => ({ ...d, [name]: {} }));
              setCanvasWorkflow(name);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-primary w-64"
          />
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
            <Filter className="w-4 h-4" />
            Filter
          </button>
          {/* Sort Dropdown */}
          <div className="relative" ref={sortMenuRef}>
            <button
              onClick={() => setSortMenuOpen(!sortMenuOpen)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
            >
              <span>{currentSortLabel}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortMenuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-48 z-20">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 hover:bg-gray-800 transition-colors ${
                      sortBy === option.value ? 'text-primary' : 'text-gray-300'
                    }`}
                    onClick={() => {
                      setSortBy(option.value);
                      setSortMenuOpen(false);
                    }}
                  >
                    {option.icon}
                    <span className="flex-1">{option.label}</span>
                    {sortBy === option.value && (
                      <span className="text-primary">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2 text-gray-600 dark:text-gray-400">No workflows found</p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
            {searchQuery ? 'Try adjusting your search query' : 'Build visual conversation flows with a node-based canvas.'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => {
                const name = `workflow_${Date.now()}`;
                setWorkflowsData((d: Record<string, any>) => ({ ...d, [name]: {} }));
                setCanvasWorkflow(name);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Your First Workflow
            </button>
          )}
        </div>
      ) : (
        // Data Table
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg overflow-visible">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Name</th>
                <th className="text-center py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Step Count</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Created</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400">Updated</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-500 dark:text-gray-400 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkflows.map(({ name, data }) => (
                <tr
                  key={name}
                  className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer transition-colors"
                  onClick={() => setCanvasWorkflow(name)}
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center">
                        <WorkflowIcon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">{name}</div>
                        {data.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{data.description}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="text-gray-700 dark:text-gray-300 font-mono">{data.steps?.length || 0}</span>
                  </td>
                  <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm">
                    {formatDate(data.created_at || getWorkflowDate(name))}
                  </td>
                  <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm">
                    {formatDate(data.updated_at || getWorkflowDate(name))}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                      {/* JSON View Button */}
                      <button
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title="View JSON"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewJson(name, data);
                        }}
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      {/* More Actions Menu */}
                      <div className="relative">
                        <button
                          className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(menuOpen === name ? null : name);
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === name && (
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-40 z-50">
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center gap-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCanvasWorkflow(name);
                                setMenuOpen(null);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white flex items-center gap-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicate(name);
                              }}
                            >
                              <CopyIcon className="w-4 h-4" />
                              Duplicate
                            </button>
                            <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(name);
                                setMenuOpen(null);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Click outside to close menus */}
      {(menuOpen || jsonDrawerOpen) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => { setMenuOpen(null); setJsonDrawerOpen(false); }}
        />
      )}

      {/* JSON Modal - Centered */}
      {jsonDrawerOpen && jsonDrawerData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-lg shadow-lg w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-foreground">Workflow JSON</h2>
                  <p className="text-sm text-muted-foreground">{jsonDrawerName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadJson}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCopyJson}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  title="Copy to Clipboard"
                >
                  <CopyIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setJsonDrawerOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Code className="w-4 h-4" />
                <span>JSON Format</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {getJsonLineCount(jsonDrawerData)} lines
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-auto p-4 bg-muted/20">
              <JsonViewer data={jsonDrawerData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowsPage;
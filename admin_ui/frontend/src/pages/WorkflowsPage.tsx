import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, Search, Filter, Code, MoreVertical, Loader2, Workflow as WorkflowIcon } from 'lucide-react';
import WorkflowCanvas from '../components/WorkflowCanvas';

const WorkflowsPage = () => {
  const [workflowNames, setWorkflowNames] = useState([]);
  const [workflowsData, setWorkflowsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [canvasWorkflow, setCanvasWorkflow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'updated'>('recent');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => { fetchWorkflows(); }, []);

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

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/workflows/${name}`);
      toast.success(`Deleted: ${name}`);
      fetchWorkflows();
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  // Filter and sort workflows
  const filteredWorkflows = useMemo(() => {
    let result = workflowNames
      .map(name => ({ name, data: workflowsData[name] }))
      .filter(({ name }) => name.toLowerCase().includes(searchQuery.toLowerCase()));

    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'updated':
        result.sort((a, b) => (b.data?.updated_at || '').localeCompare(a.data?.updated_at || ''));
        break;
      case 'recent':
      default:
        result.sort((a, b) => (b.data?.created_at || '').localeCompare(a.data?.created_at || ''));
    }
    return result;
  }, [workflowNames, workflowsData, searchQuery, sortBy]);

  // Format date
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  // Get current date for created/updated (using workflow name timestamp for demo)
  const getWorkflowDate = (name: string) => {
    const timestamp = name.replace('workflow_', '');
    if (/^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp)).toISOString();
    }
    return new Date().toISOString();
  };

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
        <button
          onClick={() => {
            const name = `workflow_${Date.now()}`;
            setWorkflowsData((d: Record<string, any>) => ({ ...d, [name]: {} }));
            setCanvasWorkflow(name);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Workflow
        </button>
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-400 focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="recent">Recently Created</option>
            <option value="name">Name A-Z</option>
            <option value="updated">Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        // Empty State
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
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Your First Workflow
            </button>
          )}
        </div>
      ) : (
        // Data Table
        <div className="bg-white dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
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
                    {formatDate(getWorkflowDate(name))}
                  </td>
                  <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm">
                    {formatDate(data.updated_at || getWorkflowDate(name))}
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <button
                        className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                        title="View JSON"
                      >
                        <Code className="w-4 h-4" />
                      </button>
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
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 min-w-32 z-10">
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCanvasWorkflow(name);
                                setMenuOpen(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(name);
                                setMenuOpen(null);
                              }}
                            >
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

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
};

export default WorkflowsPage;
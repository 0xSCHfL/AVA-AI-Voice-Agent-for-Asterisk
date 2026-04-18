import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, Settings, ArrowRight, ChevronRight, Loader2, Workflow as WorkflowIcon } from 'lucide-react';
import WorkflowCanvas from '../components/WorkflowCanvas';

const NODE_TYPE_COLORS = {
  prompt:  'bg-blue-500/20 text-blue-400',
  collect: 'bg-purple-500/20 text-purple-400',
  action:  'bg-amber-500/20 text-amber-400',
  branch:  'bg-green-500/20 text-green-400',
};

const WorkflowsPage = () => {
  const [workflowNames, setWorkflowNames] = useState([]);
  const [workflowsData, setWorkflowsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [canvasWorkflow, setCanvasWorkflow] = useState<string | null>(null);

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

  const handleSaveCanvas = async ({ steps, _canvas }: { steps: any[]; _canvas: { nodes: any[]; edges: any[] } }, name: string) => {
    const wf = {
      name,
      description: workflowsData[name]?.description || '',
      version: workflowsData[name]?.version || '1.0',
      variables: workflowsData[name]?.variables || {},
      steps,
      _canvas,
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

  const handleDelete = async (name: string) => {
    try {
      await axios.delete(`/api/workflows/${name}`);
      toast.success(`Deleted: ${name}`);
      fetchWorkflows();
    } catch {
      toast.error('Failed to delete workflow');
    }
  };

  if (canvasWorkflow !== null) {
    const wf = workflowsData[canvasWorkflow] || {};
    return (
      <WorkflowCanvas
        workflowName={canvasWorkflow}
        initialNodes={wf._canvas?.nodes}
        initialEdges={wf._canvas?.edges}
        onSave={(data) => {
          const { steps, nodes, edges } = data as { steps: any[]; nodes: any[]; edges: any[] };
          handleSaveCanvas({ steps, _canvas: { nodes, edges } }, canvasWorkflow);
        }}
        onClose={() => setCanvasWorkflow(null)}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Workflows</h1>
          <p className="text-sm text-gray-400 mt-1">
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : workflowNames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <WorkflowIcon className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2">No workflows yet</p>
          <p className="text-sm text-gray-500 mb-6">
            Build visual conversation flows with a node-based canvas.
          </p>
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflowNames.map(name => {
            const wf = workflowsData[name] || {};
            return (
              <div
                key={name}
                className="group bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-all overflow-hidden cursor-pointer"
                onClick={() => setCanvasWorkflow(name)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white font-mono">{name}</h3>
                      {wf.description && (
                        <p className="text-xs text-gray-400 mt-1">{wf.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setCanvasWorkflow(name)} className="p-2 text-gray-400 hover:text-white transition-colors" title="Edit">
                        <Settings className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(name)} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      {wf.steps?.length || 0} steps
                    </span>
                    <span>v{wf.version || '1.0'}</span>
                  </div>
                </div>
                {(wf.steps || []).length > 0 && (
                  <div className="border-t border-gray-700/50 px-4 py-3 bg-gray-900/30">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {(wf.steps || []).slice(0, 6).map((s: any, i: number) => (
                        <React.Fragment key={s.id || i}>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${NODE_TYPE_COLORS[s.type] || 'bg-gray-700 text-gray-400'}`}>
                            {s.id}
                          </span>
                          {i < Math.min((wf.steps || []).length, 6) - 1 && (
                            <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                      {(wf.steps || []).length > 6 && (
                        <span className="text-xs text-gray-500">+{(wf.steps || []).length - 6} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkflowsPage;
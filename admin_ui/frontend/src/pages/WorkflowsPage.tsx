import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
    Plus, Trash2, Copy, Settings, X, Check, ChevronRight,
    ArrowRight, MessageSquare, GitBranch, Zap, Play, Loader2,
    AlertCircle, Save, Workflow as WorkflowIcon
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { FormInput, FormLabel, FormTextarea, FormSelect } from '../components/ui/FormComponents';
import { ConfigSection } from '../components/ui/ConfigSection';
import { ConfigCard } from '../components/ui/ConfigCard';

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkflowStep = {
    id: string;
    type: 'prompt' | 'collect' | 'action' | 'branch';
    description?: string;
    prompt?: string;
    entity?: string;
    tool?: string;
    parameters?: Record<string, any>;
    conditions?: Array<{ if: string; goto: string }>;
    default?: string;
    next?: string;
    validation?: {
        pattern?: string;
        max_attempts?: number;
        retry_prompt?: string;
    };
    actions?: Array<{ tool: string; parameters?: Record<string, any> }>;
    continue_on_failure?: boolean;
    failure_default?: string;
};

type WorkflowForm = {
    name: string;
    description: string;
    version: string;
    variables: Record<string, string>;
    steps: WorkflowStep[];
};

type ValidationError = {
    valid: boolean;
    errors: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_TYPE_OPTIONS = [
    { value: 'prompt', label: 'Prompt', description: 'Speak text and wait for user response' },
    { value: 'collect', label: 'Collect', description: 'Extract a named entity from user speech' },
    { value: 'action', label: 'Action', description: 'Execute a tool and route based on result' },
    { value: 'branch', label: 'Branch', description: 'Evaluate conditions to determine next step' },
];

const STEP_TYPE_ICONS: Record<string, React.ReactNode> = {
    prompt: <MessageSquare className="w-4 h-4" />,
    collect: <ArrowRight className="w-4 h-4" />,
    action: <Zap className="w-4 h-4" />,
    branch: <GitBranch className="w-4 h-4" />,
};

// ─── Helper components ────────────────────────────────────────────────────────

const StepTypeBadge = ({ type }: { type: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
        type === 'prompt' ? 'bg-blue-500/20 text-blue-400' :
        type === 'collect' ? 'bg-purple-500/20 text-purple-400' :
        type === 'action' ? 'bg-amber-500/20 text-amber-400' :
        'bg-green-500/20 text-green-400'
    }`}>
        {STEP_TYPE_ICONS[type]}
        {type}
    </span>
);

const WorkflowFormModal = ({
    isOpen,
    onClose,
    form,
    setForm,
    onSave,
    isNew,
    validating,
    validationErrors,
}: {
    isOpen: boolean;
    onClose: () => void;
    form: WorkflowForm;
    setForm: (f: WorkflowForm) => void;
    onSave: () => void;
    isNew: boolean;
    validating: boolean;
    validationErrors: string[];
}) => {
        const updateStep = (index: number, updates: Partial<WorkflowStep>) => {
            const newSteps = [...form.steps];
            newSteps[index] = { ...newSteps[index], ...updates };
            setForm({ ...form, steps: newSteps });
        };

        const addStep = (type: WorkflowStep['type']) => {
            const id = `step_${form.steps.length + 1}`;
            const newStep: WorkflowStep = {
                id,
                type,
                description: '',
                prompt: '',
                next: undefined,
            };
            if (type === 'collect') {
                newStep.entity = '';
                newStep.validation = { pattern: '', max_attempts: 3, retry_prompt: '' };
            }
            if (type === 'action') {
                newStep.tool = '';
                newStep.parameters = {};
                newStep.continue_on_failure = false;
            }
            if (type === 'branch') {
                newStep.conditions = [];
                newStep.default = '';
            }
            setForm({ ...form, steps: [...form.steps, newStep] });
        };

        const removeStep = (index: number) => {
            const newSteps = form.steps.filter((_, i) => i !== index);
            setForm({ ...form, steps: newSteps });
        };

        const moveStep = (index: number, direction: 'up' | 'down') => {
            const newSteps = [...form.steps];
            const targetIndex = direction === 'up' ? index - 1 : index + 1;
            if (targetIndex < 0 || targetIndex >= newSteps.length) return;
            [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
            setForm({ ...form, steps: newSteps });
        };

        const updateCondition = (stepIndex: number, condIndex: number, updates: Partial<{ if: string; goto: string }>) => {
            const step = { ...form.steps[stepIndex] };
            const conditions = [...(step.conditions || [])];
            conditions[condIndex] = { ...conditions[condIndex], ...updates };
            step.conditions = conditions;
            const newSteps = [...form.steps];
            newSteps[stepIndex] = step;
            setForm({ ...form, steps: newSteps });
        };

        const addCondition = (stepIndex: number) => {
            const step = { ...form.steps[stepIndex] };
            const conditions = [...(step.conditions || []), { if: '', goto: '' }];
            step.conditions = conditions;
            const newSteps = [...form.steps];
            newSteps[stepIndex] = step;
            setForm({ ...form, steps: newSteps });
        };

        const removeCondition = (stepIndex: number, condIndex: number) => {
            const step = { ...form.steps[stepIndex] };
            const conditions = (step.conditions || []).filter((_, i) => i !== condIndex);
            step.conditions = conditions;
            const newSteps = [...form.steps];
            newSteps[stepIndex] = step;
            setForm({ ...form, steps: newSteps });
        };

        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isNew ? 'New Workflow' : `Edit: ${form.name}`}
                size="full"
                footer={
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            {validationErrors.length > 0 && (
                                <span className="text-red-400 text-sm flex items-center gap-1">
                                    <AlertCircle className="w-4 h-4" />
                                    {validationErrors.length} validation error(s)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onSave}
                                disabled={validating}
                                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Workflow
                            </button>
                        </div>
                    </div>
                }
            >
                <div className="flex flex-col lg:flex-row gap-6 min-h-0" style={{ maxHeight: 'calc(90vh - 140px)' }}>
                    {/* Left panel: workflow metadata + step list */}
                    <div className="w-full lg:w-80 flex flex-col gap-4 overflow-y-auto">
                        <div className="space-y-4">
                            <div>
                                <FormLabel>Workflow Name</FormLabel>
                                <FormInput
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g. appointment_booking"
                                    disabled={!isNew}
                                />
                            </div>
                            <div>
                                <FormLabel>Description</FormLabel>
                                <FormInput
                                    value={form.description}
                                    onChange={e => setForm({ ...form, description: e.target.value })}
                                    placeholder="What this workflow does"
                                />
                            </div>
                            <div>
                                <FormLabel>Version</FormLabel>
                                <FormInput
                                    value={form.version}
                                    onChange={e => setForm({ ...form, version: e.target.value })}
                                    placeholder="1.0"
                                />
                            </div>
                            <div>
                                <FormLabel>Variables (default values)</FormLabel>
                                <div className="space-y-2">
                                    {Object.entries(form.variables).map(([key, value]) => (
                                        <div key={key} className="flex gap-2">
                                            <FormInput
                                                value={key}
                                                onChange={e => {
                                                    const newVars = { ...form.variables };
                                                    delete newVars[key];
                                                    newVars[e.target.value] = value;
                                                    setForm({ ...form, variables: newVars });
                                                }}
                                                placeholder="variable_name"
                                                className="flex-1"
                                            />
                                            <FormInput
                                                value={value}
                                                onChange={ev => setForm({ ...form, variables: { ...form.variables, [key]: ev.target.value } })}
                                                placeholder="default value"
                                                className="flex-1"
                                            />
                                            <button
                                                onClick={() => {
                                                    const newVars = { ...form.variables };
                                                    delete newVars[key];
                                                    setForm({ ...form, variables: newVars });
                                                }}
                                                className="text-gray-400 hover:text-red-400 p-2"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => setForm({ ...form, variables: { ...form.variables, ['']: '' } })}
                                        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Variable
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Steps list */}
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex items-center justify-between mb-3">
                                <FormLabel className="mb-0">Steps ({form.steps.length})</FormLabel>
                                <div className="relative group">
                                    <button className="flex items-center gap-1 px-2 py-1 bg-primary/20 hover:bg-primary/30 text-primary rounded text-xs">
                                        <Plus className="w-3 h-3" /> Add Step
                                    </button>
                                    <div className="hidden group-hover:flex absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-xl z-10 flex-col min-w-40">
                                        {STEP_TYPE_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => addStep(opt.value as WorkflowStep['type'])}
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-700 whitespace-nowrap"
                                            >
                                                {STEP_TYPE_ICONS[opt.value]}
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {form.steps.map((step, index) => (
                                    <div key={step.id} className="group bg-gray-800/50 border border-gray-700 rounded p-3 hover:border-gray-600 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-gray-500 font-mono">{index + 1}.</span>
                                                <FormInput
                                                    value={step.id}
                                                    onChange={e => updateStep(index, { id: e.target.value })}
                                                    placeholder="step_id"
                                                    className="text-sm font-mono w-28 py-1"
                                                />
                                                <StepTypeBadge type={step.type} />
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => moveStep(index, 'up')} disabled={index === 0} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                                                    <ArrowRight className="w-3 h-3 rotate-[-90deg]" />
                                                </button>
                                                <button onClick={() => moveStep(index, 'down')} disabled={index === form.steps.length - 1} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
                                                    <ArrowRight className="w-3 h-3 rotate-[90deg]" />
                                                </button>
                                                <button onClick={() => removeStep(index)} className="p-1 text-gray-400 hover:text-red-400">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                        {step.description && (
                                            <p className="text-xs text-gray-400 mb-2">{step.description}</p>
                                        )}
                                        <div className="text-xs text-gray-500">
                                            {step.type === 'prompt' && step.prompt && (
                                                <span className="truncate block max-w-48">"{step.prompt.slice(0, 40)}{step.prompt.length > 40 ? '...' : ''}"</span>
                                            )}
                                            {step.type === 'collect' && step.entity && (
                                                <span>collect: {step.entity}</span>
                                            )}
                                            {step.type === 'action' && step.tool && (
                                                <span>tool: {step.tool}</span>
                                            )}
                                            {step.type === 'branch' && (
                                                <span>{step.conditions?.length || 0} conditions</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {form.steps.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No steps yet. Click "Add Step" to start building your workflow.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right panel: step editor */}
                    <div className="flex-1 overflow-y-auto border-t lg:border-t-0 lg:border-l border-gray-700 pt-4 lg:pt-0 lg:pl-6">
                        {form.steps.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <WorkflowIcon className="w-12 h-12 mb-4 opacity-30" />
                                <p className="text-sm">Select a step to edit its configuration</p>
                            </div>
                        ) : (
                            <StepEditor
                                step={form.steps[form.steps.length - 1]}
                                stepIndex={form.steps.length - 1}
                                allSteps={form.steps}
                                updateStep={updateStep}
                                updateCondition={updateCondition}
                                addCondition={addCondition}
                                removeCondition={removeCondition}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        );
    }

const StepEditor = ({
    step,
    stepIndex,
    allSteps,
    updateStep,
    updateCondition,
    addCondition,
    removeCondition,
}: {
    step: WorkflowStep;
    stepIndex: number;
    allSteps: WorkflowStep[];
    updateStep: (index: number, updates: Partial<WorkflowStep>) => void;
    updateCondition: (stepIndex: number, condIndex: number, updates: Partial<{ if: string; goto: string }>) => void;
    addCondition: (stepIndex: number) => void;
    removeCondition: (stepIndex: number, condIndex: number) => void;
}) => {
    const stepTypes = allSteps.map(s => s.id);
    const otherStepIds = stepTypes.filter(id => id !== step.id);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <FormInput
                    value={step.id}
                    onChange={e => updateStep(stepIndex, { id: e.target.value })}
                    placeholder="step_id"
                    className="font-mono w-40"
                />
                <span className="text-gray-400 text-sm">Step #{stepIndex + 1}</span>
                <StepTypeBadge type={step.type} />
            </div>

            <div>
                <FormLabel>Description (optional)</FormLabel>
                <FormInput
                    value={step.description || ''}
                    onChange={e => updateStep(stepIndex, { description: e.target.value })}
                    placeholder="What this step does"
                />
            </div>

            {/* Prompt / Collect / Action / Branch fields */}
            {step.type === 'prompt' && (
                <div>
                    <FormLabel>Prompt Text</FormLabel>
                    <FormTextarea
                        value={step.prompt || ''}
                        onChange={e => updateStep(stepIndex, { prompt: e.target.value })}
                        placeholder="What the AI should say to the user. Supports {{variable}} substitution."
                        rows={4}
                    />
                    <p className="text-xs text-gray-500 mt-1">Use {"{{variable_name}}"} for variable substitution</p>
                </div>
            )}

            {step.type === 'collect' && (
                <>
                    <div>
                        <FormLabel>Prompt Text</FormLabel>
                        <FormTextarea
                            value={step.prompt || ''}
                            onChange={e => updateStep(stepIndex, { prompt: e.target.value })}
                            placeholder="What to ask the user"
                            rows={3}
                        />
                    </div>
                    <div>
                        <FormLabel>Entity Name</FormLabel>
                        <FormInput
                            value={step.entity || ''}
                            onChange={e => updateStep(stepIndex, { entity: e.target.value })}
                            placeholder="e.g. customer_name, policy_number"
                        />
                        <p className="text-xs text-gray-500 mt-1">The variable name to store the extracted value in</p>
                    </div>
                    {step.validation && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FormLabel>Pattern (regex, optional)</FormLabel>
                                    <FormInput
                                        value={step.validation.pattern || ''}
                                        onChange={e => updateStep(stepIndex, {
                                            validation: { ...step.validation!, pattern: e.target.value }
                                        })}
                                        placeholder="^[A-Z]{2}[0-9]{8}$"
                                    />
                                </div>
                                <div>
                                    <FormLabel>Max Attempts</FormLabel>
                                    <FormInput
                                        type="number"
                                        value={step.validation.max_attempts || 3}
                                        onChange={e => updateStep(stepIndex, {
                                            validation: { ...step.validation!, max_attempts: parseInt(e.target.value) || 3 }
                                        })}
                                        min={1}
                                        max={10}
                                    />
                                </div>
                            </div>
                            <div>
                                <FormLabel>Retry Prompt</FormLabel>
                                <FormInput
                                    value={step.validation.retry_prompt || ''}
                                    onChange={e => updateStep(stepIndex, {
                                        validation: { ...step.validation!, retry_prompt: e.target.value }
                                    })}
                                    placeholder="I didn't understand. Please try again."
                                />
                            </div>
                        </>
                    )}
                </>
            )}

            {step.type === 'action' && (
                <>
                    <div>
                        <FormLabel>Tool Name</FormLabel>
                        <FormInput
                            value={step.tool || ''}
                            onChange={e => updateStep(stepIndex, { tool: e.target.value })}
                            placeholder="e.g. blind_transfer, hangup_call, log_claim_intent"
                        />
                    </div>
                    <div>
                        <FormLabel>Parameters</FormLabel>
                        <div className="space-y-2">
                            {Object.entries(step.parameters || {}).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                    <FormInput
                                        value={key}
                                        onChange={e => {
                                            const newParams = { ...step.parameters };
                                            delete newParams[key];
                                            newParams[e.target.value] = value;
                                            updateStep(stepIndex, { parameters: newParams });
                                        }}
                                        placeholder="parameter_name"
                                        className="flex-1"
                                    />
                                    <FormInput
                                        value={String(value)}
                                        onChange={e => updateStep(stepIndex, { parameters: { ...step.parameters!, [key]: e.target.value } })}
                                        placeholder="{{variable}} or value"
                                        className="flex-1"
                                    />
                                    <button
                                        onClick={() => {
                                            const newParams = { ...step.parameters };
                                            delete newParams[key];
                                            updateStep(stepIndex, { parameters: newParams });
                                        }}
                                        className="text-gray-400 hover:text-red-400 p-2"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <button
                                onClick={() => updateStep(stepIndex, { parameters: { ...step.parameters!, ['']: '' } })}
                                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                                <Plus className="w-3 h-3" /> Add Parameter
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <FormLabel>Continue on Failure</FormLabel>
                            <label className="flex items-center gap-2 mt-1">
                                <input
                                    type="checkbox"
                                    checked={step.continue_on_failure || false}
                                    onChange={e => updateStep(stepIndex, { continue_on_failure: e.target.checked })}
                                    className="rounded"
                                />
                                <span className="text-sm text-gray-400">Continue if tool fails</span>
                            </label>
                        </div>
                        {step.continue_on_failure && (
                            <div>
                                <FormLabel>Failure Default (goto step)</FormLabel>
                                <FormSelect
                                    value={step.failure_default || ''}
                                    onChange={e => updateStep(stepIndex, { failure_default: e.target.value })}
                                >
                                    <option value="">-- none --</option>
                                    {otherStepIds.map(id => (
                                        <option key={id} value={id}>{id}</option>
                                    ))}
                                </FormSelect>
                            </div>
                        )}
                    </div>
                </>
            )}

            {step.type === 'branch' && (
                <>
                    <div>
                        <FormLabel>Conditions</FormLabel>
                        <div className="space-y-3">
                            {(step.conditions || []).map((cond, ci) => (
                                <div key={ci} className="flex items-start gap-2 bg-gray-800/50 p-3 rounded">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                                            <span>IF</span>
                                        </div>
                                        <FormInput
                                            value={cond.if}
                                            onChange={e => updateCondition(stepIndex, ci, { if: e.target.value })}
                                            placeholder="{{claim_type}} == 'claim'"
                                            className="text-sm font-mono"
                                        />
                                        <div className="flex items-center gap-2 text-xs text-gray-400">
                                            <span>GOTO</span>
                                        </div>
                                        <FormSelect
                                            value={cond.goto}
                                            onChange={e => updateCondition(stepIndex, ci, { goto: e.target.value })}
                                        >
                                            <option value="">-- select target --</option>
                                            {otherStepIds.map(id => (
                                                <option key={id} value={id}>{id}</option>
                                            ))}
                                        </FormSelect>
                                    </div>
                                    <button
                                        onClick={() => removeCondition(stepIndex, ci)}
                                        className="text-gray-400 hover:text-red-400 mt-6"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => addCondition(stepIndex)}
                                    className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                                >
                                    <Plus className="w-3 h-3" /> Add Condition
                                </button>
                                {otherStepIds.length > 0 && !step.conditions?.length && (
                                    <span className="text-xs text-gray-500">or set a Default below</span>
                                )}
                            </div>
                        </div>
                    </div>
                    {otherStepIds.length > 0 && (
                        <div>
                            <FormLabel>Default (if no conditions match)</FormLabel>
                            <FormSelect
                                value={step.default || ''}
                                onChange={e => updateStep(stepIndex, { default: e.target.value })}
                            >
                                <option value="">-- fall through to next step --</option>
                                {otherStepIds.map(id => (
                                    <option key={id} value={id}>{id}</option>
                                ))}
                            </FormSelect>
                        </div>
                    )}
                </>
            )}

            {/* Universal fields */}
            {step.type !== 'branch' && otherStepIds.length > 0 && (
                <div>
                    <FormLabel>Next Step (fallthrough, optional)</FormLabel>
                    <FormSelect
                        value={step.next || ''}
                        onChange={e => updateStep(stepIndex, { next: e.target.value || undefined })}
                    >
                        <option value="">-- next in sequence --</option>
                        {otherStepIds.map(id => (
                            <option key={id} value={id}>{id}</option>
                        ))}
                    </FormSelect>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const WorkflowsPage = () => {
    const [workflowNames, setWorkflowNames] = useState<string[]>([]);
    const [workflowsData, setWorkflowsData] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingWorkflow, setEditingWorkflow] = useState<string | null>(null);
    const [isNewWorkflow, setIsNewWorkflow] = useState(false);
    const [form, setForm] = useState<WorkflowForm>({
        name: '',
        description: '',
        version: '1.0',
        variables: {},
        steps: [],
    });
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            const res = await axios.get('/api/workflows');
            setWorkflowNames(res.data.workflows || []);

            // Fetch full data for each workflow
            const data: Record<string, any> = {};
            for (const name of (res.data.workflows || [])) {
                try {
                    const detailRes = await axios.get(`/api/workflows/${name}`);
                    data[name] = detailRes.data;
                } catch {
                    // workflow may have been deleted
                }
            }
            setWorkflowsData(data);
        } catch (err) {
            console.error('Failed to fetch workflows', err);
            toast.error('Failed to load workflows');
        } finally {
            setLoading(false);
        }
    };

    const openNewWorkflow = () => {
        setForm({
            name: '',
            description: '',
            version: '1.0',
            variables: {},
            steps: [],
        });
        setValidationErrors([]);
        setIsNewWorkflow(true);
        setEditingWorkflow('__new__');
    };

    const openEditWorkflow = async (name: string) => {
        try {
            const res = await axios.get(`/api/workflows/${name}`);
            setForm({
                name: res.data.name || name,
                description: res.data.description || '',
                version: res.data.version || '1.0',
                variables: res.data.variables || {},
                steps: res.data.steps || [],
            });
            setValidationErrors([]);
            setIsNewWorkflow(false);
            setEditingWorkflow(name);
        } catch (err) {
            toast.error(`Failed to load workflow: ${name}`);
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Workflow name is required');
            return;
        }

        setSaving(true);
        setValidationErrors([]);

        try {
            // Validate first
            const validateRes = await axios.post(`/api/workflows/${form.name}/validate`, form);
            if (!validateRes.data.valid) {
                setValidationErrors(validateRes.data.errors || []);
                setSaving(false);
                return;
            }

            // Save
            await axios.put(`/api/workflows/${form.name}`, form);
            toast.success(isNewWorkflow ? 'Workflow created!' : 'Workflow saved!');
            setEditingWorkflow(null);
            setIsNewWorkflow(false);
            fetchWorkflows();
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (detail?.errors) {
                setValidationErrors(detail.errors);
            } else {
                toast.error(detail || 'Failed to save workflow');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (name: string) => {
        try {
            await axios.delete(`/api/workflows/${name}`);
            toast.success(`Deleted: ${name}`);
            fetchWorkflows();
        } catch (err) {
            toast.error('Failed to delete workflow');
        }
    };

    const handleDuplicate = async (name: string) => {
        const wf = workflowsData[name];
        if (!wf) return;
        const newName = `${name}_copy`;
        setForm({
            name: newName,
            description: wf.description || '',
            version: wf.version || '1.0',
            variables: wf.variables || {},
            steps: JSON.parse(JSON.stringify(wf.steps || [])),
        });
        setValidationErrors([]);
        setIsNewWorkflow(true);
        setEditingWorkflow('__new__');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Workflows</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Structured conversation flows that control what the AI says and does
                    </p>
                </div>
                <button
                    onClick={openNewWorkflow}
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
                        Workflows let you create structured conversation flows with steps, transitions, and actions.
                    </p>
                    <button
                        onClick={openNewWorkflow}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded text-sm font-medium transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Create Your First Workflow
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {workflowNames.map(name => {
                        const wf = workflowsData[name] || {};
                        return (
                            <div
                                key={name}
                                className="group bg-gray-800/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-all overflow-hidden"
                            >
                                <div className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold text-white font-mono">{name}</h3>
                                            {wf.description && (
                                                <p className="text-xs text-gray-400 mt-1">{wf.description}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openEditWorkflow(name)}
                                                className="p-2 text-gray-400 hover:text-white transition-colors"
                                                title="Edit"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicate(name)}
                                                className="p-2 text-gray-400 hover:text-white transition-colors"
                                                title="Duplicate"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(name)}
                                                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                                title="Delete"
                                            >
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
                                {/* Mini step preview */}
                                {(wf.steps || []).length > 0 && (
                                    <div className="border-t border-gray-700/50 px-4 py-3 bg-gray-900/30">
                                        <div className="flex items-center gap-1 overflow-hidden">
                                            {(wf.steps || []).slice(0, 6).map((s: any, i: number) => (
                                                <React.Fragment key={s.id || i}>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                                                        s.type === 'prompt' ? 'bg-blue-500/20 text-blue-400' :
                                                        s.type === 'collect' ? 'bg-purple-500/20 text-purple-400' :
                                                        s.type === 'action' ? 'bg-amber-500/20 text-amber-400' :
                                                        'bg-green-500/20 text-green-400'
                                                    }`}>
                                                        {s.id}
                                                    </span>
                                                    {i < Math.min(wf.steps.length, 6) - 1 && (
                                                        <ChevronRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
                                                    )}
                                                </React.Fragment>
                                            ))}
                                            {(wf.steps || []).length > 6 && (
                                                <span className="text-xs text-gray-500">+{wf.steps.length - 6} more</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit / Create modal */}
            {(editingWorkflow !== null) && (
                <WorkflowFormModal
                    isOpen={true}
                    onClose={() => { setEditingWorkflow(null); setIsNewWorkflow(false); }}
                    form={form}
                    setForm={setForm}
                    onSave={handleSave}
                    isNew={isNewWorkflow}
                    validating={saving}
                    validationErrors={validationErrors}
                />
            )}
        </div>
    );
};

export default WorkflowsPage;

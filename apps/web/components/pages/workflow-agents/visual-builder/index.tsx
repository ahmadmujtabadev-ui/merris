'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { api, type ReActExecution } from '@/lib/api';
import { useEngagementStore } from '@/lib/store';
import { ReActResultsPanel } from '../react-results-panel';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeTypes } from './nodes';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import {
  makeNode,
  INITIAL_NODES,
  INITIAL_EDGES,
  type FlowNodeType,
} from './flow-utils';

interface VisualBuilderProps {
  agentName?: string;
  templateId?: string;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}

const PRIMARY = '#0b5142';

export function VisualBuilder({ agentName = 'Untitled Agent', templateId, initialNodes, initialEdges }: VisualBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes ?? INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges ?? INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [name, setName] = useState(agentName);
  const [currentTemplateId, setCurrentTemplateId] = useState(templateId);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [runState, setRunState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [runMessage, setRunMessage] = useState('');
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const runTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [completedExecution, setCompletedExecution] = useState<ReActExecution | null>(null);
  const [showResults, setShowResults] = useState(false);
  const currentEngagement = useEngagementStore((s) => s.currentEngagement);

  useEffect(() => { setName(agentName); }, [agentName]);

  useEffect(() => {
    if (runState === 'running') {
      setElapsedSecs(0);
      runTimerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);
    } else {
      if (runTimerRef.current) clearInterval(runTimerRef.current);
    }
    return () => { if (runTimerRef.current) clearInterval(runTimerRef.current); };
  }, [runState]);

  useEffect(() => {
    if (initialNodes) setNodes(initialNodes);
    if (initialEdges) setEdges(initialEdges);
    if (templateId) setCurrentTemplateId(templateId);
  }, [initialNodes, initialEdges, templateId, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep', animated: false }, eds)),
    [setEdges],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data } : n)),
    );
    setSelectedNode((prev) => (prev?.id === nodeId ? { ...prev, data } : prev));
  }, [setNodes]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  const handleAddNode = useCallback((type: FlowNodeType, label?: string) => {
    const position = { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 };
    const node = makeNode(type, position);
    if (label) node.data = { ...node.data, label };
    setNodes((nds) => [...nds, node]);
  }, [setNodes]);

  // Drag-and-drop from palette onto canvas
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type  = e.dataTransfer.getData('application/merris-node-type') as FlowNodeType;
      const label = e.dataTransfer.getData('application/merris-node-label');
      if (!type || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = {
        x: e.clientX - bounds.left - 95,
        y: e.clientY - bounds.top - 40,
      };
      const node = makeNode(type, position);
      if (label) node.data = { ...node.data, label };
      setNodes((nds) => [...nds, node]);
    },
    [setNodes],
  );

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaveState('saving');
    try {
      // Convert visual nodes to workflow steps
      const steps = nodes
        .filter((n) => n.type !== 'trigger' && n.type !== 'output')
        .map((n) => {
          const d = n.data as Record<string, unknown>;
          const toolMap: Record<string, string> = {
            'kb-search':  'search_knowledge',
            'llm-reason': 'generate_text',
            'tool-call':  'generate_text',
            condition:    'verify_compliance',
            transform:    'perceive_document',
          };
          return {
            id: n.id,
            name: String(d.label ?? n.type),
            description: String(d.prompt ?? d.operation ?? d.tool ?? ''),
            tool: toolMap[n.type ?? ''] ?? 'generate_text',
            inputs: {},
          };
        });
      const saved = await api.saveWorkflowTemplate({
        ...(currentTemplateId ? { id: currentTemplateId } : {}),
        name: name.trim(),
        description: `Visual workflow with ${nodes.length} nodes`,
        category: 'Custom',
        steps,
        graph: { nodes, edges },
      });
      setCurrentTemplateId(saved.id);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  const handleRun = async () => {
    if (!currentEngagement) {
      setRunMessage('Select an engagement from the top bar first.');
      setRunState('error');
      return;
    }
    setRunState('running');
    setRunMessage('Saving and launching ReAct agent…');
    try {
      const steps = nodes
        .filter((n) => n.type !== 'trigger' && n.type !== 'output')
        .map((n) => {
          const d = n.data as Record<string, unknown>;
          const toolMap: Record<string, string> = {
            'kb-search':  'search_knowledge',
            'llm-reason': 'generate_text',
            'tool-call':  'generate_text',
            condition:    'verify_compliance',
            transform:    'perceive_document',
          };
          return {
            id: n.id,
            name: String(d.label ?? n.type),
            description: String(d.prompt ?? d.operation ?? d.tool ?? ''),
            tool: toolMap[n.type ?? ''] ?? 'generate_text',
            inputs: {},
          };
        });
      const saved = await api.saveWorkflowTemplate({ ...(currentTemplateId ? { id: currentTemplateId } : {}), name: name.trim(), description: `Visual workflow — ${nodes.length} nodes`, category: 'Custom', steps, graph: { nodes, edges } });
      const execution = await api.runReActAgent(saved.id, currentEngagement.id, {});
      setRunState('done');
      setRunMessage(`Completed · ${execution.iterations} iteration${execution.iterations !== 1 ? 's' : ''} · ${execution.steps.length} steps`);
      setCompletedExecution(execution);
      setShowResults(true);
    } catch (err) {
      setRunState('error');
      setRunMessage(err instanceof Error ? err.message : 'ReAct execution failed');
    }
  };

  const handleClearCanvas = () => {
    if (window.confirm('Clear all nodes? This cannot be undone.')) {
      setNodes([]);
      setEdges([]);
      setSelectedNode(null);
    }
  };

  const isValid = nodes.some((n) => n.type === 'trigger') && nodes.some((n) => n.type === 'output') && nodes.length >= 2;

  return (
    <>
    {showResults && completedExecution && (
      <ReActResultsPanel execution={completedExecution} onClose={() => setShowResults(false)} />
    )}
    <div className="flex h-[calc(100vh-200px)] min-h-[560px] overflow-hidden rounded-xl bg-gray-50" style={{ border: '1px solid #e8eae8' }}>
      {/* Left palette */}
      <NodePalette onAddNode={handleAddNode} />

      {/* Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ── RUNNING state toolbar ── */}
        {runState === 'running' ? (
          <div className="flex items-center gap-3 border-b bg-white px-4 py-2.5" style={{ borderColor: '#e8eae8' }}>
            {/* Running icon */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: '#d9770618' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#d97706" stroke="none">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
            <span className="font-display text-[12px] font-bold text-gray-800">Running agent…</span>

            {/* Progress bar */}
            <style>{`@keyframes merris-slide{0%{transform:translateX(-200%)}100%{transform:translateX(500%)}}`}</style>
            <div className="flex-1 overflow-hidden rounded-full" style={{ height: 6, background: '#f0f0ed' }}>
              <div
                className="h-full rounded-full"
                style={{ width: '30%', background: PRIMARY, animation: 'merris-slide 1.4s ease-in-out infinite' }}
              />
            </div>

            {/* Elapsed */}
            <span className="font-mono text-[11px] font-semibold" style={{ color: '#9aa0a6' }}>
              {elapsedSecs}s
            </span>

            {/* Cancel */}
            <button
              type="button"
              onClick={() => { setRunState('idle'); setRunMessage(''); }}
              className="rounded-lg px-3 py-1.5 font-body text-[11px] font-semibold transition-colors hover:bg-gray-100"
              style={{ background: '#f5f5f0', color: '#374151' }}
            >
              CANCEL
            </button>
          </div>
        ) : (
        /* ── IDLE / DONE / ERROR toolbar ── */
        <div className="flex items-center gap-2.5 border-b bg-white px-4 py-2" style={{ borderColor: '#e8eae8' }}>
          {/* Agent name + pencil */}
          <div className="flex items-center gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-44 bg-transparent font-display text-[13px] font-bold text-gray-800 outline-none placeholder:text-gray-300"
              placeholder="Untitled Agent…"
            />
            <button type="button" className="shrink-0 rounded p-1 hover:bg-gray-100">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="h-4 w-px shrink-0" style={{ background: '#e8eae8' }} />

          {/* Metadata pills */}
          <div className="flex items-center gap-1 font-mono text-[9px] font-bold" style={{ color: '#c4cac4' }}>
            <span className="rounded px-1.5 py-0.5" style={{ background: '#f5f5f0' }}>{nodes.length}n</span>
            <span style={{ color: '#e0e2e0' }}>·</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: '#f5f5f0' }}>{edges.length}e</span>
            <span style={{ color: '#e0e2e0' }}>·</span>
            <span className="rounded px-1.5 py-0.5" style={{ background: '#f5f5f0' }}>
              {saveState === 'saved' ? 'saved' : 'unsaved'}
            </span>
            <span style={{ color: '#e0e2e0' }}>·</span>
            <span
              className="flex items-center gap-1 rounded px-1.5 py-0.5"
              style={{ background: isValid ? '#f0fdf4' : '#f5f5f0', color: isValid ? '#16a34a' : '#c4cac4' }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: isValid ? '#16a34a' : '#d1d5db' }} />
              {isValid ? 'VALID' : 'INCOMPLETE'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Results button when done */}
          {runState === 'done' && completedExecution && (
            <button
              type="button"
              onClick={() => setShowResults(true)}
              className="rounded-lg px-3 py-2 font-body text-[11px] font-semibold transition-colors hover:bg-green-50"
              style={{ border: '1px solid #16a34a', color: '#16a34a' }}
            >
              View Results →
            </button>
          )}

          {/* Error strip */}
          {runState === 'error' && (
            <span className="max-w-[200px] truncate font-body text-[11px]" style={{ color: '#dc2626' }}>
              ✗ {runMessage}
            </span>
          )}

          {/* Clear */}
          <button
            type="button"
            onClick={handleClearCanvas}
            className="rounded-lg px-3 py-2 font-body text-[11px] font-semibold transition-colors hover:bg-gray-50"
            style={{ border: '1px solid #e8eae8', color: '#9aa0a6' }}
          >
            Clear
          </button>

          {/* Save */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1.5 rounded-lg px-5 py-2 font-body text-[12px] font-semibold transition-colors disabled:opacity-60"
            style={{ border: `2px solid ${saveState === 'error' ? '#dc2626' : PRIMARY}`, color: saveState === 'error' ? '#dc2626' : PRIMARY }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : 'Save'}
          </button>

          {/* Run */}
          <button
            type="button"
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded-lg px-5 py-2 font-body text-[12px] font-semibold text-white transition-colors"
            style={{ background: PRIMARY }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Run
          </button>
        </div>
        )}

        {/* ReactFlow canvas */}
        <div ref={reactFlowWrapper} className="flex-1 bg-[#f9f9f9]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            defaultEdgeOptions={{ type: 'smoothstep', style: { stroke: '#d1d5db', strokeWidth: 1.5 } }}
            snapToGrid
            snapGrid={[16, 16]}
            minZoom={0.3}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color="#e5e7eb"
            />
            <Controls
              className="!shadow-sm !rounded-xl !border !border-gray-200 !bg-white"
              showInteractive={false}
            />
            <MiniMap
              className="!rounded-xl !border !border-gray-200 !bg-white !shadow-sm"
              nodeColor={(n) => {
                const colors: Record<string, string> = {
                  trigger: '#16a34a', 'kb-search': '#0369a1',
                  'llm-reason': '#7c3aed', 'tool-call': '#b45309',
                  condition: '#be185d', transform: '#0e7490', output: '#374151',
                };
                return colors[n.type ?? ''] ?? '#9ca3af';
              }}
              maskColor="rgba(249,249,249,0.7)"
            />

            {/* Empty state overlay */}
            {nodes.length === 0 && (
              <Panel position="top-center">
                <div className="mt-16 rounded-2xl border border-dashed border-gray-300 bg-white/80 px-10 py-8 text-center backdrop-blur-sm">
                  <div className="mb-3 text-[32px]">🔲</div>
                  <p className="font-display text-[14px] font-semibold text-gray-600">Canvas is empty</p>
                  <p className="mt-1 font-body text-[12px] text-gray-400">
                    Drag nodes from the left panel or click + to add
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* Right config panel */}
      <NodeConfigPanel
        node={selectedNode}
        onUpdate={handleUpdateNode}
        onDelete={handleDeleteNode}
      />
    </div>
    </>
  );
}

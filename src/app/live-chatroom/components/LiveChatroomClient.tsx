'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import ChatFeed from './ChatFeed';
import ArtifactSidebar from './ArtifactSidebar';
import AgentStatusBar from './AgentStatusBar';
import SessionDeliveryModal from './SessionDeliveryModal';
import OrchestrationPanel from './OrchestrationPanel';
import ExecutionTimeline from './ExecutionTimeline';
import type { ExecutionEvent } from './ExecutionTimeline';
import {
  REAL_AI_AGENTS,
  getAgentResponse,
  getParallelAgentResponses,
  buildAgentFromConfig,
} from '@/lib/ai/multiAgentChat';
import type { AIAgent, AgentMessage, OrchestrationMode } from '@/lib/ai/multiAgentChat';
import { useAuth } from '@/contexts/AuthContext';
import {
  updateSessionStatus,
  insertMessage,
  trackEvent,
} from '@/lib/supabase/sessionService';
import { trackGAEvent } from '@/components/Analytics';

export type AgentRole = 'pm' | 'coder' | 'designer' | 'critic' | 'architect' | 'brainstormer' | 'researcher';

export interface LiveAgent {
  id: string;
  name: string;
  role: AgentRole;
  model: string;
  status: 'thinking' | 'speaking' | 'idle' | 'waiting';
  messageCount: number;
  color: string;
}

export interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  agentColor: string;
  content: string;
  timestamp: string;
  type: 'message' | 'code' | 'decision' | 'question' | 'artifact';
  codeLanguage?: string;
  replyTo?: string;
  artifactId?: string;
  isParallel?: boolean;
  executionMs?: number;
}

export interface Artifact {
  id: string;
  name: string;
  type: 'code' | 'document' | 'diagram' | 'decision' | 'spec';
  content: string;
  createdBy: string;
  createdAt: string;
  language?: string;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const DEFAULT_TOPIC = 'Build a modern SaaS product together — discuss architecture, features, and implementation';

/** Try to read session config agents from sessionStorage (set by session-setup flow) */
function loadSessionAgents(): AIAgent[] | null {
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage.getItem('sessionAgents') : null;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    const names = parsed.map((a: any) => a.name);
    return parsed.map((a: any) => buildAgentFromConfig(a, names));
  } catch {
    return null;
  }
}

export default function LiveChatroomClient() {
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(true);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [orchestrationMode, setOrchestrationMode] = useState<OrchestrationMode>('round-robin');
  const [pinnedAgentId, setPinnedAgentId] = useState<string | null>(null);
  const [skippedAgentIds, setSkippedAgentIds] = useState<Set<string>>(new Set());
  const [pendingDirective, setPendingDirective] = useState<{ text: string; targetAgentId?: string } | null>(null);
  const [executionEvents, setExecutionEvents] = useState<ExecutionEvent[]>([]);
  const [maxTurns, setMaxTurns] = useState(50);

  // Active AI agents — prefer session config agents, fall back to default 3
  const [activeAIAgents, setActiveAIAgents] = useState<AIAgent[]>(REAL_AI_AGENTS);

  const [agents, setAgents] = useState<LiveAgent[]>(
    REAL_AI_AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role as AgentRole,
      model: a.model,
      status: 'idle' as const,
      messageCount: 0,
      color: a.color,
    }))
  );
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [topicInput, setTopicInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<AgentMessage[]>([]);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const { user } = useAuth();

  // Get current session ID from sessionStorage
  const getCurrentSessionId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem('currentSessionId');
  };

  // Refs for stable closures
  const sessionStatusRef = useRef(sessionStatus);
  const isAgentRespondingRef = useRef(isAgentResponding);
  const currentAgentIndexRef = useRef(currentAgentIndex);
  const conversationHistoryRef = useRef(conversationHistory);
  const turnCountRef = useRef(turnCount);
  const activeAIAgentsRef = useRef(activeAIAgents);
  const orchestrationModeRef = useRef(orchestrationMode);
  const pinnedAgentIdRef = useRef(pinnedAgentId);
  const skippedAgentIdsRef = useRef(skippedAgentIds);
  const pendingDirectiveRef = useRef(pendingDirective);
  const maxTurnsRef = useRef(maxTurns);
  const elapsedSecondsRef = useRef(elapsedSeconds);

  sessionStatusRef.current = sessionStatus;
  isAgentRespondingRef.current = isAgentResponding;
  currentAgentIndexRef.current = currentAgentIndex;
  conversationHistoryRef.current = conversationHistory;
  turnCountRef.current = turnCount;
  activeAIAgentsRef.current = activeAIAgents;
  orchestrationModeRef.current = orchestrationMode;
  pinnedAgentIdRef.current = pinnedAgentId;
  skippedAgentIdsRef.current = skippedAgentIds;
  pendingDirectiveRef.current = pendingDirective;
  maxTurnsRef.current = maxTurns;
  elapsedSecondsRef.current = elapsedSeconds;

  // Load session agents from sessionStorage on mount
  useEffect(() => {
    const sessionAgents = loadSessionAgents();
    if (sessionAgents && sessionAgents.length >= 2) {
      setActiveAIAgents(sessionAgents);
      setAgents(
        sessionAgents.map((a) => ({
          id: a.id,
          name: a.name,
          role: a.role as AgentRole,
          model: a.model,
          status: 'idle' as const,
          messageCount: 0,
          color: a.color,
        }))
      );
    }
  }, []);

  // Timer
  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const addExecutionEvent = useCallback((event: Omit<ExecutionEvent, 'id'>) => {
    setExecutionEvents(prev => [...prev, { ...event, id: `evt-${Date.now()}-${Math.random()}` }]);
  }, []);

  const updateAgentStatus = useCallback((agentId: string, status: LiveAgent['status']) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status } : a)));
  }, []);

  const incrementAgentMessageCount = useCallback((agentId: string) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, messageCount: a.messageCount + 1 } : a)));
  }, []);

  /** Run parallel execution — all agents respond simultaneously */
  const runParallelTurn = useCallback(async () => {
    if (sessionStatusRef.current !== 'running' || isAgentRespondingRef.current) return;

    const currentAgents = activeAIAgentsRef.current;
    setIsAgentResponding(true);

    // Set all agents to thinking
    currentAgents.forEach(a => updateAgentStatus(a.id, 'thinking'));

    const directive = pendingDirectiveRef.current;
    const injectedContext = directive ? directive.text : undefined;
    if (directive) setPendingDirective(null);

    const batchTimestamp = formatTimestamp(elapsedSecondsRef.current);
    addExecutionEvent({
      type: 'parallel_batch',
      label: `Parallel batch — ${currentAgents.length} agents`,
      timestamp: batchTimestamp,
      parallelAgents: currentAgents.map(a => a.name),
    });

    try {
      const results = await getParallelAgentResponses(
        currentAgents,
        conversationHistoryRef.current,
        topic,
        injectedContext
      );

      if (sessionStatusRef.current !== 'running') {
        setIsAgentResponding(false);
        currentAgents.forEach(a => updateAgentStatus(a.id, 'idle'));
        return;
      }

      const newMessages: ChatMessage[] = [];
      const newHistoryEntries: AgentMessage[] = [];

      for (const result of results) {
        const aiAgent = currentAgents.find(a => a.id === result.agentId);
        if (!aiAgent) continue;

        updateAgentStatus(aiAgent.id, result.success ? 'speaking' : 'idle');

        if (result.success) {
          const msg: ChatMessage = {
            id: `msg-${Date.now()}-${result.agentId}`,
            agentId: aiAgent.id,
            agentName: aiAgent.name,
            agentRole: aiAgent.role as AgentRole,
            agentColor: aiAgent.color,
            content: result.content,
            timestamp: batchTimestamp,
            type: 'message',
            isParallel: true,
            executionMs: result.durationMs,
          };
          newMessages.push(msg);
          newHistoryEntries.push({ role: 'assistant', content: result.content, agentName: aiAgent.name });
          incrementAgentMessageCount(aiAgent.id);

          addExecutionEvent({
            type: 'agent_turn',
            agentId: aiAgent.id,
            agentName: aiAgent.name,
            agentColor: aiAgent.color,
            label: 'responded (parallel)',
            detail: result.content.slice(0, 80) + (result.content.length > 80 ? '…' : ''),
            timestamp: batchTimestamp,
            durationMs: result.durationMs,
            success: true,
          });

          const sessionId = getCurrentSessionId();
          if (sessionId && user) {
            insertMessage(sessionId, {
              agentId: aiAgent.id, agentName: aiAgent.name, agentRole: aiAgent.role,
              agentColor: aiAgent.color, content: result.content, type: 'message',
              elapsedSeconds: elapsedSecondsRef.current,
            });
          }
        } else {
          addExecutionEvent({
            type: 'agent_turn',
            agentId: aiAgent.id,
            agentName: aiAgent.name,
            agentColor: aiAgent.color,
            label: 'failed',
            detail: result.error,
            timestamp: batchTimestamp,
            durationMs: result.durationMs,
            success: false,
          });
        }
      }

      setMessages(prev => [...prev, ...newMessages]);
      setConversationHistory(prev => [...prev, ...newHistoryEntries].slice(-20));
      setTurnCount(t => t + 1);

      await new Promise(r => setTimeout(r, 2000));
      currentAgents.forEach(a => updateAgentStatus(a.id, 'idle'));
    } catch (err: any) {
      currentAgents.forEach(a => updateAgentStatus(a.id, 'idle'));
      toast.error(`Parallel execution failed: ${err?.message}`);
      setTurnCount(t => t + 1);
    } finally {
      setIsAgentResponding(false);
    }
  }, [topic, updateAgentStatus, incrementAgentMessageCount, addExecutionEvent, user]);

  /** Run a single agent turn (round-robin / sequential / priority / reactive) */
  const runNextAgentTurn = useCallback(async () => {
    if (
      sessionStatusRef.current !== 'running' ||
      isAgentRespondingRef.current ||
      turnCountRef.current >= maxTurnsRef.current
    ) return;

    const currentAgents = activeAIAgentsRef.current;

    // Determine which agent goes next
    let agentIndex: number;
    if (pinnedAgentIdRef.current) {
      const pinnedIdx = currentAgents.findIndex(a => a.id === pinnedAgentIdRef.current);
      agentIndex = pinnedIdx >= 0 ? pinnedIdx : currentAgentIndexRef.current % currentAgents.length;
    } else {
      // Skip agents in skipped set
      let idx = currentAgentIndexRef.current % currentAgents.length;
      let attempts = 0;
      while (skippedAgentIdsRef.current.has(currentAgents[idx].id) && attempts < currentAgents.length) {
        idx = (idx + 1) % currentAgents.length;
        attempts++;
      }
      // Clear skip after use
      if (skippedAgentIdsRef.current.has(currentAgents[idx].id)) {
        setSkippedAgentIds(new Set());
      }
      agentIndex = idx;
    }

    const aiAgent: AIAgent = currentAgents[agentIndex];

    // Check for pending directive targeting this agent or all agents
    const directive = pendingDirectiveRef.current;
    const injectedContext = directive && (!directive.targetAgentId || directive.targetAgentId === aiAgent.id)
      ? directive.text
      : undefined;
    if (injectedContext) setPendingDirective(null);

    setIsAgentResponding(true);
    updateAgentStatus(aiAgent.id, 'thinking');
    currentAgents.forEach((a, i) => { if (i !== agentIndex) updateAgentStatus(a.id, 'waiting'); });

    const turnStart = Date.now();
    const turnTimestamp = formatTimestamp(elapsedSecondsRef.current);

    try {
      const response = await getAgentResponse(
        aiAgent,
        conversationHistoryRef.current,
        topic,
        injectedContext
      );

      if (sessionStatusRef.current !== 'running') {
        setIsAgentResponding(false);
        updateAgentStatus(aiAgent.id, 'idle');
        return;
      }

      const durationMs = Date.now() - turnStart;
      updateAgentStatus(aiAgent.id, 'speaking');

      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${agentIndex}`,
        agentId: aiAgent.id,
        agentName: aiAgent.name,
        agentRole: aiAgent.role as AgentRole,
        agentColor: aiAgent.color,
        content: response,
        timestamp: turnTimestamp,
        type: 'message',
        executionMs: durationMs,
      };

      setMessages((prev) => [...prev, newMessage]);
      incrementAgentMessageCount(aiAgent.id);

      addExecutionEvent({
        type: 'agent_turn',
        agentId: aiAgent.id,
        agentName: aiAgent.name,
        agentColor: aiAgent.color,
        label: injectedContext ? 'responded (with directive)' : 'responded',
        detail: response.slice(0, 80) + (response.length > 80 ? '…' : ''),
        timestamp: turnTimestamp,
        durationMs,
        success: true,
      });

      const sessionId = getCurrentSessionId();
      if (sessionId && user) {
        insertMessage(sessionId, {
          agentId: aiAgent.id, agentName: aiAgent.name, agentRole: aiAgent.role,
          agentColor: aiAgent.color, content: response, type: 'message',
          elapsedSeconds: elapsedSecondsRef.current,
        });
        trackEvent('agent_turn', user.id, sessionId, {}, aiAgent.model, aiAgent.name);
        trackGAEvent('agent_turn', { model: aiAgent.model, agent_name: aiAgent.name });
      }

      setConversationHistory((prev) => [...prev, { role: 'assistant', content: response, agentName: aiAgent.name }].slice(-20));
      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % currentAgents.length);

      await new Promise((resolve) => setTimeout(resolve, 1200));
      updateAgentStatus(aiAgent.id, 'idle');
    } catch (err: any) {
      updateAgentStatus(aiAgent.id, 'idle');
      currentAgents.forEach((a) => updateAgentStatus(a.id, 'idle'));
      const errMsg = err?.message || 'Unknown error';

      addExecutionEvent({
        type: 'agent_turn',
        agentId: aiAgent.id,
        agentName: aiAgent.name,
        agentColor: aiAgent.color,
        label: 'failed',
        detail: errMsg.slice(0, 80),
        timestamp: turnTimestamp,
        durationMs: Date.now() - turnStart,
        success: false,
      });

      if (
        errMsg.includes('401') || errMsg.includes('API key') || errMsg.includes('Authentication') ||
        errMsg.includes('429') || errMsg.includes('credits') || errMsg.includes('RateLimit') ||
        errMsg.includes('rate limit') || errMsg.includes('billing')
      ) {
        const isCredits = errMsg.includes('credits') || errMsg.includes('billing');
        toast.warning(
          isCredits
            ? `${aiAgent.name} skipped — no API credits remaining.`
            : `${aiAgent.name} skipped — API key not configured or rate limited.`
        );
      } else {
        toast.error(`${aiAgent.name} failed to respond: ${errMsg}`);
      }
      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % currentAgents.length);
    } finally {
      setIsAgentResponding(false);
    }
  }, [topic, updateAgentStatus, incrementAgentMessageCount, addExecutionEvent, user]);

  // Auto-trigger next turn
  useEffect(() => {
    if (sessionStatus !== 'running' || isAgentResponding || turnCount >= maxTurns) return;
    const timeout = setTimeout(() => {
      if (orchestrationMode === 'parallel') {
        runParallelTurn();
      } else {
        runNextAgentTurn();
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [sessionStatus, isAgentResponding, turnCount, currentAgentIndex, orchestrationMode, runNextAgentTurn, runParallelTurn, maxTurns]);

  // Stop when max turns reached
  useEffect(() => {
    if (turnCount >= maxTurns && sessionStatus === 'running') {
      setSessionStatus('stopped');
      activeAIAgentsRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
      toast.success('Session complete — all turns used. View results!');
      setDeliveryModalOpen(true);
      addExecutionEvent({ type: 'session_event', label: 'Session completed — max turns reached', timestamp: formatTimestamp(elapsedSecondsRef.current) });
    }
  }, [turnCount, maxTurns, sessionStatus, updateAgentStatus, addExecutionEvent]);

  const handleStart = () => {
    const activeTopic = topicInput.trim() || DEFAULT_TOPIC;
    setTopic(activeTopic);
    setMessages([]);
    setConversationHistory([]);
    setTurnCount(0);
    setCurrentAgentIndex(0);
    setElapsedSeconds(0);
    setExecutionEvents([]);
    setSkippedAgentIds(new Set());
    setPinnedAgentId(null);
    setPendingDirective(null);
    setAgents((prev) => prev.map((a) => ({ ...a, messageCount: 0, status: 'idle' })));

    const firstAgent = activeAIAgentsRef.current[0];
    setConversationHistory([{
      role: 'user',
      content: `The collaboration topic is: "${activeTopic}". ${firstAgent.name}, please start by sharing your initial thoughts as the ${firstAgent.role}.`,
    }]);

    setSessionStatus('running');
    toast.success(`Session started in ${orchestrationMode} mode — AI agents are connecting…`);

    addExecutionEvent({ type: 'session_event', label: `Session started (${orchestrationMode})`, detail: activeTopic, timestamp: '00:00' });

    const sessionId = getCurrentSessionId();
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'running');
      trackEvent('session_start', user.id, sessionId, { topic: activeTopic, mode: orchestrationMode });
      trackGAEvent('session_start', { session_id: sessionId, topic: activeTopic });
    }
  };

  const handlePause = () => {
    setSessionStatus('paused');
    activeAIAgentsRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
    toast.info('Session paused');
    addExecutionEvent({ type: 'session_event', label: 'Session paused', timestamp: formatTimestamp(elapsedSecondsRef.current) });

    const sessionId = getCurrentSessionId();
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'paused', { elapsed_seconds: elapsedSeconds, turn_count: turnCount });
      trackEvent('session_pause', user.id, sessionId, {});
    }
  };

  const handleResume = () => {
    setSessionStatus('running');
    toast.success('Session resumed');
    addExecutionEvent({ type: 'session_event', label: 'Session resumed', timestamp: formatTimestamp(elapsedSecondsRef.current) });

    const sessionId = getCurrentSessionId();
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'running');
      trackEvent('session_resume', user.id, sessionId, {});
    }
  };

  const handleStop = () => {
    setSessionStatus('stopped');
    activeAIAgentsRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
    toast.success('Session stopped — results are being compiled');
    addExecutionEvent({ type: 'session_event', label: 'Session stopped by user', timestamp: formatTimestamp(elapsedSecondsRef.current) });

    const sessionId = getCurrentSessionId();
    const completionPct = maxTurns > 0 ? Math.min(100, Math.round((turnCount / maxTurns) * 100)) : 0;
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'stopped', {
        elapsed_seconds: elapsedSeconds, turn_count: turnCount,
        message_count: messages.length, artifact_count: artifacts.length, completion_pct: completionPct,
      });
      trackEvent('session_stop', user.id, sessionId, { turn_count: turnCount, completion_pct: completionPct });
      trackGAEvent('session_stop', { session_id: sessionId, completion_pct: completionPct });
    }
    setDeliveryModalOpen(true);
  };

  const handleInjectDirective = useCallback((text: string, targetAgentId?: string) => {
    setPendingDirective({ text, targetAgentId });
    const targetName = targetAgentId
      ? activeAIAgentsRef.current.find(a => a.id === targetAgentId)?.name || 'agent' :'all agents';
    toast.success(`Directive queued for ${targetName}`);
    addExecutionEvent({
      type: 'directive',
      label: `Directive → ${targetName}`,
      detail: text,
      timestamp: formatTimestamp(elapsedSecondsRef.current),
    });
  }, [addExecutionEvent]);

  const handleSkipAgent = useCallback((agentId: string) => {
    setSkippedAgentIds(prev => new Set([...prev, agentId]));
    const name = activeAIAgentsRef.current.find(a => a.id === agentId)?.name || 'Agent';
    toast.info(`${name} will skip their next turn`);
    addExecutionEvent({
      type: 'phase_change',
      label: `${name} skipped`,
      timestamp: formatTimestamp(elapsedSecondsRef.current),
    });
  }, [addExecutionEvent]);

  const handlePinAgent = useCallback((agentId: string) => {
    setPinnedAgentId(agentId || null);
    if (agentId) {
      const name = activeAIAgentsRef.current.find(a => a.id === agentId)?.name || 'Agent';
      toast.success(`${name} pinned — will always respond next`);
      addExecutionEvent({ type: 'phase_change', label: `${name} pinned`, timestamp: formatTimestamp(elapsedSecondsRef.current) });
    }
  }, [addExecutionEvent]);

  const handleOrchestrationModeChange = useCallback((mode: OrchestrationMode) => {
    setOrchestrationMode(mode);
    addExecutionEvent({ type: 'phase_change', label: `Orchestration mode → ${mode}`, timestamp: formatTimestamp(elapsedSecondsRef.current) });
  }, [addExecutionEvent]);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Topbar */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center gap-3 px-4 flex-shrink-0 z-30">
        <Link href="/sessions-dashboard" className="flex items-center gap-2 mr-2">
          <AppLogo size={26} />
          <span className="text-sm font-semibold text-foreground hidden sm:block">AICollab</span>
        </Link>

        <div className="w-px h-5 bg-border" />

        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            sessionStatus === 'running' ? 'bg-positive live-indicator'
              : sessionStatus === 'paused' ? 'bg-warning' : 'bg-muted-foreground'
          }`} />
          <span className="text-sm font-medium text-foreground truncate">
            {sessionStatus === 'idle' ? 'AI Collaboration Room' : topic.slice(0, 40) + (topic.length > 40 ? '…' : '')}
          </span>
          {sessionStatus !== 'idle' && (
            <span className="badge-mode-build text-xs hidden sm:inline-flex">Live</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Timer */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          </div>

          {/* Turn count */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ChatBubbleLeftRightIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">{turnCount}/{maxTurns}</span>
          </div>

          {/* Timeline toggle */}
          {sessionStatus !== 'idle' && (
            <button
              onClick={() => setTimelineOpen(!timelineOpen)}
              className={`btn-ghost text-xs gap-1.5 py-1.5 ${timelineOpen ? 'text-accent' : ''}`}
              title="Execution timeline"
            >
              <Icon name="ClockIcon" size={14} />
              <span className="hidden sm:inline">Timeline</span>
              {executionEvents.length > 0 && (
                <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">{executionEvents.length}</span>
              )}
            </button>
          )}

          {/* Session controls */}
          {sessionStatus === 'idle' && (
            <button onClick={handleStart} className="btn-primary text-xs gap-1.5 py-1.5">
              <Icon name="PlayIcon" size={14} />
              Start Session
            </button>
          )}
          {sessionStatus === 'running' && (
            <button onClick={handlePause} className="btn-secondary text-xs gap-1.5 py-1.5">
              <Icon name="PauseIcon" size={14} />
              Pause
            </button>
          )}
          {sessionStatus === 'paused' && (
            <button onClick={handleResume} className="btn-primary text-xs gap-1.5 py-1.5">
              <Icon name="PlayIcon" size={14} />
              Resume
            </button>
          )}
          {sessionStatus !== 'idle' && sessionStatus !== 'stopped' && (
            <button onClick={handleStop} className="btn-danger text-xs gap-1.5 py-1.5">
              <Icon name="StopIcon" size={14} />
              Stop
            </button>
          )}
          {sessionStatus === 'stopped' && (
            <button onClick={() => setDeliveryModalOpen(true)} className="btn-primary text-xs gap-1.5 py-1.5">
              <Icon name="TrophyIcon" size={14} />
              View Results
            </button>
          )}

          {/* Artifact toggle */}
          <button
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
            className={`btn-ghost text-xs gap-1.5 py-1.5 ${artifactPanelOpen ? 'text-accent' : ''}`}
            title={artifactPanelOpen ? 'Hide artifacts panel' : 'Show artifacts panel'}
          >
            <Icon name="DocumentDuplicateIcon" size={14} />
            <span className="hidden sm:inline">Artifacts</span>
            <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">{artifacts.length}</span>
          </button>

          <Link href="/session-results" className="btn-secondary text-xs gap-1.5 py-1.5">
            <Icon name="ChartBarIcon" size={14} />
            <span className="hidden sm:inline">Results</span>
          </Link>
        </div>
      </header>

      {/* Agent status bar */}
      <AgentStatusBar
        agents={agents}
        sessionStatus={sessionStatus === 'idle' ? 'stopped' : sessionStatus}
        orchestrationMode={orchestrationMode}
        pinnedAgentId={pinnedAgentId}
      />

      {/* Orchestration panel */}
      {sessionStatus !== 'idle' && (
        <OrchestrationPanel
          agents={agents}
          orchestrationMode={orchestrationMode}
          sessionStatus={sessionStatus}
          turnCount={turnCount}
          maxTurns={maxTurns}
          currentAgentIndex={currentAgentIndex}
          onOrchestrationModeChange={handleOrchestrationModeChange}
          onInjectDirective={handleInjectDirective}
          onSkipAgent={handleSkipAgent}
          onPinAgent={handlePinAgent}
          pinnedAgentId={pinnedAgentId}
          onMaxTurnsChange={setMaxTurns}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat feed */}
        <div className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${artifactPanelOpen ? '' : 'w-full'}`}>
          {sessionStatus === 'idle' ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6">
              <div className="text-center max-w-lg">
                <div className="flex items-center justify-center gap-3 mb-4 flex-wrap">
                  {activeAIAgents.map((a) => (
                    <div
                      key={a.id}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ backgroundColor: `${a.color}22`, color: a.color, border: `2px solid ${a.color}44` }}
                    >
                      {a.name.charAt(0)}
                    </div>
                  ))}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">AI Collaboration Room</h2>
                <p className="text-sm text-muted-foreground mb-1">
                  {activeAIAgents.map((a) => a.name).join(', ')} will collaborate in real time.
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure agents in{' '}
                  <Link href="/session-setup" className="text-accent hover:underline">Session Setup</Link> to use any AI model.
                </p>

                {/* Orchestration mode picker */}
                <div className="mb-5">
                  <p className="text-xs font-medium text-foreground mb-2 text-left">Execution Mode</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {[
                      { value: 'round-robin' as OrchestrationMode, label: 'Round Robin', icon: 'ArrowPathIcon' },
                      { value: 'parallel' as OrchestrationMode, label: 'Parallel', icon: 'BoltIcon' },
                      { value: 'sequential' as OrchestrationMode, label: 'Sequential', icon: 'QueueListIcon' },
                      { value: 'priority' as OrchestrationMode, label: 'Priority', icon: 'FunnelIcon' },
                      { value: 'reactive' as OrchestrationMode, label: 'Reactive', icon: 'CpuChipIcon' },
                    ].map(m => (
                      <button
                        key={m.value}
                        onClick={() => setOrchestrationMode(m.value)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs transition-all ${
                          orchestrationMode === m.value
                            ? 'border-accent/50 bg-accent/10 text-accent' :'border-border bg-muted/20 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon name={m.icon as any} size={14} />
                        <span className="font-medium leading-tight">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      placeholder={DEFAULT_TOPIC}
                      className="flex-1 px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                    />
                    <button onClick={handleStart} className="btn-primary text-sm gap-2 px-4">
                      <Icon name="PlayIcon" size={15} />
                      Start
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      'Design a social media app',
                      'Build an AI-powered code reviewer',
                      'Create a real-time collaboration tool',
                    ].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setTopicInput(suggestion)}
                        className="text-xs px-3 py-1.5 rounded-full bg-muted/40 border border-border text-muted-foreground hover:text-foreground hover:border-accent/50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-6 text-xs text-muted-foreground flex-wrap justify-center">
                {activeAIAgents.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span style={{ color: a.color }}>{a.name}</span>
                    <span className="text-muted-foreground/60">({a.role})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ChatFeed messages={messages} agents={agents} sessionStatus={sessionStatus === 'idle' ? 'stopped' : sessionStatus} />
          )}
        </div>

        {/* Artifact sidebar */}
        {artifactPanelOpen && (
          <div className="w-80 xl:w-96 flex-shrink-0 border-l border-border overflow-hidden flex flex-col">
            <ArtifactSidebar artifacts={artifacts} />
          </div>
        )}

        {/* Execution timeline overlay */}
        {timelineOpen && (
          <ExecutionTimeline
            events={executionEvents}
            agents={agents}
            isOpen={timelineOpen}
            onClose={() => setTimelineOpen(false)}
          />
        )}
      </div>

      {/* Session delivery modal */}
      {deliveryModalOpen && (
        <SessionDeliveryModal
          topic={topic}
          messages={messages}
          artifacts={artifacts}
          agents={agents}
          elapsedSeconds={elapsedSeconds}
          turnCount={turnCount}
          maxTurns={maxTurns}
          onClose={() => setDeliveryModalOpen(false)}
        />
      )}
    </div>
  );
}

const MOCK_ARTIFACTS: any = null;
export { MOCK_ARTIFACTS };
const MOCK_MESSAGES: any = null;
export { MOCK_MESSAGES };
const LIVE_AGENTS: any = null;
export { LIVE_AGENTS };
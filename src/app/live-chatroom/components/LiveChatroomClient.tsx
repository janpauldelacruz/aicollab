'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import ChatFeed from './ChatFeed';
import ArtifactSidebar from './ArtifactSidebar';
import AgentStatusBar from './AgentStatusBar';
import {
  REAL_AI_AGENTS,
  getAgentResponse,
  buildAgentsFromConfig,
  produceDeliverable,
  resolveAgentModels,
  distinctModels,
} from '@/lib/ai/multiAgentChat';
import { consumePendingSession } from '@/lib/session/pendingSession';
import { similarity, REPEAT_THRESHOLD } from '@/lib/ai/collaboration';
import { DELIVERABLE_FILE, applyMessageToWorkspace, workspaceFiles } from '@/lib/ai/workspace';
import type { Workspace } from '@/lib/ai/workspace';
import type { AIAgent, AgentMessage } from '@/lib/ai/multiAgentChat';
import { useAvailableModels } from '@/lib/ai/models';
import { saveSession } from '@/lib/session/sessionStore';
import type { StoredSession } from '@/lib/session/sessionStore';

export type AgentRole =
  'pm' | 'coder' | 'designer' | 'critic' | 'architect' | 'brainstormer' | 'researcher';

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

const AGENT_ROLE_MAP: Record<string, AgentRole> = {
  'agent-architect': 'architect',
  'agent-researcher': 'researcher',
  'agent-coder': 'coder',
};

const DEFAULT_TOPIC =
  'Build a modern SaaS product together — discuss architecture, features, and implementation';

export default function LiveChatroomClient() {
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'running' | 'paused' | 'stopped'>(
    'idle'
  );
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agents, setAgents] = useState<LiveAgent[]>(
    REAL_AI_AGENTS.map((a) => ({
      id: a.id,
      name: a.name,
      role: AGENT_ROLE_MAP[a.id] as AgentRole,
      model: a.model,
      status: 'idle' as const,
      messageCount: 0,
      color: a.color,
    }))
  );
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  // Roster of local Ollama agents; models are resolved against what is installed.
  const [roster, setRoster] = useState<AIAgent[]>(REAL_AI_AGENTS);
  const {
    models: availableModels,
    loading: modelsLoading,
    error: modelsError,
    baseUrl: ollamaBaseUrl,
  } = useAvailableModels();
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>({});
  const [userInput, setUserInput] = useState('');
  const [pendingDirective, setPendingDirective] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  const [turnSeconds, setTurnSeconds] = useState(0);
  const [topicInput, setTopicInput] = useState('');
  const [conversationHistory, setConversationHistory] = useState<AgentMessage[]>([]);
  const [currentAgentIndex, setCurrentAgentIndex] = useState(0);
  const [isAgentResponding, setIsAgentResponding] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [maxTurns, setMaxTurns] = useState(18);

  const sessionStatusRef = useRef(sessionStatus);
  const isAgentRespondingRef = useRef(isAgentResponding);
  const currentAgentIndexRef = useRef(currentAgentIndex);
  const conversationHistoryRef = useRef(conversationHistory);
  const turnCountRef = useRef(turnCount);
  const rosterRef = useRef(roster);
  const workspaceRef = useRef(workspace);
  const pendingDirectiveRef = useRef(pendingDirective);
  const lastByAgentRef = useRef<Record<string, string>>({});

  sessionStatusRef.current = sessionStatus;
  isAgentRespondingRef.current = isAgentResponding;
  currentAgentIndexRef.current = currentAgentIndex;
  conversationHistoryRef.current = conversationHistory;
  turnCountRef.current = turnCount;
  rosterRef.current = roster;
  workspaceRef.current = workspace;
  pendingDirectiveRef.current = pendingDirective;

  // A session launched from the setup wizard must run with the topic, roster and
  // AI settings that were configured there — not the chatroom defaults.
  const [launchedConfig, setLaunchedConfig] = useState<ReturnType<
    typeof consumePendingSession
  > | null>(null);
  const launchedRef = useRef(false);

  useEffect(() => {
    const pending = consumePendingSession();
    if (!pending) return;

    if (pending.agents.length > 0) launchedRef.current = true;
    setLaunchedConfig(pending);
    setTopic(pending.topic);
    setTopicInput(pending.topic);
    if (pending.maxTurns > 0) setMaxTurns(pending.maxTurns);

    if (pending.agents.length > 0) {
      const configured = buildAgentsFromConfig(pending.agents);
      setRoster(configured);
      setAgents(
        configured.map((a) => ({
          id: a.id,
          name: a.name,
          role: (a.role as AgentRole) || 'coder',
          model: a.model,
          status: 'idle' as const,
          messageCount: 0,
          color: a.color,
        }))
      );
    }

    toast.success(`Loaded "${pending.name || pending.topic}" — ${pending.agents.length} agents`);
  }, []);

  // Point each agent at a model that is actually installed on the Ollama host
  useEffect(() => {
    if (availableModels.length === 0) return;
    // A launched roster already has explicit model choices — leave them alone.
    if (launchedRef.current) return;
    const resolved = resolveAgentModels(availableModels.map((m) => m.id));
    setRoster(resolved);
    setAgents((prev) =>
      prev.map((a) => {
        const match = resolved.find((r) => r.id === a.id);
        return match ? { ...a, model: match.model } : a;
      })
    );
  }, [availableModels, launchedConfig]);

  // Timer
  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [sessionStatus]);

  // Local models can take a minute per turn — show the clock so a slow turn does
  // not read as a crashed one.
  useEffect(() => {
    if (!turnStartedAt) {
      setTurnSeconds(0);
      return;
    }
    const interval = setInterval(
      () => setTurnSeconds(Math.floor((Date.now() - turnStartedAt) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [turnStartedAt]);

  const updateAgentStatus = useCallback((agentId: string, status: LiveAgent['status']) => {
    setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, status } : a)));
  }, []);

  const incrementAgentMessageCount = useCallback((agentId: string) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, messageCount: a.messageCount + 1 } : a))
    );
  }, []);

  const runNextAgentTurn = useCallback(async () => {
    if (
      sessionStatusRef.current !== 'running' ||
      isAgentRespondingRef.current ||
      turnCountRef.current >= maxTurns
    )
      return;

    const agentIndex = currentAgentIndexRef.current;
    const aiAgent: AIAgent = rosterRef.current[agentIndex];

    setIsAgentResponding(true);
    setTurnStartedAt(Date.now());
    updateAgentStatus(aiAgent.id, 'thinking');

    // Set others to waiting
    rosterRef.current.forEach((a, i) => {
      if (i !== agentIndex) updateAgentStatus(a.id, 'waiting');
    });

    try {
      const directive = pendingDirectiveRef.current;

      // One retry: a single dropped connection or model hiccup should not cost a turn.
      let response: string;
      try {
        response = await getAgentResponse(aiAgent, conversationHistoryRef.current, topic, {
          workspace: workspaceRef.current,
          userDirective: directive || undefined,
        });
      } catch (firstError: any) {
        if (sessionStatusRef.current !== 'running') throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 2000));
        response = await getAgentResponse(aiAgent, conversationHistoryRef.current, topic, {
          workspace: workspaceRef.current,
          userDirective: directive || undefined,
        });
      }

      // If the agent just restated its own last turn, give it one more shot with
      // an explicit warning before letting the repetition into the transcript.
      const previous = lastByAgentRef.current[aiAgent.id];
      if (previous && similarity(previous, response) > REPEAT_THRESHOLD) {
        response = await getAgentResponse(aiAgent, conversationHistoryRef.current, topic, {
          workspace: workspaceRef.current,
          userDirective: directive || undefined,
          repeatWarning: true,
        });
      }
      lastByAgentRef.current[aiAgent.id] = response;
      if (directive) setPendingDirective(null);

      if (sessionStatusRef.current !== 'running') {
        setIsAgentResponding(false);
        updateAgentStatus(aiAgent.id, 'idle');
        return;
      }

      updateAgentStatus(aiAgent.id, 'speaking');

      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}-${agentIndex}`,
        agentId: aiAgent.id,
        agentName: aiAgent.name,
        agentRole: AGENT_ROLE_MAP[aiAgent.id] as AgentRole,
        agentColor: aiAgent.color,
        content: response,
        timestamp: formatTimestamp(elapsedSeconds),
        type: 'message',
      };

      setMessages((prev) => [...prev, newMessage]);
      incrementAgentMessageCount(aiAgent.id);

      // Fold any FILE:/DECISION: blocks into the shared workspace.
      const applied = applyMessageToWorkspace(
        workspaceRef.current,
        response,
        aiAgent.name,
        formatTimestamp(elapsedSeconds)
      );
      if (applied.touched.length > 0) {
        setWorkspace(applied.workspace);
        workspaceRef.current = applied.workspace;
        toast.success(`${aiAgent.name} wrote ${applied.touched.join(', ')}`);
      }

      // Update conversation history
      const historyEntry: AgentMessage = {
        role: 'assistant',
        content: response,
        agentName: aiAgent.name,
      };
      setConversationHistory((prev) => {
        const updated = [...prev, historyEntry];
        // Keep last 20 messages to avoid token overflow
        return updated.slice(-20);
      });

      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % rosterRef.current.length);

      // Brief pause before next agent speaks
      await new Promise((resolve) => setTimeout(resolve, 1500));
      updateAgentStatus(aiAgent.id, 'idle');
    } catch (err: any) {
      updateAgentStatus(aiAgent.id, 'idle');
      rosterRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
      const errMsg = err?.message || 'Unknown error';
      // Ollama runs locally, so failures are almost always "daemon down" or
      // "model not pulled" — both are recoverable, so warn and skip the turn.
      if (/Cannot reach the AICollab server|Failed to fetch|unreadable response/i.test(errMsg)) {
        // No point spending the remaining turns against a server that is gone.
        setSessionStatus('paused');
        toast.error(errMsg, { duration: 10000 });
        return;
      }

      if (/Cannot reach Ollama|ECONNREFUSED|fetch failed/i.test(errMsg)) {
        setSessionStatus('paused');
        toast.error(
          `Ollama is not running — session paused. Start it with "ollama serve", then hit Resume.`,
          { duration: 10000 }
        );
        return;
      } else if (/not found|no such model|pull the model/i.test(errMsg)) {
        toast.warning(
          `${aiAgent.name} skipped — model "${aiAgent.model}" is not installed. Run "ollama pull ${aiAgent.model}".`
        );
      } else {
        toast.error(`${aiAgent.name} failed to respond: ${errMsg}`);
      }
      // Advance to next agent so the session doesn't stall
      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % rosterRef.current.length);
    } finally {
      setIsAgentResponding(false);
      setTurnStartedAt(null);
    }
  }, [topic, elapsedSeconds, updateAgentStatus, incrementAgentMessageCount]);

  // Auto-trigger next turn when session is running and no agent is responding
  useEffect(() => {
    if (sessionStatus !== 'running' || isAgentResponding || turnCount >= maxTurns) return;
    const timeout = setTimeout(() => {
      runNextAgentTurn();
    }, 800);
    return () => clearTimeout(timeout);
  }, [sessionStatus, isAgentResponding, turnCount, currentAgentIndex, runNextAgentTurn]);

  // Stop when max turns reached
  useEffect(() => {
    if (turnCount >= maxTurns && sessionStatus === 'running') {
      setSessionStatus('stopped');
      rosterRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
      toast.success('Session complete — all turns used.');
      synthesizeDeliverable();
    }
  }, [turnCount, sessionStatus, updateAgentStatus]);

  // The Artifacts panel mirrors the shared workspace one-for-one.
  useEffect(() => {
    setArtifacts(
      workspaceFiles(workspace).map((file) => ({
        id: `artifact-${file.name}`,
        name: file.name,
        type:
          file.name === DELIVERABLE_FILE
            ? ('document' as const)
            : file.language === 'markdown' || file.name.endsWith('.md')
              ? ('spec' as const)
              : ('code' as const),
        content: file.content,
        createdBy: file.updatedBy,
        createdAt: file.updatedAt,
        language: file.language,
      }))
    );
  }, [workspace]);

  // Turn the finished workspace into the session's end product.
  const synthesizeDeliverable = useCallback(async () => {
    const currentWorkspace = workspaceRef.current;
    if (Object.keys(currentWorkspace).length === 0) {
      toast.warning('Nothing to summarise — the agents did not write any files.');
      return;
    }

    setIsSynthesizing(true);
    toast.info('Writing the final deliverable…');

    try {
      const author = rosterRef.current[0];
      const deliverable = await produceDeliverable(author, currentWorkspace, topic);
      const next: Workspace = {
        ...currentWorkspace,
        [DELIVERABLE_FILE]: {
          name: DELIVERABLE_FILE,
          content: deliverable,
          language: 'markdown',
          updatedBy: author.name,
          updatedAt: formatTimestamp(elapsedSeconds),
          revision: (currentWorkspace[DELIVERABLE_FILE]?.revision ?? 0) + 1,
        },
      };
      setWorkspace(next);
      workspaceRef.current = next;
      toast.success(`${DELIVERABLE_FILE} is ready — open it in the Artifacts panel or Results.`);
    } catch (err: any) {
      toast.error(`Could not write the deliverable: ${err?.message || 'unknown error'}`);
    } finally {
      setIsSynthesizing(false);
    }
  }, [topic, elapsedSeconds]);

  // Persist the running session so /session-results shows the real transcript.
  useEffect(() => {
    if (!sessionId || !startedAt || sessionStatus === 'idle') return;

    const snapshot: StoredSession = {
      id: sessionId,
      topic,
      status: sessionStatus,
      startedAt,
      updatedAt: new Date().toISOString(),
      elapsedSeconds,
      turnCount,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        model: a.model,
        color: a.color,
        messageCount: a.messageCount,
      })),
      messages: messages.map((m) => ({
        id: m.id,
        agentId: m.agentId,
        agentName: m.agentName,
        agentRole: m.agentRole,
        agentColor: m.agentColor,
        content: m.content,
        timestamp: m.timestamp,
        type: m.type,
        codeLanguage: m.codeLanguage,
      })),
      artifacts: artifacts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        content: a.content,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        language: a.language,
      })),
    };

    saveSession(snapshot);
    // elapsedSeconds ticks every second; it is captured above but intentionally
    // left out of the deps so we only write on real session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, startedAt, sessionStatus, topic, turnCount, messages, artifacts, agents]);

  const handleStart = () => {
    const activeTopic = topicInput.trim() || topic || DEFAULT_TOPIC;
    setTopic(activeTopic);
    setSessionId(`session-${Date.now()}`);
    setStartedAt(new Date().toISOString());
    setMessages([]);
    setArtifacts([]);
    setWorkspace({});
    workspaceRef.current = {};
    lastByAgentRef.current = {};
    setPendingDirective(null);
    setConversationHistory([]);
    setTurnCount(0);
    setCurrentAgentIndex(0);
    setElapsedSeconds(0);
    setAgents((prev) => prev.map((a) => ({ ...a, messageCount: 0, status: 'idle' })));

    // Seed conversation with the topic
    setConversationHistory([
      {
        role: 'user',
        content: `The collaboration topic is: "${activeTopic}". Orion, please start by sharing your initial thoughts as the Architect.`,
      },
    ]);

    setSessionStatus('running');
    toast.success('Session started — AI agents are connecting…');
  };

  const handlePause = () => {
    setSessionStatus('paused');
    rosterRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
    toast.info('Session paused — agents will finish current turn then wait');
  };

  const handleResume = () => {
    setSessionStatus('running');
    toast.success('Session resumed');
  };

  const handleStop = () => {
    setSessionStatus('stopped');
    rosterRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
    synthesizeDeliverable();
  };

  // Human turn: goes into the transcript and steers the next agent.
  const handleSendUserMessage = () => {
    const text = userInput.trim();
    if (!text) return;

    const message: ChatMessage = {
      id: `msg-user-${Date.now()}`,
      agentId: 'human',
      agentName: 'You',
      agentRole: 'pm',
      agentColor: '#f59e0b',
      content: text,
      timestamp: formatTimestamp(elapsedSeconds),
      type: 'message',
    };

    setMessages((prev) => [...prev, message]);
    setConversationHistory((prev) => [...prev, { role: 'user', content: `Human: ${text}` }]);
    setPendingDirective(text);
    setUserInput('');
    toast.success('Sent — the next agent will address it');
  };

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
          <div
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              sessionStatus === 'running'
                ? 'bg-positive live-indicator'
                : sessionStatus === 'paused'
                  ? 'bg-warning'
                  : 'bg-muted-foreground'
            }`}
          />
          <span className="text-sm font-medium text-foreground truncate">
            {sessionStatus === 'idle'
              ? 'AI Collaboration Room'
              : topic.slice(0, 40) + (topic.length > 40 ? '…' : '')}
          </span>
          {sessionStatus !== 'idle' && (
            <span className="badge-mode-build text-xs hidden sm:inline-flex">Live</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Session timer */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
          </div>

          {/* Turn count */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ChatBubbleLeftRightIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">
              {turnCount}/{maxTurns}
            </span>
          </div>

          {/* Controls */}
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

          {/* Artifact toggle */}
          <button
            onClick={() => setArtifactPanelOpen(!artifactPanelOpen)}
            className={`btn-ghost text-xs gap-1.5 py-1.5 ${artifactPanelOpen ? 'text-accent' : ''}`}
            title={artifactPanelOpen ? 'Hide artifacts panel' : 'Show artifacts panel'}
          >
            <Icon name="DocumentDuplicateIcon" size={14} />
            <span className="hidden sm:inline">Artifacts</span>
            <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">
              {artifacts.length}
            </span>
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
      />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat feed */}
        <div
          className={`flex flex-col flex-1 overflow-hidden transition-all duration-300 ${artifactPanelOpen ? '' : 'w-full'}`}
        >
          {sessionStatus === 'idle' ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-6 px-6">
              <div className="text-center max-w-lg">
                <div className="flex items-center justify-center gap-3 mb-4">
                  {roster.map((a) => (
                    <div
                      key={a.id}
                      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: `${a.color}22`,
                        color: a.color,
                        border: `2px solid ${a.color}44`,
                      }}
                    >
                      {a.name.charAt(0)}
                    </div>
                  ))}
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">AI Collaboration Room</h2>
                <p className="text-xs font-mono mb-2">
                  {modelsLoading ? (
                    <span className="text-muted-foreground">Checking Ollama…</span>
                  ) : modelsError ? (
                    <span className="text-warning">
                      Ollama unreachable at {ollamaBaseUrl || 'localhost:11434'} — run "ollama
                      serve"
                    </span>
                  ) : (
                    <span className="text-positive">
                      Ollama connected · {availableModels.length} models installed
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  {roster.length} local agents work in real time, writing into a shared file
                  workspace — no API keys, no credits.
                </p>
                {distinctModels(roster).length > 1 && (
                  <p className="text-xs text-warning mb-3">
                    Roster spans {distinctModels(roster).length} models — Ollama will reload a model
                    every turn, which is slow. Same model for all agents runs far faster.
                  </p>
                )}
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
              <div className="flex items-center gap-6 text-xs text-muted-foreground">
                {roster.map((a) => (
                  <div key={a.id} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span style={{ color: a.color }}>{a.name}</span>
                    <span className="text-muted-foreground/60">({a.role})</span>
                    <span className="font-mono text-muted-foreground/50">{a.model}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ChatFeed
              messages={messages}
              agents={agents}
              sessionStatus={sessionStatus === 'idle' ? 'stopped' : sessionStatus}
            />
          )}

          {/* Human input — join the conversation at any time */}
          {sessionStatus !== 'idle' && (
            <div className="border-t border-border bg-card/60 px-4 py-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendUserMessage();
                    }
                  }}
                  placeholder="Steer the agents — ask for a change, challenge a decision, set a constraint…"
                  className="input-base text-sm flex-1"
                />
                <button
                  onClick={handleSendUserMessage}
                  disabled={!userInput.trim()}
                  className="btn-primary text-xs gap-1.5 disabled:opacity-40"
                >
                  <Icon name="PaperAirplaneIcon" size={14} />
                  Send
                </button>
                <button
                  onClick={synthesizeDeliverable}
                  disabled={isSynthesizing}
                  className="btn-secondary text-xs gap-1.5 disabled:opacity-40"
                  title="Write DELIVERABLE.md from the current workspace"
                >
                  <Icon name="DocumentCheckIcon" size={14} />
                  {isSynthesizing ? 'Writing…' : 'Deliverable'}
                </button>
              </div>
              {isAgentResponding && turnSeconds > 5 && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {rosterRef.current[currentAgentIndex]?.name || 'Agent'} has been generating for{' '}
                  {turnSeconds}s — local models are slow when they do not fit in VRAM.
                </p>
              )}
              {pendingDirective && (
                <p className="text-xs text-warning mt-1.5">
                  Queued for the next agent: “{pendingDirective}”
                </p>
              )}
            </div>
          )}
        </div>

        {/* Artifact sidebar */}
        {artifactPanelOpen && (
          <div className="w-80 xl:w-96 flex-shrink-0 border-l border-border overflow-hidden flex flex-col">
            <ArtifactSidebar artifacts={artifacts} />
          </div>
        )}
      </div>
    </div>
  );
}

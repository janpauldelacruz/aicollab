'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import ChatFeed from './ChatFeed';
import ArtifactSidebar from './ArtifactSidebar';
import AgentStatusBar from './AgentStatusBar';
import { REAL_AI_AGENTS, getAgentResponse, buildAgentFromConfig } from '@/lib/ai/multiAgentChat';
import type { AIAgent, AgentMessage } from '@/lib/ai/multiAgentChat';
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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

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
  const MAX_TURNS = 50;
  const { user } = useAuth();

  // Get current session ID from sessionStorage
  const getCurrentSessionId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem('currentSessionId');
  };

  const sessionStatusRef = useRef(sessionStatus);
  const isAgentRespondingRef = useRef(isAgentResponding);
  const currentAgentIndexRef = useRef(currentAgentIndex);
  const conversationHistoryRef = useRef(conversationHistory);
  const turnCountRef = useRef(turnCount);
  const activeAIAgentsRef = useRef(activeAIAgents);

  sessionStatusRef.current = sessionStatus;
  isAgentRespondingRef.current = isAgentResponding;
  currentAgentIndexRef.current = currentAgentIndex;
  conversationHistoryRef.current = conversationHistory;
  turnCountRef.current = turnCount;
  activeAIAgentsRef.current = activeAIAgents;

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

  const updateAgentStatus = useCallback((agentId: string, status: LiveAgent['status']) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, status } : a))
    );
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
      turnCountRef.current >= MAX_TURNS
    ) return;

    const currentAgents = activeAIAgentsRef.current;
    const agentIndex = currentAgentIndexRef.current % currentAgents.length;
    const aiAgent: AIAgent = currentAgents[agentIndex];

    setIsAgentResponding(true);
    updateAgentStatus(aiAgent.id, 'thinking');

    // Set others to waiting
    currentAgents.forEach((a, i) => {
      if (i !== agentIndex) updateAgentStatus(a.id, 'waiting');
    });

    try {
      const response = await getAgentResponse(
        aiAgent,
        conversationHistoryRef.current,
        topic
      );

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
        agentRole: aiAgent.role as AgentRole,
        agentColor: aiAgent.color,
        content: response,
        timestamp: formatTimestamp(elapsedSeconds),
        type: 'message',
      };

      setMessages((prev) => [...prev, newMessage]);
      incrementAgentMessageCount(aiAgent.id);

      // Persist message to Supabase
      const sessionId = getCurrentSessionId();
      if (sessionId && user) {
        insertMessage(sessionId, {
          agentId: aiAgent.id,
          agentName: aiAgent.name,
          agentRole: aiAgent.role,
          agentColor: aiAgent.color,
          content: response,
          type: 'message',
          elapsedSeconds,
        });
        trackEvent('agent_turn', user.id, sessionId, {}, aiAgent.model, aiAgent.name);
        trackGAEvent('agent_turn', { model: aiAgent.model, agent_name: aiAgent.name });
      }

      // Update conversation history
      const historyEntry: AgentMessage = {
        role: 'assistant',
        content: response,
        agentName: aiAgent.name,
      };
      setConversationHistory((prev) => {
        const updated = [...prev, historyEntry];
        return updated.slice(-20);
      });

      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % currentAgents.length);

      await new Promise((resolve) => setTimeout(resolve, 1500));
      updateAgentStatus(aiAgent.id, 'idle');
    } catch (err: any) {
      updateAgentStatus(aiAgent.id, 'idle');
      currentAgents.forEach((a) => updateAgentStatus(a.id, 'idle'));
      const errMsg = err?.message || 'Unknown error';
      if (
        errMsg.includes('401') ||
        errMsg.includes('API key') ||
        errMsg.includes('Authentication') ||
        errMsg.includes('429') ||
        errMsg.includes('credits') ||
        errMsg.includes('RateLimit') ||
        errMsg.includes('rate limit') ||
        errMsg.includes('billing')
      ) {
        const isCredits = errMsg.includes('credits') || errMsg.includes('billing');
        toast.warning(
          isCredits
            ? `${aiAgent.name} skipped — no API credits remaining. Add credits to continue using this agent.`
            : `${aiAgent.name} skipped — API key not configured or rate limited. Check your API key to enable this agent.`
        );
      } else {
        toast.error(`${aiAgent.name} failed to respond: ${errMsg}`);
      }
      setTurnCount((t) => t + 1);
      setCurrentAgentIndex((prev) => (prev + 1) % currentAgents.length);
    } finally {
      setIsAgentResponding(false);
    }
  }, [topic, elapsedSeconds, updateAgentStatus, incrementAgentMessageCount]);

  // Auto-trigger next turn when session is running and no agent is responding
  useEffect(() => {
    if (sessionStatus !== 'running' || isAgentResponding || turnCount >= MAX_TURNS) return;
    const timeout = setTimeout(() => {
      runNextAgentTurn();
    }, 800);
    return () => clearTimeout(timeout);
  }, [sessionStatus, isAgentResponding, turnCount, currentAgentIndex, runNextAgentTurn]);

  // Stop when max turns reached
  useEffect(() => {
    if (turnCount >= MAX_TURNS && sessionStatus === 'running') {
      setSessionStatus('stopped');
      activeAIAgentsRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
      toast.success('Session complete — all turns used. View results!');
    }
  }, [turnCount, sessionStatus, updateAgentStatus]);

  const handleStart = () => {
    const activeTopic = topicInput.trim() || DEFAULT_TOPIC;
    setTopic(activeTopic);
    setMessages([]);
    setConversationHistory([]);
    setTurnCount(0);
    setCurrentAgentIndex(0);
    setElapsedSeconds(0);
    setAgents((prev) => prev.map((a) => ({ ...a, messageCount: 0, status: 'idle' })));

    const firstAgent = activeAIAgentsRef.current[0];
    setConversationHistory([
      {
        role: 'user',
        content: `The collaboration topic is: "${activeTopic}". ${firstAgent.name}, please start by sharing your initial thoughts as the ${firstAgent.role}.`,
      },
    ]);

    setSessionStatus('running');
    toast.success('Session started — AI agents are connecting…');

    // Persist status to Supabase
    const sessionId = getCurrentSessionId();
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'running');
      trackEvent('session_start', user.id, sessionId, { topic: activeTopic });
      trackGAEvent('session_start', { session_id: sessionId, topic: activeTopic });
    }
  };

  const handlePause = () => {
    setSessionStatus('paused');
    activeAIAgentsRef.current.forEach((a) => updateAgentStatus(a.id, 'idle'));
    toast.info('Session paused — agents will finish current turn then wait');

    const sessionId = getCurrentSessionId();
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'paused', { elapsed_seconds: elapsedSeconds, turn_count: turnCount });
      trackEvent('session_pause', user.id, sessionId, {});
    }
  };

  const handleResume = () => {
    setSessionStatus('running');
    toast.success('Session resumed');

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

    const sessionId = getCurrentSessionId();
    const completionPct = MAX_TURNS > 0 ? Math.min(100, Math.round((turnCount / MAX_TURNS) * 100)) : 0;
    if (sessionId && user) {
      updateSessionStatus(sessionId, 'stopped', {
        elapsed_seconds: elapsedSeconds,
        turn_count: turnCount,
        message_count: messages.length,
        artifact_count: artifacts.length,
        completion_pct: completionPct,
      });
      trackEvent('session_stop', user.id, sessionId, { turn_count: turnCount, completion_pct: completionPct });
      trackGAEvent('session_stop', { session_id: sessionId, completion_pct: completionPct });
    }
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
              sessionStatus === 'running' ? 'bg-positive live-indicator'
                : sessionStatus === 'paused' ? 'bg-warning' : 'bg-muted-foreground'
            }`}
          />
          <span className="text-sm font-medium text-foreground truncate">
            {sessionStatus === 'idle' ? 'AI Collaboration Room' : topic.slice(0, 40) + (topic.length > 40 ? '…' : '')}
          </span>
          {sessionStatus !== 'idle' && (
            <span className="badge-mode-build text-xs hidden sm:inline-flex">Live</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* Session timer */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ClockIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">{formatElapsed(elapsedSeconds)}</span>
          </div>

          {/* Turn count */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border">
            <Icon name="ChatBubbleLeftRightIcon" size={13} className="text-muted-foreground" />
            <span className="text-xs font-mono text-foreground tabular-nums">{turnCount}/{MAX_TURNS}</span>
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
            <span className="bg-accent/20 text-accent text-xs px-1.5 py-0.5 rounded-full font-mono">{artifacts.length}</span>
          </button>

          <Link href="/session-results" className="btn-secondary text-xs gap-1.5 py-1.5">
            <Icon name="ChartBarIcon" size={14} />
            <span className="hidden sm:inline">Results</span>
          </Link>
        </div>
      </header>

      {/* Agent status bar */}
      <AgentStatusBar agents={agents} sessionStatus={sessionStatus === 'idle' ? 'stopped' : sessionStatus} />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
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
                  {activeAIAgents.map((a) => a.name).join(', ')} will talk to each other in real time.
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  Set a topic and watch them collaborate. Configure agents in{' '}
                  <Link href="/session-setup" className="text-accent hover:underline">Session Setup</Link> to use any AI model.
                </p>
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
      </div>
    </div>
  );
}
const MOCK_ARTIFACTS: any = null;

export { MOCK_ARTIFACTS };
const MOCK_MESSAGES: any = null;

export { MOCK_MESSAGES };
const LIVE_AGENTS: any = null;

export { LIVE_AGENTS };
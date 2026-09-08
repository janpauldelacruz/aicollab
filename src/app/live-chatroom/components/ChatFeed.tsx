'use client';
import React, { useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { ChatMessage, LiveAgent } from './LiveChatroomClient';

interface Props {
  messages: ChatMessage[];
  agents: LiveAgent[];
  sessionStatus: 'running' | 'paused' | 'stopped';
}

const ROLE_LABELS: Record<string, string> = {
  pm: 'PM',
  coder: 'Coder',
  designer: 'Designer',
  critic: 'Critic',
  architect: 'Architect',
  brainstormer: 'Brainstormer',
  researcher: 'Researcher',
};

function CodeBlock({ content, language }: { content: string; language?: string }) {
  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
        <span className="text-xs font-mono text-muted-foreground">{language || 'code'}</span>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <Icon name="ClipboardDocumentIcon" size={12} />
          Copy
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono text-foreground leading-relaxed bg-background/60">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function MessageBubble({ message, isFirst }: { message: ChatMessage; isFirst: boolean }) {
  const isDecision = message.type === 'decision';
  const isArtifact = message.type === 'artifact';

  if (isDecision) {
    return (
      <div className="message-enter flex items-start gap-2 py-2 px-4 mx-2 rounded-xl bg-positive/5 border border-positive/20 my-2">
        <Icon name="CheckCircleIcon" size={16} className="text-positive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ color: message.agentColor }}>{message.agentName}</span>
            <span className="text-xs text-positive/80 font-medium">Decision</span>
            <span className="text-xs text-muted-foreground font-mono ml-auto">{message.timestamp}</span>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="message-enter flex items-start gap-3 px-4 py-2 hover:bg-muted/20 transition-colors group">
      {isFirst && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5"
          style={{ backgroundColor: `${message.agentColor}22`, color: message.agentColor, border: `1px solid ${message.agentColor}44` }}
        >
          {message.agentName.charAt(0)}
        </div>
      )}
      {!isFirst && <div className="w-8 flex-shrink-0" />}

      <div className="flex-1 min-w-0">
        {isFirst && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold" style={{ color: message.agentColor }}>{message.agentName}</span>
            <span className="text-xs text-muted-foreground/70 px-1.5 py-0.5 rounded bg-muted/40">
              {ROLE_LABELS[message.agentRole]}
            </span>
            <span className="text-xs text-muted-foreground font-mono">{message.timestamp}</span>
          </div>
        )}

        {message.replyTo && (
          <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
            <Icon name="ArrowUturnLeftIcon" size={11} />
            <span>Replying to a previous message</span>
          </div>
        )}

        {message.type === 'code' ? (
          <div>
            {message.content.split('\n')[0].startsWith('//') || message.content.startsWith('--') || message.content.startsWith('┌') ? null : (
              <p className="text-sm text-foreground leading-relaxed mb-1">{message.content.split('\n')[0]}</p>
            )}
            <CodeBlock
              content={message.content}
              language={message.codeLanguage}
            />
            {message.artifactId && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-accent">
                <Icon name="DocumentArrowDownIcon" size={13} />
                <span>Saved as artifact</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground leading-relaxed">{message.content}</p>
        )}
      </div>
    </div>
  );
}

export default function ChatFeed({ messages, agents, sessionStatus }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const thinkingAgents = agents.filter((a) => a.status === 'thinking' && sessionStatus === 'running');

  // Group consecutive messages from same agent
  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1].agentId !== msg.agentId,
  }));

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-0.5">
      {grouped.map((msg) => (
        <MessageBubble key={msg.id} message={msg} isFirst={msg.isFirst} />
      ))}

      {/* Thinking indicators */}
      {thinkingAgents.map((agent) => (
        <div key={`thinking-${agent.id}`} className="flex items-center gap-3 px-4 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ backgroundColor: `${agent.color}22`, color: agent.color, border: `1px solid ${agent.color}44` }}
          >
            {agent.name.charAt(0)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: agent.color }}>{agent.name}</span>
            <div className="thinking-dots flex gap-1 items-center px-3 py-2 rounded-xl bg-muted/40">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground inline-block" />
            </div>
          </div>
        </div>
      ))}

      {sessionStatus === 'paused' && (
        <div className="flex items-center justify-center py-4 mx-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-warning/10 border border-warning/20">
            <Icon name="PauseCircleIcon" size={15} className="text-warning" />
            <span className="text-xs text-warning font-medium">Session paused — agents are waiting</span>
          </div>
        </div>
      )}

      {sessionStatus === 'stopped' && (
        <div className="flex items-center justify-center py-4 mx-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border border-border">
            <Icon name="StopCircleIcon" size={15} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground font-medium">Session ended — compiling results…</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: unknown;
}

type TopicKey = 'overall' | 'relationship' | 'career' | 'finance' | 'health' | 'personality';
type Message = { role: 'assistant'; content: string };

const TOPICS: { key: TopicKey; label: string }[] = [
  { key: 'overall', label: '命格' },
  { key: 'relationship', label: '感情' },
  { key: 'career', label: '事业' },
  { key: 'finance', label: '财运' },
  { key: 'health', label: '身心' },
  { key: 'personality', label: '性格' },
];

function ReportText({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, index) => {
        const heading = line.match(/^\*\*【(.+?)】\*\*$/);
        if (heading) {
          return (
            <div key={index} className="pt-3 pb-1 text-[12px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
              【{heading[1]}】
            </div>
          );
        }
        if (!line.trim()) return <div key={index} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/g);
        return (
          <p key={index} className="text-[12px] leading-[1.85] whitespace-pre-wrap" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, i) => i % 2 ? <strong key={i} style={{ color: 'var(--t-text)' }}>{part}</strong> : part)}
          </p>
        );
      })}
      {streaming && <span className="inline-block ml-1 h-3 w-1.5 animate-pulse rounded-sm" style={{ background: 'var(--t-gold)' }} />}
    </div>
  );
}

export default function InsightPanel({ chart, selectedPalace }: InsightPanelProps) {
  const [activeTopic, setActiveTopic] = useState<TopicKey>('overall');
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);

  const loadTopic = useCallback(async (topicKey: TopicKey) => {
    requestId.current += 1;
    const thisRequest = requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setActiveTopic(topicKey);
    setMessage({ role: 'assistant', content: '' });
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, topicKey, mode: 'topic' }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('解读请求失败，请稍后重试。');
      if (!response.body) throw new Error('服务器没有返回解读内容。');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const payload = JSON.parse(data) as { delta?: { text?: string } };
            fullText += payload.delta?.text || '';
            if (requestId.current === thisRequest) setMessage({ role: 'assistant', content: fullText });
          } catch {
            // 忽略不完整的数据行，继续读取后续内容。
          }
        }
        if (done) break;
      }
      if (requestId.current === thisRequest && !fullText) {
        setMessage({ role: 'assistant', content: '这次没有生成解读内容，请重新点击主题试试。' });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestId.current === thisRequest) {
        setMessage(null);
        setError(err instanceof Error ? err.message : '网络异常，请稍后重试。');
      }
    } finally {
      if (requestId.current === thisRequest) setLoading(false);
    }
  }, [chart]);

  const loadPalace = useCallback(async (palaceName: string) => {
    requestId.current += 1;
    const thisRequest = requestId.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setMessage({ role: 'assistant', content: '' });
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, mode: 'palace', requestedPalace: palaceName }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error('宫位解读请求失败，请稍后重试。');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const payload = JSON.parse(data) as { delta?: { text?: string } };
            fullText += payload.delta?.text || '';
            if (requestId.current === thisRequest) setMessage({ role: 'assistant', content: fullText });
          } catch { /* 忽略不完整的数据行 */ }
        }
        if (done) break;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (requestId.current === thisRequest) {
        setMessage(null);
        setError(err instanceof Error ? err.message : '网络异常，请稍后重试。');
      }
    } finally {
      if (requestId.current === thisRequest) setLoading(false);
    }
  }, [chart]);

  useEffect(() => {
    if (initialLoaded.current) return;
    initialLoaded.current = true;
    void loadTopic('overall');
    return () => abortRef.current?.abort();
  }, [loadTopic]);

  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) return;
    lastPalaceBranch.current = selectedPalace.branch;
    void loadPalace(selectedPalace.name);
  }, [selectedPalace, loadPalace]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTopic]);

  return (
    <section className="flex h-[min(44rem,80dvh)] min-h-0 min-w-0 flex-col overflow-hidden rounded-xl card-glass">
      <div className="flex-shrink-0 px-2 pb-2 pt-2.5" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-6 gap-1">
          {TOPICS.map((topic) => {
            const active = activeTopic === topic.key;
            return (
              <button
                key={topic.key}
                type="button"
                onClick={() => void loadTopic(topic.key)}
                disabled={loading && active}
                className="rounded-lg py-2 text-[10px] font-medium transition-colors disabled:opacity-60"
                style={{
                  background: active ? 'rgba(212,168,67,0.12)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(212,168,67,0.38)' : 'var(--t-border)'}`,
                  color: active ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        {loading && !message?.content && (
          <div className="py-8 text-center text-[11px]" style={{ color: 'var(--t-faint)' }}>
            正在根据这张命盘整理「{TOPICS.find((item) => item.key === activeTopic)?.label}」解读…
          </div>
        )}
        {error && <p className="py-6 text-center text-[12px]" style={{ color: 'var(--t-text2)' }}>{error}</p>}
        {message && <ReportText text={message.content} streaming={loading} />}
      </div>

      <div className="flex-shrink-0 px-3 py-2 text-center text-[9px]" style={{ borderTop: '1px solid var(--t-border)', color: 'var(--t-faint)' }}>
        传统文化视角的自我观察参考；不作命运保证、疾病预测或投资判断。
      </div>
    </section>
  );
}

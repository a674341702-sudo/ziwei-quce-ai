'use client'

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean;
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
}

type TopicKey =
  | 'overall'
  | 'relationship'
  | 'career'
  | 'finance'
  | 'health'
  | 'personality';

interface RequestOptions {
  topicKey?: TopicKey;
  mode?: 'topic' | 'palace' | 'sihua';
  requestedPalace?: string;
}

const TOPICS: { key: TopicKey; label: string }[] = [
  { key: 'overall', label: '命格' },
  { key: 'relationship', label: '感情' },
  { key: 'career', label: '事业' },
  { key: 'finance', label: '财运' },
  { key: 'health', label: '身心' },
  { key: 'personality', label: '性格' },
];

const TOPIC_PROMPTS: Record<TopicKey, string> = {
  overall: `请根据这张实际命盘进行命格整体分析。
依次分析命宫主星与星曜组合、命宫三方四正、已满足条件的格局、本命生年四化及当前十年大限。
说明判断依据，区分命盘明确显示的结构与传统解释上的倾向。
请用原创、通俗的中文表达，不引用任何老师或作者的原话。
最后总结命主的优势、需要留意的地方和现实行动建议。`,
  relationship: `请根据这张实际命盘分析感情与婚姻主题。
以夫妻宫为核心，结合命宫、福德宫、迁移宫及相关三方四正，核对星曜组合、格局和本命／大限／流年四化。
分析关系需求、相处方式、沟通特点、可能的磨合点与不同阶段的变化。
必须说明每个判断对应的宫位和星曜依据，不要只凭单星下结论。
使用原创通俗表达，不引用任何老师或作者的原话；不把命盘倾向说成必然事件。`,
  career: `请根据这张实际命盘深度分析事业发展。
以官禄宫为核心，重点结合命宫、财帛宫、迁移宫、交友宫及三方四正。
分析适合的工作方式、执行与管理特点、任职和自主经营的倾向、合作环境及发展阶段。
核对本命、大限与流年四化，说明事业判断的具体星曜和宫位依据。
用原创通俗表达，不引用任何老师或作者原话，并给出可执行的现实建议。`,
  finance: `请根据这张实际命盘分析一生财运与财富模式。
以财帛宫为核心，结合福德宫、田宅宫、官禄宫、命宫及三方四正。
分析收入来源倾向、赚钱方式、消费与积累习惯、资产稳定性；逐步梳理每一步十年大限的财运主题。
核对本命、大限与流年四化，说明每项判断的星曜和宫位依据。
不得承诺发财或预测具体投资收益；使用原创通俗表达，并给出现实的财务管理建议。`,
  health: `请以传统文化角度分析命盘中的身心状态与生活节奏。
可观察疾厄宫、命宫、福德宫及相关星曜组合，讨论压力应对、作息节奏、情绪调节和日常习惯方面的提醒。
只作传统文化与自我观察参考，不推断疾病、不判断器官病变、不预测寿命，也不提供医疗诊断。
使用温和、原创、通俗的中文表达，并给出一般性的生活管理建议。`,
  personality: `请根据这张实际命盘分析性格特点。
以命宫为核心，结合福德宫、迁移宫、官禄宫及三方四正，分析思考方式、行动风格、情绪需求、人际互动、优势和容易遇到的成长课题。
必须结合实际星曜位置与组合说明依据，不要只给通用性格标签。
使用原创通俗表达，不引用任何老师或作者的原话。`,
};

const PALACE_ROLES: Record<string, string> = {
  命宫: '自我认知、性格与人生方向',
  兄弟宫: '手足关系、同辈互动与合作资源',
  夫妻宫: '亲密关系、婚姻与长期合作',
  子女宫: '子女缘分、创作表达与部属互动',
  财帛宫: '收入模式、财务习惯与资源运用',
  疾厄宫: '身心状态、压力与生活习惯',
  迁移宫: '外部环境、异地发展与对外表现',
  交友宫: '朋友圈层、团队协作与人脉经营',
  官禄宫: '职业方向、事业方式与社会角色',
  田宅宫: '居住环境、家庭资产与稳定基础',
  福德宫: '内在需求、精神状态与休闲方式',
  父母宫: '家庭互动、长辈关系与文书事务',
};

/** 将接口返回的简易 Markdown 转成项目原有的金色标题样式。 */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: 'var(--t-gold)' }}
              >
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }

        if (line.trim() === '') return <div key={i} className="h-1" />;

        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div
            key={i}
            className="text-[11px] leading-relaxed"
            style={{ color: 'var(--t-text2)' }}
          >
            {parts.map((part, j) =>
              j % 2 === 0 ? (
                part
              ) : (
                <strong
                  key={j}
                  className="font-medium"
                  style={{ color: 'var(--t-text)' }}
                >
                  {part}
                </strong>
              ),
            )}
          </div>
        );
      })}

      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}

export default function InsightPanel({
  chart,
  selectedPalace,
  selectedSiHua,
}: InsightPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<TopicKey>('overall');

  const messagesRef = useRef<Message[]>([]);
  const loadingRef = useRef(false);
  const autoLoaded = useRef(false);
  const lastPalaceBranch = useRef<number | undefined>(undefined);
  const lastSiHuaKey = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const streamResponse = async (
    apiMessages: { role: 'user' | 'assistant'; content: string }[],
    options: RequestOptions = {},
  ) => {
    let assistantIndex = -1;

    try {
      const res = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chart,
          messages: apiMessages,
          ...(options.topicKey ? { topicKey: options.topicKey } : {}),
          mode: options.mode ?? 'topic',
          ...(options.requestedPalace
            ? { requestedPalace: options.requestedPalace }
            : {}),
        }),
      });

      if (res.status === 404) throw new Error('api-missing');
      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(errorText || '请求失败');
      }
      if (!res.body) throw new Error('无响应流');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      setMessages(prev => {
        assistantIndex = prev.length;
        return [...prev, { role: 'assistant', content: '' }];
      });

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;

          try {
            const payload = JSON.parse(data);
            assistantText += payload.delta?.text ?? '';
            setMessages(prev =>
              prev.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: assistantText }
                  : message,
              ),
            );
          } catch {
            // 忽略不完整或非 JSON 数据行，继续读取后续数据。
          }
        }

        if (done) break;
      }

      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            const payload = JSON.parse(data);
            assistantText += payload.delta?.text ?? '';
            setMessages(prev =>
              prev.map((message, index) =>
                index === assistantIndex
                  ? { ...message, content: assistantText }
                  : message,
              ),
            );
          } catch {
            // 忽略末尾不完整数据。
          }
        }
      }

      if (!assistantText) {
        setMessages(prev =>
          prev.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: '本次没有收到解读内容，请稍后重试。' }
              : message,
          ),
        );
      }
    } catch (error) {
      const missing = error instanceof Error && error.message === 'api-missing';
      const errorMessage = missing
        ? '解读接口暂时不可用。请确认 /api/interpret 已部署成功后再试。'
        : '解读请求失败，请检查网络后重试。';

      setMessages(prev => {
        if (assistantIndex >= 0) {
          return prev.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: errorMessage }
              : message,
          );
        }
        return [...prev, { role: 'assistant', content: errorMessage }];
      });
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  const sendMessage = (
    text: string,
    hidden = false,
    options: RequestOptions = {},
  ) => {
    if (!text.trim() || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);

    const userMsg: Message = { role: 'user', content: text, hidden };
    const apiMessages = [...messagesRef.current, userMsg].map(message => ({
      role: message.role,
      content: message.content,
    }));

    const nextMessages = [...messagesRef.current, userMsg];
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
    setInput('');

    void streamResponse(apiMessages, options);
  };

  // 首次打开时自动生成命格总览。
  useEffect(() => {
    if (autoLoaded.current) return;
    autoLoaded.current = true;
    sendMessage(TOPIC_PROMPTS.overall, true, {
      topicKey: 'overall',
      mode: 'topic',
    });
    // 只在组件首次挂载时执行一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 点击某个宫位时，明确告诉后端这是宫位专项分析。
  useEffect(() => {
    if (!selectedPalace || selectedPalace.branch === lastPalaceBranch.current) {
      return;
    }

    lastPalaceBranch.current = selectedPalace.branch;
    const role = PALACE_ROLES[selectedPalace.name] ?? '该宫位所代表的生活领域';
    const majorStars = selectedPalace.stars.filter(star => star.type === 'major');
    const starDesc = majorStars.length
      ? majorStars
          .map(star => `${star.name}${star.siHua ? `化${star.siHua}` : ''}`)
          .join('、')
      : '空宫，请结合对宫借星及三方四正判断';

    const prompt = `请对【${selectedPalace.name}】进行宫位专项分析。
该宫主管：${role}。
当前宫位主星信息：${starDesc}。
请结合该宫实际星曜、亮度、辅曜煞曜、对宫借星及三方四正进行分析，并核对相关四化。
说明每项判断的命盘依据，最后给出具体建议。
使用原创通俗表达，不引用任何老师或作者原话；健康相关内容只作生活习惯提醒，不作疾病判断。`;

    sendMessage(prompt, true, {
      mode: 'palace',
      requestedPalace: selectedPalace.name,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPalace]);

  // 点击四化标记时，明确告诉后端四化星曜、类别与时间层次。
  useEffect(() => {
    if (!selectedSiHua) return;

    const key = `${selectedSiHua.starName}-${selectedSiHua.siHua}-${selectedSiHua.view}`;
    if (key === lastSiHuaKey.current) return;
    lastSiHuaKey.current = key;

    const palaceOfStar = chart.palaces.find(palace =>
      palace.stars.some(star => star.name === selectedSiHua.starName),
    );
    const palaceName = palaceOfStar?.name;
    const viewLabel =
      selectedSiHua.view === 'daxian'
        ? '大限'
        : selectedSiHua.view === 'liunian'
          ? '流年'
          : '本命';

    const prompt = `请分析【${viewLabel}${selectedSiHua.starName}化${selectedSiHua.siHua}】。
${selectedSiHua.view === 'liunian' ? `分析年份：${new Date().getFullYear()}年。` : ''}
请核对这颗星的实际落宫、对应来源天干、三方四正，以及本命、大限、流年不同层次的区别。
不要把不同层次混为一谈；请说明能够从当前命盘确认的依据和无法确认的部分。
最后给出与该宫位主题相关的现实观察建议。`;

    sendMessage(prompt, true, {
      mode: 'sihua',
      ...(palaceName ? { requestedPalace: palaceName } : {}),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiHua, chart]);

  const handleTopicClick = (topicKey: TopicKey) => {
    if (loadingRef.current) return;
    setActiveTopic(topicKey);
    sendMessage(TOPIC_PROMPTS[topicKey], true, {
      topicKey,
      mode: 'topic',
    });
  };

  const handleSend = () => {
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[min(44rem,80dvh)] min-h-0 min-w-0 rounded-xl overflow-hidden card-glass">
      {/* 六大主题 */}
      <div
        className="flex-shrink-0 px-2 pt-2.5 pb-2"
        style={{ borderBottom: '1px solid var(--t-border)' }}
      >
        <div className="grid grid-cols-6 gap-1">
          {TOPICS.map(topic => {
            const isActive = activeTopic === topic.key;
            return (
              <button
                key={topic.key}
                onClick={() => handleTopicClick(topic.key)}
                disabled={loading}
                className="py-1.5 text-[10px] font-medium rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{
                  background: isActive ? 'rgba(212,168,67,0.12)' : 'transparent',
                  border: `1px solid ${
                    isActive ? 'rgba(212,168,67,0.3)' : 'var(--t-border)'
                  }`,
                  color: isActive ? 'var(--t-gold)' : 'var(--t-faint)',
                }}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 解读消息 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div
              className="text-4xl mb-3"
              style={{ color: 'var(--t-gold)', opacity: 0.1 }}
            >
              ✦
            </div>
            <p
              className="text-[10px] animate-pulse"
              style={{ color: 'var(--t-faint)' }}
            >
              命格解读生成中…
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message, index) => {
            if (message.role === 'user' && message.hidden) return null;

            if (message.role === 'user') {
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-end"
                >
                  <div
                    className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                    style={{
                      background: 'rgba(212,168,67,0.08)',
                      border: '1px solid rgba(212,168,67,0.18)',
                      color: 'var(--t-gold)',
                    }}
                  >
                    {message.content}
                  </div>
                </motion.div>
              );
            }

            const isLastMessage = index === messages.length - 1;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div
                  className="text-[9px] tracking-widest mb-2 flex items-center gap-1.5"
                  style={{ color: 'var(--t-faint)' }}
                >
                  <span style={{ color: 'var(--t-gold)', opacity: 0.4 }}>✦</span>
                  命理解读
                </div>
                <AiContent
                  text={message.content}
                  streaming={loading && isLastMessage}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 继续追问 */}
      <div
        className="flex-shrink-0 px-3 pb-3 pt-2"
        style={{ borderTop: '1px solid var(--t-border)' }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) handleSend();
            }}
            placeholder="继续追问，如：今年适合换工作吗？"
            disabled={loading}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{
              background: 'var(--t-card)',
              border: '1px solid var(--t-border)',
              color: 'var(--t-text)',
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.25)',
              color: 'var(--t-gold)',
            }}
          >
            {loading ? '…' : '追问'}
          </button>
        </div>
      </div>
    </div>
  );
}

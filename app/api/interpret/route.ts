import { NextRequest } from 'next/server';
import type { ZiweiChart, Palace, Star, SiHua } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';
import {
  detectSelfSihua,
  getDaXianSiHua,
  getLiuNianSiHua,
  getSiHuaByStem,
} from '@/lib/ziwei/sihua';

export const runtime = 'nodejs';

type TopicKey =
  | 'overall'
  | 'personality'
  | 'relationship'
  | 'career'
  | 'job_change'
  | 'business'
  | 'promotion'
  | 'finance'
  | 'health';

type Topic = {
  key: TopicKey;
  title: string;
  mainPalace: string;
  relatedPalaces: string[];
  focus: string;
};

const palaceRoles: Record<string, string> = {
  命宫: '性格底色、行动方式与人生方向',
  兄弟宫: '同辈关系、手足互动与合作资源',
  夫妻宫: '亲密关系、伴侣互动与长期合作',
  子女宫: '子女缘分、创作表达与部属互动',
  财帛宫: '收入模式、资源运用与理财习惯',
  疾厄宫: '身心状态与日常健康管理倾向',
  迁移宫: '外部环境、异地发展与对外表现',
  交友宫: '朋友圈层、团队协作与人脉经营',
  官禄宫: '职业方向、事业方式与社会角色',
  田宅宫: '居住环境、家庭资产与稳定基础',
  福德宫: '内在需求、精神状态与休闲方式',
  父母宫: '家庭互动、长辈关系与支持系统',
};

const starTraits: Record<string, string> = {
  紫微: '重视主导权、格局与责任，适合统筹协调；需留意自尊较强或不易示弱。',
  天机: '思考灵活、善于观察变化与规划；需留意想法过多、决策反复。',
  太阳: '倾向主动表达、承担责任并照顾群体；需留意过度付出。',
  武曲: '务实重效率，重视执行、数字与成果；需留意表达直接、容易紧绷。',
  天同: '重视和谐、体验与人际舒适度；需留意回避冲突或安于熟悉环境。',
  廉贞: '重视原则、界线与个人风格；需留意关系中的控制感与立场僵持。',
  天府: '重视稳定、资源整合与长期经营；需留意过度求稳。',
  太阴: '感受细腻，重视安全感、规划与细节；需留意情绪内耗。',
  贪狼: '兴趣广泛，社交与表现欲较强，善于连接资源；需留意分心与节奏失衡。',
  巨门: '善于辨析、研究与表达观点；需留意言语误会与过度质疑。',
  天相: '重视公平、规则与协调，擅长支持团队；需留意过度顾及他人评价。',
  天梁: '重视原则、经验与照顾他人；需留意操心过多。',
  七杀: '行动果断，面对压力有突破倾向；需留意急进与风险评估。',
  破军: '倾向改革、尝试新方法；需留意变动带来的成本。',
};

const topics: Record<TopicKey, Topic> = {
  overall: {
    key: 'overall', title: '命格整体分析', mainPalace: '命宫',
    relatedPalaces: ['命宫', '财帛宫', '官禄宫', '迁移宫'],
    focus: '先天个性、人生方向、资源配置与外部环境',
  },
  personality: {
    key: 'personality', title: '性格特质分析', mainPalace: '命宫',
    relatedPalaces: ['命宫', '福德宫', '迁移宫', '官禄宫'],
    focus: '思考方式、行动风格、内在需求、优势与成长课题',
  },
  relationship: {
    key: 'relationship', title: '感情关系分析', mainPalace: '夫妻宫',
    relatedPalaces: ['夫妻宫', '命宫', '福德宫', '迁移宫', '子女宫'],
    focus: '关系需求、沟通模式、相处优势与磨合课题',
  },
  career: {
    key: 'career', title: '事业发展分析', mainPalace: '官禄宫',
    relatedPalaces: ['官禄宫', '命宫', '财帛宫', '迁移宫', '交友宫', '福德宫'],
    focus: '职业风格、执行方式、合作环境与发展策略',
  },
  job_change: {
    key: 'job_change', title: '换工作与职业转型分析', mainPalace: '官禄宫',
    relatedPalaces: ['官禄宫', '命宫', '财帛宫', '迁移宫', '交友宫', '福德宫'],
    focus: '职业变化、外部机会、收入衔接、合作环境与转型成本',
  },
  business: {
    key: 'business', title: '创业与经营方向分析', mainPalace: '官禄宫',
    relatedPalaces: ['官禄宫', '财帛宫', '命宫', '迁移宫', '交友宫', '田宅宫', '福德宫'],
    focus: '经营方式、现金流、客户资源、合作关系与经营风险',
  },
  promotion: {
    key: 'promotion', title: '升职与发展机会分析', mainPalace: '官禄宫',
    relatedPalaces: ['官禄宫', '命宫', '财帛宫', '交友宫', '迁移宫'],
    focus: '职责变化、组织协作、专业能力与回报',
  },
  finance: {
    key: 'finance', title: '财富模式分析', mainPalace: '财帛宫',
    relatedPalaces: ['财帛宫', '福德宫', '田宅宫', '官禄宫', '命宫'],
    focus: '收入习惯、资源管理、风险意识与长期积累',
  },
  health: {
    key: 'health', title: '身心状态分析', mainPalace: '疾厄宫',
    relatedPalaces: ['疾厄宫', '命宫', '福德宫', '父母宫'],
    focus: '压力管理、生活节奏与健康维护习惯',
  },
};

const brightnessNotes: Record<string, string> = {
  庙: '庙', 旺: '旺', 得: '得', 利: '利', 平: '平',
  不: '不', 闲: '闲', 陷: '陷', 地: '地',
};

const huaOrder: SiHua[] = ['禄', '权', '科', '忌'];
const currentYear = new Date().getFullYear();

function findPalace(chart: ZiweiChart, name: string): Palace | undefined {
  return chart.palaces.find(p => p.name === name);
}

function findPalaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
  const normalized = ((branch % 12) + 12) % 12;
  return chart.palaces.find(p => p.branch === normalized);
}

function findStarPalaces(chart: ZiweiChart, starName: string): Palace[] {
  return chart.palaces.filter(p => (p.stars ?? []).some(s => s.name === starName));
}

function getStars(palace?: Palace): string {
  if (!palace) return '未找到相关宫位资料';
  const stars = palace.stars ?? [];
  const majorStars = stars.filter(s => s.type === 'major');
  if (!stars.length) {
    return palace.borrowedStars?.length
      ? '空宫；借对宫主星：' + palace.borrowedStars.join('、') + '，需连同对宫结构判断'
      : '空宫；需参考对宫借星，不宜只凭空宫作结论';
  }

  const lines = stars.map((s: Star) => {
    const kind = s.type === 'major' ? '主星' : s.type === 'lucky' ? '吉曜' : s.type === 'sha' ? '煞曜' : '辅曜';
    const bright = s.brightnessRaw ? '（亮度：' + (brightnessNotes[s.brightnessRaw] || s.brightnessRaw) + '）' : '';
    const trait = s.type === 'major' && starTraits[s.name] ? '；星性参考：' + starTraits[s.name] : '';
    return kind + '：' + s.name + bright + trait;
  });
  if (!majorStars.length && palace.borrowedStars?.length) {
    lines.push('空宫借对宫主星：' + palace.borrowedStars.join('、'));
  }
  return lines.join('\n');
}

function palaceLine(palace?: Palace): string {
  if (!palace) return '宫位资料暂缺';
  return palace.name + '（地支索引' + palace.branch + '）：' + getStars(palace);
}

function fourPalacesByBranch(chart: ZiweiChart, branch: number): string[] {
  const branches = [branch, (branch + 4) % 12, (branch + 8) % 12, (branch + 6) % 12];
  const labels = ['本宫', '三合宫一', '三合宫二', '对宫'];
  return branches.map((b, i) => labels[i] + '：' + palaceLine(findPalaceByBranch(chart, b)));
}

function resolveRequestedPalace(chart: ZiweiChart, prompt: string): string | undefined {
  const patterns = [
    /落在【([^】]+)】/,
    /重点分析【([^】]+)】/,
    /分析【([^】]+)】/,
  ];
  for (const re of patterns) {
    const match = prompt.match(re);
    if (match?.[1] && findPalace(chart, match[1])) return match[1];
  }
  return undefined;
}

function detectTopic(prompt: string): Topic {
  if (/换工作|跳槽|转行|辞职|求职|找工作|新工作|换行业/.test(prompt)) return topics.job_change;
  if (/创业|开店|做生意|合伙|经营项目|自己干/.test(prompt)) return topics.business;
  if (/升职|晋升|加薪|升迁|职位提升/.test(prompt)) return topics.promotion;
  if (/感情|婚姻|恋爱|对象|伴侣|夫妻|桃花/.test(prompt)) return topics.relationship;
  if (/财运|财富|收入|赚钱|存钱|理财|投资|欠债|债务/.test(prompt)) return topics.finance;
  if (/健康|身体|疾病|疾厄|养生/.test(prompt)) return topics.health;
  if (/事业|工作|职业|官禄|职场/.test(prompt)) return topics.career;
  if (/性格|脾气|人际|个性/.test(prompt)) return topics.personality;
  return topics.overall;
}

function getSelfSihuaText(chart: ZiweiChart): string {
  const lines = chart.palaces.flatMap(p =>
    detectSelfSihua(p).map(mark => p.name + '宫宫干自化' + mark.starName + '化' + mark.siHua)
  );
  return lines.length
    ? lines.join('；')
    : '按当前宫干与本宫星曜逐宫检查，未发现可确认的本宫自化组合。';
}

function getLayerText(
  chart: ZiweiChart,
  label: string,
  transforms: Record<SiHua, string>,
  relatedNames: string[],
  stemName?: string,
): string {
  const lines = [label + (stemName ? '（天干：' + stemName + '）' : '') + '：'];
  for (const hua of huaOrder) {
    const starName = transforms[hua];
    if (!starName) {
      lines.push('化' + hua + '：星曜表资料暂缺');
      continue;
    }
    const palaces = findStarPalaces(chart, starName);
    const destinations = palaces.length
      ? palaces.map(p => p.name + (relatedNames.includes(p.name) ? '〔本次主题相关〕' : '')).join('、')
      : '命盘中未找到该星落宫资料';
    lines.push('化' + hua + '：' + starName + ' → ' + destinations);
  }
  return lines.join('\n');
}

function nativeSiHuaAnalysis(chart: ZiweiChart, relatedNames: string[]): string {
  const stem = chart.lunarInfo?.yearStem;
  if (!Number.isInteger(stem) || stem < 0 || stem > 9) {
    return '出生年天干资料不完整，暂时无法计算本命生年四化。';
  }
  const transforms = getSiHuaByStem(stem);
  return getLayerText(chart, '本命生年四化', transforms, relatedNames) +
    '\n宫干自化检查：' + getSelfSihuaText(chart) +
    '\n四化落点需结合本宫、三方四正及行运层次理解，不能只凭单一化曜断定事件。';
}

function currentDaXianAnalysis(chart: ZiweiChart, relatedNames: string[]): {
  text: string;
  palace?: Palace;
  index: number;
} {
  let index = chart.currentDaXianIndex;
  if (!Number.isInteger(index) || index < 0 || index >= (chart.daXians?.length ?? 0)) {
    index = (chart.daXians ?? []).findIndex(dx =>
      chart.currentAge >= dx.startAge && chart.currentAge <= dx.endAge
    );
  }
  if (index < 0 || index >= (chart.daXians?.length ?? 0)) {
    return {
      text: '当前年龄为' + (chart.currentAge ?? '暂缺') +
        '岁；命盘没有提供与当前年龄匹配的有效十年大限资料，因此不强行套用某一步大限。',
      index: -1,
    };
  }

  const dx = chart.daXians[index];
  const palace = findPalaceByBranch(chart, dx.palaceBranch);
  if (!palace) {
    return {
      text: dx.startAge + '至' + dx.endAge + '岁大限，行运宫位为' + dx.palaceName + '，但对应宫位资料暂缺。',
      index,
    };
  }

  const siHua = getDaXianSiHua(chart, index);
  const transforms = siHua?.transforms;
  const huaText = transforms
    ? getLayerText(chart, '大限宫干四化', transforms, relatedNames, siHua.stemName)
    : '大限宫干四化暂时无法计算。';

  return {
    text:
      dx.startAge + '至' + dx.endAge + '岁，当前大限行运宫位为' + dx.palaceName + '。\n' +
      '大限宫位结构：' + palaceLine(palace) + '\n' +
      '大限宫位三方四正：\n' + fourPalacesByBranch(chart, palace.branch).join('\n') +
      '\n' + huaText,
    palace,
    index,
  };
}

function patternAnalysis(chart: ZiweiChart): string {
  const patterns = detectPatterns(chart);
  if (!patterns.length) {
    return '格局识别模块未发现达到当前规则条件的已定义格局。这不代表命盘没有特点，只表示本次规则没有匹配到对应组合。';
  }

  return patterns.slice(0, 10).map((p, i) => {
    const conditions = p.conditions?.required?.length
      ? '\n成立依据：' + p.conditions.required.join('；')
      : '';
    const bonus = p.conditions?.bonus?.length
      ? '\n加分条件：' + p.conditions.bonus.join('；')
      : '';
    const breaking = p.conditions?.breaking?.length
      ? '\n需留意：' + p.conditions.breaking.join('；')
      : '';
    const source = p.source ? '\n传统资料出处标注：' + p.source : '';
    return (i + 1) + '. ' + p.name + '（' + p.level + '）\n' +
      p.description + conditions + bonus + breaking + source;
  }).join('\n\n');
}

function getQuestionFocus(key: TopicKey, prompt: string): string {
  if (key === 'job_change') {
    return '围绕“是否考虑换工作”分析官禄宫所示的职业方式、命宫所示的个人行动风格、迁移宫所示的外部环境、财帛宫所示的收入衔接，并对照当前大限与流年四化。';
  }
  if (key === 'business') {
    return '围绕创业经营，重点观察官禄宫、财帛宫、命宫、迁移宫和交友宫，分别讨论经营能力、现金流、客户环境及合作风险。';
  }
  if (key === 'promotion') {
    return '围绕职位发展，观察官禄宫、命宫、交友宫与财帛宫，区分职责机会、协作条件和实际回报。';
  }
  if (key === 'relationship') return '围绕关系互动，合看夫妻宫、命宫、福德宫与迁移宫，不以单星判断婚姻结果。';
  if (key === 'finance') return '围绕财富模式，合看财帛宫、福德宫、官禄宫与田宅宫，重点区分收入能力、消费倾向和长期积累。';
  if (key === 'health') return '围绕身心状态，观察疾厄宫与命宫、福德宫的关联，只作生活管理层面的传统文化参考。';
  if (key === 'career') return '围绕事业方向，合看官禄宫、命宫、财帛宫、迁移宫及交友宫。';
  return '围绕命盘整体结构，观察命宫三方四正、主要格局、生年四化和当前大限。用户问题：' + prompt;
}

function getAdvice(key: TopicKey): string {
  const advice: Record<TopicKey, string> = {
    overall: '把命盘倾向当作自我观察的参考，结合现实经历验证，不把格局名称当作人生结论。',
    personality: '把星曜特质转化为可观察的行为习惯，持续用真实经历验证，不给自己贴固定标签。',
    relationship: '把沟通方式、金钱观、生活节奏和冲突处理作为现实相处观察点；重要关系以双方真实互动为准。',
    career: '先明确优势技能、目标行业和可持续投入的岗位，再通过小成本实践验证方向。',
    job_change: '不要只凭命盘裸辞。先确认新岗位、薪资结构、试用期、通勤成本和合同条件；尽量先拿到明确录用，再安排离职，并留足生活备用金。',
    business: '先用小规模、低固定成本方式验证真实客户和复购，再扩大投入；合伙前写清出资、分工、分账与退出机制。',
    promotion: '把目标岗位要求拆成可量化成果，主动争取职责与反馈，同时确认薪酬和晋升标准。',
    finance: '区分稳定收入、弹性收入与高风险收入，建立预算和应急资金；命盘不能判断投资收益或借贷安全。',
    health: '关注作息、压力与生活习惯；紫微斗数不能诊断疾病，如有不适应咨询正规医疗机构。',
  };
  return advice[key];
}

function analyze(chart: ZiweiChart, prompt: string): string {
  const topic = detectTopic(prompt);
  const requestedPalace = resolveRequestedPalace(chart, prompt);
  const mainPalaceName = requestedPalace || topic.mainPalace;
  const mainPalace = findPalace(chart, mainPalaceName);
  const relatedNames = requestedPalace
    ? [mainPalaceName]
    : topic.relatedPalaces;
  const yearMatch = prompt.match(/(?:19|20)\d{2}/);
  const analysisYear = yearMatch ? Number(yearMatch[0]) : currentYear;
  const yearSiHua = getLiuNianSiHua(analysisYear);
  const daXian = currentDaXianAnalysis(chart, relatedNames);
  const mainStars = mainPalace?.stars?.filter(s => s.type === 'major') ?? [];
  const traits = mainStars.map(s => starTraits[s.name]).filter(Boolean);
  const title = requestedPalace ? mainPalaceName + '专项分析' : topic.title;

  const relevantPalaces = relatedNames
    .map(name => findPalace(chart, name))
    .filter((p): p is Palace => Boolean(p));

  const lines = [
    '**【' + title + '】**',
    '你的问题：' + prompt,
    getQuestionFocus(topic.key, prompt),
    '',
    '本次按以下顺序综合判断：本命宫位结构 → 三方四正 → 格局成立条件 → 本命四化与自化 → 当前十年大限 → ' + analysisYear + '年流年四化。',
    '以下是根据排盘数据和传统紫微斗数规则生成的文化性参考解读，不代表确定命运，也不保证现实事件发生。',
    '',
    '**【一、核心宫位与主星】**',
    mainPalaceName + '主要对应：' + (palaceRoles[mainPalaceName] || '相关人生主题') + '。',
    palaceLine(mainPalace),
    traits.length ? '主星组合提示：' + traits.join(' ') : '主星资料不足，暂不对主星组合做强结论。',
    '',
    '**【二、相关宫位联动】**',
    relevantPalaces.length
      ? relevantPalaces.map(p => palaceLine(p)).join('\n')
      : '相关宫位资料暂缺。',
    '**【三、核心宫位三方四正】**',
    fourPalacesByBranch(chart, mainPalace?.branch ?? chart.mingGongBranch).join('\n'),
    '判断原则：本宫看主题本身，三合宫补充资源、能力和行动条件，对宫观察外部环境与互动面；四宫需要合看。',
    '',
    '**【四、本命格局识别】**',
    patternAnalysis(chart),
    '',
    '**【五、本命生年四化与宫干自化】**',
    nativeSiHuaAnalysis(chart, relatedNames),
    '',
    '**【六、当前十年大限】**',
    '当前排盘年龄：' + (chart.currentAge ?? '暂缺') + '岁。',
    daXian.text,
    '',
    '**【七、' + analysisYear + '年流年四化】**',
    getLayerText(chart, analysisYear + '年流年四化', yearSiHua.transforms, relatedNames, yearSiHua.stemName),
    '流年四化表示该年天干对应的四化星及其落宫；需要与本命、大限层次一起看，不能把单个化忌或化禄直接等同于事件结果。',
    '',
    '**【八、结合问题的综合判断】**',
    topic.key === 'job_change'
      ? '换工作不能只看官禄宫一处：官禄宫看职业内容与工作方式，命宫看个人承受与行动方式，迁移宫看外部机会，财帛宫看收入衔接，交友宫看团队与合作环境。再观察本命、大限、流年四化是否触及这些宫位。若机会来自外部环境变化，可把它当作主动了解岗位的信号；若收入与现金流承压，则应优先降低转型成本。命盘本身不能替代对真实岗位、合同和薪资的核实。'
      : topic.key === 'business'
      ? '创业要同时看职业执行、资金管理、外部市场与合作资源。即使命盘中出现有利格局，也不能据此推断项目必然盈利；现实验证应先于扩大投入。'
      : topic.key === 'promotion'
      ? '职位变化需要同时考虑工作成果、组织关系和实际回报。命盘结构只能提供观察角度，是否晋升仍取决于岗位需求、绩效和组织决策。'
      : '把本命结构视为长期倾向，把大限视为十年阶段背景，把流年四化视为年度观察层。不同层次若指向同一主题，可以提高关注度；若彼此不同，则应保留多种可能，不作单点断言。',
    '',
    '**【九、现实行动建议】**',
    getAdvice(topic.key),
    '资料缺失或规则未覆盖的部分保留为未知，不凭空补断。',
    '',
    '**说明**',
    '本接口目前使用规则与命盘数据生成解读，并非接入大语言模型的自由推理服务；不构成医疗、投资、法律或婚恋决策建议。'
  ];

  return lines.filter(Boolean).join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chart = body.chart as ZiweiChart | undefined;
    const messages = body.messages as Array<{ role: string; content: string }> | undefined;

    if (!chart || !Array.isArray(chart.palaces) || !chart.lunarInfo) {
      return Response.json({ error: '命盘数据不完整' }, { status: 400 });
    }

    const prompt = messages && messages.length
      ? String(messages[messages.length - 1]?.content ?? '')
      : '命格总览';
    const result = analyze(chart, prompt || '命格总览');

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/[\s\S]{1,30}/gu) ?? [result];
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify({ delta: { text: chunk } }) + '\n\n'));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('紫微解读接口错误:', error);
    return Response.json({ error: '解读生成失败' }, { status: 500 });
  }
}

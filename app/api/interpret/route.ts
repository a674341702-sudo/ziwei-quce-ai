import { NextRequest } from 'next/server';
import type { ZiweiChart, Palace, Star, SiHua } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';
import { getDaXianSiHua, getSiHuaByStem } from '@/lib/ziwei/sihua';

export const runtime = 'nodejs';

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

const brightnessNotes: Record<string, string> = {
  庙: '庙', 旺: '旺', 得: '得', 利: '利', 平: '平',
  不: '不', 闲: '闲', 陷: '陷', 地: '地',
};

const topics = [
  { words: ['感情', '婚姻', '夫妻宫'], palace: '夫妻宫', title: '感情关系分析', focus: '关系需求、沟通模式、相处优势与磨合课题' },
  { words: ['事业', '官禄宫', '创业'], palace: '官禄宫', title: '事业发展分析', focus: '职业风格、执行方式、合作环境与发展策略' },
  { words: ['财运', '财富', '财帛宫', '理财'], palace: '财帛宫', title: '财富模式分析', focus: '收入习惯、资源管理、风险意识与长期积累' },
  { words: ['健康', '疾厄宫', '养生'], palace: '疾厄宫', title: '身心状态分析', focus: '压力管理、生活节奏与健康维护习惯' },
  { words: ['性格', '人际关系模式'], palace: '命宫', title: '性格特质分析', focus: '思考方式、行动风格、优势与成长课题' },
];

function findPalace(chart: ZiweiChart, name: string) {
  return chart.palaces.find(p => p.name === name);
}

function findPalaceByBranch(chart: ZiweiChart, branch: number) {
  return chart.palaces.find(p => p.branch === ((branch % 12) + 12) % 12);
}

function getStars(palace?: Palace): string {
  if (!palace) return '未找到相关宫位资料';
  const stars = palace.stars ?? [];
  const majorStars = stars.filter(s => s.type === 'major');
  const borrowed = palace.borrowedStars?.length
    ? '；空宫借对宫主星参考：' + palace.borrowedStars.join('、')
    : '';

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
  if (!majorStars.length && palace.borrowedStars?.length) lines.push('空宫借对宫主星：' + palace.borrowedStars.join('、'));
  return lines.join('\n') + borrowed;
}

function palaceLine(palace?: Palace) {
  if (!palace) return '宫位资料暂缺';
  return palace.name + '（地支' + palace.branch + '，宫干索引' + palace.stem + '）：' + getStars(palace);
}

function fourPalacesByBranch(chart: ZiweiChart, branch: number): string[] {
  const branches = [branch, (branch + 4) % 12, (branch + 8) % 12, (branch + 6) % 12];
  const labels = ['本宫', '三合宫一', '三合宫二', '对宫'];
  return branches.map((b, i) => {
    const p = findPalaceByBranch(chart, b);
    return labels[i] + '：' + palaceLine(p);
  });
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

function nativeSiHuaAnalysis(chart: ZiweiChart): string {
  const stem = chart.lunarInfo?.yearStem;
  if (!Number.isInteger(stem) || stem < 0 || stem > 9) return '出生年天干资料不完整，暂时无法计算本命生年四化。';
  const transforms = getSiHuaByStem(stem);
  const labels: SiHua[] = ['禄', '权', '科', '忌'];
  const lines = labels.map(type => {
    const starName = transforms[type];
    const palace = chart.palaces.find(p => (p.stars ?? []).some(s => s.name === starName));
    return '生年化' + type + '：' + starName + (palace ? '落在' + palace.name : '（命盘中未找到该星落宫资料）');
  });
  const self = chart.palaces.flatMap(p =>
    (p.selfSihua ?? []).map(mark => p.name + '宫宫干自化' + mark.starName + '化' + mark.siHua)
  );
  lines.push(self.length
    ? '宫干自化标记：' + self.join('；')
    : '当前命盘资料未提供宫干自化标记。');
  return lines.join('\n') + '\n四化要结合星曜所在宫位、三方四正和行运层次合看，不能只凭某一化曜断定事件必然发生。';
}
function currentDaXianAnalysis(chart: ZiweiChart): { text: string; palace?: Palace; index: number } {
  const index = chart.currentDaXianIndex;
  if (!Number.isInteger(index) || index < 0 || index >= (chart.daXians?.length ?? 0)) {
    return {
      text: '当前年龄为' + (chart.currentAge ?? '暂缺') + '岁；当前大限索引未指向有效的十年大限。可能处于童限或排盘资料未覆盖的年龄段，因此不强行套用第一步大限。',
      index: -1,
    };
  }

  const dx = chart.daXians[index];
  const palace = findPalaceByBranch(chart, dx.palaceBranch);
  if (!palace) {
    return { text: dx.startAge + '至' + dx.endAge + '岁大限，行运宫位为' + dx.palaceName + '，但对应宫位资料暂缺。', index };
  }

  const siHua = getDaXianSiHua(chart, index);
  const transforms = siHua?.transforms;
  const huaText = transforms
    ? '大限宫干为' + siHua.stemName + '，大限四化：化禄' + transforms.禄 + '、化权' + transforms.权 + '、化科' + transforms.科 + '、化忌' + transforms.忌 + '。'
    : '大限宫干四化暂时无法计算。';

  return {
    text: dx.startAge + '至' + dx.endAge + '岁，当前行运宫位为' + dx.palaceName + '。\n' +
      '大限宫位星曜：' + getStars(palace) + '\n' + huaText +
      '\n大限宫位三方四正：\n' + fourPalacesByBranch(chart, palace.branch).join('\n'),
    palace,
    index,
  };
}

function patternAnalysis(chart: ZiweiChart): string {
  const patterns = detectPatterns(chart);
  if (!patterns.length) {
    return '格局识别模块未发现达到当前规则条件的已定义格局。此结果不代表命盘没有特点，只表示本次规则没有匹配到对应组合。';
  }

  return patterns.slice(0, 8).map((p, i) => {
    const conditions = p.conditions?.required?.length
      ? '\n成立依据：' + p.conditions.required.join('；')
      : '';
    const bonus = p.conditions?.bonus?.length
      ? '\n加分条件：' + p.conditions.bonus.join('；')
      : '';
    const breaking = p.conditions?.breaking?.length
      ? '\n需留意：' + p.conditions.breaking.join('；')
      : '';
    const source = p.source ? '\n传统资料标注：' + p.source : '';
    return (i + 1) + '. ' + p.name + '（' + p.level + '）\n' +
      p.description + conditions + bonus + breaking + source;
  }).join('\n\n');
}

function analyze(chart: ZiweiChart, prompt: string): string {
  const topic = topics.find(t => t.words.some(w => prompt.includes(w)));
  const requestedPalace = resolveRequestedPalace(chart, prompt);
  const mainPalace = requestedPalace || (topic ? topic.palace : '命宫');
  const title = requestedPalace ? mainPalace + '专项分析' : topic ? topic.title : '命格整体分析';
  const main = findPalace(chart, mainPalace);
  const mainStars = main?.stars?.filter(s => s.type === 'major') ?? [];
  const traits = mainStars.map(s => starTraits[s.name]).filter(Boolean);
  const focus = topic?.focus || (requestedPalace ? (palaceRoles[mainPalace] || '该宫位对应的人生主题') : '先天个性、人生方向、资源配置与环境互动');
  const dx = currentDaXianAnalysis(chart);

  const suggestions: Record<string, string> = {
    夫妻宫: '把沟通方式、金钱观、生活节奏和冲突处理作为现实相处观察点；不宜凭单一星曜判断婚姻成败。',
    官禄宫: '明确优势技能、可持续投入的行业和阶段目标，再用小成本实践验证方向；重大转型需评估现金流与风险。',
    财帛宫: '区分稳定收入、弹性收入与高风险收入，建立预算、储蓄和应急资金；命盘不能判断投资收益或借贷安全。',
    疾厄宫: '关注作息、压力与生活习惯；紫微斗数不能诊断疾病，如有不适应咨询正规医疗机构。',
    命宫: '把星曜特质当作自我观察的假设，结合真实经历验证；将优势转成可执行习惯，比单纯贴性格标签更有帮助。',
  };

  const lines = [
    '**【' + title + '】**',
    '本次重点：' + focus + '。',
    '以下内容依据当前命盘数据和传统紫微斗数规则作文化性、参考性解读，不代表确定命运，也不保证现实事件发生。',
    '',
    '**【一、核心宫位与星曜】**',
    mainPalace + '主要对应：' + (palaceRoles[mainPalace] || '相关人生主题') + '。',
    palaceLine(main),
    traits.length ? '主星组合提示：' + traits.join(' ') : '主星资料不足，暂不对主星组合做强结论。',
    '',
    '**【二、三方四正联动】**',
    fourPalacesByBranch(chart, main?.branch ?? chart.mingGongBranch).join('\n'),
    '判断方法：本宫看主题本身，两个三合宫补充资源与行动条件，对宫观察外部环境及互动面。四宫需要合看，不以单颗星曜直接定吉凶。',
    '',
    '**【三、本命格局识别】**',
    patternAnalysis(chart),
    '',
    '**【四、生年四化与宫干自化】**',
    nativeSiHuaAnalysis(chart),
    '',
    '**【五、当前十年大限】**',
    '当前年龄：' + (chart.currentAge ?? '暂缺') + '岁。',
    dx.text,
    '',
    '**【六、现实建议】**',
    suggestions[mainPalace] || '把命盘中的倾向转化为具体、可观察的行动目标，并结合现实条件持续调整。',
    '资料不足的部分保留为未知，不凭空补断。',
    '',
    '**说明**',
    '本内容为规则型传统文化解读，并非大语言模型生成的个性化专业咨询；不构成医疗、投资、法律或婚恋决策建议。'
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
        const chunks = result.match(/.{1,30}/gu) ?? [result];
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

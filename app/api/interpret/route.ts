import { NextRequest } from 'next/server';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';

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
  庙: '传统亮度标记为庙，通常视为该星特质较容易发挥',
  旺: '传统亮度标记为旺，通常视为该星特质较有表现空间',
  得: '传统亮度标记为得，通常视为该星特质有一定发挥条件',
  利: '传统亮度标记为利，需结合会照星曜观察',
  平: '传统亮度标记为平，表现较依赖环境与个人选择',
  不: '传统亮度标记为不，宜留意该星特质的压力面',
  闲: '传统亮度标记为闲，单星作用不宜过度放大',
  陷: '传统亮度标记为陷，传统上较强调该星特质的调整课题',
  地: '传统亮度标记为地，宜结合全盘结构谨慎判断',
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

function getStars(palace?: Palace) {
  if (!palace) return '未找到相关宫位资料';

  const stars = palace.stars ?? [];

  if (!stars.length) {
    return palace.borrowedStars?.length
      ? '空宫，借对宫主星：' + palace.borrowedStars.join('、') + '；需连同对宫结构一起判断'
      : '空宫；需参考对宫借星，不宜只凭空宫作结论';
  }

  return stars.map((s: Star) => {
    const kind =
      s.type === 'major' ? '主星' :
      s.type === 'lucky' ? '吉曜' :
      s.type === 'sha' ? '煞曜' : '辅曜';

    const hua = s.siHua ? '，生年四化标记为化' + s.siHua : '';
    const bright = s.brightnessRaw
      ? '；' + (brightnessNotes[s.brightnessRaw] || ('亮度：' + s.brightnessRaw))
      : '';
    const trait =
      s.type === 'major' && starTraits[s.name]
        ? '。星性参考：' + starTraits[s.name]
        : '';

    return kind + '：' + s.name + hua + bright + trait;
  }).join('\n');
}

function palaceLine(palace?: Palace) {
  if (!palace) return '宫位资料暂缺';
  return palace.name + '：' + getStars(palace);
}

// 三方四正：目标宫、地支相隔四位的两宫，以及对宫。
function fourPalaces(chart: ZiweiChart, targetName: string) {
  const target = findPalace(chart, targetName);

  if (!target) return [targetName + '：宫位资料暂缺'];

  const branches = [
    target.branch,
    (target.branch + 4) % 12,
    (target.branch + 8) % 12,
    (target.branch + 6) % 12,
  ];

  const result: string[] = [];
  const seen = new Set<number>();

  for (const branch of branches) {
    const palace = chart.palaces.find(p => p.branch === branch);

    if (palace && !seen.has(branch)) {
      seen.add(branch);
      result.push(palaceLine(palace));
    }
  }

  return result;
}

function currentDaXian(chart: ZiweiChart) {
  const d = chart.daXians?.[chart.currentDaXianIndex];

  if (!d) return '当前大限资料暂未提供。';

  const hua = d.siHua
    ? '该大限四化：化禄' + d.siHua.lu +
      '、化权' + d.siHua.quan +
      '、化科' + d.siHua.ke +
      '、化忌' + d.siHua.ji + '。'
    : '当前大限四化资料暂缺。';

  return d.startAge + '至' + d.endAge +
    '岁，行运宫位为' + d.palaceName + '。' +
    hua +
    '应把大限宫位与本命相关宫位交叉观察，不宜把大限单独当成吉凶结论。';
}

function siHuaAnalysis(chart: ZiweiChart) {
  const birth = chart.palaces.flatMap(p =>
    (p.stars ?? [])
      .filter(s => s.siHua)
      .map(s => p.name + '的' + s.name + '化' + s.siHua)
  );

  const self = chart.palaces.flatMap(p =>
    (p.selfSihua ?? [])
      .map(mark => p.name + '宫干自化' + mark.starName + '化' + mark.siHua)
  );

  return [
    birth.length
      ? '生年四化星曜标记：' + birth.join('；') + '。'
      : '排盘资料中没有读取到生年四化星曜标记。',
    self.length
      ? '宫干自化资料：' + self.join('；') + '。'
      : '排盘资料中没有读取到宫干自化标记。',
    '四化需结合星曜所在宫位、对宫及行运层次理解；单独出现某一化曜，不足以断定事件必然发生。',
  ].join('\n');
}

function analyze(chart: ZiweiChart, prompt: string) {
  const topic = topics.find(t =>
    t.words.some(w => prompt.includes(w))
  );

  const mainPalace = topic ? topic.palace : '命宫';
  const title = topic ? topic.title : '命格整体分析';
  const main = findPalace(chart, mainPalace);

  const mainStars = main?.stars?.filter(s => s.type === 'major') ?? [];
  const traits = mainStars
    .map(s => starTraits[s.name])
    .filter(Boolean);

  const selfMarks = main?.selfSihua ?? [];
  const focus = topic
    ? topic.focus
    : '先天个性、人生方向、资源配置与环境互动';

  const suggestions: Record<string, string> = {
    夫妻宫: '可把沟通方式、金钱观、生活节奏和冲突处理方式作为现实相处观察点；不宜凭单一星曜判断婚姻成败。',
    官禄宫: '先明确优势技能、可持续投入的行业和阶段目标，再用小成本实践验证方向；重大转型需评估现金流与风险。',
    财帛宫: '区分稳定收入、弹性收入与高风险收入，建立预算、储蓄和应急资金；命盘不能判断投资收益或借贷安全。',
    疾厄宫: '可关注作息、压力与生活习惯；紫微斗数不能诊断疾病，如有不适应咨询正规医疗机构。',
    命宫: '把星曜特质当作自我观察的假设，结合真实经历验证；将优势转成可执行习惯，比单纯贴性格标签更有帮助。',
  };

  const lines = [
    '**【' + title + '】**',
    '本次重点：' + focus + '。',
    '以下内容依据当前命盘结构，以传统紫微斗数概念作文化性、参考性解读，不代表确定命运，也不保证现实事件发生。',
    '',
    '**【一、核心宫位与星曜】**',
    mainPalace + '主要对应：' + (palaceRoles[mainPalace] || '相关人生主题') + '。',
    getStars(main),
    traits.length
      ? '主星组合提示：' + traits.join(' ')
      : '主星资料不足，暂不对主星组合做强结论。',
    selfMarks.length
      ? '本宫自化：' + selfMarks.map(m => m.starName + '化' + m.siHua).join('、') + '。需结合星曜与对宫理解。'
      : '',
    '',
    '**【二、三方四正联动】**',
    fourPalaces(chart, mainPalace).join('\n'),
    '观察重点：主宫反映主题本身，三合宫补充资源与行动条件，对宫呈现外部环境及互动面。四宫信息需要合看，不能只用一颗星定论。',
    '',
    '**【三、四化与自化】**',
    siHuaAnalysis(chart),
    '',
    '**【四、当前大限】**',
    '当前年龄：' + (chart.currentAge ?? '暂缺') + '岁。',
    currentDaXian(chart),
    '',
    '**【五、命盘基础资料】**',
    '五行局：' + (chart.wuxingJuName || '暂缺') +
      '；命主：' + (chart.mingZhu || '暂缺') +
      '；身主：' + (chart.shenZhu || '暂缺') +
      '；身宫地支：' + (chart.shenGongBranch ?? '暂缺') + '。',
    '',
    '**【六、可执行的现实建议】**',
    suggestions[mainPalace] ||
      '建议把命盘中的倾向转化为具体、可观察的行动目标，并结合现实条件持续调整。',
    '资料不足的部分应保留，不宜凭空补断。',
    '',
    '**说明**',
    '本内容为规则型传统文化解读，不是人工智能模型生成的专业咨询，也不构成医疗、投资、法律或婚恋决策建议。',
  ];

  return lines.filter(Boolean).join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chart = body.chart as ZiweiChart | undefined;
    const messages = body.messages as Array<{
      role: string;
      content: string;
    }> | undefined;

    if (!chart || !Array.isArray(chart.palaces)) {
      return Response.json(
        { error: '命盘数据不完整' },
        { status: 400 }
      );
    }

    const prompt =
      messages && messages.length
        ? messages[messages.length - 1].content
        : '命格总览';

    const result = analyze(chart, prompt || '命格总览');

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/.{1,30}/gu) ?? [result];

        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(
              'data: ' +
              JSON.stringify({ delta: { text: chunk } }) +
              '\n\n'
            )
          );
        }

        controller.enqueue(
          encoder.encode('data: [DONE]\n\n')
        );

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

    return Response.json(
      { error: '解读生成失败' },
      { status: 500 }
    );
  }
}

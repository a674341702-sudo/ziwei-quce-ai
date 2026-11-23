import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';

export const runtime = 'nodejs';

type TopicKey = 'overall' | 'relationship' | 'career' | 'finance' | 'health' | 'personality';
type PatternHit = ReturnType<typeof detectPatterns>[number];

type TopicSpec = {
  title: string;
  main: string[];
  related: string[];
  focus: string;
};

const TOPICS: Record<TopicKey, TopicSpec> = {
  overall: {
    title: '命格整体分析',
    main: ['命宫'],
    related: ['命宫', '财帛', '官禄', '迁移'],
    focus: '你的整体做事风格、个人优势，以及怎样把能力放进适合自己的环境。',
  },
  relationship: {
    title: '感情与相处模式',
    main: ['夫妻'],
    related: ['夫妻', '命宫', '福德'],
    focus: '你在亲密关系中重视什么、怎样表达感情，以及容易出现哪些相处磨合。',
  },
  career: {
    title: '事业发展与工作方式',
    main: ['官禄'],
    related: ['官禄', '命宫', '财帛', '迁移'],
    focus: '你更容易发挥哪些工作能力，适合怎样的工作方式，以及如何把能力转化为成果。',
  },
  finance: {
    title: '财运与财富管理',
    main: ['财帛'],
    related: ['财帛', '官禄', '福德', '田宅'],
    focus: '你的收入模式、赚钱能力、花钱习惯与长期积累方式。',
  },
  health: {
    title: '身心状态与生活节奏',
    main: ['疾厄'],
    related: ['疾厄', '福德', '命宫'],
    focus: '从传统文化角度观察压力应对、情绪节奏和生活习惯，不作疾病判断。',
  },
  personality: {
    title: '性格与内在特点',
    main: ['命宫'],
    related: ['命宫', '福德', '迁移'],
    focus: '你外在给人的印象、内心真正重视的东西，以及面对环境时的行为方式。',
  },
};

const STAR_GUIDE: Record<string, { nature: string; excess: string; action: string }> = {
  紫微: { nature: '有主见，重视方向感，也愿意承担统筹责任', excess: '有时容易什么都想自己决定，不太习惯求助', action: '练习授权和听取不同意见，把目标与分工说清楚' },
  天机: { nature: '反应灵活，善于观察、思考和寻找办法', excess: '想法多时容易犹豫，计划也可能反复调整', action: '给计划设定期限，先完成一个小步骤再优化' },
  太阳: { nature: '愿意主动承担，也重视自己能否帮到别人', excess: '容易把责任揽得太多，忽略自己的精力', action: '分清哪些事必须亲自做，哪些可以交给别人' },
  武曲: { nature: '务实，重效率，喜欢用结果和数字说话', excess: '压力大时容易显得强硬，也可能过度紧绷', action: '目标之外也要留意过程、沟通和休息' },
  天同: { nature: '重视相处舒服，愿意合作，也懂得感受生活', excess: '有时为了避免冲突而拖延决定', action: '遇到重要问题及时表达，不要一味迁就' },
  廉贞: { nature: '有原则和边界感，重视规则，也在意个人风格', excess: '立场太强时容易僵持', action: '坚持原则的同时给沟通留出余地' },
  天府: { nature: '重视稳定和长期经营，擅长管理手上的资源', excess: '有时过于求稳，不愿尝试新方法', action: '在可控范围内做小规模尝试，逐步扩大' },
  太阴: { nature: '心思细，重视安全感，擅长观察细节和规划', excess: '容易反复担心，或把压力放在心里', action: '把担忧写下来，区分事实、猜测和能采取的行动' },
  贪狼: { nature: '兴趣广，适应力强，比较会连接人和资源', excess: '容易分心，也要留意时间和精力分配', action: '确定阶段重点，减少同时铺开的事情' },
  巨门: { nature: '善于发现问题、研究细节，也敢于表达观点', excess: '容易反复解释、追问或纠结话语细节', action: '先确认对方的意思，再表达自己的判断' },
  天相: { nature: '重视公平和规则，擅长协调人与团队', excess: '容易顾虑别人评价，替别人承担太多', action: '把责任边界讲清楚，不必凡事做和事佬' },
  天梁: { nature: '重原则和经验，愿意照顾别人，也有责任感', excess: '容易操心，习惯替别人解决问题', action: '帮助别人之前先确认自己是否有余力' },
  七杀: { nature: '行动果断，遇到压力时有承担和突破的劲头', excess: '容易急着推进，重大决定可能低估代价', action: '先核对成本、风险和退路，再快速执行' },
  破军: { nature: '不怕改变，愿意打破旧办法、尝试新方向', excess: '变化太快会增加成本，容易推倒重来', action: '先试点验证，不要在准备不足时一次性全盘改变' },
};

function norm(name: string): string {
  return String(name || '').replace(/宫/g, '').replace('仆役', '交友').trim();
}

function findPalace(chart: ZiweiChart, name: string): Palace | undefined {
  const key = norm(name);
  return chart.palaces.find((p) => norm(p.name) === key);
}

function mainStars(palace?: Palace): Star[] {
  return (palace?.stars || []).filter((s) => s.type === 'major');
}

function getStarNames(palace?: Palace): string[] {
  const majors = mainStars(palace).map((s) => s.name);
  return majors.length ? majors : (palace?.borrowedStars || []);
}

function starSentence(name: string, topic: TopicKey): string {
  const item = STAR_GUIDE[name];
  if (!item) return `${name}是本宫实际出现的星曜之一，具体表现还要结合整宫组合判断，不单凭这一颗星下结论。`;
  if (topic === 'career') return `${name}：${item.nature}。放在工作中，适合把这项特点转化为可交付的能力。`;
  if (topic === 'finance') return `${name}：${item.nature}。这提示你可以留意与这项能力相关的收入方式，但不代表收入必然增加。`;
  if (topic === 'relationship') return `${name}：${item.nature}。在关系中，这可能表现为你的表达习惯或安全感需求。`;
  if (topic === 'health') return `${name}：${item.nature}。可把它作为观察压力反应和生活节奏的提醒，不代表身体状况或疾病。`;
  return `${name}：${item.nature}。需要留意的是，${item.excess}。`;
}

function palaceEvidence(palace: Palace | undefined, label: string, topic: TopicKey): string {
  if (!palace) return `${label}资料缺失，本次不对这一部分作推断。`;
  const names = getStarNames(palace);
  if (!names.length) return `${label}目前没有可确认的主星资料。若为空宫，需要结合对宫借星和其他宫位一起看，不能当作没有特点。`;
  const borrowed = mainStars(palace).length === 0;
  const stars = names.slice(0, 3).map((name) => starSentence(name, topic)).join(' ');
  const hua = (palace.stars || []).filter((s) => s.type === 'major' && s.siHua).map((s) => `${s.name}化${s.siHua}`);
  const lucky = (palace.stars || []).filter((s) => s.type === 'lucky').map((s) => s.name);
  const sha = (palace.stars || []).filter((s) => s.type === 'sha').map((s) => s.name);
  return `${label}${borrowed ? `（本宫无主星，参考对宫借星：${names.join('、')}）` : `的主星为${names.join('、')}`}。${stars}${hua.length ? ` 本宫还见到${hua.join('、')}，可作为本命四化的辅助线索。` : ''}${lucky.length ? ` 同宫辅曜有${lucky.join('、')}。` : ''}${sha.length ? ` 同宫煞曜有${sha.join('、')}，提醒相关事情多做准备、留意压力和风险。` : ''}`;
}

function palaceKeyText(chart: ZiweiChart, names: string[], topic: TopicKey): string[] {
  return names.map((name) => palaceEvidence(findPalace(chart, name), `${name}宫`, topic));
}

function relevantPatterns(chart: ZiweiChart, topic: TopicKey, related: string[]): PatternHit[] {
  let hits: PatternHit[] = [];
  try { hits = detectPatterns(chart); } catch { return []; }
  const relatedSet = new Set(related.map(norm));
  const approved = new Set(['杀破狼', '机月同梁', '机月同梁三星会', '紫府同宫', '廉贞天相格', '化禄入财', '化权入官', '魁钺同会', '昌曲同会', '辅弼同会']);
  return hits.filter((hit) => {
    if (!approved.has(hit.name)) return false;
    const places = (hit.palaces || []).map(norm);
    if (topic === 'overall' || topic === 'personality') return places.includes('命') || places.includes('命宫') || hit.name === '杀破狼' || hit.name === '机月同梁';
    return places.some((place) => relatedSet.has(place));
  }).slice(0, 2);
}

function patternLines(chart: ZiweiChart, topic: TopicKey, related: string[]): string[] {
  const hits = relevantPatterns(chart, topic, related);
  if (!hits.length) return ['目前没有识别到达到本项目设定条件、且与本主题直接相关的完整格局。没有格局不代表命盘不好，也不为了凑名称而强行贴格局。'];
  return hits.map((hit) => {
    const conditions = hit.conditions?.required?.slice(0, 2).join('；');
    if (hit.name === '杀破狼') return `本盘的格局识别结果包含「杀破狼」。按本项目识别条件，这是七杀、破军、贪狼在命宫三方四正形成的组合。传统上常用来观察开创、变化和行动力；优势是遇到新环境时较愿意突破，需留意的是别只凭一股冲劲做决定。${conditions ? `本次核对条件：${conditions}。` : ''}`;
    if (hit.name === '机月同梁') return `本盘识别到「机月同梁」组合，传统上更强调思考、规划、协调和长期积累。它提供的是能力倾向，不是职业或人生结果的保证。${conditions ? `本次核对条件：${conditions}。` : ''}`;
    return `本盘识别到「${hit.name}」这一组合。它只能作为相关领域的辅助观察线索，仍需结合落宫和现实经历理解。${conditions ? `本次核对条件：${conditions}。` : ''}`;
  });
}

function topicReport(chart: ZiweiChart, key: TopicKey): string {
  const spec = TOPICS[key];
  const related = spec.related;
  const mainName = spec.main[0];
  const main = findPalace(chart, mainName);
  const stars = getStarNames(main);
  const relatedLines = palaceKeyText(chart, related, key);
  const pattern = patternLines(chart, key, related);
  const starWatch = stars.map((name) => STAR_GUIDE[name]?.excess).filter(Boolean).slice(0, 2);
  const starActions = stars.map((name) => STAR_GUIDE[name]?.action).filter(Boolean).slice(0, 2);

  let situation = '';
  let strengths = '';
  let caution = '';
  let advice = '';
  let basis = '';

  switch (key) {
    case 'overall':
      situation = stars.length
        ? `命宫实际坐守${stars.join('、')}。从这组星曜看，你的个人底色更值得从${stars.map((n) => STAR_GUIDE[n]?.nature || '综合星曜组合').join('、')}这些方向理解。命格不是好坏等级，而是看你习惯怎样做选择、怎样发挥能力。`
        : '命宫主星资料暂缺，不能仅凭空宫给你贴性格标签。本次会结合命宫关联位置观察整体特点。';
      basis = [...relatedLines, ...pattern].join('\n\n');
      strengths = stars.map((n) => STAR_GUIDE[n]?.nature).filter(Boolean).join('；') || '命宫主星资料不足，暂不概括固定优势。可以结合命宫三方四正的实际星曜进一步观察。';
      caution = starWatch.join('；') || '目前主星资料不足以判断具体短板，不宜为了完整报告而编造性格问题。';
      advice = starActions.join('；') || '先观察自己在工作、关系和重大选择中的真实表现，再把稳定发挥的能力变成习惯。';
      break;
    case 'relationship':
      situation = `感情主题以夫妻宫为主。${stars.length ? `夫妻宫主星为${stars.join('、')}，可从这些星曜理解你在亲密关系中的表达方式和相处需求。` : '夫妻宫目前没有可确认的主星，需要结合对宫借星及命宫、福德宫共同判断。'}`;
      basis = [...relatedLines, ...pattern].join('\n\n');
      strengths = stars.map((n) => STAR_GUIDE[n]?.nature).filter(Boolean).join('；') || '夫妻宫主星信息不足，暂不对你的感情优势作具体定论。';
      caution = starWatch.join('；') || '关系中的磨合不能只凭命盘判断，尤其不能据此断定分手、出轨或婚姻结果。';
      advice = '遇到分歧时先讲清自己的感受和需求，再确认对方的想法；重要问题看双方长期行动，不要只靠猜测。';
      break;
    case 'career':
      situation = `事业以官禄宫为核心。${stars.length ? `官禄宫主星为${stars.join('、')}，说明分析工作方式时，值得重点观察${stars.map((n) => STAR_GUIDE[n]?.nature || n).join('；')}。` : '官禄宫主星资料暂缺，不能直接断定适合哪种职业，需要结合命宫、财帛和迁移宫。'}`;
      basis = [...relatedLines, ...pattern].join('\n\n');
      strengths = stars.map((n) => STAR_GUIDE[n]?.action).filter(Boolean).join('；') || '目前官禄宫主星资料不足，建议结合实际技能、工作经历和市场需求判断优势。';
      caution = starWatch.join('；') || '不要只凭一个格局决定行业，也不要把命盘倾向当成必然升职或创业成功。';
      advice = '把想做的岗位拆成具体能力要求，用真实项目和业绩验证；选择能发挥长处、同时有稳定回报和成长空间的工作环境。';
      break;
    case 'finance':
      situation = `财运以财帛宫为核心。${stars.length ? `财帛宫主星为${stars.join('、')}，可以从这些星曜观察你较适合发挥的赚钱能力和资源运用方式。` : '财帛宫主星资料暂缺，不能单凭空宫判断财运好坏，需要结合官禄、福德、田宅宫。'}`;
      basis = [...relatedLines, ...pattern].join('\n\n');
      strengths = stars.map((n) => STAR_GUIDE[n]?.nature).filter(Boolean).join('；') || '暂时没有足够的财帛宫主星依据归纳具体赚钱优势。';
      caution = '化禄或吉曜不等于一定发财，化忌也不等于必然破财。实际财富还取决于收入、支出、债务、合同和风险管理。';
      advice = '先把现金流管清楚：记录稳定收入、必要支出、债务还款和可储蓄金额；再逐步提高收入来源，避免高风险借贷和冲动投资。';
      break;
    case 'health':
      situation = '这一部分只谈压力应对、情绪习惯和生活节奏。疾厄宫在这里仅作为传统文化中的观察入口，不用它推断疾病、器官问题或寿命。';
      basis = [...relatedLines, '身心状态还要结合真实作息、工作强度、情绪体验和生活环境，命盘不能代替医学或心理评估。'].join('\n\n');
      strengths = '如果能觉察自己何时容易紧绷、何时需要独处或休息，就更容易建立适合自己的恢复节奏。';
      caution = '星曜不能诊断疾病，也不能预测健康结果。若有持续身体不适或明显情绪困扰，应向合格专业人员求助。';
      advice = '尽量固定睡眠和起床时间，把高强度工作拆成小段，中间安排休息；保持适合自己的活动，并找可信任的人交流压力。';
      break;
    case 'personality':
      situation = `性格以命宫为核心，再看福德宫的内在需求和迁移宫面对外界时的表现。${stars.length ? `命宫主星为${stars.join('、')}，可先从${stars.map((n) => STAR_GUIDE[n]?.nature || n).join('；')}理解你的外在做事风格。` : '命宫没有可确认的主星，不能只凭空宫给你贴标签，需要结合福德、迁移宫一起看。'}`;
      basis = [...relatedLines, ...pattern].join('\n\n');
      strengths = stars.map((n) => STAR_GUIDE[n]?.nature).filter(Boolean).join('；') || '目前命宫主星资料不足，暂不作单一性格定论。';
      caution = starWatch.join('；') || '性格会受成长经历、环境和选择影响，命盘不能把一个人固定成某种类型。';
      advice = starActions.join('；') || '观察自己在压力、合作和独处时的真实反应，保留有效习惯，对容易过头的部分设置边界。';
      break;
  }

  return [
    `**【${spec.title}】**`,
    `本次重点：${spec.focus}`,
    '',
    '**【你的情况】**', situation,
    '',
    '**【命盘依据】**', basis,
    '',
    '**【你的优势】**', strengths,
    '',
    '**【需要留意】**', caution,
    '',
    '**【给你的建议】**', advice,
    '',
    '**【解读边界】**',
    '本报告依据当前排盘数据中的宫位、星曜和项目格局识别结果生成，属于传统文化视角的自我观察参考，不代表确定命运。当前版本不分析十年大限、流年，也未接入大语言模型。',
  ].join('\n');
}

function palaceReport(chart: ZiweiChart, palaceName: string): string {
  const target = findPalace(chart, palaceName);
  if (!target) return '没有找到你选择的宫位资料，请重新选择。';
  const branches = [target.branch, (target.branch + 4) % 12, (target.branch + 8) % 12, (target.branch + 6) % 12];
  const related = branches.map((branch) => chart.palaces.find((p) => p.branch === branch)).filter((p): p is Palace => Boolean(p));
  const topic: TopicKey = norm(target.name) === '疾厄' ? 'health' : 'overall';
  return [
    `**【${target.name}宫专项观察】**`,
    '先看你选中的宫位，再合看它的三方四正。以下只使用本命盘资料，不加入十年大限或流年。',
    ...related.map((palace, index) => palaceEvidence(palace, index === 0 ? '本宫' : `相关宫位${index}`, topic)),
    '**【这组配置可以怎样理解】**',
    '宫位要结合主星、辅曜、煞曜和对宫借星一起看，单颗星不能直接决定吉凶。把这些特点当作观察线索，再结合现实经历验证。',
    '**【现实建议】**',
    '先明确这件事在现实中遇到的具体问题，再把命盘提示转化为可执行的小行动；涉及健康、金钱或重大关系决定时，仍应以专业意见和实际条件为准。',
  ].join('\n\n');
}

function validTopic(value: unknown): value is TopicKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TOPICS, value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { chart?: ZiweiChart; topicKey?: unknown; mode?: string; requestedPalace?: string };
    const chart = body.chart;
    if (!chart || !Array.isArray(chart.palaces) || !chart.lunarInfo) {
      return Response.json({ error: '命盘数据不完整' }, { status: 400 });
    }
    const topicKey: TopicKey = validTopic(body.topicKey) ? body.topicKey : 'overall';
    const result = body.mode === 'palace' && typeof body.requestedPalace === 'string'
      ? palaceReport(chart, body.requestedPalace)
      : topicReport(chart, topicKey);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/[\s\S]{1,48}/gu) || [result];
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`));
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
    return Response.json({ error: '解读生成失败，请稍后重试' }, { status: 500 });
  }
}

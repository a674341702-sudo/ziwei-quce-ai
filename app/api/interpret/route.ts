import { NextRequest } from 'next/server';
import type { ZiweiChart, Palace, Star, SiHua } from '@/lib/ziwei/types';
import { detectPatterns } from '@/lib/ziwei/patterns';
import {
  getDaXianSiHua,
  getLiuNianSiHua,
  getSiHuaByStem,
} from '@/lib/ziwei/sihua';
import {
  getDaXianIndexForAge,
  getDaXianIndexForYear,
  getDaXianStartYear,
} from '@/lib/ziwei/yunxian-context';

export const runtime = 'nodejs';

/**
 * 产品解读层：用原创通俗表达翻译本项目已有的排盘与格局识别结果。
 * 不直接展示上游规则库中的长段断语，也不复制受非商业条款约束的教学原话。
 * 注意：67.5 万命盘的 v4.0 压缩解读数据集没有被打包进此文件；它约 56.6GB
 * 解压体积，应另行建立可查询的数据服务后再接入，不能塞入 Netlify 函数包。
 */

type TopicKey =
  | 'overall'
  | 'relationship'
  | 'career'
  | 'finance'
  | 'health'
  | 'personality'
  | 'job_change'
  | 'business'
  | 'promotion';

type RequestMode = 'topic' | 'palace' | 'sihua';
type Hua = SiHua;
type PatternHit = ReturnType<typeof detectPatterns>[number];

type TopicDefinition = {
  title: string;
  mainPalace: string;
  relatedPalaces: string[];
  opening: string;
  strengths: string;
  cautions: string;
  advice: string;
};

const TOPICS: Record<TopicKey, TopicDefinition> = {
  overall: {
    title: '你的人生格局',
    mainPalace: '命宫',
    relatedPalaces: ['命宫', '官禄', '财帛', '迁移', '福德'],
    opening: '先看整张命盘呈现出的性格底色、做事方式和人生资源，再看哪些格局真正成立。',
    strengths: '把命宫的核心特点，与事业、财务和外部环境的配置合在一起看，找出可以长期发挥的优势。',
    cautions: '格局是传统命理中的组合名称，不是人生等级，也不代表某种结果一定发生。',
    advice: '把优势放到现实中验证：选择能发挥长处的环境，同时用计划、复盘和风险控制补足短板。',
  },
  relationship: {
    title: '你的感情相处模式',
    mainPalace: '夫妻',
    relatedPalaces: ['夫妻', '命宫', '福德', '迁移', '子女'],
    opening: '重点不是替你断定会不会结婚，而是看你在亲密关系里重视什么、怎样表达，以及容易在哪些地方产生磨合。',
    strengths: '看你愿意怎样经营关系、怎样表达在乎，以及什么样的相处方式更容易让关系稳定。',
    cautions: '星曜组合只能提示关系中的倾向，不能单凭一颗星断定争吵、分手或婚姻结果。',
    advice: '把命盘提示转化成现实相处方法：及时沟通、尊重边界、确认彼此期待，重要问题看双方真实行动。',
  },
  career: {
    title: '你的事业发展方式',
    mainPalace: '官禄',
    relatedPalaces: ['官禄', '命宫', '财帛', '迁移', '交友', '福德'],
    opening: '事业以官禄宫为主，同时参考命宫、财帛宫和迁移宫，判断你更容易在哪种工作方式中发挥能力。',
    strengths: '找出你适合发挥的工作能力，例如执行、组织、表达、研究、开拓或协调。',
    cautions: '命盘不能替代行业、岗位、收入和团队条件的现实调查。',
    advice: '先选能发挥优势的岗位，再用实际业绩、技能提升和收入结构验证方向；不要只凭一个格局决定职业。',
  },
  finance: {
    title: '你的赚钱与财富管理方式',
    mainPalace: '财帛',
    relatedPalaces: ['财帛', '官禄', '福德', '田宅', '命宫', '迁移'],
    opening: '财运不只看有没有化禄，还要合看赚钱方式、工作来源、花钱习惯、资产观念和不同阶段的环境。',
    strengths: '重点找出比较适合你的收入模式，以及哪些能力可能成为长期积累的基础。',
    cautions: '命盘不能保证发财、判断投资回报或替代债务和现金流规划。',
    advice: '先守住现金流，再谈扩大收入；把固定收入、弹性收入、必要支出和高风险投入分开管理。',
  },
  health: {
    title: '你的身心节奏与生活提醒',
    mainPalace: '疾厄',
    relatedPalaces: ['疾厄', '命宫', '福德', '父母'],
    opening: '这一部分只从传统文化角度观察压力来源、情绪节奏和生活习惯，不用命盘判断疾病。',
    strengths: '找出有助于你恢复精力的生活方式，以及在压力大时可以依靠的支持。',
    cautions: '星曜不能诊断疾病、推断器官问题或预测寿命；身体不适应以正规医疗意见为准。',
    advice: '把睡眠、规律运动、休息和情绪支持落实到日常；持续不适应及时寻求专业帮助。',
  },
  personality: {
    title: '你的性格与做事风格',
    mainPalace: '命宫',
    relatedPalaces: ['命宫', '福德', '迁移', '官禄'],
    opening: '从命宫看外在做事方式，从福德宫看内在需求，再从迁移和官禄宫看你面对环境时的表现。',
    strengths: '把你的思考、行动、表达和合作优势说清楚，而不是只给你贴上几个性格标签。',
    cautions: '性格不是固定不变的命运；相同星曜在不同组合和生活环境中，也可能有不同表现。',
    advice: '保留好用的性格优势，对容易过头的部分建立具体习惯，例如先沟通、列计划、设边界和定期复盘。',
  },
  job_change: {
    title: '你的换工作与职业转型',
    mainPalace: '官禄',
    relatedPalaces: ['官禄', '命宫', '财帛', '迁移', '交友', '福德'],
    opening: '重点看职业方式、外部机会、收入衔接和转型成本，不用命盘替你作出裸辞决定。',
    strengths: '看你在新环境中可以发挥什么能力，以及适合怎样寻找机会。',
    cautions: '现实岗位、合同、薪资、试用期和生活储备比单一吉凶判断更重要。',
    advice: '尽量先拿到明确录用和薪资条件，再安排离职；准备备用金，降低转型期间的现金流压力。',
  },
  business: {
    title: '你的创业与经营方式',
    mainPalace: '官禄',
    relatedPalaces: ['官禄', '财帛', '命宫', '迁移', '交友', '田宅', '福德'],
    opening: '创业要同时看执行方式、资金管理、客户来源、合作关系和固定成本。',
    strengths: '找出你可能擅长的经营环节，例如开拓客户、专业交付、管理流程或整合资源。',
    cautions: '有利的命盘组合不等于项目必然盈利，不能用命盘替代市场验证。',
    advice: '先做低成本试运营，验证真实客户和复购；合伙前写清出资、分工、分账和退出办法。',
  },
  promotion: {
    title: '你的升职与职业发展',
    mainPalace: '官禄',
    relatedPalaces: ['官禄', '命宫', '财帛', '交友', '迁移'],
    opening: '重点观察职责承担、团队协作、专业能力和实际回报之间的关系。',
    strengths: '看你适合靠专业、执行、组织还是协调能力争取更大职责。',
    cautions: '是否晋升仍取决于业绩、岗位需求、团队安排和组织决策。',
    advice: '把目标职位的要求拆成可量化成果，主动争取反馈，并确认职责变化对应的薪酬和资源。',
  },
};

const STAR_MEANINGS: Record<string, { positive: string; watch: string; work: string }> = {
  紫微: { positive: '有主见，重视方向感，也愿意承担统筹责任', watch: '有时太想自己拿主意，不容易开口求助', work: '适合统筹、管理、协调资源或负责整体方向' },
  天机: { positive: '脑子灵活，观察细，善于想办法和调整路线', watch: '想法多时容易犹豫，计划改来改去', work: '适合策划、分析、顾问、技术、需要应变的工作' },
  太阳: { positive: '愿意主动承担，也比较在意自己能否帮到别人', watch: '容易把责任揽得太多，忙到忽略自己', work: '适合服务、带团队、公开表达、对外沟通和承担责任的岗位' },
  武曲: { positive: '务实，重效率，喜欢用结果和数字说话', watch: '压力大时容易显得强硬，也可能过度紧绷', work: '适合执行、财务、运营、管理、销售目标和结果导向工作' },
  天同: { positive: '重视相处舒服，愿意合作，也懂得享受生活', watch: '有时为了避免冲突而拖延决定', work: '适合服务、协调、客户维护和需要耐心的工作' },
  廉贞: { positive: '有原则和边界感，重视规则，也在意个人风格', watch: '立场太强时容易僵持，关系中需要留意控制感', work: '适合制度管理、流程、谈判、品牌和需要判断边界的工作' },
  天府: { positive: '重视稳定和长期经营，擅长管理手上的资源', watch: '有时过于求稳，不愿意尝试新方法', work: '适合运营、资源管理、行政、资产和长期项目' },
  太阴: { positive: '心思细，重视安全感，擅长观察细节和规划', watch: '容易反复担心，或把压力放在心里', work: '适合规划、财务、服务、研究、审美和细节管理' },
  贪狼: { positive: '兴趣广，社交适应力强，比较会连接人和资源', watch: '容易分心，也要留意欲望和时间分配', work: '适合销售、市场、商务、内容、社交和资源整合' },
  巨门: { positive: '善于发现问题、研究细节，也敢于表达观点', watch: '容易反复解释、追问或纠结话语中的细节', work: '适合销售谈判、咨询、研究、表达、分析和沟通类工作' },
  天相: { positive: '重视公平和规则，擅长协调人与团队', watch: '容易顾虑别人评价，替别人承担太多', work: '适合管理支持、项目协调、客户服务和制度流程' },
  天梁: { positive: '重原则和经验，愿意照顾别人，也有责任感', watch: '容易操心，或习惯替别人解决问题', work: '适合顾问、服务、管理、教育、支持和经验型工作' },
  七杀: { positive: '行动果断，遇到压力时有突破和承担的劲头', watch: '容易急着推进，重大决定要先评估代价', work: '适合目标清楚、节奏快、需要执行和开拓的工作' },
  破军: { positive: '不怕改变，愿意打破旧办法、尝试新方向', watch: '变化太快会增加成本，需避免一时冲动推倒重来', work: '适合改革、开创、项目启动、转型和解决难题' },
};

const STAR_HUA_MEANINGS: Record<Hua, string> = {
  禄: '这方面比较容易成为你愿意投入、争取资源或寻找机会的领域',
  权: '这方面容易牵涉责任、主导权、执行力或掌控感',
  科: '这方面适合靠专业、口碑、表达和可信度建立优势',
  忌: '这方面容易成为你特别在意、反复思考或需要花心力处理的课题',
};

const PALACE_LABELS: Record<string, string> = {
  命: '命宫', 兄弟: '兄弟宫', 夫妻: '夫妻宫', 子女: '子女宫', 财帛: '财帛宫',
  疾厄: '身心与生活习惯', 迁移: '迁移宫', 交友: '人际与合作', 官禄: '事业宫',
  田宅: '田宅宫', 福德: '内在状态', 父母: '父母宫', 仆役: '人际与合作',
};



const PATTERN_COPY: Record<string, { plain: string; strength: string; caution: string; advice: string }> = {
  杀破狼: {
    plain: '命宫的关键关联位置会齐七杀、破军、贪狼，传统上称为“杀破狼”。它强调开创、变化和行动，不代表人生一定动荡。',
    strength: '你可能更愿意主动寻找突破，不太甘心长期停在没有成长空间的环境。面对新项目、市场变化或需要从零开拓的事情，容易被激发行动力。',
    caution: '冲劲太强时，容易先行动、后计算，或因为想快速改变而频繁换方向。',
    advice: '保留敢闯的优点，但把大决定拆成小试验：先验证需求、成本和退路，再逐步加码。',
  },
  机月同梁: {
    plain: '天机、太阴、天同、天梁四颗星在命宫的重要关联位置齐会，传统上称为“机月同梁”。这类组合更强调思考、规划、协调和长期积累。',
    strength: '比起只靠冲劲，更容易通过专业、经验、服务、研究或组织能力逐渐建立价值。',
    caution: '考虑太多或过度求稳，可能让机会迟迟无法落实。',
    advice: '把计划设定期限，先做一个可验证的小成果，不要只停留在分析。',
  },
  机月同梁三星会: {
    plain: '命盘在相关位置会到机月同梁四颗星中的三颗，属于部分呼应，不是完整的“机月同梁”格局。',
    strength: '仍可看到思考、规划、协调或细腻观察方面的特点。',
    caution: '不能把部分组合直接当成完整格局，也不宜只凭这个名称判断职业。',
    advice: '结合实际主星、工作经历和大限变化，找出最能发挥的能力。',
  },
  紫府同宫: {
    plain: '紫微和天府同在一个宫位，传统上称为“紫府同宫”。如果不在命宫，属于全盘中的辅助线索，不等于命宫直接坐守。',
    strength: '传统解释常把它与组织、资源管理、稳定经营和统筹能力联系起来。',
    caution: '是否能发挥，要看它落在哪个宫位，以及周围有没有支持或牵制。',
    advice: '把资源管理和长期规划当作可培养的能力，不要只凭格局名称期待结果。',
  },
  廉贞天相格: {
    plain: '廉贞和天相同宫，传统上称为“廉贞天相”。它常被用来观察规则意识、协调、公平和处理人际边界的方式。',
    strength: '适合发挥判断规则、协调关系、维护流程和处理复杂事务的能力。',
    caution: '原则太强时容易陷入立场对立，也要留意规则与人情之间的平衡。',
    advice: '把规则讲清楚，也给沟通留余地；合作事项尽量事先明确权责。',
  },
  化禄入财: {
    plain: '财帛宫的主星出现本命化禄，传统上称为“化禄入财”。可以把它理解为资源、机会或投入意愿与财务主题产生联系。',
    strength: '适合留意通过主星代表的能力、服务或资源整合来创造收入的机会。',
    caution: '化禄不等于收入必然稳定，也不代表一定发财；仍要看工作模式、支出和其他组合。',
    advice: '把赚钱能力变成稳定流程，同时记录成本、回款和储蓄，不要只看收入不看净结余。',
  },
  化权入官: {
    plain: '官禄宫出现本命化权，说明传统四化体系把责任、主导权和执行力的主题落在事业领域。',
    strength: '适合争取负责项目、带团队或成为某个专业环节的核心执行者。',
    caution: '责任增加不一定同步带来回报，也要留意过度承担。',
    advice: '争取职责时同步确认资源、权限、考核方式和薪酬。',
  },
  魁钺同会: {
    plain: '命宫相关位置同时见天魁和天钺，传统上常把它们视为贵人、支持和引荐的象征。',
    strength: '在团队、学习或职业发展中，可以主动建立可靠的人际支持。',
    caution: '贵人不是凭空出现，不能把机会完全寄托在别人身上。',
    advice: '主动展示能力、保持信用，也学会清楚表达自己需要什么帮助。',
  },
  昌曲同会: {
    plain: '文昌和文曲同时出现在命宫相关位置，传统上常与学习、表达、文字和审美能力联系起来。',
    strength: '适合把知识、表达、写作、内容或专业呈现变成个人优势。',
    caution: '想得好、说得好，还需要落实和持续交付。',
    advice: '把想法变成作品、成果或可展示的专业能力。',
  },
  辅弼同会: {
    plain: '左辅和右弼同时会照命宫，传统上常用来观察协作和团队支持。',
    strength: '适合通过合作、分工和互相补位来完成目标。',
    caution: '不要只等别人帮忙，也要明确分工与责任。',
    advice: '建立稳定的合作关系，并把承诺和分工说清楚。',
  },
};

const HUA_ORDER: Hua[] = ['禄', '权', '科', '忌'];

function normalisePalaceName(name: string): string {
  return String(name || '').replace(/宫/g, '').replace('仆役', '交友').trim();
}

function palaceLabel(name: string): string {
  const key = normalisePalaceName(name);
  return PALACE_LABELS[key] || (key === '命' ? '命宫' : `${key}宫`);
}

function findPalace(chart: ZiweiChart, name: string): Palace | undefined {
  const target = normalisePalaceName(name);
  return chart.palaces.find(p => normalisePalaceName(p.name) === target);
}

function findPalaceByBranch(chart: ZiweiChart, branch: number): Palace | undefined {
  const safe = ((branch % 12) + 12) % 12;
  return chart.palaces.find(p => p.branch === safe);
}

function findStarPalaces(chart: ZiweiChart, starName: string): Palace[] {
  return chart.palaces.filter(p => p.stars.some(s => s.name === starName));
}

function mainStars(palace?: Palace): Star[] {
  return (palace?.stars || []).filter(s => s.type === 'major');
}

function starNames(palace?: Palace): string[] {
  const names = mainStars(palace).map(s => s.name);
  if (!names.length && palace?.borrowedStars?.length) return palace.borrowedStars;
  return names;
}

function brightnessDescription(star: Star): string {
  const value = star.brightnessRaw;
  if (!value) return '';
  if (value === '庙' || value === '旺') return '，状态较有力';
  if (value === '得' || value === '利') return '，发挥条件尚可';
  if (value === '陷') return '，发挥时更需要方法和环境配合';
  if (value === '平') return '，表现较平稳';
  return '';
}

function describeStar(starName: string): string {
  const item = STAR_MEANINGS[starName];
  return item ? item.positive : `${starName}的具体表现需要结合所在宫位和其他星曜一起判断`;
}

function describePalace(palace: Palace | undefined, heading?: string): string {
  if (!palace) return `${heading || '相关宫位'}资料暂缺，本次不作推断。`;
  const name = heading || palaceLabel(palace.name);
  const majors = mainStars(palace);
  const usedBorrowed = majors.length === 0 && Boolean(palace.borrowedStars?.length);
  const names = usedBorrowed ? (palace.borrowedStars || []) : majors.map(s => s.name);
  let mainText = '';
  if (names.length) {
    mainText = names.map(starName => {
      const star = majors.find(s => s.name === starName);
      return `${starName}${star ? brightnessDescription(star) : ''}：${describeStar(starName)}`;
    }).join('；');
    if (usedBorrowed) mainText = `本宫没有主星，传统上需要参考对宫借星（${names.join('、')}）：${mainText}`;
  } else {
    mainText = '这处宫位没有可确认的主星资料，需结合对宫和其他信息，不宜单独下判断。';
  }

  const lucky = (palace.stars || []).filter(s => s.type === 'lucky').map(s => s.name);
  const sha = (palace.stars || []).filter(s => s.type === 'sha').map(s => s.name);
  const minor = (palace.stars || []).filter(s => s.type === 'minor').map(s => s.name);
  const supportText = lucky.length ? `；另见${lucky.join('、')}，传统上可作为支持、协调或资源方面的辅助线索` : '';
  const challengeText = sha.length ? `；同时有${sha.join('、')}，提醒相关事情不要只凭冲劲，计划和风险控制要跟上` : '';
  const minorText = minor.length ? `；其他辅曜：${minor.slice(0, 4).join('、')}` : '';
  return `${name}：${mainText}${supportText}${challengeText}${minorText}。`;
}

function getFourPalaces(chart: ZiweiChart, palace: Palace): Palace[] {
  const branches = [
    palace.branch,
    (palace.branch + 4) % 12,
    (palace.branch + 8) % 12,
    (palace.branch + 6) % 12,
  ];
  return branches
    .map(branch => findPalaceByBranch(chart, branch))
    .filter((p): p is Palace => Boolean(p));
}


function topicPatterns(chart: ZiweiChart, topicKey: TopicKey, relatedNames: string[]): PatternHit[] {
  let patterns: PatternHit[] = [];
  try {
    patterns = detectPatterns(chart);
  } catch {
    return [];
  }
  if (topicKey === 'overall') return patterns.slice(0, 5);

  const related = new Set(relatedNames.map(normalisePalaceName));
  return patterns.filter(pattern => {
    const locations = (pattern.palaces || []).map(normalisePalaceName);
    return locations.some(name => related.has(name)) || locations.includes('命');
  }).slice(0, 3);
}

function patternPlainText(pattern: PatternHit): string {
  const known = PATTERN_COPY[pattern.name];
  const required = pattern.conditions?.required || [];
  const bonus = pattern.conditions?.bonus || [];
  const breaking = pattern.conditions?.breaking || [];
  if (known) {
    const qualification = breaking.length
      ? `本盘同时出现需要留意的条件：${breaking.join('、')}。因此更适合把它看成有特点、但需要管理风险的组合。`
      : bonus.length
        ? `本盘还见到一些辅助条件（${bonus.join('、')}），可作为进一步观察的加分线索。`
        : '';
    return `**${pattern.name}**\n${known.plain}\n${known.strength}\n需要留意：${known.caution}\n建议：${known.advice}${qualification ? `\n${qualification}` : ''}`;
  }

  const generic = pattern.level === 'caution'
    ? '这是传统上需要谨慎观察的组合，不宜直接理解成坏结果。现实中更适合把它当成提醒，主动管理压力、冲突和风险。'
    : pattern.level === 'excellent' || pattern.level === 'good'
      ? '这是传统格局识别规则匹配到的组合，可以作为观察优势的线索，但仍要结合落宫、亮度和其他星曜。'
      : '这是一个部分符合条件的组合，属于辅助线索，不宜单独当成人生结论。';
  const basis = required.length ? `核对到的条件：${required.slice(0, 3).join('；')}。` : '';
  const limits = breaking.length ? `同时需要留意：${breaking.join('；')}。` : '';
  return `**${pattern.name}**\n${generic}${basis}${limits}\n建议：把这项特点放在相关生活领域中观察，再用现实经历验证。`;
}

function getNatalFourHua(chart: ZiweiChart): Record<Hua, string> | null {
  const yearStem = chart.lunarInfo?.yearStem;
  if (!Number.isInteger(yearStem) || yearStem < 0 || yearStem > 9) return null;
  return getSiHuaByStem(yearStem);
}

function findSihuaPalaces(chart: ZiweiChart, starName: string): Palace[] {
  return findStarPalaces(chart, starName);
}

function relevantNatalHuaLines(chart: ZiweiChart, relatedNames: string[]): string[] {
  const transforms = getNatalFourHua(chart);
  if (!transforms) return ['出生年天干资料不完整，暂时无法核对本命四化。'];
  const related = new Set(relatedNames.map(normalisePalaceName));
  const lines: string[] = [];
  for (const hua of HUA_ORDER) {
    const star = transforms[hua];
    const placements = findSihuaPalaces(chart, star);
    const relevant = placements.filter(p => related.has(normalisePalaceName(p.name)));
    if (!relevant.length) continue;
    const placeText = relevant.map(p => palaceLabel(p.name)).join('、');
    lines.push(`${star}化${hua}落在${placeText}：${STAR_HUA_MEANINGS[hua]}。`);
  }
  return lines.length ? lines : ['本命四化暂未直接落在本主题的核心宫位，不能把其他宫位的四化强行解释成本主题结论。'];
}


function findHuaInPalace(chart: ZiweiChart, palaceName: string, hua: Hua): string | undefined {
  const transforms = getNatalFourHua(chart);
  if (!transforms) return undefined;
  const palace = findPalace(chart, palaceName);
  if (!palace) return undefined;
  return transforms[hua] && palace.stars.some(star => star.name === transforms[hua])
    ? transforms[hua]
    : undefined;
}

function starPracticalTip(starName: string, topic: TopicKey): string {
  const meaning = STAR_MEANINGS[starName];
  if (!meaning) return '把这个星曜当作观察线索，仍要结合整宫组合和现实经历。';
  if (topic === 'career' || topic === 'job_change' || topic === 'business' || topic === 'promotion') return meaning.work;
  return `${meaning.positive}；需要留意：${meaning.watch}`;
}

function mainStarSummary(palaces: Palace[], topic: TopicKey): string[] {
  const lines: string[] = [];
  for (const palace of palaces) {
    const stars = mainStars(palace);
    const names = stars.length ? stars.map(s => s.name) : (palace.borrowedStars || []);
    if (!names.length) continue;
    const role = palaceLabel(palace.name);
    const descriptions = names.slice(0, 2).map(name => `${name}：${starPracticalTip(name, topic)}`);
    lines.push(`${role} ${descriptions.join('；')}`);
  }
  return lines;
}

function currentDaXian(chart: ZiweiChart, year: number): { text: string; palace?: Palace; index: number } {
  const age = Number.isFinite(chart.currentAge) && chart.currentAge > 0
    ? chart.currentAge
    : year - chart.lunarInfo.lunarYear + 1;
  let index = getDaXianIndexForAge(chart, age);
  if (index < 0 && Number.isInteger(chart.currentDaXianIndex)) {
    const candidate = chart.currentDaXianIndex;
    if (candidate >= 0 && candidate < chart.daXians.length) index = candidate;
  }
  if (index < 0 || index >= chart.daXians.length) {
    return { text: '命盘没有提供可以确认的当前十年大限，本次不强行套用。', index: -1 };
  }

  const dx = chart.daXians[index];
  const palace = findPalaceByBranch(chart, dx.palaceBranch);
  const startYear = getDaXianStartYear(chart, index);
  const endYear = startYear === null ? null : startYear + (dx.endAge - dx.startAge);
  const time = startYear !== null && endYear !== null ? `（约${startYear}年至${endYear}年）` : '';
  if (!palace) {
    return { text: `${dx.startAge}至${dx.endAge}岁${time}的大限宫位资料不完整。`, index };
  }

  const siHua = getDaXianSiHua(chart, index, year);
  const relatedNames = [palace.name, '命宫', '财帛', '官禄', '迁移'];
  const huaLines: string[] = [];
  if (siHua) {
    for (const hua of HUA_ORDER) {
      const star = siHua.transforms[hua];
      const locations = findStarPalaces(chart, star);
      if (locations.some(p => relatedNames.map(normalisePalaceName).includes(normalisePalaceName(p.name)))) {
        huaLines.push(`${star}化${hua}：${STAR_HUA_MEANINGS[hua]}。`);
      }
    }
  }
  const starLine = mainStars(palace).map(s => s.name).join('、');
  const text = `${dx.startAge}至${dx.endAge}岁${time}，这一步大限走到${palaceLabel(palace.name)}${starLine ? `，主星为${starLine}` : ''}。这代表这十年更需要关注${PALACE_LABELS[normalisePalaceName(palace.name)] || '该宫位相关的生活领域'}。${huaLines.length ? `\n这一步运限中与人生主线有关的变化线索：${huaLines.join('')}` : ''}`;
  return { text, palace, index };
}

function yearlyHuaSummary(chart: ZiweiChart, year: number, relatedNames: string[]): string[] {
  const yearly = getLiuNianSiHua(year);
  const related = new Set(relatedNames.map(normalisePalaceName));
  const lines: string[] = [];
  for (const hua of HUA_ORDER) {
    const star = yearly.transforms[hua];
    const places = findStarPalaces(chart, star).filter(p => related.has(normalisePalaceName(p.name)));
    if (places.length) {
      lines.push(`${year}年${star}化${hua}，落在${places.map(p => palaceLabel(p.name)).join('、')}，${STAR_HUA_MEANINGS[hua]}。`);
    }
  }
  return lines;
}

function addPatternSection(chart: ZiweiChart, topicKey: TopicKey, topic: TopicDefinition): string[] {
  const hits = topicPatterns(chart, topicKey, topic.relatedPalaces);
  if (!hits.length) {
    return [
      '**【命盘组合怎么理解】**',
      '当前规则没有识别到与本主题直接相关、达到设定条件的完整格局。没有识别到格局不代表命盘不好；我们继续看实际星曜和四化，不为了凑名称而硬贴格局。',
    ];
  }
  return [
    '**【命盘组合怎么理解】**',
    ...hits.slice(0, topicKey === 'overall' ? 3 : 2).map(patternPlainText),
  ];
}

function buildOverall(chart: ZiweiChart, year: number): string {
  const topic = TOPICS.overall;
  const ming = findPalace(chart, '命宫');
  const four = ming ? getFourPalaces(chart, ming) : [];
  const overallStars = mainStarSummary(four, 'overall');
  const daXian = currentDaXian(chart, year);
  const huaLines = relevantNatalHuaLines(chart, topic.relatedPalaces);
  const yearlyLines = yearlyHuaSummary(chart, year, topic.relatedPalaces);

  return [
    '**【你的人生格局】**',
    topic.opening,
    '',
    '**【先看你的核心特点】**',
    ming ? describePalace(ming, '命宫') : '命宫资料暂缺，暂时不能确认核心性格。',
    ...overallStars.slice(1, 4),
    '',
    '**【命盘真正成立的格局】**',
    ...addPatternSection(chart, 'overall', topic).slice(1),
    '',
    '**【本命四化带来的长期主题】**',
    ...huaLines.slice(0, 4),
    '',
    '**【你目前所处的人生阶段】**',
    daXian.text,
    yearlyLines.length ? `\n**【${year}年的关注点】**\n${yearlyLines.slice(0, 3).join('\n')}` : '',
    '',
    '**【你的优势】**',
    topic.strengths,
    '**【需要留意】**',
    topic.cautions,
    '**【给你的现实建议】**',
    topic.advice,
  ].filter(Boolean).join('\n');
}

function buildPersonality(chart: ZiweiChart, year: number): string {
  const topic = TOPICS.personality;
  const core = ['命宫', '福德', '迁移', '官禄'].map(n => findPalace(chart, n)).filter((p): p is Palace => Boolean(p));
  const lines = mainStarSummary(core, 'personality');
  const ming = findPalace(chart, '命宫');
  const mind = findPalace(chart, '福德');
  const outside = findPalace(chart, '迁移');
  const hua = relevantNatalHuaLines(chart, topic.relatedPalaces);
  const daXian = currentDaXian(chart, year);
  return [
    '**【你的性格画像】**',
    topic.opening,
    '',
    '**【别人容易看到的你】**',
    describePalace(ming, '命宫'),
    '**【你内心真正需要的东西】**',
    describePalace(mind, '福德宫'),
    '**【你面对外部环境的表现】**',
    describePalace(outside, '迁移宫'),
    '**【你的做事优势】**',
    lines.length ? lines.join('\n') : topic.strengths,
    '**【容易走过头的地方】**',
    [...mainStars(ming), ...mainStars(mind)].map(s => STAR_MEANINGS[s.name]?.watch).filter(Boolean).slice(0, 3).join('；') || topic.cautions,
    ...addPatternSection(chart, 'personality', topic),
    '**【本命四化补充】**',
    ...hua.slice(0, 3),
    '**【目前阶段的提醒】**',
    daXian.text,
    '**【给你的建议】**',
    topic.advice,
  ].filter(Boolean).join('\n');
}

function buildRelationship(chart: ZiweiChart, year: number): string {
  const topic = TOPICS.relationship;
  const spouse = findPalace(chart, '夫妻');
  const ming = findPalace(chart, '命宫');
  const mind = findPalace(chart, '福德');
  const annual = yearlyHuaSummary(chart, year, topic.relatedPalaces);
  const natal = getNatalFourHua(chart);
  const spouseGiMenJi = Boolean(natal?.忌 === '巨门' && spouse?.stars.some(s => s.name === '巨门'));
  const spouseStarNames = starNames(spouse);
  const starLine = spouseStarNames.map(name => STAR_MEANINGS[name]?.positive).filter(Boolean).join('；');
  const daXian = currentDaXian(chart, year);
  return [
    '**【你的感情相处模式】**',
    topic.opening,
    '',
    '**【你在关系里的基本模式】**',
    describePalace(spouse, '夫妻宫'),
    starLine ? `从主星特点看：${starLine}。` : '',
    '**【你自己带进关系的习惯】**',
    describePalace(ming, '命宫'),
    '**【你内心需要怎样的安全感】**',
    describePalace(mind, '福德宫'),
    spouseGiMenJi
      ? '**【特别值得留意：巨门化忌在夫妻宫】**\n这张盘的本命四化确实显示巨门化忌落在夫妻宫。用日常话来说，亲密关系里可能比较容易因为话没说清楚、反复解释、追问细节或争论对错而消耗感情。你可能很想把问题弄明白，但对方有时会觉得被质疑。它提醒的是沟通课题，不代表一定经常吵架，更不代表婚姻注定不好。\n建议：争论时先确认对方的感受和真实意思，再讨论事情本身；重大问题约定好沟通时间，不在情绪最高点逼着对方给答案。'
      : '**【本命四化提醒】**\n' + relevantNatalHuaLines(chart, topic.relatedPalaces).slice(0, 2).join('\n'),
    ...addPatternSection(chart, 'relationship', topic),
    '**【目前阶段的关系观察】**',
    daXian.text,
    annual.length ? `\n**【${year}年的相关提醒】**\n${annual.slice(0, 2).join('\n')}` : '',
    '**【你可以怎么做】**',
    topic.advice,
    '以上是传统命盘倾向的表达，现实关系仍以双方的沟通、尊重和行动为准。',
  ].filter(Boolean).join('\n');
}

function buildCareer(chart: ZiweiChart, year: number, topicKey: 'career' | 'job_change' | 'business' | 'promotion' = 'career'): string {
  const topic = TOPICS[topicKey];
  const main = findPalace(chart, '官禄');
  const ming = findPalace(chart, '命宫');
  const wealth = findPalace(chart, '财帛');
  const move = findPalace(chart, '迁移');
  const friends = findPalace(chart, '交友') || findPalace(chart, '仆役');
  const core = [main, ming, wealth, move, friends].filter((p): p is Palace => Boolean(p));
  const lines = mainStarSummary(core, topicKey);
  const daXian = currentDaXian(chart, year);
  return [
    `**【${topic.title}】**`,
    topic.opening,
    '',
    '**【你适合发挥的工作能力】**',
    describePalace(main, '官禄宫'),
    lines.join('\n'),
    '**【你做事的个人风格】**',
    describePalace(ming, '命宫'),
    '**【收入与工作回报】**',
    describePalace(wealth, '财帛宫'),
    '**【外部机会与合作环境】**',
    [describePalace(move, '迁移宫'), describePalace(friends, '交友宫')].join('\n'),
    ...addPatternSection(chart, topicKey, topic),
    '**【本命四化与阶段变化】**',
    ...relevantNatalHuaLines(chart, topic.relatedPalaces).slice(0, 3),
    daXian.text,
    '**【优势可以怎样发挥】**',
    topic.strengths,
    '**【需要留意】**',
    topic.cautions,
    '**【现实行动建议】**',
    topic.advice,
  ].filter(Boolean).join('\n');
}

function wealthStageLines(chart: ZiweiChart): string[] {
  if (!Array.isArray(chart.daXians) || !chart.daXians.length) return ['命盘未提供完整的大限资料，暂时不能逐步整理人生阶段。'];
  return chart.daXians.map((dx, index) => {
    const palace = findPalaceByBranch(chart, dx.palaceBranch);
    const start = getDaXianStartYear(chart, index);
    const end = start === null ? null : start + (dx.endAge - dx.startAge);
    if (!palace) return `${dx.startAge}至${dx.endAge}岁：大限宫位资料暂缺。`;
    const stars = mainStars(palace).map(s => s.name);
    const detail = stars.length ? stars.map(n => STAR_MEANINGS[n]?.positive || n).join('；') : '主星资料不完整，需结合其他宫位观察';
    const hua = getDaXianSiHua(chart, index, start ?? new Date().getFullYear());
    const wealthHua = hua
      ? HUA_ORDER.map(h => {
          const star = hua.transforms[h];
          const inMoneyArea = findStarPalaces(chart, star).some(p => ['财帛', '官禄', '田宅', '福德'].includes(normalisePalaceName(p.name)));
          return inMoneyArea ? `${star}化${h}` : '';
        }).filter(Boolean)
      : [];
    const period = start !== null && end !== null ? `，约${start}年至${end}年` : '';
    const huaText = wealthHua.length ? `；财务相关的运限线索：${wealthHua.join('、')}` : '';
    return `${dx.startAge}至${dx.endAge}岁${period}，大限走${palaceLabel(palace.name)}。${detail}${huaText}。这部分只提示该阶段值得关注的主题，不代表收入必然增减。`;
  });
}

function buildFinance(chart: ZiweiChart, year: number): string {
  const topic = TOPICS.finance;
  const money = findPalace(chart, '财帛');
  const work = findPalace(chart, '官禄');
  const mind = findPalace(chart, '福德');
  const home = findPalace(chart, '田宅');
  const ming = findPalace(chart, '命宫');
  const wealthLu = findHuaInPalace(chart, '财帛', '禄');
  const wealthJi = findHuaInPalace(chart, '财帛', '忌');
  return [
    '**【你的赚钱与财富管理方式】**',
    topic.opening,
    '',
    '**【你可能通过什么方式创造收入】**',
    describePalace(money, '财帛宫'),
    describePalace(work, '官禄宫'),
    '**【你对钱的安全感与使用习惯】**',
    describePalace(mind, '福德宫'),
    '**【长期积累与稳定基础】**',
    describePalace(home, '田宅宫'),
    describePalace(ming, '命宫'),
    wealthLu
      ? `**【财务方面的有利线索】**\n本命化禄星${wealthLu}落在财帛宫。传统上常把这看成财务机会、资源或投入意愿的线索；真正能否积累，仍取决于持续收入、成本和管理。`
      : '',
    wealthJi
      ? `**【财务方面需要多留意的地方】**\n本命化忌星${wealthJi}落在财帛宫。它更适合作为提醒：金钱问题容易成为需要反复处理的课题，预算、合同、回款和风险边界要特别清楚；不代表一定破财。`
      : '',
    '**【一生不同阶段的财富观察】**',
    ...wealthStageLines(chart),
    '**【本命四化补充】**',
    ...relevantNatalHuaLines(chart, topic.relatedPalaces).slice(0, 3),
    '**【优势】**',
    topic.strengths,
    '**【需要留意】**',
    topic.cautions,
    `**【${year}年的现实提醒】**`,
    yearlyHuaSummary(chart, year, topic.relatedPalaces).slice(0, 3).join('\n') || '本年度流年四化没有直接落入当前财务主题的核心宫位，不强行解读。',
    '**【建议】**',
    topic.advice,
  ].filter(Boolean).join('\n');
}

const HEALTH_BEHAVIOUR: Record<string, string> = {
  天机: '思考和计划容易占用很多精力，适合把待办写下来，避免一直在脑中反复运转',
  巨门: '遇到压力时可能反复琢磨问题，适合找可信任的人沟通，不把烦恼长期闷在心里',
  太阴: '对环境和细节比较敏感，适合建立稳定、安静且有规律的休息习惯',
  天梁: '容易为别人操心，记得照顾他人之前也给自己留出休息时间',
  太阳: '容易主动承担责任，忙碌时要留意工作与休息的界线',
  七杀: '做事节奏可能偏快，适合在高强度任务之间安排明确的恢复时间',
  破军: '生活节奏变化较多时，适合用固定的小习惯帮助自己重新稳定下来',
  贪狼: '兴趣和社交活动较多，适合留意时间分配，避免长期透支休息时间',
  武曲: '容易把注意力放在任务和结果上，适合安排固定休息，不要总等事情做完才放松',
  天同: '重视舒适和放松，适合用轻量、可持续的日常活动维持规律',
  廉贞: '对规则和界线比较在意，压力大时可练习调整标准，不必事事都要求完美',
  天府: '偏好稳定的生活节奏，适合用固定作息和长期习惯维持状态',
  天相: '容易顾及周围人的感受，适合清楚表达自己的需求，不把所有责任都揽下来',
  紫微: '容易承担统筹责任，适合练习分工和授权，不必每件事都亲自扛着',
};

function describeHealthPalace(palace: Palace | undefined, heading: string): string {
  if (!palace) return `${heading}资料暂缺，不对身心状态作推断。`;
  const names = starNames(palace);
  const notes = names.map(name => HEALTH_BEHAVIOUR[name]).filter(Boolean);
  const shaNames = palace.stars.filter(s => s.type === 'sha').map(s => s.name);
  const extra = shaNames.length
    ? `；同宫有${shaNames.join('、')}，可把它当作提醒：忙碌或压力大时，给自己多一点缓冲，不要长期硬撑`
    : '';
  return notes.length
    ? `${heading}：${notes.join('；')}${extra}。`
    : `${heading}：当前星曜组合没有足够依据归纳特定的生活节奏，建议以实际作息、压力来源和个人感受为准。`;
}

function buildHealth(chart: ZiweiChart): string {
  const topic = TOPICS.health;
  const stress = findPalace(chart, '疾厄');
  const mind = findPalace(chart, '福德');
  const ming = findPalace(chart, '命宫');
  return [
    '**【你的身心节奏与生活提醒】**',
    topic.opening,
    '',
    '**【压力来时，你可能怎样反应】**',
    describeHealthPalace(stress, '疾厄宫'),
    '**【什么方式有助于恢复状态】**',
    describeHealthPalace(mind, '福德宫'),
    '**【你平时的行动节奏】**',
    describeHealthPalace(ming, '命宫'),
    ...addPatternSection(chart, 'health', topic),
    '**【可以落实的生活建议】**',
    '给自己安排固定睡眠时间和休息间隔；工作压力大时，把任务分优先级，不要长期靠熬夜硬撑。',
    '保持适合自己的规律活动，定期与信任的人交流。如果长期情绪低落、睡眠困难或身体不适，请及时向合格的医疗或心理专业人员求助。',
    '本段只作传统文化和自我观察参考，不诊断疾病、不推断器官病变、不预测寿命。',
  ].filter(Boolean).join('\n');
}

function buildTopic(chart: ZiweiChart, topicKey: TopicKey, year: number): string {
  switch (topicKey) {
    case 'overall': return buildOverall(chart, year);
    case 'relationship': return buildRelationship(chart, year);
    case 'career':
    case 'job_change':
    case 'business':
    case 'promotion': return buildCareer(chart, year, topicKey);
    case 'finance': return buildFinance(chart, year);
    case 'health': return buildHealth(chart);
    case 'personality': return buildPersonality(chart, year);
    default: return buildOverall(chart, year);
  }
}

function isTopicKey(value: unknown): value is TopicKey {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(TOPICS, value);
}

function isRequestMode(value: unknown): value is RequestMode {
  return value === 'topic' || value === 'palace' || value === 'sihua';
}

function detectTopic(prompt: string): TopicKey {
  if (/换工作|跳槽|转行|辞职|求职|找工作|新工作/.test(prompt)) return 'job_change';
  if (/创业|开店|做生意|合伙|经营项目/.test(prompt)) return 'business';
  if (/升职|晋升|加薪|升迁/.test(prompt)) return 'promotion';
  if (/感情|婚姻|恋爱|对象|伴侣|夫妻|桃花/.test(prompt)) return 'relationship';
  if (/财运|财富|收入|赚钱|存钱|理财|欠债|债务/.test(prompt)) return 'finance';
  if (/健康|身体|疾病|疾厄|养生|身心/.test(prompt)) return 'health';
  if (/事业|工作|职业|官禄|职场/.test(prompt)) return 'career';
  if (/性格|脾气|人际|个性/.test(prompt)) return 'personality';
  return 'overall';
}

function getYearFromPrompt(prompt: string): number {
  const match = prompt.match(/(?:19|20)\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

function resolveRequestedPalace(chart: ZiweiChart, prompt: string, requestedName?: string): string | undefined {
  if (requestedName && findPalace(chart, requestedName)) return requestedName;
  const match = prompt.match(/【([^】]+)】/);
  if (match && findPalace(chart, match[1])) return match[1];
  const names = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫'];
  return names.find(name => prompt.includes(name) && findPalace(chart, name));
}

function buildPalaceAnalysis(chart: ZiweiChart, palaceName: string, year: number): string {
  const palace = findPalace(chart, palaceName);
  if (!palace) return '没有找到这处宫位的完整资料，本次不作推断。';
  const four = getFourPalaces(chart, palace);
  const fourLines = four.map((p, index) => describePalace(p, index === 0 ? '这件事本身' : index === 3 ? '外部互动面' : '相关支持面'));
  const native = relevantNatalHuaLines(chart, [palace.name, ...four.map(p => p.name)]);
  const title = `${palaceLabel(palace.name)}专项解读`;
  return [
    `**【${title}】**`,
    `这部分主要对应${PALACE_LABELS[normalisePalaceName(palace.name)] || '相关生活领域'}。我们先看本宫，再合看其他相关位置，不用单颗星直接下结论。`,
    ...fourLines,
    '**【这组星曜可能怎样表现】**',
    ...mainStarSummary(four, detectTopic(palaceName)),
    '**【四化线索】**',
    ...native.slice(0, 3),
    `**【${year}年的相关变化】**`,
    ...yearlyHuaSummary(chart, year, [palace.name, ...four.map(p => p.name)]).slice(0, 3),
    '**【现实建议】**',
    '把以上特点当作观察提示，结合现实经历验证；遇到重要决定时，还要核实具体条件，不要只依赖命盘。',
  ].filter(Boolean).join('\n');
}

function buildSihuaAnalysis(chart: ZiweiChart, prompt: string, year: number, requestedPalace?: string): string {
  const match = prompt.match(/【(?:(本命|大限|流年))?([^】]+?)化([禄权科忌])】/);
  if (!match) return '没有识别到明确的四化目标，请重新点击命盘上的四化标记。';
  const layer = match[1] || '本命';
  const starName = match[2].trim().replace(/^(本命|大限|流年)/, '');
  const hua = match[3] as Hua;
  const destinations = findStarPalaces(chart, starName);
  const destination = requestedPalace ? findPalace(chart, requestedPalace) : destinations[0];
  let confirmed = false;
  if (layer === '本命') {
    const native = getNatalFourHua(chart);
    confirmed = Boolean(native && native[hua] === starName);
  } else if (layer === '流年') {
    const annual = getLiuNianSiHua(year);
    confirmed = annual.transforms[hua] === starName;
  } else {
    const age = Number.isFinite(chart.currentAge) ? chart.currentAge : year - chart.lunarInfo.lunarYear + 1;
    const index = getDaXianIndexForYear(chart, year) >= 0 ? getDaXianIndexForYear(chart, year) : getDaXianIndexForAge(chart, age);
    const daXian = index >= 0 ? getDaXianSiHua(chart, index, year) : null;
    confirmed = Boolean(daXian && daXian.transforms[hua] === starName);
  }
  return [
    '**【四化是什么意思】**',
    `${layer}的${starName}化${hua}，${STAR_HUA_MEANINGS[hua]}。` ,
    '**【命盘位置】**',
    destination ? describePalace(destination, palaceLabel(destination.name)) : `在当前命盘资料中没有找到${starName}的落宫。`,
    '**【本次是否核对成立】**',
    confirmed
      ? `按当前命盘的${layer}层次，确实对应${starName}化${hua}。`
      : `当前选择的${layer}层次，未核对到${starName}化${hua}。请留意：这不表示这颗星不存在，而是所选运限层次与该四化不一致。`,
    '**【放到现实生活中怎么理解】**',
    `${starName}所在宫位代表${PALACE_LABELS[normalisePalaceName(destination?.name || '')] || '相关生活领域'}。化${hua}的传统含义是：${STAR_HUA_MEANINGS[hua]}。${hua === '忌' ? '它更像需要认真面对的课题，不等于必然发生坏事。' : '它提供的是一种倾向，不保证现实结果。'}`,
    '**【建议】**',
    hua === '忌'
      ? '不要因为看到化忌就害怕。把这件事拆开看，找到可沟通、可规划、可改善的部分，别把单一标记当成命运判决。'
      : '把这方面的特点转化为具体行动，并用现实反馈判断是否适合继续投入。',
  ].filter(Boolean).join('\n');
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
    const topicKey = isTopicKey(body?.topicKey) ? body.topicKey : detectTopic(prompt);
    const mode: RequestMode = isRequestMode(body?.mode) ? body.mode : 'topic';
    const year = getYearFromPrompt(prompt);
    const requestedPalace = typeof body?.requestedPalace === 'string'
      ? body.requestedPalace.trim()
      : undefined;

    let result: string;
    if (mode === 'sihua') {
      result = buildSihuaAnalysis(chart, prompt || '四化专项分析', year, requestedPalace);
    } else if (mode === 'palace') {
      const palaceName = resolveRequestedPalace(chart, prompt, requestedPalace);
      result = palaceName
        ? buildPalaceAnalysis(chart, palaceName, year)
        : '没有识别到你选择的宫位，请重新点击一个宫位。';
    } else {
      result = buildTopic(chart, topicKey, year);
    }

    result += '\n\n**说明**\n本解读是依据命盘结构和传统文化规则整理的自我观察参考，不代表确定命运，也不能替代医疗、法律、投资或婚恋方面的专业判断。';

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/[\s\S]{1,40}/gu) ?? [result];
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
    return Response.json({ error: '解读生成失败，请稍后再试' }, { status: 500 });
  }
}

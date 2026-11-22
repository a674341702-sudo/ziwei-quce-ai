
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
  main: string;
  related: string[];
};

type CenterPattern = {
  name: string;
  evidence: string[];
  support: string[];
  caution: string[];
};

const TOPICS: Record<TopicKey, Topic> = {
  overall: {
    key: 'overall',
    title: '命格整体分析',
    main: '命',
    related: ['命', '财帛', '官禄', '迁移', '福德'],
  },
  personality: {
    key: 'personality',
    title: '性格特质分析',
    main: '命',
    related: ['命', '福德', '迁移', '官禄'],
  },
  relationship: {
    key: 'relationship',
    title: '感情关系分析',
    main: '夫妻',
    related: ['夫妻', '命', '福德', '迁移', '子女'],
  },
  career: {
    key: 'career',
    title: '事业发展分析',
    main: '官禄',
    related: ['官禄', '命', '财帛', '迁移', '交友', '福德'],
  },
  job_change: {
    key: 'job_change',
    title: '换工作与职业转型分析',
    main: '官禄',
    related: ['官禄', '命', '财帛', '迁移', '交友', '福德'],
  },
  business: {
    key: 'business',
    title: '创业与经营方向分析',
    main: '官禄',
    related: ['官禄', '财帛', '命', '迁移', '交友', '田宅'],
  },
  promotion: {
    key: 'promotion',
    title: '升职与发展机会分析',
    main: '官禄',
    related: ['官禄', '命', '财帛', '交友', '迁移'],
  },
  finance: {
    key: 'finance',
    title: '财富模式分析',
    main: '财帛',
    related: ['财帛', '福德', '田宅', '官禄', '命'],
  },
  health: {
    key: 'health',
    title: '身心状态分析',
    main: '疾厄',
    related: ['疾厄', '命', '福德', '父母'],
  },
};

const STAR_TRAITS: Record<string, string> = {
  紫微: '主导、统筹、责任与管理意识',
  天机: '思考、谋划、变化与学习能力',
  太阳: '主动、表达、承担与对外影响力',
  武曲: '执行、财务意识、效率与决断',
  天同: '协调、享受、温和与舒适需求',
  廉贞: '原则、界线、表现与复杂关系处理',
  天府: '资源管理、稳定、积累与守成',
  太阴: '细节、规划、安全感与内在感受',
  贪狼: '欲望、社交、才艺、资源连接与开拓',
  巨门: '表达、研究、辨析与沟通压力',
  天相: '协调、规则、辅助与组织能力',
  天梁: '经验、原则、照顾与长期责任',
  七杀: '决断、压力应对、竞争与突破',
  破军: '改革、重建、变动与重新开始',
};

const STAR_BRIGHTNESS: Record<string, string> = {
  庙: '庙旺',
  旺: '旺',
  得: '得地',
  利: '有利',
  平: '平',
  不: '较弱',
  闲: '闲弱',
  陷: '落陷',
  地: '地',
};

const HUA_ORDER: SiHua[] = ['禄', '权', '科', '忌'];

const PALACE_NAMES = [
  '命',
  '兄弟',
  '夫妻',
  '子女',
  '财帛',
  '疾厄',
  '迁移',
  '交友',
  '官禄',
  '田宅',
  '福德',
  '父母',
];

function normalizeName(name: string): string {
  return String(name || '')
    .replace(/宫$/, '')
    .replace('仆役', '交友');
}

function getPalaceByBranch(
  chart: ZiweiChart,
  branch: number,
): Palace | undefined {
  const b = ((branch % 12) + 12) % 12;
  return chart.palaces.find(p => p.branch === b);
}

function getPalaceByName(
  chart: ZiweiChart,
  name: string,
): Palace | undefined {
  const target = normalizeName(name);
  return chart.palaces.find(
    p => normalizeName(p.name) === target,
  );
}

function getTriadBranches(centerBranch: number): number[] {
  return [
    centerBranch,
    (centerBranch + 4) % 12,
    (centerBranch + 8) % 12,
    (centerBranch + 6) % 12,
  ];
}

function getTriadPalaces(
  chart: ZiweiChart,
  centerBranch: number,
): Palace[] {
  return getTriadBranches(centerBranch)
    .map(branch => getPalaceByBranch(chart, branch))
    .filter((p): p is Palace => Boolean(p));
}

function getStars(palace: Palace): Star[] {
  return Array.isArray(palace.stars) ? palace.stars : [];
}

function getMajorStars(palace: Palace): Star[] {
  return getStars(palace).filter(s => s.type === 'major');
}

function hasStar(palace: Palace, name: string): boolean {
  return getStars(palace).some(s => s.name === name);
}

function findStarPalaces(
  chart: ZiweiChart,
  starName: string,
): Palace[] {
  return chart.palaces.filter(p => hasStar(p, starName));
}

function getStarLocation(
  chart: ZiweiChart,
  starName: string,
): string {
  const palaces = findStarPalaces(chart, starName);
  if (!palaces.length) return '未找到落宫';

  return palaces.map(p => p.name).join('、');
}

function formatStar(star: Star): string {
  const brightness = star.brightnessRaw
    ? '（' + (STAR_BRIGHTNESS[star.brightnessRaw] || star.brightnessRaw) + '）'
    : '';

  const hua = star.siHua ? '〔化' + star.siHua + '〕' : '';

  return star.name + brightness + hua;
}

function formatPalace(palace: Palace): string {
  const stars = getStars(palace);
  const major = getMajorStars(palace);
  const lucky = stars.filter(s => s.type === 'lucky');
  const sha = stars.filter(s => s.type === 'sha');
  const minor = stars.filter(s => s.type === 'minor');

  const lines: string[] = [];

  lines.push(
    '【' + palace.name + '｜' + palace.branch + '宫支】',
  );

  if (major.length) {
    lines.push('主星：' + major.map(formatStar).join('、'));
  } else {
    lines.push('主星：空宫');

    if (palace.borrowedStars?.length) {
      lines.push(
        '借对宫主星：' + palace.borrowedStars.join('、'),
      );
    } else {
      lines.push('空宫需要结合对宫借星观察');
    }
  }

  if (lucky.length) {
    lines.push('吉曜：' + lucky.map(formatStar).join('、'));
  }

  if (sha.length) {
    lines.push('煞曜：' + sha.map(formatStar).join('、'));
  }

  if (minor.length) {
    lines.push('其他辅曜：' + minor.map(formatStar).join('、'));
  }

  return lines.join('\n');
}

function detectTopic(prompt: string): Topic {
  if (/换工作|跳槽|转行|辞职|求职|找工作|新工作/.test(prompt)) {
    return TOPICS.job_change;
  }

  if (/创业|开店|做生意|合伙|经营项目|自己干/.test(prompt)) {
    return TOPICS.business;
  }

  if (/升职|晋升|加薪|升迁|职位提升/.test(prompt)) {
    return TOPICS.promotion;
  }

  if (/感情|婚姻|恋爱|对象|伴侣|夫妻|桃花/.test(prompt)) {
    return TOPICS.relationship;
  }

  if (/财运|财富|收入|赚钱|存钱|理财|投资|欠债|债务/.test(prompt)) {
    return TOPICS.finance;
  }

  if (/健康|身体|疾病|疾厄|养生/.test(prompt)) {
    return TOPICS.health;
  }

  if (/事业|工作|职业|官禄|职场/.test(prompt)) {
    return TOPICS.career;
  }

  if (/性格|脾气|人际|个性/.test(prompt)) {
    return TOPICS.personality;
  }

  return TOPICS.overall;
}

function findRequestedPalace(
  chart: ZiweiChart,
  prompt: string,
): Palace | undefined {
  const bracket = prompt.match(
    /(?:分析|重点看|重点分析|看看)【([^】]+)】/,
  );

  if (bracket?.[1]) {
    const found = getPalaceByName(chart, bracket[1]);
    if (found) return found;
  }

  const names = [
    '命宫',
    '兄弟宫',
    '夫妻宫',
    '子女宫',
    '财帛宫',
    '疾厄宫',
    '迁移宫',
    '交友宫',
    '官禄宫',
    '田宅宫',
    '福德宫',
    '父母宫',
  ];

  for (const name of names) {
    if (prompt.includes(name)) {
      const found = getPalaceByName(chart, name);
      if (found) return found;
    }
  }

  return undefined;
}

/**
 * 以任意宫位为中心识别组合。
 * 不再把本命命宫写死为唯一分析中心。
 */
function detectCenterPatterns(
  chart: ZiweiChart,
  center: Palace,
): CenterPattern[] {
  const palaces = getTriadPalaces(chart, center.branch);
  const branches = new Set(palaces.map(p => p.branch));
  const allStars = new Set(
    palaces.flatMap(p => getStars(p).map(s => s.name)),
  );

  const patterns: CenterPattern[] = [];

  const locations = (names: string[]) =>
    names.map(name => name + '在' + getStarLocation(chart, name));

  const shaNames = [
    '擎羊',
    '陀罗',
    '火星',
    '铃星',
    '地空',
    '地劫',
  ];

  const shaCount = palaces.reduce(
    (sum, p) =>
      sum + getStars(p).filter(s => shaNames.includes(s.name)).length,
    0,
  );

  const luckyNames = [
    '左辅',
    '右弼',
    '文昌',
    '文曲',
    '天魁',
    '天钺',
    '禄存',
  ];

  const foundLucky = luckyNames.filter(name => allStars.has(name));

  // 杀破狼：七杀、破军、贪狼齐入中心宫位三方四正
  if (
    allStars.has('七杀') &&
    allStars.has('破军') &&
    allStars.has('贪狼')
  ) {
    const evidence = [
      '七杀、破军、贪狼三颗主星同时进入本次中心宫位的三方四正',
      ...locations(['七杀', '破军', '贪狼']),
    ];

    const support: string[] = [];

    if (
      allStars.has('左辅') &&
      allStars.has('右弼')
    ) {
      support.push('左辅、右弼同会，增加协作与助力条件');
    }

    if (
      palaces.some(p =>
        getStars(p).some(s =>
          (s.name === '七杀' || s.name === '破军' || s.name === '贪狼') &&
          (s.siHua === '禄' || s.siHua === '权'),
        ),
      )
    ) {
      support.push('杀破狼相关星曜见化禄或化权');
    }

    const caution: string[] = [];

    if (shaCount >= 3) {
      caution.push('三方四正煞曜数量较多，需要检查冲动、竞争和变动成本');
    }

    patterns.push({
      name: '杀破狼组合',
      evidence,
      support,
      caution,
    });
  }

  // 机月同梁：四星齐入中心三方四正
  if (
    ['天机', '太阴', '天同', '天梁']
      .every(name => allStars.has(name))
  ) {
    patterns.push({
      name: '机月同梁组合',
      evidence: [
        '天机、太阴、天同、天梁四星齐入本次中心宫位三方四正',
        ...locations(['天机', '太阴', '天同', '天梁']),
      ],
      support: [
        ...(allStars.has('文昌') || allStars.has('文曲')
          ? ['会照文昌或文曲，增加学习、表达和专业能力方面的观察依据']
          : []),
        ...(allStars.has('左辅') || allStars.has('右弼')
          ? ['会照辅弼，增加协作条件']
          : []),
      ],
      caution: shaCount >= 3
        ? ['三方煞曜较多，稳定性与执行过程仍需单独判断']
        : [],
    });
  }

  // 火贪、铃贪：贪狼与火星或铃星处于同宫或三方四正
  for (const sha of ['火星', '铃星']) {
    if (allStars.has('贪狼') && allStars.has(sha)) {
      const tan = findStarPalaces(chart, '贪狼')
        .find(p => branches.has(p.branch));

      const fire = findStarPalaces(chart, sha)
        .find(p => branches.has(p.branch));

      if (tan && fire) {
        const samePalace = tan.branch === fire.branch;

        const tanStar = getStars(tan).find(s => s.name === '贪狼');

        patterns.push({
          name: sha === '火星' ? '火贪组合' : '铃贪组合',
          evidence: [
            '贪狼与' + sha + (samePalace ? '同宫' : '同入本次三方四正'),
            '贪狼落在' + tan.name,
            sha + '落在' + fire.name,
          ],
          support: [
            ...(tanStar?.brightnessRaw === '庙' ||
            tanStar?.brightnessRaw === '旺'
              ? ['贪狼处于庙旺位置']
              : []),
            ...(tanStar?.siHua === '禄' || tanStar?.siHua === '权'
              ? ['贪狼同时见化禄或化权']
              : []),
          ],
          caution: [
            ...(hasStar(tan, '擎羊') || hasStar(tan, '陀罗')
              ? ['贪狼所在宫同时见羊陀']
              : []),
            ...(hasStar(tan, '地空') || hasStar(tan, '地劫')
              ? ['贪狼所在宫同时见空劫']
              : []),
          ],
        });
      }
    }
  }

  // 武贪：武曲、贪狼同宫或对宫
  if (allStars.has('武曲') && allStars.has('贪狼')) {
    const wu = findStarPalaces(chart, '武曲')
      .find(p => branches.has(p.branch));

    const tan = findStarPalaces(chart, '贪狼')
      .find(p => branches.has(p.branch));

    if (wu && tan) {
      const same = wu.branch === tan.branch;
      const opposite = (wu.branch + 6) % 12 === tan.branch;

      if (same || opposite) {
        patterns.push({
          name: '武贪组合',
          evidence: [
            same ? '武曲与贪狼同宫' : '武曲与贪狼对宫',
            '武曲在' + wu.name,
            '贪狼在' + tan.name,
          ],
          support: [
            ...(hasStar(wu, '禄存') || hasStar(tan, '禄存')
              ? ['相关宫位见禄存']
              : []),
            ...(hasStar(wu, '火星') || hasStar(tan, '火星') ||
            hasStar(wu, '铃星') || hasStar(tan, '铃星')
              ? ['相关宫位另见火星或铃星']
              : []),
          ],
          caution: [
            ...(hasStar(wu, '地空') || hasStar(wu, '地劫')
              ? ['武曲所在宫见空劫']
              : []),
            ...(hasStar(tan, '擎羊') || hasStar(tan, '陀罗')
              ? ['贪狼所在宫见羊陀']
              : []),
          ],
        });
      }
    }
  }

  // 紫府同宫
  const ziwei = findStarPalaces(chart, '紫微')
    .find(p => branches.has(p.branch));

  const tianfu = findStarPalaces(chart, '天府')
    .find(p => branches.has(p.branch));

  if (
    ziwei &&
    tianfu &&
    ziwei.branch === tianfu.branch
  ) {
    patterns.push({
      name: '紫府同宫组合',
      evidence: [
        '紫微与天府同在' + ziwei.name,
        '该宫位属于本次中心三方四正',
      ],
      support: foundLucky.length
        ? ['同一三方四正另见：' + foundLucky.join('、')]
        : [],
      caution: [
        ...(hasStar(ziwei, '地空') || hasStar(ziwei, '地劫')
          ? ['紫府同宫位置见空劫']
          : []),
      ],
    });
  }

  return patterns;
}

function formatCenterPatterns(
  chart: ZiweiChart,
  center: Palace,
): string {
  const patterns = detectCenterPatterns(chart, center);

  if (!patterns.length) {
    return [
      '本次中心宫位三方四正未匹配到当前已定义的重点组合。',
      '这不代表命盘没有特点，只代表目前规则没有发现完整的组合条件。',
    ].join('\n');
  }

  return patterns.map((p, index) => {
    return [
      (index + 1) + '、' + p.name,
      '成立依据：' + p.evidence.join('；'),
      p.support.length
        ? '辅助条件：' + p.support.join('；')
        : '',
      p.caution.length
        ? '需要留意：' + p.caution.join('；')
        : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function getLayerText(
  chart: ZiweiChart,
  label: string,
  transforms: Record<SiHua, string>,
  centerBranches?: number[],
): string {
  const lines: string[] = [
    '【' + label + '】',
  ];

  const branchSet = centerBranches
    ? new Set(centerBranches)
    : undefined;

  for (const hua of HUA_ORDER) {
    const starName = transforms[hua];

    if (!starName) {
      lines.push('化' + hua + '：资料缺失');
      continue;
    }

    const destinations = findStarPalaces(chart, starName);

    if (!destinations.length) {
      lines.push('化' + hua + '：' + starName + '，命盘中未找到落宫');
      continue;
    }

    const text = destinations.map(p => {
      const hit = branchSet?.has(p.branch);
      return p.name + (hit ? '〔进入本次分析三方四正〕' : '');
    }).join('、');

    lines.push(
      '化' + hua + '：' + starName + ' → ' + text,
    );
  }

  return lines.join('\n');
}

function getNativeSihua(chart: ZiweiChart): string {
  const stem = chart.lunarInfo?.yearStem;

  if (!Number.isInteger(stem) || stem < 0 || stem > 9) {
    return '出生年天干资料不完整，无法计算本命四化。';
  }

  const transforms = getSiHuaByStem(stem);

  return getLayerText(
    chart,
    '本命生年四化',
    transforms,
  );
}

function getSelfSihuaText(chart: ZiweiChart): string {
  const lines = chart.palaces.flatMap(p =>
    detectSelfSihua(p).map(mark =>
      p.name + '宫干对应本宫星曜：' +
      mark.starName + '化' + mark.siHua,
    ),
  );

  return lines.length
    ? lines.join('；')
    : '当前规则未识别到可确认的宫干自化组合。';
}

function getAgeAndYear(
  chart: ZiweiChart,
  prompt: string,
): { year: number; age: number } {
  const yearMatch = prompt.match(/(?:19|20)\d{2}/);
  const ageMatch = prompt.match(/(\d{1,2})岁/);

  const year = yearMatch
    ? Number(yearMatch[0])
    : new Date().getFullYear();

  const age = ageMatch
    ? Number(ageMatch[1])
    : year - chart.lunarInfo.lunarYear + 1;

  return { year, age };
}

function getDaXianIndex(
  chart: ZiweiChart,
  age: number,
): number {
  const index = (chart.daXians || []).findIndex(dx =>
    age >= dx.startAge && age <= dx.endAge,
  );

  if (index >= 0) return index;

  if (
    age === chart.currentAge &&
    chart.currentDaXianIndex >= 0 &&
    chart.currentDaXianIndex < chart.daXians.length
  ) {
    return chart.currentDaXianIndex;
  }

  return -1;
}

function getDaXianAnalysis(
  chart: ZiweiChart,
  age: number,
  year: number,
): {
  text: string;
  palace?: Palace;
  index: number;
  branches?: number[];
} {
  const index = getDaXianIndex(chart, age);

  if (index < 0) {
    return {
      index: -1,
      text:
        '按当前年龄' + age +
        '岁，命盘没有提供可匹配的十年大限。' +
        '本次不强行套用其他大限。',
    };
  }

  const dx = chart.daXians[index];
  const palace = getPalaceByBranch(chart, dx.palaceBranch);

  if (!palace) {
    return {
      index,
      text:
        dx.startAge + '至' + dx.endAge +
        '岁大限对应宫位资料缺失。',
    };
  }

  const branches = getTriadBranches(palace.branch);
  const triad = getTriadPalaces(chart, palace.branch);

  const sihua = getDaXianSiHua(chart, index, year);

  const sihuaText = sihua
    ? getLayerText(
        chart,
        '大限宫干四化（' + sihua.stemName + '干）',
        sihua.transforms,
        branches,
      )
    : '大限宫干四化资料暂缺。';

  const text = [
    '大限年龄：' + dx.startAge + '至' + dx.endAge + '岁',
    '大限所在宫位：' + palace.name,
    '',
    '大限宫位本身：',
    formatPalace(palace),
    '',
    '大限宫位三方四正：',
    triad.map(formatPalace).join('\n\n'),
    '',
    '大限中心组合识别：',
    formatCenterPatterns(chart, palace),
    '',
    sihuaText,
  ].join('\n');

  return {
    text,
    palace,
    index,
    branches,
  };
}

function getAnnualAnalysis(
  chart: ZiweiChart,
  year: number,
  centerBranches: number[],
): string {
  const annual = getLiuNianSiHua(year);

  return getLayerText(
    chart,
    year + '年流年四化（' + annual.stemName + '干）',
    annual.transforms,
    centerBranches,
  );
}

function getNativePatternAnalysis(chart: ZiweiChart): string {
  const patterns = detectPatterns(chart);

  if (!patterns.length) {
    return '本命格局库未匹配到已定义的完整格局。不能据此认定命盘没有特点。';
  }

  return patterns.slice(0, 12).map((p, index) => {
    const conditions = p.conditions?.required?.length
      ? '成立条件：' + p.conditions.required.join('；')
      : '';

    const bonus = p.conditions?.bonus?.length
      ? '辅助条件：' + p.conditions.bonus.join('；')
      : '';

    const breaking = p.conditions?.breaking?.length
      ? '破格或减力因素：' + p.conditions.breaking.join('；')
      : '';

    return [
      (index + 1) + '、' + p.name + '（' + p.level + '）',
      p.description,
      conditions,
      bonus,
      breaking,
      p.source ? '参考出处：' + p.source : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

function getStarCombinationText(
  center: Palace,
): string {
  const major = getMajorStars(center);

  if (!major.length) {
    return '本宫为空宫，不能只凭空宫作判断。需要同时观察对宫借星以及本宫三方四正。';
  }

  const traits = major
    .map(s => {
      const trait = STAR_TRAITS[s.name];
      return s.name + '：' + (trait || '需结合具体星曜组合分析');
    });

  return traits.join('\n');
}

function getTopicAdvice(key: TopicKey): string {
  const advice: Record<TopicKey, string> = {
    overall:
      '把命盘结构当作长期自我观察的参考，结合真实经历验证，不把单一格局当作人生结论。',
    personality:
      '将星曜组合转化为可观察的行为习惯，结合现实经历调整，不给自己贴固定标签。',
    relationship:
      '关注双方真实沟通、金钱观、生活节奏和冲突处理。命盘不能代替现实中的相处与选择。',
    career:
      '结合自身技能、行业需求和真实岗位条件判断职业方向。',
    job_change:
      '不要只凭命盘裸辞。先核实新岗位、薪资结构、试用期、合同和生活成本，尽量先获得明确录用再离职。',
    business:
      '先用低成本方式验证真实客户、回款和复购，再扩大投入。合伙前明确出资、分工、分账和退出机制。',
    promotion:
      '把晋升目标拆成可量化成果，核实组织需求、岗位标准和薪酬回报。',
    finance:
      '区分稳定收入、弹性收入和高风险收入，优先做好预算与应急储备。命盘不能判断投资收益。',
    health:
      '关注作息、压力与生活习惯。紫微斗数不能诊断疾病，有不适应咨询正规医疗机构。',
  };

  return advice[key];
}

function buildAnalysis(
  chart: ZiweiChart,
  prompt: string,
): string {
  const topic = detectTopic(prompt);
  const requested = findRequestedPalace(chart, prompt);
  const mainPalace =
    requested || getPalaceByName(chart, topic.main);

  if (!mainPalace) {
    return '命盘中没有找到本次主题对应的宫位，请检查排盘数据。';
  }

  const { year, age } = getAgeAndYear(chart, prompt);

  const mainBranches = getTriadBranches(mainPalace.branch);
  const mainTriad = getTriadPalaces(chart, mainPalace.branch);

  const related = topic.related
    .map(name => getPalaceByName(chart, name))
    .filter((p): p is Palace => Boolean(p));

  const daXian = getDaXianAnalysis(chart, age, year);

  const annualText = getAnnualAnalysis(
    chart,
    year,
    daXian.branches || mainBranches,
  );

  const nativeSihua = getLayerText(
    chart,
    '本命生年四化',
    getSiHuaByStem(chart.lunarInfo.yearStem),
    mainBranches,
  );

  const centerPatterns = formatCenterPatterns(
    chart,
    mainPalace,
  );

  const nativePatterns = getNativePatternAnalysis(chart);

  const lines = [
    '【' + (requested
      ? mainPalace.name + '专项分析'
      : topic.title) + '】',
    '',
    '用户问题：' + prompt,
    '',
    '本次分析中心：' + mainPalace.name,
    '中心宫位地支：' + mainPalace.branch,
    '本次参考年份：' + year,
    '对应分析年龄：' + age + '岁',
    '',
    '【一、中心宫位的实际星曜】',
    formatPalace(mainPalace),
    '',
    '主星特质参考：',
    getStarCombinationText(mainPalace),
    '',
    '【二、中心宫位三方四正】',
    '本宫、两个三合宫及对宫必须合看：',
    mainTriad.map(formatPalace).join('\n\n'),
    '',
    '【三、中心宫位的组合推导】',
    centerPatterns,
    '',
    '【四、本命整体格局】',
    nativePatterns,
    '',
    '【五、本命生年四化】',
    nativeSihua,
    '',
    '【六、宫干自化检查】',
    getSelfSihuaText(chart),
    '',
    '【七、十年大限分析】',
    daXian.text,
    '',
    '【八、年度四化分析】',
    annualText,
    '',
    '【九、主题相关宫位联动】',
    related.length
      ? related.map(formatPalace).join('\n\n')
      : '相关宫位资料不足。',
    '',
    '【十、综合推导】',
    buildConclusion(
      chart,
      mainPalace,
      mainBranches,
      daXian,
      year,
    ),
    '',
    '【十一、现实行动建议】',
    getTopicAdvice(topic.key),
    '',
    '【分析说明】',
    '本次结论根据实际命盘星曜落宫、三方四正、星曜亮度、辅煞曜、格局条件和四化落点逐项生成。',
    '未满足完整条件的格局不会强行认定。缺失的数据不会自行补齐。',
    '大限宫干四化属于独立辅助分析层，不等同于所有紫微斗数流派的统一口径。',
    '本解读属于传统文化研究与娱乐参考，不构成医疗、投资、法律或人生决策保证。',
  ];

  return lines.filter(Boolean).join('\n');
}

function buildConclusion(
  chart: ZiweiChart,
  center: Palace,
  branches: number[],
  daXian: {
    text: string;
    palace?: Palace;
    index: number;
    branches?: number[];
  },
  year: number,
): string {
  const triad = getTriadPalaces(chart, center.branch);
  const allStars = new Set(
    triad.flatMap(p => getStars(p).map(s => s.name)),
  );

  const shaCount = triad.reduce(
    (sum, p) =>
      sum + getStars(p).filter(s =>
        ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']
          .includes(s.name),
      ).length,
    0,
  );

  const lines: string[] = [];

  lines.push(
    '本次主题以' + center.name +
    '为中心，三方四正涉及：' +
    triad.map(p => p.name).join('、') + '。',
  );

  const majorNames = triad.flatMap(p =>
    getMajorStars(p).map(s => s.name),
  );

  lines.push(
    '该结构中实际出现的主星为：' +
    (majorNames.length ? [...new Set(majorNames)].join('、') : '暂无主星资料') +
    '。',
  );

  if (
    allStars.has('七杀') &&
    allStars.has('破军') &&
    allStars.has('贪狼')
  ) {
    lines.push(
      '中心三方四正齐见七杀、破军、贪狼，已满足本系统的杀破狼组合识别条件。需要继续结合三颗星的具体落宫、亮度、辅煞曜和四化，不能只凭格局名称判断吉凶。',
    );
  }

  if (allStars.has('左辅') || allStars.has('右弼')) {
    lines.push(
      '三方四正见辅弼星，说明分析时需要把协作、支持资源和人际助力纳入判断。',
    );
  }

  if (allStars.has('文昌') || allStars.has('文曲')) {
    lines.push(
      '三方四正见昌曲，需要把学习、表达、专业能力和文书沟通因素纳入观察。',
    );
  }

  if (shaCount > 0) {
    lines.push(
      '中心三方四正共发现' + shaCount +
      '颗主要煞曜。煞曜的具体位置不同，影响也不同，不能简单把数量直接等同于凶险程度。',
    );
  }

  if (daXian.palace) {
    lines.push(
      '当前对应大限中心为' + daXian.palace.name +
      '，其三方四正需要与本命' + center.name +
      '宫结构分开观察。',
    );
  }

  lines.push(
    year + '年流年四化需要与本命及大限层次交叉观察。四化落入相关宫位时，可以作为该年度值得关注的主题，但不能单独等同于某个现实事件。',
  );

  lines.push(
    '最终判断应以实际星曜组合、四化落点、运限宫位是否共同指向同一主题为依据；不同层次不一致时，应保留不确定性。',
  );

  return lines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const chart = body.chart as ZiweiChart | undefined;

    const messages = body.messages as
      | Array<{ role: string; content: string }>
      | undefined;

    if (
      !chart ||
      !Array.isArray(chart.palaces) ||
      chart.palaces.length !== 12 ||
      !chart.lunarInfo ||
      !Array.isArray(chart.daXians)
    ) {
      return Response.json(
        { error: '命盘数据不完整，无法进行组合分析。' },
        { status: 400 },
      );
    }

    const prompt = messages?.length
      ? String(messages[messages.length - 1]?.content ?? '')
      : '命格整体分析';

    const result = buildAnalysis(
      chart,
      prompt || '命格整体分析',
    );

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/[\s\S]{1,30}/gu) || [result];

        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(
              'data: ' +
              JSON.stringify({ delta: { text: chunk } }) +
              '\n\n',
            ),
          );
        }

        controller.enqueue(
          encoder.encode('data: [DONE]\n\n'),
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
    console.error('紫微组合分析接口错误:', error);

    return Response.json(
      { error: '紫微组合分析生成失败，请检查命盘数据和接口日志。' },
      { status: 500 },
    );
  }
}

import { NextRequest } from 'next/server';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';

const palaceRoles: Record<string, string> = {
  命宫: '性格、先天格局与人生方向',
  兄弟宫: '兄弟关系与合作关系',
  夫妻宫: '感情关系与婚姻',
  子女宫: '子女缘分与下属关系',
  财帛宫: '收入来源与财富管理',
  疾厄宫: '身体状态与健康管理',
  迁移宫: '外出发展与外部机遇',
  交友宫: '人际关系与社交圈',
  官禄宫: '事业发展与职业方向',
  田宅宫: '家庭环境与资产积累',
  福德宫: '精神状态与内在需求',
  父母宫: '家庭关系与长辈缘分',
};

function getStars(palace?: Palace) {
  if (!palace) return '未找到相关宫位数据';
  const stars = palace.stars ?? [];
  const major = stars.filter((s: Star) => s.type === 'major');
  const others = stars.filter((s: Star) => s.type !== 'major');

  const describe = (s: Star) =>
    `${s.name}${s.siHua ? `（化${s.siHua}）` : ''}${s.brightnessRaw ? `，亮度：${s.brightnessRaw}` : ''}`;

  if (!stars.length) {
    return palace.borrowedStars?.length
      ? `空宫，借对宫星曜：${palace.borrowedStars.join('、')}`
      : '空宫，需结合对宫借星进一步判断';
  }

  return [
    major.length ? `主星：${major.map(describe).join('、')}` : '无主星',
    others.length ? `辅曜及其他星曜：${others.map(describe).join('、')}` : '',
  ].filter(Boolean).join('；');
}

function findPalace(chart: ZiweiChart, name: string) {
  return chart.palaces.find(p => p.name === name);
}

function palaceInfo(chart: ZiweiChart, name: string) {
  const p = findPalace(chart, name);
  return `${name}：${getStars(p)}`;
}

function currentDaXian(chart: ZiweiChart) {
  const d = chart.daXians?.[chart.currentDaXianIndex];
  if (!d) return '当前大限资料暂未提供。';
  return `${d.startAge}至${d.endAge}岁，所在${d.palaceName}，${d.siHua
    ? `大限四化：化禄${d.siHua.lu}、化权${d.siHua.quan}、化科${d.siHua.ke}、化忌${d.siHua.ji}`
    : '暂无大限四化资料'}`;
}

function analyze(chart: ZiweiChart, prompt: string) {
  const topics = [
    { key: 'love', words: ['感情', '婚姻', '夫妻宫'], palace: '夫妻宫', title: '感情分析' },
    { key: 'career', words: ['事业', '官禄宫', '创业'], palace: '官禄宫', title: '事业分析' },
    { key: 'wealth', words: ['财运', '财富', '财帛宫', '理财'], palace: '财帛宫', title: '财运分析' },
    { key: 'health', words: ['健康', '疾厄宫', '养生'], palace: '疾厄宫', title: '健康分析' },
    { key: 'personality', words: ['性格', '人际关系模式'], palace: '命宫', title: '性格分析' },
  ];

  const topic = topics.find(t => t.words.some(w => prompt.includes(w)));
  const mainPalace = topic?.palace ?? '命宫';
  const p = findPalace(chart, mainPalace);
  const stars = getStars(p);
  const current = currentDaXian(chart);
  const siHua = chart.palaces.flatMap(palace =>
    (palace.stars ?? [])
      .filter(s => s.siHua)
      .map(s => `${palace.name}的${s.name}化${s.siHua}`)
  );

  const threePalaces = topic
    ? `${palaceInfo(chart, topic.palace)}\n${palaceInfo(chart, '命宫')}\n${palaceInfo(chart, '迁移宫')}`
    : `${palaceInfo(chart, '命宫')}\n${palaceInfo(chart, '财帛宫')}\n${palaceInfo(chart, '官禄宫')}\n${palaceInfo(chart, '迁移宫')}`;

  const title = topic?.title ?? '命格总览';

  const advice: Record<string, string> = {
    夫妻宫: '观察双方沟通方式、价值观与现实责任，不宜仅凭单一星曜判断婚姻结果。',
    官禄宫: '结合个人能力、行业环境和资源条件选择职业方向，重大转变宜先做好风险评估。',
    财帛宫: '建立稳定收入、储蓄和风险控制机制，不宜仅凭命盘判断投资或借贷。',
    疾厄宫: '命盘不能用于诊断疾病。如有身体不适，应及时咨询正规医疗机构。',
    命宫: '把命盘当作认识自身特点的参考，结合真实经历持续调整目标和行动。',
  };

  return `**【${title}】**
本次分析依据当前排盘中已有的宫位和星曜资料生成，属于传统紫微斗数规则参考，不代表确定的人生预测。

**【宫位与星曜】**
${mainPalace}主管：${palaceRoles[mainPalace]}。
${stars}

**【相关宫位联动】**
${threePalaces}

**【四化信息】**
${siHua.length ? siHua.join('；') : '当前命盘未读取到明确的生年四化标记。四化需要结合具体宫位和时间层次综合判断。'}

**【当前大限】**
当前年龄：${chart.currentAge}岁。
当前大限：${current}

**【五行局与命主身主】**
五行局：${chart.wuxingJuName || '暂缺'}；命主：${chart.mingZhu || '暂缺'}；身主：${chart.shenZhu || '暂缺'}。

**【分析建议】**
${advice[mainPalace]}

以上内容是基础规则型解读，不替代现实中的专业决策。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chart = body.chart as ZiweiChart | undefined;
    const messages = body.messages as Array<{ role: string; content: string }> | undefined;

    if (!chart || !Array.isArray(chart.palaces)) {
      return Response.json({ error: '命盘数据不完整' }, { status: 400 });
    }

    const prompt = messages?.[messages.length - 1]?.content ?? '命格总览';
    const result = analyze(chart, prompt);

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const chunks = result.match(/.{1,30}/gu) ?? [result];

        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ delta: { text: chunk } })}\n\n`)
          );
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

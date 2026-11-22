'use client';

export default function Home() {
  return (
    <main style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 10%, #172b50 0%, #071426 45%, #020810 100%)',
      color: '#eee6d2',
      padding: '55px 22px 30px',
      fontFamily: 'sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        <header style={{ textAlign: 'center', marginBottom: 55 }}>
          <div style={{
            color: '#d4a843',
            letterSpacing: 8,
            fontSize: 12,
            marginBottom: 22
          }}>
            ✦ ZI WEI · DESTINY ✦
          </div>

          <div style={{
            fontSize: 36,
            fontWeight: 'bold',
            letterSpacing: 5,
            color: '#e8c879',
            marginBottom: 15
          }}>
            紫微趣测 AI
          </div>

          <div style={{
            color: '#aebbd0',
            fontSize: 14,
            lineHeight: 2
          }}>
            以星曜为线索，探索命盘中的人生密码
            <br />
            认识自己，也读懂彼此
          </div>

          <div style={{
            width: 65,
            height: 1,
            background: '#bd9648',
            margin: '28px auto'
          }} />
        </header>

        <section style={{ marginBottom: 22 }}>
          <a href="/chart" style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: '28px 24px',
            border: '1px solid rgba(212,168,67,0.55)',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(35,57,91,0.85), rgba(9,22,42,0.95))',
            boxShadow: '0 12px 35px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              color: '#d4a843',
              fontSize: 12,
              letterSpacing: 3,
              marginBottom: 15
            }}>
              01 · PERSONAL CHART
            </div>

            <div style={{
              fontSize: 25,
              color: '#f0d48d',
              fontWeight: 'bold',
              marginBottom: 13
            }}>
              个人命盘
            </div>

            <div style={{
              color: '#bdc8d8',
              fontSize: 13,
              lineHeight: 2
            }}>
              排出你的专属紫微命盘
              <br />
              查看十二宫、十四主星、四化与十年大限
            </div>

            <div style={{
              marginTop: 22,
              color: '#d4a843',
              fontSize: 13
            }}>
              进入个人排盘　→
            </div>
          </a>
        </section>

        <section>
          <a href="/heming" style={{
            display: 'block',
            textDecoration: 'none',
            color: 'inherit',
            padding: '28px 24px',
            border: '1px solid rgba(212,168,67,0.55)',
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(35,57,91,0.85), rgba(9,22,42,0.95))',
            boxShadow: '0 12px 35px rgba(0,0,0,0.25)'
          }}>
            <div style={{
              color: '#d4a843',
              fontSize: 12,
              letterSpacing: 3,
              marginBottom: 15
            }}>
              02 · RELATIONSHIP
            </div>

            <div style={{
              fontSize: 25,
              color: '#f0d48d',
              fontWeight: 'bold',
              marginBottom: 13
            }}>
              双人合盘
            </div>

            <div style={{
              color: '#bdc8d8',
              fontSize: 13,
              lineHeight: 2
            }}>
              输入两个人的出生信息
              <br />
              分析双方命宫、夫妻宫、星曜组合与四化互动
            </div>

            <div style={{
              marginTop: 22,
              color: '#d4a843',
              fontSize: 13
            }}>
              进入双人合盘　→
            </div>
          </a>
        </section>

        <footer style={{
          textAlign: 'center',
          marginTop: 65,
          borderTop: '1px solid rgba(212,168,67,0.18)',
          paddingTop: 25
        }}>
          <div style={{
            color: '#b99754',
            fontSize: 12,
            letterSpacing: 3,
            marginBottom: 12
          }}>
            紫微趣测 AI
          </div>

          <div style={{
            color: '#78879d',
            fontSize: 11,
            lineHeight: 2
          }}>
            传统文化研究与个人成长参考
            <br />
            命运仅供参考，人生由自己创造
          </div>
        </footer>

      </div>
    </main>
  );
}

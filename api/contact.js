// 홈페이지 문의 폼 → Resend로 start@sheventures.kr에 메일 발송
// 버셀 환경변수: RESEND_API_KEY (필수), CONTACT_TO / CONTACT_FROM (선택)

const TYPES = ['기관 프로그램', '컨설팅·자문', '파운더스랩', '기타'];

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: '허용되지 않은 요청입니다.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // 스팸 방지용 숨은 칸: 사람이 보면 비어 있어야 함
  if (body.website) return res.status(200).json({ ok: true });

  const org = String(body.org || '').trim().slice(0, 100);
  const name = String(body.name || '').trim().slice(0, 50);
  const email = String(body.email || '').trim().slice(0, 120);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const type = TYPES.includes(body.type) ? body.type : '기타';
  const message = String(body.message || '').trim().slice(0, 3000);
  const agree = body.agree === true || body.agree === 'on' || body.agree === 'true';

  if (!org || !name || !email || !message) return res.status(400).json({ ok: false, error: '필수 항목을 모두 입력해 주세요.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: '이메일 주소를 다시 확인해 주세요.' });
  if (!agree) return res.status(400).json({ ok: false, error: '개인정보 수집·이용에 동의해 주세요.' });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: '메일 발송 설정이 아직 완료되지 않았습니다.' });

  const to = process.env.CONTACT_TO || 'start@sheventures.kr';
  const from = process.env.CONTACT_FROM || '쉬벤처스 홈페이지 <noreply@sheventures.kr>';

  const rows = [['기관·회사명', org], ['담당자', name], ['이메일', email], ['연락처', phone || '-'], ['문의 유형', type]];
  const html = `
    <div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#4B332A;line-height:1.6">
      <h2 style="margin:0 0 16px;font-size:18px">홈페이지 문의가 들어왔어요</h2>
      <table style="border-collapse:collapse;font-size:14px">
        ${rows.map(([k, v]) => `<tr><td style="padding:6px 16px 6px 0;color:#5D534E;white-space:nowrap">${k}</td><td style="padding:6px 0"><b>${esc(v)}</b></td></tr>`).join('')}
      </table>
      <div style="margin-top:18px;padding:16px;background:#F1ECE5;border-radius:8px;font-size:14px;white-space:pre-wrap">${esc(message)}</div>
      <p style="margin-top:18px;font-size:12px;color:#5D534E">이 메일에 바로 회신하면 ${esc(email)}로 답장이 갑니다.</p>
    </div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\n${message}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], reply_to: email,
        subject: `[홈페이지 문의] ${org} · ${type}`,
        html, text,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend error', r.status, detail);
      return res.status(502).json({ ok: false, error: '메일 발송 중 문제가 생겼습니다.' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ ok: false, error: '메일 발송 중 문제가 생겼습니다.' });
  }
};

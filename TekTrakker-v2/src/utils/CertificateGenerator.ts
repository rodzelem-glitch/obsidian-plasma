import type { TekTrakkerAward } from '../data/awardBadgesData';

export function openPrintableCertificate(award: TekTrakkerAward): void {
  const windowUrl = typeof window !== 'undefined' ? window.location.origin : 'https://tektrakker.com';
  const verifyUrl = `${windowUrl}/#/awards/verify/${award.id}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`;

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) {
    alert('Please allow popups to generate your Certificate of Excellence.');
    return;
  }

  const certificateHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TekTrakker Certificate of Excellence - ${award.orgName}</title>
  <style>
    @page { size: landscape; margin: 0; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Georgia', 'Times New Roman', serif;
      background-color: #0F172A;
      color: #F8FAFC;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      -webkit-print-color-adjust: exact;
    }
    .cert-frame {
      width: 1020px;
      height: 720px;
      background: linear-gradient(135deg, #0B132B 0%, #1C2541 100%);
      border: 16px solid #D4AF37;
      box-shadow: inset 0 0 40px rgba(212, 175, 55, 0.4), 0 20px 50px rgba(0,0,0,0.8);
      position: relative;
      box-sizing: border-box;
      padding: 40px 60px;
      text-align: center;
    }
    .inner-border {
      border: 2px stroke #F3C649;
      outline: 2px dashed rgba(243, 198, 73, 0.5);
      outline-offset: -12px;
      height: 100%;
      box-sizing: border-box;
      padding: 30px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
    }
    .header-seal {
      font-size: 14px;
      letter-spacing: 4px;
      color: #F3C649;
      text-transform: uppercase;
      font-family: 'Arial', sans-serif;
      font-weight: 800;
    }
    .main-title {
      font-size: 38px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 10px 0 5px 0;
      text-transform: uppercase;
      letter-spacing: 2px;
      background: linear-gradient(to right, #FFF8DB, #F3C649, #B8860B);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      font-size: 16px;
      color: #94A3B8;
      font-style: italic;
    }
    .presented-to {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 3px;
      color: #CBD5E1;
      margin-top: 15px;
      font-family: 'Arial', sans-serif;
    }
    .org-name {
      font-size: 36px;
      font-weight: bold;
      color: #F3C649;
      margin: 8px 0;
      border-bottom: 2px solid rgba(243, 198, 73, 0.4);
      display: inline-block;
      padding-bottom: 6px;
    }
    .award-category {
      font-size: 22px;
      font-weight: 600;
      color: #E2E8F0;
      margin: 10px 0;
    }
    .metrics-summary {
      display: flex;
      gap: 30px;
      justify-content: center;
      margin: 15px 0;
      font-family: 'Arial', sans-serif;
    }
    .metric-pill {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(243, 198, 73, 0.3);
      padding: 8px 18px;
      border-radius: 20px;
    }
    .metric-pill span {
      color: #F3C649;
      font-weight: bold;
    }
    .footer-signatures {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      margin-top: 15px;
    }
    .sig-block {
      text-align: center;
      font-family: 'Arial', sans-serif;
    }
    .sig-line {
      width: 180px;
      border-bottom: 1px solid #94A3B8;
      margin-bottom: 6px;
      font-family: 'Brush Script MT', cursive, sans-serif;
      font-size: 24px;
      color: #F3C649;
    }
    .sig-title {
      font-size: 11px;
      color: #94A3B8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .qr-block {
      text-align: center;
    }
    .qr-block img {
      border: 3px solid #F3C649;
      border-radius: 8px;
    }
    .verify-text {
      font-size: 9px;
      color: #64748B;
      font-family: 'Arial', sans-serif;
      margin-top: 4px;
    }
    @media print {
      body { background: none; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="position: fixed; top: 20px; right: 20px; z-index: 9999;">
    <button onclick="window.print()" style="background: #F3C649; color: #000; font-weight: bold; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
      🖨️ Print / Save PDF Certificate
    </button>
  </div>

  <div class="cert-frame">
    <div class="inner-border">
      <div>
        <div class="header-seal">★ TekTrakker Official Business Excellence Rating ★</div>
        <div class="main-title">Certificate of Excellence</div>
        <div class="subtitle">Issued by TekTrakker Verified Business Awards Committee</div>
      </div>

      <div>
        <div class="presented-to">This Certificate is Proudly Awarded To</div>
        <div class="org-name">${award.orgName}</div>
        <div class="award-category">For Outstanding Performance in ${award.category}</div>
      </div>

      <div class="metrics-summary">
        <div class="metric-pill">Overall Score: <span>${award.overallScore.toFixed(1)} / 100</span></div>
        <div class="metric-pill">Industry Rank: <span>${award.percentile}</span></div>
        <div class="metric-pill">Verified Reviews: <span>${award.starRating} ★ (${award.reviewCount} Reviews)</span></div>
      </div>

      <div class="footer-signatures">
        <div class="sig-block">
          <div class="sig-line">Roderick Macdonell</div>
          <div class="sig-title">Chairperson, Awards Committee</div>
        </div>

        <div class="qr-block">
          <img src="${qrCodeUrl}" width="85" height="85" alt="Scan to Verify" />
          <div class="verify-text">Code: ${award.verificationCode}<br/>Scan to Verify Authenticity</div>
        </div>

        <div class="sig-block">
          <div class="sig-line">TekTrakker Audit Team</div>
          <div class="sig-title">Verified Issue Date: ${award.issuedDate}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;

  printWindow.document.write(certificateHtml);
  printWindow.document.close();
}

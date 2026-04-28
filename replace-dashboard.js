const fs = require('fs');
const path = './firebase-react/apps/user-web/src/App.tsx';
let code = fs.readFileSync(path, 'utf8');

// Find the start of the return statement
const returnStart = code.indexOf('return (\n    <div className="min-h-screen');
// Find the end
const returnEnd = code.indexOf('</Suspense>\n    </div>\n  );') + '</Suspense>\n    </div>\n  );'.length;

if (returnStart === -1 || returnEnd === -1) {
  console.log('Could not find return block');
  process.exit(1);
}

const newReturn = `return (
    <div className="dash-root">
      <div className="dash-container">
        
        {/* Header */}
        <header className="dash-header">
          <h1 className="dash-title">AgentRegi</h1>
          <div className="dash-nav">
            <span>{t('auth_load')}</span>
            <button onClick={() => i18n.changeLanguage('ko')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('ko') ? 600 : 400, color: i18n.language?.startsWith('ko') ? 'var(--text-primary)' : '' }}>KO</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={() => i18n.changeLanguage('en')} className="dash-nav-btn" style={{ fontWeight: i18n.language?.startsWith('en') ? 600 : 400, color: i18n.language?.startsWith('en') ? 'var(--text-primary)' : '' }}>EN</button>
            <span style={{color: 'var(--border-strong)'}}>·</span>
            <button onClick={handleLogout} className="dash-nav-btn">로그아웃</button>
          </div>
        </header>

        {log && (
          <div className="wc-log wc-log--neutral" style={{ marginBottom: '2rem' }}>
            {log}
          </div>
        )}

        {token && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5rem' }}>
            
            {/* Action Section */}
            <section className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">신규 의뢰 시작</h2>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  value={funnelIntent} 
                  onChange={e => setFunnelIntent(e.target.value)} 
                  placeholder={t('funnel_placeholder')} 
                  className="dash-input"
                />
                <button onClick={startFunnel} disabled={busy || !funnelIntent} className="dash-button" style={{ whiteSpace: 'nowrap' }}>
                  {t('funnel_start')}
                </button>
              </div>

              {funnelSessionId && currentQuestion && (
                <div className="dash-card" style={{ marginTop: '1.5rem' }}>
                  <h3 className="dash-card-title" style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>{currentQuestion.text}</h3>
                  {currentQuestion.type === "single_choice" && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      {currentQuestion.options.map((opt) => (
                        <button 
                          key={opt} 
                          onClick={() => { setFunnelAnswer(opt); submitFunnelAnswer(); }} 
                          disabled={busy} 
                          className="dash-button dash-button--outline"
                          style={funnelAnswer === opt ? { backgroundColor: 'var(--surface)', borderColor: 'var(--text-primary)' } : {}}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentQuestion.type === "number" && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <input type="number" value={funnelAnswer} onChange={e => setFunnelAnswer(e.target.value)} className="dash-input" style={{ width: '150px' }} />
                      <button onClick={submitFunnelAnswer} disabled={busy || !funnelAnswer} className="dash-button">다음</button>
                    </div>
                  )}
                </div>
              )}

              {funnelPreview && !funnelResults && (
                <div className="dash-card" style={{ marginTop: '1.5rem', backgroundColor: 'var(--brand-faint)' }}>
                  <h4 className="dash-card-title" style={{ fontSize: '1rem' }}>가치 프리뷰</h4>
                  <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
                    <div>
                      <span className="dash-label">예상 비용</span>
                      <div className="dash-value" style={{ marginBottom: 0 }}>{funnelPreview.minPrice.toLocaleString()}원 ~ {funnelPreview.maxPrice.toLocaleString()}원</div>
                    </div>
                    <div>
                      <span className="dash-label">소요 시간</span>
                      <div className="dash-value" style={{ marginBottom: 0 }}>{funnelPreview.etaDays}일</div>
                    </div>
                  </div>
                </div>
              )}

              {funnelResults && (
                <div className="dash-card" style={{ marginTop: '1.5rem' }}>
                  <h3 className="dash-card-title">매칭 결과</h3>
                  
                  {funnelResults.recommended && (
                    <div style={{ marginTop: '2rem' }}>
                      <span className="dash-label" style={{ color: 'var(--brand)' }}>추천 파트너</span>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', border: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>{funnelResults.recommended.name}</div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            예상 가격: {funnelResults.recommended.price?.toLocaleString()}원 · ETA: {funnelResults.recommended.etaHours}시간
                          </div>
                        </div>
                        <button onClick={() => createSubmissionFromFunnel(funnelResults.recommended.partnerId)} disabled={busy} className="dash-button">
                          선택
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* List Section */}
            <section className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">{t('my_submissions')}</h2>
                <button onClick={loadSubmissions} disabled={busy} className="dash-nav-btn" style={{ fontSize: '0.875rem' }}>{t('refresh')}</button>
              </div>

              {submissions.length === 0 ? (
                <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>
                  {t('empty_submissions')}
                </div>
              ) : (
                <div>
                  {submissions.map(s => (
                    <div key={s.id} className="dash-item" onClick={() => loadSubDetail(s.id)} style={{ cursor: 'pointer' }}>
                      <div className="dash-item-header">
                        <div className="dash-item-title" style={{ color: selectedSub?.id === s.id ? 'var(--brand)' : 'var(--text-primary)' }}>{s.input?.type || '알 수 없는 유형'}</div>
                        <div className={\`dash-item-status \${["failed", "cancelled"].includes(s.status) ? "dash-item-status--error" : ""}\`}>
                          {statusText[s.status] || s.status.toUpperCase()}
                        </div>
                      </div>
                      <div className="dash-item-meta">
                        {new Date(s.updatedAt).toLocaleString()} · ID: {s.id.slice(0,8)}...
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Detail Section */}
            {selectedSub && (
              <section className="dash-section">
                <div className="dash-section-header">
                  <h2 className="dash-section-title">상세 정보</h2>
                  <button onClick={() => loadSubDetail(selectedSub.id)} disabled={busy} className="dash-nav-btn" style={{ fontSize: '0.875rem' }}>새로고침</button>
                </div>

                <div className="dash-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                    <div>
                      <h3 className="dash-title" style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{selectedSub.input?.type}</h3>
                      <div className="dash-item-meta">ID: {selectedSub.id}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className={\`dash-item-status \${["failed", "cancelled"].includes(selectedSub.status) ? "dash-item-status--error" : ""}\`} style={{ fontSize: '0.875rem' }}>
                        {statusText[selectedSub.status] || selectedSub.status.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {selectedSub.status === "draft" && (
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                      <button onClick={() => submitSubmission(selectedSub.id)} disabled={busy} className="dash-button">제출하기</button>
                      <button onClick={() => cancelSubmission(selectedSub.id)} disabled={busy} className="dash-button dash-button--outline">취소</button>
                    </div>
                  )}

                  {/* Quotes */}
                  {quotes.length > 0 && (
                    <div style={{ marginTop: '3rem' }}>
                      <span className="dash-label">견적 제안</span>
                      {quotes.map(q => (
                        <div key={q.id} style={{ padding: '1.5rem', border: '1px solid var(--border)', marginTop: '1rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ fontWeight: 600 }}>{q.priceMin.toLocaleString()} ~ {q.priceMax.toLocaleString()} 원</div>
                            <div className="dash-item-status">{q.status}</div>
                          </div>
                          {q.assumptionsKo && (
                            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {q.assumptionsKo.map((asm, idx) => <li key={idx}>{asm}</li>)}
                            </ul>
                          )}
                          {q.status === "finalized" && (
                            <button onClick={() => acceptQuote(q.id)} disabled={busy} className="dash-button" style={{ marginTop: '1.5rem', width: '100%' }}>견적 동의 및 결제</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Timeline */}
                  {events.length > 0 && (
                    <div style={{ marginTop: '3rem' }}>
                      <span className="dash-label">진행 내역</span>
                      <div style={{ marginTop: '1rem' }}>
                        {events.map(ev => (
                          <div key={ev.id} style={{ padding: '1rem 0', borderTop: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{new Date(ev.createdAt).toLocaleString()}</div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{ev.type.toUpperCase()}</div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ev.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        <FloatingChatWidget token={token} />
      </Suspense>
      <Suspense fallback={null}>
        {showTossModal && payment && (
          <TossPaymentModal
            clientKey={payment.clientKey || ""}
            customerKey={user?.uid || "anonymous"}
            amount={payment.amount}
            orderId={payment.id}
            orderName={\`결제건 \${payment.id}\`}
            successUrl={\`\${window.location.origin}\${window.location.pathname}?tossSuccess=true&paymentId=\${payment.id}&paymentKey={PAYMENT_KEY}&orderId={ORDER_ID}&amount={AMOUNT}\`}
            failUrl={\`\${window.location.origin}\${window.location.pathname}?tossFail=true&paymentId=\${payment.id}\`}
            onClose={() => { setShowTossModal(false); setBusy(false); }}
            onError={(err) => { setLog(\`[Error] 결제 오류: \${err.message || err}\`); setShowTossModal(false); setBusy(false); }}
          />
        )}
      </Suspense>
    </div>
  );`;

code = code.substring(0, returnStart) + newReturn + code.substring(returnEnd);
fs.writeFileSync(path, code);

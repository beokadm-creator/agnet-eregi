import React, { useState, useEffect, useRef } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
}

interface FloatingChatWidgetProps {
  token: string;
}

import { Button, Input } from "@agentregi/ui-components";

export default function FloatingChatWidget({ token }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 메시지 업데이트 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 위젯이 열릴 때 세션 초기화 또는 기존 세션 불러오기
  useEffect(() => {
    if (isOpen && token && !sessionId) {
      initSession();
    }
  }, [isOpen, token, sessionId]);

  const apiFetch = async (path: string, method: string = 'GET', body?: any) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    const res = await fetch(`${apiUrl}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.messageKo || data.error?.code || 'API Error');
    return data.data;
  };

  const initSession = async () => {
    try {
      setIsLoading(true);
      // 1. 활성화된 기존 세션 조회
      const sessions = await apiFetch('/v1/chatbot/sessions');
      if (sessions && sessions.length > 0) {
        const currentSession = sessions[0];
        setSessionId(currentSession.id);
        
        // 2. 세션의 메시지 기록 불러오기
        const history = await apiFetch(`/v1/chatbot/sessions/${currentSession.id}/messages`);
        setMessages(history.map((m: any) => ({
          id: m.id || Math.random().toString(36).substring(2, 9),
          role: m.role,
          content: m.content
        })));
      } else {
        // 3. 기존 세션이 없다면 새로 생성
        const newSession = await apiFetch('/v1/chatbot/sessions', 'POST', { title: '새로운 대화' });
        setSessionId(newSession.id);
        setMessages([{
          id: 'welcome',
          role: 'model',
          content: '안녕하세요! 무엇을 도와드릴까요?'
        }]);
      }
    } catch (error: any) {
      console.error('Failed to init session:', error);
      setMessages([{ id: 'err', role: 'system', content: `세션을 불러오는 중 오류가 발생했습니다: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !sessionId || !token) return;

    const userMessage: Message = {
      id: Math.random().toString(36).substring(2, 9),
      role: 'user',
      content: inputValue.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 챗봇 워커에 메시지 전송 및 응답 대기
      const response = await apiFetch(`/v1/chatbot/sessions/${sessionId}/messages`, 'POST', {
        content: userMessage.content
      });
      
      const assistantMessage: Message = {
        id: response.id || Math.random().toString(36).substring(2, 9),
        role: response.role || 'model',
        content: response.content || '응답을 받지 못했습니다.'
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        role: 'system',
        content: `오류가 발생했습니다: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  // 토큰(로그인)이 없으면 위젯을 렌더링하지 않음
  if (!token) return null;

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, fontFamily: 'sans-serif' }}>
      {isOpen ? (
        <div style={{
          width: 350,
          height: 500,
          backgroundColor: '#fff',
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{
            backgroundColor: '#3f51b5',
            color: '#fff',
            padding: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1em' }}>AI 챗봇 어시스턴트</h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '1.2em'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: '#f9f9f9'
          }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                backgroundColor: msg.role === 'user' ? '#3f51b5' : (msg.role === 'system' ? '#ffebee' : '#fff'),
                color: msg.role === 'user' ? '#fff' : (msg.role === 'system' ? '#c62828' : '#333'),
                padding: '10px 14px',
                borderRadius: '12px',
                border: msg.role === 'model' ? '1px solid #e0e0e0' : 'none',
                fontSize: '0.9em',
                lineHeight: '1.4',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            ))}
            {isLoading && (
              <div style={{
                alignSelf: 'flex-start',
                backgroundColor: '#fff',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                fontSize: '0.9em',
                color: '#666'
              }}>
                입력 중...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: '12px',
            borderTop: '1px solid #eee',
            display: 'flex',
            gap: '8px',
            backgroundColor: '#fff'
          }}>
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="메시지를 입력하세요..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '20px',
                border: '1px solid #ccc',
                outline: 'none',
                fontSize: '0.9em'
              }}
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputValue.trim()}
              style={{
                backgroundColor: inputValue.trim() && !isLoading ? '#3f51b5' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '20px',
                padding: '0 16px',
                cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                fontWeight: 'bold'
              }}
            >
              전송
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: 60,
            height: 60,
            borderRadius: '30px',
            backgroundColor: '#3f51b5',
            color: '#fff',
            border: 'none',
            boxShadow: '0 4px 12px rgba(63, 81, 181, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            fontSize: '24px'
          }}
        >
          💬
        </button>
      )}
    </div>
  );
}
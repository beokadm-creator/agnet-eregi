import React, { useEffect, useRef, useState } from "react";
import { loadPaymentWidget, PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";

interface TossPaymentModalProps {
  clientKey: string;
  customerKey: string;
  amount: number;
  currency?: string;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  failUrl: string;
  onClose: () => void;
  onError: (error: any) => void;
}

export default function TossPaymentModal({
  clientKey,
  customerKey,
  amount,
  currency = "KRW",
  orderId,
  orderName,
  customerEmail,
  customerName,
  successUrl,
  failUrl,
  onClose,
  onError
}: TossPaymentModalProps) {
  const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // 결제 위젯 SDK 초기화
        const paymentWidget = await loadPaymentWidget(clientKey, customerKey);
        paymentWidgetRef.current = paymentWidget;

        // 결제수단 위젯 렌더링
        paymentWidget.renderPaymentMethods(
          "#payment-widget",
          { value: amount, currency: currency as "KRW" | "USD" },
          { variantKey: "DEFAULT" }
        );

        // 이용약관 위젯 렌더링
        paymentWidget.renderAgreement(
          "#agreement",
          { variantKey: "AGREEMENT" }
        );

        setIsLoaded(true);
      } catch (error) {
        console.error("Toss Payment Widget Load Error:", error);
        onError(error);
      }
    })();
  }, [clientKey, customerKey, amount, currency, onError]);

  const handlePaymentRequest = async () => {
    const paymentWidget = paymentWidgetRef.current;
    if (!paymentWidget) return;

    try {
      await paymentWidget.requestPayment({
        orderId,
        orderName,
        customerName,
        customerEmail,
        successUrl,
        failUrl,
      });
    } catch (error) {
      console.error("Toss Payment Request Error:", error);
      onError(error);
    }
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
      backgroundColor: "rgba(0,0,0,0.6)",
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 9999,
      backdropFilter: "blur(2px)"
    }}>
      <div style={{
        backgroundColor: "white", padding: "24px", borderRadius: "12px",
        width: "90%", maxWidth: "500px", maxHeight: "90vh",
        overflowY: "auto", position: "relative",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
      }}>
        <button 
          onClick={onClose}
          style={{ 
            position: "absolute", top: "12px", right: "16px", 
            background: "none", border: "none", fontSize: "20px", 
            color: "#666", cursor: "pointer", padding: "4px" 
          }}
        >
          ✕
        </button>
        
        <h2 style={{ margin: "0 0 16px 0", color: "#333", fontSize: "1.2em" }}>결제 진행</h2>
        
        {!isLoaded && (
          <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
            결제 모듈을 불러오는 중입니다...
          </div>
        )}

        <div id="payment-widget" style={{ minHeight: "200px" }} />
        <div id="agreement" style={{ marginTop: "16px" }} />
        
        <button 
          onClick={handlePaymentRequest}
          disabled={!isLoaded}
          style={{
            width: "100%", padding: "16px", marginTop: "24px",
            backgroundColor: isLoaded ? "#3182f6" : "#b0bec5", 
            color: "white", border: "none",
            borderRadius: "8px", fontSize: "16px", cursor: isLoaded ? "pointer" : "not-allowed", 
            fontWeight: "bold", transition: "background-color 0.2s"
          }}
        >
          {amount.toLocaleString()}원 결제하기
        </button>
      </div>
    </div>
  );
}
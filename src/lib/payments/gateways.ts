import type { CheckoutCurrency, CheckoutProvider } from "@/lib/db/types";

export type GatewayAttempt = {
  provider: CheckoutProvider;
  status: "initiated" | "queued" | "failed";
  note: string;
  stripeSessionId: string | null;
  mpesaReceipt: string | null;
};

function mpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY,
  );
}

function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function darajaBase(): string {
  return process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function timestampNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function msisdn(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length >= 12) return digits.slice(0, 12);
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

async function tryMpesaStk(input: {
  amountKes: number;
  phone: string;
  reference: string;
  detail: string;
}): Promise<GatewayAttempt> {
  if (!mpesaConfigured()) {
    return {
      provider: "queued",
      status: "queued",
      note: "M-Pesa STK queued — Daraja credentials are not configured on this Worker.",
      stripeSessionId: null,
      mpesaReceipt: null,
    };
  }
  const key = process.env.MPESA_CONSUMER_KEY as string;
  const secret = process.env.MPESA_CONSUMER_SECRET as string;
  const shortcode = process.env.MPESA_SHORTCODE as string;
  const passkey = process.env.MPESA_PASSKEY as string;
  const callback =
    process.env.MPESA_CALLBACK_URL ||
    "https://shambatrust.mikeal-murphy.workers.dev/api/payments/mpesa-callback";
  try {
    const tokenRes = await fetch(
      `${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${btoa(`${key}:${secret}`)}`,
        },
      },
    );
    if (!tokenRes.ok) {
      return {
        provider: "mpesa",
        status: "failed",
        note: `Daraja token HTTP ${tokenRes.status}`,
        stripeSessionId: null,
        mpesaReceipt: null,
      };
    }
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const token = tokenJson.access_token;
    if (!token) {
      return {
        provider: "mpesa",
        status: "failed",
        note: "Daraja token missing access_token",
        stripeSessionId: null,
        mpesaReceipt: null,
      };
    }
    const ts = timestampNow();
    const password = btoa(`${shortcode}${passkey}${ts}`);
    const stkRes = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.max(1, Math.round(input.amountKes)),
        PartyA: msisdn(input.phone),
        PartyB: shortcode,
        PhoneNumber: msisdn(input.phone),
        CallBackURL: callback,
        AccountReference: input.reference.slice(0, 12),
        TransactionDesc: input.detail.slice(0, 13) || "ShambaTrust",
      }),
    });
    if (!stkRes.ok) {
      return {
        provider: "mpesa",
        status: "failed",
        note: `STK HTTP ${stkRes.status}`,
        stripeSessionId: null,
        mpesaReceipt: null,
      };
    }
    return {
      provider: "mpesa",
      status: "initiated",
      note: "M-Pesa STK Push sent. Confirm on the handset, then ops will mark paid.",
      stripeSessionId: null,
      mpesaReceipt: null,
    };
  } catch {
    return {
      provider: "mpesa",
      status: "failed",
      note: "M-Pesa network error — checkout was recorded as queued.",
      stripeSessionId: null,
      mpesaReceipt: null,
    };
  }
}

async function tryStripeIntent(input: {
  amount: number;
  currency: CheckoutCurrency;
  reference: string;
  detail: string;
}): Promise<GatewayAttempt> {
  if (!stripeConfigured()) {
    return {
      provider: "queued",
      status: "queued",
      note: "Stripe checkout queued — STRIPE_SECRET_KEY is not configured on this Worker.",
      stripeSessionId: null,
      mpesaReceipt: null,
    };
  }
  const secret = process.env.STRIPE_SECRET_KEY as string;
  const cents = Math.max(50, Math.round(input.amount * 100));
  try {
    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(cents),
        currency: input.currency.toLowerCase(),
        description: input.detail.slice(0, 1000),
        "metadata[reference]": input.reference,
      }),
    });
    if (!res.ok) {
      return {
        provider: "stripe",
        status: "failed",
        note: `Stripe HTTP ${res.status}`,
        stripeSessionId: null,
        mpesaReceipt: null,
      };
    }
    const json = (await res.json()) as { id?: string };
    return {
      provider: "stripe",
      status: "initiated",
      note: "Stripe PaymentIntent created. Complete card payment, then ops will mark paid.",
      stripeSessionId: json.id || null,
      mpesaReceipt: null,
    };
  } catch {
    return {
      provider: "stripe",
      status: "failed",
      note: "Stripe network error — checkout was recorded as queued.",
      stripeSessionId: null,
      mpesaReceipt: null,
    };
  }
}

/**
 * Attempt a live gateway when secrets exist. Failures never throw —
 * the checkout row is always persisted by the caller.
 */
export async function attemptCheckoutGateway(input: {
  currency: CheckoutCurrency;
  amount: number;
  amountKes: number;
  phone: string;
  reference: string;
  detail: string;
}): Promise<GatewayAttempt> {
  if (input.currency === "KES") {
    return tryMpesaStk({
      amountKes: input.amountKes,
      phone: input.phone,
      reference: input.reference,
      detail: input.detail,
    });
  }
  return tryStripeIntent({
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    detail: input.detail,
  });
}

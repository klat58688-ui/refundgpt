# Demo Video Script — RefundGPT (final cut 2:16)

**Shipped file:** `refundgpt-demo-1080p.mp4` (1920×1080, 2:16, burned-in captions, silent) + `refundgpt-demo.srt` (editable captions).

Silent by design: judges often watch muted, and captions survive any player. Voiceover text is below if you want to record it in your own voice (TTS was blocked by the provider, so no synthetic voice was used).

## What was cut from the 3:35 raw recording

| Raw range | Reason |
|---|---|
| 0:06 – 1:14 | dashboard idle while the LLM call ran (spinner only) |
| 2:28 – 2:43 | approved-state idle before the PayPal execution |

Result: 3:35 → 2:16, all real product footage, no speed-up tricks.

## Caption timeline (as burned in)

| Time | Caption |
|---|---|
| 0:00 | Refund requests: read the message, check the order, decide, refund — twenty times a day. |
| 0:08 | RefundGPT. Paste the conversation and the PayPal Capture ID. |
| 0:15 | The AI extracts the order, amount, claims and evidence, matches your refund policy, |
| 0:25 | and recommends an action with a confidence score — plus the reasoning, so you can disagree. |
| 0:50 | You stay the decision maker. Approve, change the amount, or reject. |
| 1:12 | Before money moves, it verifies the PayPal capture and checks the amount against it. |
| 1:20 | Then it refunds through the PayPal Refund API with an idempotency key — no double refunds. |
| 1:52 | That is a real sandbox refund, executed live — Refund ID visible in the receipt. |
| 2:07 | Every case lands in an AG Grid operations view, backed by an audit trail. |
| 2:12 | RefundGPT — the AI does the reading and the PayPal call. You keep the judgment. |

## Voiceover text (record in your own voice if desired)

1. (0:00) "Every small e-commerce team drowns in refund requests. Someone reads the message, checks the order, guesses whether the story adds up — twenty times a day."
2. (0:08) "This is RefundGPT. Paste the conversation and the PayPal capture ID."
3. (0:15) "It extracts the order, the amount, the claims and the evidence, matches your refund policy, and recommends an action — with a confidence score and the reasoning, so you can disagree with it."
4. (0:50) "You stay the decision maker. Approve, change the amount, or reject."
5. (1:12) "Before money moves, it verifies the PayPal capture and checks the amount against it. Then it refunds through the PayPal Refund API with an idempotency key, so a double click can never refund twice."
6. (1:52) "That's a real sandbox refund, executed live."
7. (2:07) "Every case lands in an AG Grid operations view, backed by an audit trail."
8. (2:12) "RefundGPT — the AI does the reading and the PayPal call. You keep the judgment."

## Upload checklist

- [ ] Upload `refundgpt-demo-1080p.mp4` to YouTube as **Public**
- [ ] Title: "RefundGPT — AI refund analyst for PayPal (Hackathon demo)"
- [ ] Description: repo link + one-line pitch + "PayPal sandbox demo"
- [ ] Paste the YouTube URL into the Devpost form
- [ ] Do **not** add licensed music — the hackathon forbids it


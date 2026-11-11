const nodemailer = require("nodemailer");

let transporter;
const configured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

// Never throws: email problems must not break an order or payment.
const sendMail = async ({ to, subject, html }) => {
  if (!to) return false;
  if (!configured()) {
    console.log(`[email skipped - SMTP not configured] to=${to} subject="${subject}"`);
    return false;
  }
  try {
    await getTransporter().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
    return true;
  } catch (err) {
    console.error("Email failed:", err.message);
    return false;
  }
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => `$${Number(n).toFixed(2)}`;

const COPY = {
  paid: { subject: "Payment received", headline: "Thank you - your payment was received", note: "Your order is confirmed." },
  cod: { subject: "Order placed", headline: "Your order is placed", note: "Please pay in cash when your order arrives." },
  shipped: { subject: "Your order has shipped", headline: "Your order is on its way", note: "" },
  delivered: { subject: "Your order was delivered", headline: "Your order was delivered", note: "We hope you enjoy it." },
  cancelled: { subject: "Your order was cancelled", headline: "Your order was cancelled", note: "If you paid, contact us about a refund." },
};

const buildOrderEmail = (order, kind) => {
  const c = COPY[kind];
  const rows = order.items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} x ${i.quantity}</td><td style="text-align:right">${money(i.price * i.quantity)}</td></tr>`)
    .join("");
  const ref = String(order._id).slice(-8);
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172523">
    <h2 style="margin-bottom:4px">${esc(c.headline)}</h2>
    <p style="margin-top:0;color:#4b5c59">Order #${esc(ref)}</p>
    <table style="width:100%;border-collapse:collapse">${rows}
      <tr><td style="padding-top:10px;border-top:1px solid #dfe6e4"><strong>Total</strong></td>
      <td style="text-align:right;border-top:1px solid #dfe6e4"><strong>${money(order.totalAmount)}</strong></td></tr>
    </table>
    ${order.transactionId ? `<p style="color:#4b5c59">Transaction ID: ${esc(order.transactionId)}</p>` : ""}
    <p>${esc(c.note)}</p></div>`;
  return { subject: `${c.subject} - order #${ref}`, html };
};

// kind: paid | cod | shipped | delivered | cancelled
const sendOrderEmail = (order, kind) => {
  if (!COPY[kind]) return Promise.resolve(false);
  const { subject, html } = buildOrderEmail(order, kind);
  return sendMail({ to: order.contactEmail, subject, html });
};

module.exports = { sendMail, sendOrderEmail, buildOrderEmail };